<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    public $timestamps = false; // Uses custom created_at only

    protected $fillable = [
        'user_id',
        'action',
        'entity_type',
        'entity_id',
        'description',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Helper to write an immutable audit entry anywhere in the app.
     */
    public static function log(
        mixed $actionOrUserId,
        ?string $actionOrEntityType = null,
        mixed $entityTypeOrId = null,
        mixed $entityIdOrDesc = null,
        mixed $descriptionOrOldValues = null,
        mixed $oldOrNewValues = null,
        ?array $newValues = null
    ): self {
        if (is_int($actionOrUserId) || (is_null($actionOrUserId) && is_string($actionOrEntityType))) {
            $userId = $actionOrUserId ?? auth()->id();
            $action = $actionOrEntityType;
            $entityType = $entityTypeOrId;
            $entityId = (int)$entityIdOrDesc;
            $description = (string)$descriptionOrOldValues;
            $oldValues = is_array($oldOrNewValues) ? $oldOrNewValues : null;
            $actualNewValues = is_array($newValues) ? $newValues : null;
        } else {
            $userId = auth()->id();
            $action = $actionOrUserId;
            $entityType = $actionOrEntityType;
            $entityId = (int)$entityTypeOrId;
            $description = (string)$entityIdOrDesc;
            $oldValues = is_array($descriptionOrOldValues) ? $descriptionOrOldValues : null;
            $actualNewValues = is_array($oldOrNewValues) ? $oldOrNewValues : null;
        }

        return self::create([
            'user_id' => $userId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'description' => $description,
            'old_values' => $oldValues,
            'new_values' => $actualNewValues,
            'ip_address' => request()?->ip(),
            'user_agent' => request()?->userAgent(),
            'created_at' => now(),
        ]);
    }
}
