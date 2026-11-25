<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Enquiry extends Model
{
    protected $fillable = [
        'customer_id',
        'channel',
        'product_interest',
        'budget_range',
        'estimated_value',
        'enquiry_date',
        'requirements',
        'status',
        'lost_reason',
        'follow_up_date',
        'notes',
        'converted_order_id',
    ];

    protected $casts = [
        'estimated_value' => 'decimal:2',
        'enquiry_date' => 'date',
        'follow_up_date' => 'date',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function convertedOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'converted_order_id');
    }

    public function followUps(): HasMany
    {
        return $this->hasMany(FollowUp::class)->latest('scheduled_date');
    }
}
