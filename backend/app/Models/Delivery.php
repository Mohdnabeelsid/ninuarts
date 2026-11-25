<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Delivery extends Model
{
    protected $fillable = [
        'order_id',
        'delivery_type',
        'recipient_name',
        'recipient_phone',
        'delivery_address',
        'courier_partner',
        'tracking_number',
        'shipping_charge',
        'shipped_date',
        'dispatch_date',
        'estimated_delivery_date',
        'delivered_date',
        'delivery_notes',
        'delay_reason',
        'status',
    ];

    protected $casts = [
        'shipping_charge' => 'decimal:2',
        'shipped_date' => 'datetime',
        'dispatch_date' => 'datetime',
        'estimated_delivery_date' => 'date',
        'delivered_date' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    /**
     * Scope to find overdue deliveries:
     * Expected delivery date has passed, and package is not delivered or returned.
     */
    public function scopeOverdue($query)
    {
        return $query->whereNotNull('estimated_delivery_date')
            ->whereDate('estimated_delivery_date', '<', now()->toDateString())
            ->whereNotIn('status', ['DELIVERED', 'RETURNED']);
    }
}
