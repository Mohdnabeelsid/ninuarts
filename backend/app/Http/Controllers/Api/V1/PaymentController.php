<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Order;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Exception;

class PaymentController extends BaseApiController
{
    /**
     * List payments for a specific order or all recent payments.
     */
    public function index(Request $request, ?int $orderId = null): JsonResponse
    {
        $query = Payment::with(['order.customer', 'recorder']);

        if ($orderId) {
            $query->where('order_id', $orderId);
        } elseif ($reqOrderId = $request->query('order_id')) {
            $query->where('order_id', $reqOrderId);
        } elseif (!$request->filled('search')) {
            $periodStart = $request->attributes->get('active_period_start');
            $periodEnd = $request->attributes->get('active_period_end');
            if ($periodStart && $periodEnd) {
                $query->whereBetween('payment_date', [$periodStart, $periodEnd]);
            }
        }

        if ($method = $request->query('payment_method')) {
            if ($method !== 'ALL') {
                $query->where('payment_method', strtoupper($method));
            }
        }

        if ($type = $request->query('payment_type')) {
            if ($type !== 'ALL') {
                $query->where('payment_type', strtoupper($type));
            }
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('transaction_reference', 'like', "%{$search}%")
                  ->orWhere('notes', 'like', "%{$search}%")
                  ->orWhereHas('order', function ($oq) use ($search) {
                      $oq->where('order_number', 'like', "%{$search}%")
                         ->orWhereHas('customer', function ($cq) use ($search) {
                             $cq->where('name', 'like', "%{$search}%")
                                ->orWhere('phone', 'like', "%{$search}%");
                         });
                  });
            });
        }

        $payments = $query->latest('payment_date')->latest('id')->paginate($request->query('per_page', 25));

        return $this->sendResponse($payments->items(), null, 200, [
            'current_page' => $payments->currentPage(),
            'per_page' => $payments->perPage(),
            'total' => $payments->total(),
            'last_page' => $payments->lastPage(),
        ]);
    }

    /**
     * Record a payment against an order.
     */
    public function store(Request $request, int $orderId, PaymentService $paymentService): JsonResponse
    {
        $order = Order::find($orderId);

        if (!$order) {
            return $this->sendError('Order not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_type' => 'required|in:ADVANCE,PARTIAL,ADDITIONAL,BALANCE_FINAL,INTERIM',
            'payment_method' => 'required|in:UPI,BANK_TRANSFER,CASH',
            'transaction_reference' => 'nullable|string|max:150',
            'payment_date' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            $payment = $paymentService->recordPayment($order, $validated, $request->user()->id);
            return $this->sendResponse(
                $payment,
                "Payment of ₹" . number_format($payment->amount, 2) . " recorded successfully.",
                201
            );
        } catch (ValidationException $e) {
            return $this->sendError($e->getMessage(), 422, 'PAYMENT_VALIDATION_FAILED', $e->errors());
        } catch (Exception $e) {
            return $this->sendError($e->getMessage(), 422, 'PAYMENT_RECORDING_FAILED');
        }
    }
}
