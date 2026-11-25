<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;

class DeliveryController extends BaseApiController
{
    /**
     * Safely sync order status from delivery milestone without bypassing DRAFT/CANCELLED guards.
     */
    public static function syncOrderStatus(Order $order, string $deliveryStatus, int $userId): void
    {
        if (in_array($order->status, ['DRAFT', 'PENDING_ADVANCE', 'CANCELLED'], true)) {
            return;
        }

        if (in_array($deliveryStatus, ['DISPATCHED', 'SHIPPED'], true) && $order->status !== 'DISPATCHED' && $order->status !== 'DELIVERED') {
            $from = $order->status;
            $order->update(['status' => 'DISPATCHED']);
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'user_id' => $userId,
                'from_status' => $from,
                'to_status' => 'DISPATCHED',
                'note' => 'Order marked DISPATCHED via delivery fulfillment.',
            ]);
        } elseif ($deliveryStatus === 'DELIVERED' && $order->status !== 'DELIVERED') {
            $from = $order->status;
            $order->update(['status' => 'DELIVERED']);
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'user_id' => $userId,
                'from_status' => $from,
                'to_status' => 'DELIVERED',
                'note' => 'Order marked DELIVERED upon delivery handover confirmation.',
            ]);
        }
    }
    /**
     * List all deliveries with filters, search, and status summary.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Delivery::with(['order.customer', 'order.items']);

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($deliveryType = $request->query('delivery_type')) {
            $query->where('delivery_type', $deliveryType);
        }

        if ($courierPartner = $request->query('courier_partner')) {
            $query->where('courier_partner', $courierPartner);
        }

        if ($request->boolean('is_overdue')) {
            $query->overdue();
        }

        if ($fromDate = $request->query('from_date')) {
            $query->whereDate('estimated_delivery_date', '>=', $fromDate);
        }

        if ($toDate = $request->query('to_date')) {
            $query->whereDate('estimated_delivery_date', '<=', $toDate);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('tracking_number', 'like', "%{$search}%")
                  ->orWhere('courier_partner', 'like', "%{$search}%")
                  ->orWhere('recipient_name', 'like', "%{$search}%")
                  ->orWhere('recipient_phone', 'like', "%{$search}%")
                  ->orWhereHas('order', function ($oq) use ($search) {
                      $oq->where('order_number', 'like', "%{$search}%");
                  });
            });
        }

        // Status counts summary
        $counts = [
            'total' => Delivery::count(),
            'pending' => Delivery::where('status', 'PENDING')->count(),
            'ready_for_dispatch' => Delivery::where('status', 'READY_FOR_DISPATCH')->count(),
            'dispatched' => Delivery::where('status', 'DISPATCHED')->count(),
            'in_transit' => Delivery::where('status', 'IN_TRANSIT')->count(),
            'delivered' => Delivery::where('status', 'DELIVERED')->count(),
            'delivery_failed' => Delivery::where('status', 'DELIVERY_FAILED')->count(),
            'returned' => Delivery::where('status', 'RETURNED')->count(),
            'overdue' => Delivery::overdue()->count(),
        ];

        $perPage = (int)$request->query('per_page', 25);
        $deliveries = $query->latest()->paginate($perPage);

        // Append computed days_overdue to items
        $items = collect($deliveries->items())->map(function ($item) {
            $isOverdue = false;
            $daysOverdue = 0;
            if ($item->estimated_delivery_date && !in_array($item->status, ['DELIVERED', 'RETURNED'])) {
                $est = Carbon::parse($item->estimated_delivery_date)->startOfDay();
                $today = now()->startOfDay();
                if ($est->lt($today)) {
                    $isOverdue = true;
                    $daysOverdue = $est->diffInDays($today);
                }
            }
            $itemArray = $item->toArray();
            $itemArray['is_overdue'] = $isOverdue;
            $itemArray['days_overdue'] = $daysOverdue;
            return $itemArray;
        });

        return $this->sendResponse($items, null, 200, [
            'current_page' => $deliveries->currentPage(),
            'per_page' => $deliveries->perPage(),
            'total' => $deliveries->total(),
            'last_page' => $deliveries->lastPage(),
            'summary' => $counts,
        ]);
    }

    /**
     * Show single delivery with order and history.
     */
    public function show(int $id): JsonResponse
    {
        $delivery = Delivery::with(['order.customer', 'order.items.costs'])->find($id);

        if (!$delivery) {
            return $this->sendError('Delivery record not found.', 404, 'NOT_FOUND');
        }

        $isOverdue = false;
        $daysOverdue = 0;
        if ($delivery->estimated_delivery_date && !in_array($delivery->status, ['DELIVERED', 'RETURNED'])) {
            $est = Carbon::parse($delivery->estimated_delivery_date)->startOfDay();
            $today = now()->startOfDay();
            if ($est->lt($today)) {
                $isOverdue = true;
                $daysOverdue = $est->diffInDays($today);
            }
        }

        $logs = ActivityLog::where('entity_type', 'Delivery')
            ->where('entity_id', $id)
            ->with('user')
            ->latest()
            ->get();

        $data = $delivery->toArray();
        $data['is_overdue'] = $isOverdue;
        $data['days_overdue'] = $daysOverdue;
        $data['audit_trail'] = $logs;

        return $this->sendResponse($data);
    }

    /**
     * Create or attach delivery to an order.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id' => 'required|exists:orders,id',
            'delivery_type' => 'required|in:COURIER,LOCAL_DELIVERY',
            'recipient_name' => 'nullable|string|max:150',
            'recipient_phone' => 'nullable|string|max:30',
            'delivery_address' => 'nullable|string',
            'courier_partner' => 'nullable|string|max:100',
            'tracking_number' => 'nullable|string|max:150',
            'shipping_charge' => 'nullable|numeric|min:0',
            'dispatch_date' => 'nullable|date',
            'estimated_delivery_date' => 'nullable|date',
            'delivery_notes' => 'nullable|string',
            'status' => 'required|in:PENDING,READY_FOR_DISPATCH,DISPATCHED,IN_TRANSIT,DELIVERED,DELIVERY_FAILED,RETURNED',
        ]);

        $order = Order::with('customer')->findOrFail($validated['order_id']);

        if (in_array($order->status, ['DRAFT', 'CANCELLED'], true)) {
            return $this->sendError(
                'Cannot create a delivery shipment for a DRAFT or CANCELLED order. Confirm the order first.',
                422,
                'INVALID_ORDER_STATE'
            );
        }

        // Default recipient info from order customer if missing
        if (empty($validated['recipient_name']) && $order->customer) {
            $validated['recipient_name'] = $order->customer->name;
        }
        if (empty($validated['recipient_phone']) && $order->customer) {
            $validated['recipient_phone'] = $order->customer->phone;
        }
        if (empty($validated['delivery_address']) && $order->customer) {
            $validated['delivery_address'] = $order->customer->delivery_address ?? $order->customer->city;
        }

        if (empty($validated['shipping_charge'])) {
            $validated['shipping_charge'] = $order->delivery_charge ?? 0.00;
        }

        $delivery = Delivery::updateOrCreate(
            ['order_id' => $order->id],
            $validated
        );

        // Auto-sync Order status safely
        self::syncOrderStatus($order, $delivery->status, $request->user()->id);

        ActivityLog::log(
            $request->user()->id,
            'DELIVERY_CREATED',
            'Delivery',
            $delivery->id,
            "Created delivery shipment for order #{$order->order_number} ({$delivery->status}).",
            null,
            $delivery->toArray()
        );

        return $this->sendResponse($delivery->load('order.customer'), 'Delivery created successfully.', 201);
    }

    /**
     * Update delivery details.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $delivery = Delivery::with('order')->find($id);

        if (!$delivery) {
            return $this->sendError('Delivery record not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'delivery_type' => 'sometimes|in:COURIER,LOCAL_DELIVERY',
            'recipient_name' => 'nullable|string|max:150',
            'recipient_phone' => 'nullable|string|max:30',
            'delivery_address' => 'nullable|string',
            'courier_partner' => 'nullable|string|max:100',
            'tracking_number' => 'nullable|string|max:150',
            'shipping_charge' => 'nullable|numeric|min:0',
            'dispatch_date' => 'nullable|date',
            'estimated_delivery_date' => 'nullable|date',
            'delivered_date' => 'nullable|date',
            'delivery_notes' => 'nullable|string',
            'delay_reason' => 'nullable|string|max:255',
            'status' => 'sometimes|in:PENDING,READY_FOR_DISPATCH,DISPATCHED,IN_TRANSIT,DELIVERED,DELIVERY_FAILED,RETURNED',
        ]);

        $oldSnapshot = $delivery->toArray();
        $delivery->update($validated);

        // Sync order status safely
        if (isset($validated['status']) && $delivery->order) {
            self::syncOrderStatus($delivery->order, $validated['status'], $request->user()->id);
        }

        ActivityLog::log(
            $request->user()->id,
            'DELIVERY_UPDATED',
            'Delivery',
            $delivery->id,
            "Updated delivery info for shipment #{$delivery->id} (Order #{$delivery->order?->order_number}).",
            $oldSnapshot,
            $delivery->toArray()
        );

        return $this->sendResponse($delivery->load('order.customer'), 'Delivery updated successfully.');
    }

    /**
     * Update delivery status.
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $delivery = Delivery::with('order')->find($id);

        if (!$delivery) {
            return $this->sendError('Delivery record not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'status' => 'required|in:PENDING,READY_FOR_DISPATCH,DISPATCHED,IN_TRANSIT,DELIVERED,DELIVERY_FAILED,RETURNED',
            'actual_delivery_date' => 'nullable|date',
            'delay_reason' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        $oldStatus = $delivery->status;
        $delivery->status = $validated['status'];

        if ($validated['status'] === 'DELIVERED') {
            $delivery->delivered_date = $validated['actual_delivery_date'] ?? now();
        }

        if ($validated['status'] === 'DISPATCHED' && !$delivery->dispatch_date) {
            $delivery->dispatch_date = now();
        }

        if (!empty($validated['delay_reason'])) {
            $delivery->delay_reason = $validated['delay_reason'];
        }

        if (!empty($validated['notes'])) {
            $delivery->delivery_notes = ($delivery->delivery_notes ? $delivery->delivery_notes . "\n" : '') . $validated['notes'];
        }

        $delivery->save();

        // Sync order status safely
        if ($delivery->order) {
            self::syncOrderStatus($delivery->order, $validated['status'], $request->user()->id);
        }

        ActivityLog::log(
            $request->user()->id,
            'DELIVERY_STATUS_CHANGED',
            'Delivery',
            $delivery->id,
            "Delivery #{$delivery->id} status changed from {$oldStatus} to {$delivery->status}."
        );

        return $this->sendResponse($delivery->load('order.customer'), 'Delivery status updated.');
    }

    /**
     * Get overdue deliveries list.
     */
    public function overdue(): JsonResponse
    {
        $overdueDeliveries = Delivery::overdue()
            ->with(['order.customer'])
            ->latest('estimated_delivery_date')
            ->get()
            ->map(function ($item) {
                $est = Carbon::parse($item->estimated_delivery_date)->startOfDay();
                $today = now()->startOfDay();
                $itemArray = $item->toArray();
                $itemArray['days_overdue'] = $est->diffInDays($today);
                return $itemArray;
            });

        return $this->sendResponse($overdueDeliveries, null, 200, [
            'total_overdue' => $overdueDeliveries->count(),
        ]);
    }

    /**
     * Generate manual dispatch notification text for WhatsApp / Instagram.
     */
    public function dispatchTemplate(int $id): JsonResponse
    {
        $delivery = Delivery::with(['order.customer'])->find($id);

        if (!$delivery) {
            return $this->sendError('Delivery not found.', 404, 'NOT_FOUND');
        }

        $customerName = $delivery->recipient_name ?? $delivery->order?->customer?->name ?? 'Valued Customer';
        $orderNumber = $delivery->order?->order_number ?? 'Order';
        $courier = $delivery->courier_partner ?: ($delivery->delivery_type === 'LOCAL_DELIVERY' ? 'Local Courier Delivery' : 'Courier');
        $tracking = $delivery->tracking_number ? "Tracking Number: {$delivery->tracking_number}" : "Delivery partner will contact you shortly.";
        $expectedDate = $delivery->estimated_delivery_date ? Carbon::parse($delivery->estimated_delivery_date)->format('d M, Y') : 'in 2-4 business days';

        $whatsappMessage = "🌸 *Ninu Arts Order Dispatch Update* 🌸\n\n"
            . "Dear {$customerName},\n\n"
            . "Your personalized gift order *#{$orderNumber}* has been dispatched via *{$courier}*! 🎁✨\n\n"
            . "📦 {$tracking}\n"
            . "📅 Expected Delivery: {$expectedDate}\n"
            . "📍 Delivery Address: {$delivery->delivery_address}\n\n"
            . "Please let us know once you receive your parcel! If you loved your artwork, do tag us on Instagram *@ninuarts*. 💕\n\n"
            . "Warm regards,\n*Ninu Arts, Alappuzha* 🌸";

        return $this->sendResponse([
            'delivery_id' => $delivery->id,
            'recipient' => $customerName,
            'phone' => $delivery->recipient_phone ?? $delivery->order?->customer?->phone,
            'template_text' => $whatsappMessage,
        ], 'Dispatch message template generated.');
    }
}
