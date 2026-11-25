<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'order_number',
        'customer_id',
        'status',
        'payment_status',
        'subtotal_amount',
        'delivery_charge',
        'discount_amount',
        'total_amount',
        'advance_amount_required',
        'total_paid',
        'balance_amount',
        'confirmed_at',
        'target_delivery_date',
        'internal_notes',
        'created_by',
    ];

    protected $casts = [
        'subtotal_amount' => 'decimal:2',
        'delivery_charge' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'advance_amount_required' => 'decimal:2',
        'total_paid' => 'decimal:2',
        'balance_amount' => 'decimal:2',
        'confirmed_at' => 'datetime',
        'target_delivery_date' => 'date',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->latest();
    }

    public function modificationHistory(): HasMany
    {
        return $this->hasMany(OrderModificationHistory::class)->latest();
    }

    public function modifications(): HasMany
    {
        return $this->hasMany(OrderModificationHistory::class)->latest();
    }

    public function delivery(): HasOne
    {
        return $this->hasOne(Delivery::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function netPaid(): float
    {
        $paid = (float)$this->payments()->where('status', 'SUCCESS')->sum('amount');
        $refunded = (float)$this->refunds()->where('status', 'COMPLETED')->sum('amount');
        return max(0.00, $paid - $refunded);
    }

    public function eligibleRefundableAmount(): float
    {
        return $this->netPaid();
    }
}
