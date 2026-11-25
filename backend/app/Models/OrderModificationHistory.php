<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderModificationHistory extends Model
{
    protected $table = 'order_modification_history';

    protected $fillable = [
        'order_id',
        'modified_by',
        'previous_values',
        'new_values',
        'previous_total',
        'new_total',
        'modification_reason',
        'change_summary',
    ];

    protected $casts = [
        'previous_values' => 'array',
        'new_values' => 'array',
        'previous_total' => 'decimal:2',
        'new_total' => 'decimal:2',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function modifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'modified_by');
    }
}
