<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\OrderStatusHistory;
use App\Models\ActivityLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Exception;

class PaymentService
{
    /**
     * Record a payment (Advance, Partial, Final, Additional) with duplicate reference check.
     */
    public function recordPayment(Order $order, array $data, int $userId): Payment
    {
        return DB::transaction(function () use ($order, $data, $userId) {
            // Row-level lock inside transaction to prevent concurrent balance/duplicate races
            $order = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            $amount = round((float)($data['amount'] ?? 0.00), 2);
            if ($amount <= 0.00) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount must be greater than zero.'],
                ]);
            }

            $method = strtoupper($data['payment_method'] ?? 'UPI');
            if (!in_array($method, ['UPI', 'BANK_TRANSFER', 'CASH'], true)) {
                throw ValidationException::withMessages([
                    'payment_method' => ['Invalid payment method. Supported: UPI, BANK_TRANSFER, CASH.'],
                ]);
            }

            $type = strtoupper($data['payment_type'] ?? 'ADVANCE');
            if (!in_array($type, ['ADVANCE', 'PARTIAL', 'ADDITIONAL', 'BALANCE_FINAL'], true)) {
                $type = 'PARTIAL';
            }

            $txRef = trim($data['transaction_reference'] ?? '');

            // Duplicate payment submission prevention (for non-cash transactions with a reference)
            if ($method !== 'CASH' && !empty($txRef)) {
                $exists = Payment::where('order_id', $order->id)
                    ->where('transaction_reference', $txRef)
                    ->where('status', 'SUCCESS')
                    ->exists();

                if ($exists) {
                    throw ValidationException::withMessages([
                        'transaction_reference' => ["Duplicate payment detected: transaction reference '{$txRef}' has already been recorded for this order."],
                    ]);
                }
            }

            $payment = Payment::create([
                'order_id' => $order->id,
                'payment_type' => $type,
                'amount' => $amount,
                'payment_method' => $method,
                'transaction_reference' => !empty($txRef) ? $txRef : null,
                'payment_date' => $data['payment_date'] ?? now(),
                'status' => 'SUCCESS',
                'notes' => $data['notes'] ?? null,
                'recorded_by' => $userId,
            ]);

            // Recalculate order balances
            $this->recalculateBalances($order);

            // Auto-Confirm Order on Valid Advance Payment
            if (in_array($order->status, ['DRAFT', 'PENDING_ADVANCE'], true)) {
                $advanceRequired = (float)$order->advance_amount_required;
                if ($order->total_paid > 0 && ($advanceRequired <= 0.00 || $order->total_paid >= $advanceRequired)) {
                    $order->status = 'CONFIRMED';
                    $order->confirmed_at = now();
                    $order->save();

                    OrderStatusHistory::create([
                        'order_id' => $order->id,
                        'user_id' => $userId,
                        'from_status' => 'DRAFT',
                        'to_status' => 'CONFIRMED',
                        'note' => "Order automatically confirmed upon receiving advance payment of ₹" . number_format($amount, 2) . " via {$method}.",
                    ]);
                }
            }

            ActivityLog::log(
                $userId,
                'PAYMENT_RECORDED',
                'Payment',
                $payment->id,
                "Recorded {$type} payment of ₹{$amount} via {$method} for Order {$order->order_number}."
            );

            return $payment->fresh(['order', 'recorder']);
        });
    }

    /**
     * Record a refund with strict limit validation against net paid amount.
     */
    public function recordRefund(Order $order, array $data, int $userId): Refund
    {
        return DB::transaction(function () use ($order, $data, $userId) {
            $order = Order::where('id', $order->id)->lockForUpdate()->firstOrFail();

            $amount = round((float)($data['amount'] ?? 0.00), 2);
            if ($amount <= 0.00) {
                throw ValidationException::withMessages([
                    'amount' => ['Refund amount must be greater than zero.'],
                ]);
            }

            // CRITICAL BUSINESS RULE: Refund amounts must not exceed eligible refundable amount
            $eligibleRefundable = $order->netPaid();
            if ($amount > $eligibleRefundable) {
                throw ValidationException::withMessages([
                    'amount' => [
                        "Refund amount ₹" . number_format($amount, 2) .
                        " exceeds the eligible refundable amount of ₹" . number_format($eligibleRefundable, 2) . "."
                    ],
                ]);
            }

            $method = strtoupper($data['refund_method'] ?? 'UPI');
            if (!in_array($method, ['UPI', 'BANK_TRANSFER', 'CASH'], true)) {
                $method = 'UPI';
            }

            $reason = trim($data['reason'] ?? '');
            if (empty($reason)) {
                throw ValidationException::withMessages([
                    'reason' => ['A valid reason must be stated for processing a refund.'],
                ]);
            }

            $refund = Refund::create([
                'order_id' => $order->id,
                'payment_id' => $data['payment_id'] ?? null,
                'amount' => $amount,
                'refund_method' => $method,
                'transaction_reference' => $data['transaction_reference'] ?? null,
                'reason' => $reason,
                'notes' => $data['notes'] ?? null,
                'refund_date' => $data['refund_date'] ?? now(),
                'status' => 'COMPLETED',
                'processed_by' => $userId,
            ]);

            // Recalculate order balances
            $this->recalculateBalances($order);

            ActivityLog::log(
                $userId,
                'REFUND_PROCESSED',
                'Refund',
                $refund->id,
                "Processed refund of ₹{$amount} for Order {$order->order_number} via {$method}. Reason: {$reason}"
            );

            return $refund->fresh(['order', 'payment', 'processor']);
        });
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
}
