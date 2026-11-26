<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vendor extends Model
{
    protected $fillable = [
        'name',
        'code',
        'entity_type',
        'contact_person',
        'phone',
        'email',
        'city',
        'address',
        'gstin',
        'upi_id',
        'payment_terms',
        'default_category',
        'tracking_url_template',
        'is_active',
        'notes',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class, 'vendor_id');
    }
}
