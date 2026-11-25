<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Order;
use App\Models\Refund;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Exception;

class RefundController extends BaseApiController
{
    /**
     * List refunds for a specific order.
     */
    public function index(Request $request, int $orderId): JsonResponse
    {
        $refunds = Refund::where('order_id', $orderId)
            ->with(['payment', 'processor'])
            ->latest('refund_date')
            ->latest('id')
            ->get();

        return $this->sendResponse($refunds);
    }

    /**
     * Authorize and record a refund with strict net-paid ceiling verification.
     */
    public function store(Request $request, int $orderId, PaymentService $paymentService): JsonResponse
    {
        $order = Order::find($orderId);

        if (!$order) {
            return $this->sendError('Order not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'refund_method' => 'required|in:UPI,BANK_TRANSFER,CASH',
            'transaction_reference' => 'nullable|string|max:150',
            'reason' => 'required|string|min:3|max:255',
            'notes' => 'nullable|string|max:500',
            'payment_id' => 'nullable|exists:payments,id',
            'refund_date' => 'nullable|date',
        ]);

        try {
            $refund = $paymentService->recordRefund($order, $validated, $request->user()->id);
            return $this->sendResponse(
                $refund,
                "Refund of ₹" . number_format($refund->amount, 2) . " processed successfully.",
                201
            );
        } catch (ValidationException $e) {
            return $this->sendError($e->getMessage(), 422, 'REFUND_VALIDATION_FAILED', $e->errors());
        } catch (Exception $e) {
            return $this->sendError($e->getMessage(), 422, 'REFUND_PROCESSING_FAILED');
        }
    }
}
