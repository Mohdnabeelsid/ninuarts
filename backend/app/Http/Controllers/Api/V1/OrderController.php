<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Exception;

class OrderController extends BaseApiController
{
    /**
     * Display a listing of orders with search and filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Order::with(['customer', 'items', 'payments', 'refunds']);

        if ($status = $request->query('status')) {
            if ($status !== 'ALL') {
                $query->where('status', strtoupper($status));
            }
        }

        if ($paymentStatus = $request->query('payment_status')) {
            if ($paymentStatus !== 'ALL') {
                $query->where('payment_status', strtoupper($paymentStatus));
            }
        }

        if ($customerId = $request->query('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        $periodStart = $request->attributes->get('active_period_start');
        $periodEnd = $request->attributes->get('active_period_end');
        if ($periodStart && $periodEnd && !$request->filled('search') && !$customerId) {
            $query->whereBetween('created_at', [$periodStart, $periodEnd]);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhere('internal_notes', 'like', "%{$search}%")
                  ->orWhereHas('customer', function ($cq) use ($search) {
                      $cq->where('name', 'like', "%{$search}%")
                         ->orWhere('phone', 'like', "%{$search}%")
                         ->orWhere('customer_code', 'like', "%{$search}%");
                  })
                  ->orWhereHas('items', function ($iq) use ($search) {
                      $iq->where('item_name', 'like', "%{$search}%")
                         ->orWhere('customization_details', 'like', "%{$search}%");
                  });
            });
        }

        $orders = $query->latest()->paginate($request->query('per_page', 20));

        return $this->sendResponse($orders->items(), null, 200, [
            'current_page' => $orders->currentPage(),
            'per_page' => $orders->perPage(),
            'total' => $orders->total(),
            'last_page' => $orders->lastPage(),
        ]);
    }

    /**
     * Create a new order with items and optional direct advance payment.
     */
    public function store(Request $request, OrderService $orderService): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'new_customer' => 'nullable|array',
            'new_customer.name' => 'required_with:new_customer|string|max:150',
            'new_customer.phone' => 'required_with:new_customer|string|max:50',
            'new_customer.email' => 'nullable|email|max:150',
            'new_customer.source_channel' => 'nullable|in:INSTAGRAM,WHATSAPP,REFERRAL,DIRECT',
            'new_customer.city' => 'nullable|string|max:100',
            'new_customer.delivery_address' => 'nullable|string',
            'advance_amount_required' => 'nullable|numeric|min:0',
            'delivery_charge' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'target_delivery_date' => 'nullable|date',
            'internal_notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.item_name' => 'required|string|max:200',
            'items.*.item_type' => 'required|in:CATALOG,CUSTOM',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.customization_details' => 'nullable|string',
            'items.*.direct_cost' => 'nullable|numeric|min:0',
            'items.*.cost_type' => 'nullable|in:RAW_MATERIAL,PRINT,FRAME,PACKAGING,OTHER',
            'items.*.cost_description' => 'nullable|string|max:255',
            'advance_payment' => 'nullable|array',
            'advance_payment.amount' => 'required_with:advance_payment|numeric|min:1',
            'advance_payment.payment_method' => 'required_with:advance_payment|in:UPI,BANK_TRANSFER,CASH',
            'advance_payment.transaction_reference' => 'nullable|string|max:150',
            'advance_payment.notes' => 'nullable|string',
        ]);

        if (empty($validated['customer_id']) && empty($validated['new_customer'])) {
            return $this->sendError('Either customer_id or new_customer must be provided.', 422, 'VALIDATION_FAILED');
        }

        try {
            $order = $orderService->createOrder($validated, $request->user()->id);
            return $this->sendResponse($order, "Order {$order->order_number} created successfully.", 201);
        } catch (Exception $e) {
            return $this->sendError($e->getMessage(), 422, 'ORDER_CREATION_FAILED');
        }
    }

    /**
     * Display the specified order with full relationships.
     */
    public function show(int $id): JsonResponse
    {
        $order = Order::with([
            'customer',
            'items.costs',
            'payments.recorder',
            'refunds.processor',
            'statusHistory.user',
            'modificationHistory.modifier',
            'delivery',
            'creator',
        ])->find($id);

        if (!$order) {
            return $this->sendError('Order not found.', 404, 'NOT_FOUND');
        }

        return $this->sendResponse($order);
    }

    /**
     * Modify order details or items post-creation with full audit trail.
     */
    public function update(Request $request, int $id, OrderService $orderService): JsonResponse
    {
        $order = Order::find($id);

        if (!$order) {
            return $this->sendError('Order not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'modification_reason' => 'required|string|min:3|max:255',
            'advance_amount_required' => 'nullable|numeric|min:0',
            'delivery_charge' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'target_delivery_date' => 'nullable|date',
            'internal_notes' => 'nullable|string',
            'items' => 'nullable|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.item_name' => 'required|string|max:200',
            'items.*.item_type' => 'required|in:CATALOG,CUSTOM',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.customization_details' => 'nullable|string',
            'items.*.direct_cost' => 'nullable|numeric|min:0',
            'items.*.cost_type' => 'nullable|in:RAW_MATERIAL,PRINT,FRAME,PACKAGING,OTHER',
        ]);

        try {
            $reason = $validated['modification_reason'];
            unset($validated['modification_reason']);
            $updatedOrder = $orderService->modifyOrder($order, $validated, $request->user()->id, $reason);
            return $this->sendResponse($updatedOrder, "Order {$order->order_number} modified successfully.");
        } catch (Exception $e) {
            return $this->sendError($e->getMessage(), 422, 'ORDER_MODIFICATION_FAILED');
        }
    }

    /**
     * Update order status with strict advance payment rules on confirmation.
     */
    public function updateStatus(Request $request, int $id, OrderService $orderService): JsonResponse
    {
        $order = Order::find($id);

        if (!$order) {
            return $this->sendError('Order not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'status' => 'required|in:DRAFT,PENDING_ADVANCE,CONFIRMED,IN_PROGRESS,READY_FOR_DELIVERY,DISPATCHED,DELIVERED,ON_HOLD,CANCELLED',
            'note' => 'nullable|string|max:255',
        ]);

        try {
            $updatedOrder = $orderService->updateStatus(
                $order,
                $validated['status'],
                $request->user()->id,
                $validated['note'] ?? null
            );
            return $this->sendResponse($updatedOrder, "Order status shifted to {$validated['status']}.");
        } catch (ValidationException $e) {
            return $this->sendError($e->getMessage(), 422, 'ADVANCE_PAYMENT_REQUIRED', $e->errors());
        } catch (Exception $e) {
            return $this->sendError($e->getMessage(), 422, 'STATUS_UPDATE_FAILED');
        }
    }

    /**
     * Delete order (guarded against confirmed or paid orders).
     */
    public function destroy(Request $request, int $id, OrderService $orderService): JsonResponse
    {
        $order = Order::find($id);

        if (!$order) {
            return $this->sendError('Order not found.', 404, 'NOT_FOUND');
        }

        try {
            $orderService->deleteOrder($order, $request->user()->id);
            return $this->sendResponse(null, "Order {$order->order_number} soft-deleted successfully.");
        } catch (Exception $e) {
            return $this->sendError($e->getMessage(), 422, 'ORDER_DELETION_FAILED');
        }
    }
}
