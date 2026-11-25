<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerOccasion extends Model
{
    protected $fillable = [
        'customer_id',
        'occasion_name',
        'occasion_date',
        'notes',
    ];

    protected $casts = [
        'occasion_date' => 'date',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
