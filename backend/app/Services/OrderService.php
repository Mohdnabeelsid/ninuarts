<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemCost;
use App\Models\OrderStatusHistory;
use App\Models\OrderModificationHistory;
use App\Models\Product;
use App\Models\Customer;
use App\Models\ActivityLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Exception;

class OrderService
{
    protected PaymentService $paymentService;

    public function __construct(PaymentService $paymentService)
    {
        $this->paymentService = $paymentService;
    }

    /**
     * Create a new order with multiple line items, optional advance payment, and audit logging.
     */
    public function createOrder(array $data, int $userId): Order
    {
        return DB::transaction(function () use ($data, $userId) {
            // 1. Resolve or create customer
            $customerId = $data['customer_id'] ?? null;
            if (!$customerId && !empty($data['new_customer'])) {
                $newCustData = $data['new_customer'];
                $existing = Customer::where('phone', $newCustData['phone'])->first();
                if ($existing) {
                    $customerId = $existing->id;
                } else {
                    $created = Customer::create([
                        'name' => $newCustData['name'],
                        'phone' => $newCustData['phone'],
                        'email' => $newCustData['email'] ?? null,
                        'source_channel' => $newCustData['source_channel'] ?? 'INSTAGRAM',
                        'city' => $newCustData['city'] ?? 'Alappuzha',
                        'delivery_address' => $newCustData['delivery_address'] ?? null,
                        'notes' => $newCustData['notes'] ?? null,
                        'status' => 'ACTIVE',
                    ]);
                    $customerId = $created->id;
                }
            }

            if (!$customerId) {
                throw new Exception("A valid customer_id or new_customer profile must be provided.");
            }

            // 2. Strict Financial Precision Calculation
            $subtotal = 0.00;
            $itemsData = $data['items'] ?? [];

            if (empty($itemsData)) {
                throw new Exception("Order must contain at least one product line item.");
            }

            foreach ($itemsData as $item) {
                $unitPrice = (float)($item['unit_price'] ?? 0.00);
                $qty = (int)($item['quantity'] ?? 1);
                $subtotal += round($unitPrice * $qty, 2);
            }

            $deliveryCharge = round((float)($data['delivery_charge'] ?? 0.00), 2);
            $discountAmount = round((float)($data['discount_amount'] ?? 0.00), 2);
            $totalAmount = max(0.00, round($subtotal + $deliveryCharge - $discountAmount, 2));
            $advanceRequired = round((float)($data['advance_amount_required'] ?? 0.00), 2);

            $order = Order::create([
                'order_number' => $this->generateOrderNumber(),
                'customer_id' => $customerId,
                'status' => 'DRAFT',
                'payment_status' => 'UNPAID',
                'subtotal_amount' => $subtotal,
                'delivery_charge' => $deliveryCharge,
                'discount_amount' => $discountAmount,
                'total_amount' => $totalAmount,
                'advance_amount_required' => $advanceRequired,
                'total_paid' => 0.00,
                'balance_amount' => $totalAmount,
                'target_delivery_date' => $data['target_delivery_date'] ?? null,
                'internal_notes' => $data['internal_notes'] ?? null,
                'created_by' => $userId,
            ]);

            // 3. Create Order Line Items (Preserving historical price snapshot)
            foreach ($itemsData as $item) {
                $itemUnitPrice = (float)$item['unit_price'];
                $itemQty = (int)($item['quantity'] ?? 1);
                $itemTotal = round($itemUnitPrice * $itemQty, 2);

                $orderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $item['product_id'] ?? null,
                    'item_name' => $item['item_name'],
                    'item_type' => $item['item_type'] ?? 'CUSTOM',
                    'unit_price' => $itemUnitPrice,
                    'quantity' => $itemQty,
                    'total_price' => $itemTotal,
                    'customization_details' => $item['customization_details'] ?? null,
                ]);

                // Direct Costs if supplied
                if (!empty($item['direct_cost'])) {
                    OrderItemCost::create([
                        'order_item_id' => $orderItem->id,
                        'cost_type' => $item['cost_type'] ?? 'RAW_MATERIAL',
                        'amount' => (float)$item['direct_cost'],
                        'description' => $item['cost_description'] ?? null,
                    ]);
                }
            }

            // 4. Initial Status History
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'user_id' => $userId,
                'from_status' => null,
                'to_status' => 'DRAFT',
                'note' => 'Order draft initialized.',
            ]);

            // 5. Optional Initial Advance Payment Recording
            if (!empty($data['advance_payment']) && (float)($data['advance_payment']['amount'] ?? 0) > 0) {
                $paymentPayload = $data['advance_payment'];
                $paymentPayload['payment_type'] = 'ADVANCE';
                $this->paymentService->recordPayment($order, $paymentPayload, $userId);
            }

            // Recalculate balances
            $this->recalculateBalances($order);

            // Audit Log
            ActivityLog::log(
                $userId,
                'ORDER_CREATED',
                'Order',
                $order->id,
                "Created new order {$order->order_number} for customer #{$customerId} with total amount ₹{$order->total_amount}.",
                null,
                $order->toArray()
            );

            return $order->fresh(['customer', 'items.costs', 'payments', 'refunds', 'statusHistory']);
        });
    }

    /**
     * Modify an existing order and preserve complete modification audit trail.
     */
    public function modifyOrder(Order $order, array $data, int $userId, string $reason): Order
    {
        return DB::transaction(function () use ($order, $data, $userId, $reason) {
            if ($order->status === 'CANCELLED') {
                throw new Exception("Cannot modify a cancelled order.");
            }

            // 1. Snapshot previous state
            $previousSnapshot = [
                'subtotal_amount' => (float)$order->subtotal_amount,
                'delivery_charge' => (float)$order->delivery_charge,
                'discount_amount' => (float)$order->discount_amount,
                'total_amount' => (float)$order->total_amount,
                'advance_amount_required' => (float)$order->advance_amount_required,
                'target_delivery_date' => $order->target_delivery_date ? $order->target_delivery_date->toDateString() : null,
                'items' => $order->items->map(function ($it) {
                    return [
                        'item_name' => $it->item_name,
                        'unit_price' => (float)$it->unit_price,
                        'quantity' => $it->quantity,
                        'total_price' => (float)$it->total_price,
                        'customization_details' => $it->customization_details,
                    ];
                })->toArray(),
            ];

            // 2. Compute new totals
            $itemsData = $data['items'] ?? [];
            if (!empty($itemsData)) {
                // Snapshot existing item costs so edits that omit cost fields do not wipe profitability data
                $existingItems = $order->items()->with('costs')->get();
                $costsByProductId = [];
                $costsByItemName = [];
                foreach ($existingItems as $existingItem) {
                    if ($existingItem->costs->isEmpty()) {
                        continue;
                    }
                    $savedCosts = $existingItem->costs->map(fn ($c) => [
                        'cost_type' => $c->cost_type,
                        'amount' => (float)$c->amount,
                        'description' => $c->description,
                    ])->toArray();
                    if ($existingItem->product_id) {
                        $costsByProductId[$existingItem->product_id] = $savedCosts;
                    }
                    $costsByItemName[strtolower(trim($existingItem->item_name))] = $savedCosts;
                }

                // Delete previous items and re-insert
                $order->items()->delete();

                $subtotal = 0.00;
                foreach ($itemsData as $item) {
                    $unitPrice = (float)$item['unit_price'];
                    $qty = (int)($item['quantity'] ?? 1);
                    $itemTotal = round($unitPrice * $qty, 2);
                    $subtotal += $itemTotal;

                    $orderItem = OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $item['product_id'] ?? null,
                        'item_name' => $item['item_name'],
                        'item_type' => $item['item_type'] ?? 'CUSTOM',
                        'unit_price' => $unitPrice,
                        'quantity' => $qty,
                        'total_price' => $itemTotal,
                        'customization_details' => $item['customization_details'] ?? null,
                    ]);

                    if (array_key_exists('direct_cost', $item)) {
                        if (!empty($item['direct_cost']) && (float)$item['direct_cost'] > 0) {
                            OrderItemCost::create([
                                'order_item_id' => $orderItem->id,
                                'cost_type' => $item['cost_type'] ?? 'RAW_MATERIAL',
                                'amount' => (float)$item['direct_cost'],
                                'description' => $item['cost_description'] ?? null,
                            ]);
                        }
                    } else {
                        $nameKey = strtolower(trim($item['item_name']));
                        $fallbackCosts = (!empty($item['product_id']) && isset($costsByProductId[$item['product_id']]))
                            ? $costsByProductId[$item['product_id']]
                            : ($costsByItemName[$nameKey] ?? []);
                        foreach ($fallbackCosts as $savedCost) {
                            OrderItemCost::create([
                                'order_item_id' => $orderItem->id,
                                'cost_type' => $savedCost['cost_type'],
                                'amount' => $savedCost['amount'],
                                'description' => $savedCost['description'],
                            ]);
                        }
                    }
                }
                $order->subtotal_amount = $subtotal;
            }

            if (isset($data['delivery_charge'])) {
                $order->delivery_charge = round((float)$data['delivery_charge'], 2);
            }
            if (isset($data['discount_amount'])) {
                $order->discount_amount = round((float)$data['discount_amount'], 2);
            }
            if (isset($data['advance_amount_required'])) {
                $order->advance_amount_required = round((float)$data['advance_amount_required'], 2);
            }
            if (isset($data['target_delivery_date'])) {
                $order->target_delivery_date = $data['target_delivery_date'];
            }
            if (isset($data['internal_notes'])) {
                $order->internal_notes = $data['internal_notes'];
            }

            $order->total_amount = max(0.00, round((float)$order->subtotal_amount + (float)$order->delivery_charge - (float)$order->discount_amount, 2));

            // Snapshot new state
            $newSnapshot = [
                'subtotal_amount' => (float)$order->subtotal_amount,
                'delivery_charge' => (float)$order->delivery_charge,
                'discount_amount' => (float)$order->discount_amount,
                'total_amount' => (float)$order->total_amount,
                'advance_amount_required' => (float)$order->advance_amount_required,
                'target_delivery_date' => $order->target_delivery_date ? $order->target_delivery_date->toDateString() : null,
                'items' => $order->fresh('items')->items->map(function ($it) {
                    return [
                        'item_name' => $it->item_name,
                        'unit_price' => (float)$it->unit_price,
                        'quantity' => $it->quantity,
                        'total_price' => (float)$it->total_price,
                        'customization_details' => $it->customization_details,
                    ];
                })->toArray(),
            ];

            // 3. Record Order Modification History
            OrderModificationHistory::create([
                'order_id' => $order->id,
                'modified_by' => $userId,
                'previous_values' => $previousSnapshot,
                'new_values' => $newSnapshot,
                'previous_total' => $previousSnapshot['total_amount'],
                'new_total' => $newSnapshot['total_amount'],
                'modification_reason' => $reason,
                'change_summary' => "Total amended from ₹{$previousSnapshot['total_amount']} to ₹{$newSnapshot['total_amount']}. Reason: {$reason}",
            ]);

            // 4. Recalculate balance
            $this->recalculateBalances($order);

            ActivityLog::log(
                $userId,
                'ORDER_MODIFIED',
                'Order',
                $order->id,
                "Modified order {$order->order_number}: ₹{$previousSnapshot['total_amount']} -> ₹{$newSnapshot['total_amount']}. Reason: {$reason}",
                $previousSnapshot,
                $newSnapshot
            );

            return $order->fresh(['customer', 'items.costs', 'payments', 'refunds', 'modificationHistory']);
        });
    }

    /**
     * Update order status with strict lifecycle rules.
     */
    public function updateStatus(Order $order, string $newStatus, int $userId, ?string $note = null): Order
    {
        return DB::transaction(function () use ($order, $newStatus, $userId, $note) {
            $fromStatus = $order->status;
            $newStatus = strtoupper($newStatus);
            if ($newStatus === 'READY') {
                $newStatus = 'READY_FOR_DELIVERY';
            }

            $validStatuses = [
                'DRAFT',
                'PENDING_ADVANCE',
                'CONFIRMED',
                'IN_PROGRESS',
                'READY_FOR_DELIVERY',
                'DISPATCHED',
                'DELIVERED',
                'ON_HOLD',
                'CANCELLED',
            ];

            if (!in_array($newStatus, $validStatuses, true)) {
                throw new Exception("Invalid order status '{$newStatus}'.");
            }

            // CRITICAL BUSINESS RULE 2: Order can ONLY become confirmed after valid advance payment has been recorded!
            if ($newStatus === 'CONFIRMED' && $fromStatus !== 'CONFIRMED') {
                $netPaid = $order->netPaid();
                $advanceRequired = (float)$order->advance_amount_required;

                // Zero advance rejection on confirmation rule:
                // An order must have a valid recorded advance payment to be confirmed
                if ($netPaid <= 0.00 || ($advanceRequired > 0.00 && $netPaid < $advanceRequired)) {
                    throw ValidationException::withMessages([
                        'status' => [
                            "An order can only become CONFIRMED after a valid advance payment has been recorded. " .
                            "(Advance Required: ₹" . number_format($advanceRequired, 2) . ", Net Paid: ₹" . number_format($netPaid, 2) . ")"
                        ],
                    ]);
                }

                $order->confirmed_at = now();
            }

            $order->status = $newStatus;
            $order->save();

            // Record status audit history
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'user_id' => $userId,
                'from_status' => $fromStatus,
                'to_status' => $newStatus,
                'note' => $note ?? "Status updated from {$fromStatus} to {$newStatus}.",
            ]);

            ActivityLog::log(
                $userId,
                'ORDER_STATUS_CHANGED',
                'Order',
                $order->id,
                "Order {$order->order_number} status changed from {$fromStatus} to {$newStatus}." . ($note ? " Note: {$note}" : "")
            );

            return $order->fresh(['customer', 'items', 'payments', 'refunds', 'statusHistory']);
        });
    }

    /**
     * Delete order (Soft delete only; confirmed orders are protected).
     */
    public function deleteOrder(Order $order, int $userId): void
    {
        // CRITICAL BUSINESS RULE 10: Confirmed orders must not be permanently deleted.
        if (!in_array($order->status, ['DRAFT', 'CANCELLED'], true)) {
            throw new Exception("Confirmed, in-progress, or fulfilled orders cannot be deleted. You may cancel the order instead.");
        }

        if ($order->payments()->where('status', 'SUCCESS')->exists()) {
            throw new Exception("Orders with recorded financial transactions cannot be deleted to preserve accounting integrity.");
        }

        ActivityLog::log(
            $userId,
            'ORDER_DELETED',
            'Order',
            $order->id,
            "Soft-deleted draft/cancelled order {$order->order_number}."
        );

        $order->delete();
    }

    /**
     * Recalculate financial balances on an order using decimal precision.
     */
    public function recalculateBalances(Order $order): void
    {
        $totalPaid = (float)$order->payments()->where('status', 'SUCCESS')->sum('amount');
        $totalRefunded = (float)$order->refunds()->where('status', 'COMPLETED')->sum('amount');
        $netPaid = max(0.00, round($totalPaid - $totalRefunded, 2));

        $order->total_paid = $netPaid;
        $order->balance_amount = max(0.00, round((float)$order->total_amount - $netPaid, 2));

        $netPaidStr = number_format($netPaid, 2, '.', '');
        $totalAmountStr = number_format((float)$order->total_amount, 2, '.', '');
        $cmp = bccomp($netPaidStr, $totalAmountStr, 2);

        if ($netPaid <= 0.00) {
            $order->payment_status = 'UNPAID';
        } elseif ($cmp < 0) {
            $order->payment_status = 'PARTIALLY_PAID';
        } elseif ($cmp === 0) {
            $order->payment_status = 'PAID';
        } else {
            $order->payment_status = 'OVERPAID';
        }

        $order->save();
    }

    private function generateOrderNumber(): string
    {
        return 'ORD-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));
    }
}
