<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Order;
use App\Models\Delivery;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class FulfillmentController extends BaseApiController
{
    public function update(Request $request, int $orderId): JsonResponse
    {
        $order = Order::find($orderId);

        if (!$order) {
            return $this->sendError('Order not found.', 404, 'NOT_FOUND');
        }

        if (in_array($order->status, ['DRAFT', 'CANCELLED'], true)) {
            return $this->sendError(
                'Cannot update fulfillment for a DRAFT or CANCELLED order. Confirm the order first.',
                422,
                'INVALID_ORDER_STATE'
            );
        }

        $validated = $request->validate([
            'delivery_type' => 'required|in:COURIER,LOCAL_DELIVERY',
            'courier_partner' => 'nullable|string|max:100',
            'tracking_number' => 'nullable|string|max:150',
            'shipped_date' => 'nullable|date',
            'estimated_delivery_date' => 'nullable|date',
            'delivery_notes' => 'nullable|string',
            'status' => 'required|in:PENDING,READY_FOR_DISPATCH,DISPATCHED,IN_TRANSIT,DELIVERED,DELIVERY_FAILED,RETURNED,PACKED,SHIPPED,OUT_FOR_DELIVERY',
        ]);

        $normalizedStatus = match ($validated['status']) {
            'PACKED' => 'READY_FOR_DISPATCH',
            'SHIPPED' => 'DISPATCHED',
            'OUT_FOR_DELIVERY' => 'IN_TRANSIT',
            default => $validated['status'],
        };
        $validated['status'] = $normalizedStatus;

        $delivery = Delivery::updateOrCreate(
            ['order_id' => $order->id],
            $validated
        );

        DeliveryController::syncOrderStatus($order, $normalizedStatus, $request->user()->id);

        ActivityLog::log(
            $request->user()->id,
            'FULFILLMENT_UPDATED',
            'Order',
            $order->id,
            "Updated fulfillment details for {$order->order_number}: {$delivery->status} ({$delivery->courier_partner})."
        );

        return $this->sendResponse($delivery, 'Fulfillment updated successfully.');
    }

    public function updateStatus(Request $request, int $orderId): JsonResponse
    {
        $delivery = Delivery::with('order')->where('order_id', $orderId)->first();

        if (!$delivery) {
            return $this->sendError('Fulfillment record not found for this order.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'status' => 'required|in:PENDING,READY_FOR_DISPATCH,DISPATCHED,IN_TRANSIT,DELIVERED,DELIVERY_FAILED,RETURNED,PACKED,SHIPPED,OUT_FOR_DELIVERY',
        ]);

        $normalizedStatus = match ($validated['status']) {
            'PACKED' => 'READY_FOR_DISPATCH',
            'SHIPPED' => 'DISPATCHED',
            'OUT_FOR_DELIVERY' => 'IN_TRANSIT',
            default => $validated['status'],
        };

        $delivery->update(['status' => $normalizedStatus]);

        if ($delivery->order) {
            DeliveryController::syncOrderStatus($delivery->order, $normalizedStatus, $request->user()->id);
        }

        return $this->sendResponse($delivery, 'Delivery status updated.');
    }
}
