<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BusinessEntity extends Model
{
    protected $fillable = [
        'name',
        'legal_name',
        'code',
        'entity_type',
        'gstin',
        'pan',
        'email',
        'phone',
        'address',
        'city',
        'state',
        'pincode',
        'upi_id',
        'bank_name',
        'bank_account_number',
        'bank_ifsc',
        'is_primary',
        'is_active',
        'notes',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'is_active' => 'boolean',
    ];
}
