<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'customer_code',
        'name',
        'phone',
        'instagram_handle',
        'email',
        'source_channel',
        'delivery_address',
        'city',
        'pincode',
        'notes',
        'status',
    ];

    protected $appends = [
        'formatted_code',
    ];

    protected static function booted(): void
    {
        static::created(function (Customer $customer) {
            if (empty($customer->customer_code)) {
                $customer->customer_code = 'CUST-' . str_pad((string)$customer->id, 5, '0', STR_PAD_LEFT);
                $customer->saveQuietly();
            }
        });
    }

    public function getFormattedCodeAttribute(): string
    {
        return $this->customer_code ?? ('CUST-' . str_pad((string)$this->id, 5, '0', STR_PAD_LEFT));
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class)->latest();
    }

    public function enquiries(): HasMany
    {
        return $this->hasMany(Enquiry::class)->latest();
    }

    public function notesHistory(): HasMany
    {
        return $this->hasMany(CustomerNote::class)->latest();
    }

    public function occasions(): HasMany
    {
        return $this->hasMany(CustomerOccasion::class)->orderBy('occasion_date');
    }
}
