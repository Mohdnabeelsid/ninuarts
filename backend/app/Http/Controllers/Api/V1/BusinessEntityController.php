<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\ActivityLog;
use App\Models\BusinessEntity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BusinessEntityController extends BaseApiController
{
    public const ENTITY_TYPES = ['STUDIO', 'BRANCH', 'WORKSHOP', 'BRAND'];

    /**
     * List studio and legal business entities with optional filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $query = BusinessEntity::query();

        if ($entityType = $request->query('entity_type')) {
            $query->where('entity_type', $entityType);
        }

        if ($request->has('is_active') && $request->query('is_active') !== '') {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $needle = '%' . strtolower($search) . '%';
            $query->where(function ($q) use ($needle) {
                $q->whereRaw('LOWER(name) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(COALESCE(legal_name, \'\')) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(code) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(COALESCE(city, \'\')) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(COALESCE(gstin, \'\')) LIKE ?', [$needle]);
            });
        }

        $entities = $query
            ->orderByDesc('is_primary')
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get();

        $primaryEntity = BusinessEntity::where('is_primary', true)->first();

        return $this->sendResponse($entities, null, 200, [
            'total' => BusinessEntity::count(),
            'active_count' => BusinessEntity::where('is_active', true)->count(),
            'primary_entity' => $primaryEntity,
        ]);
    }

    /**
     * Create a new studio or legal business entity.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'legal_name' => 'nullable|string|max:200',
            'code' => 'nullable|string|max:50',
            'entity_type' => 'required|in:' . implode(',', self::ENTITY_TYPES),
            'gstin' => 'nullable|string|max:30',
            'pan' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:150',
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'pincode' => 'nullable|string|max:20',
            'upi_id' => 'nullable|string|max:100',
            'bank_name' => 'nullable|string|max:120',
            'bank_account_number' => 'nullable|string|max:50',
            'bank_ifsc' => 'nullable|string|max:25',
            'is_primary' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        $code = $this->resolveUniqueCode($validated['code'] ?? null, $validated['name']);
        if (BusinessEntity::whereRaw('LOWER(code) = ?', [strtolower($code)])->exists()) {
            return $this->sendError('An entity with this short code already exists.', 422, 'ENTITY_CODE_EXISTS');
        }

        $isPrimary = (bool) ($validated['is_primary'] ?? false);
        $isActive = array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true;
        if ($isPrimary) {
            $isActive = true;
        }

        $entity = DB::transaction(function () use ($validated, $code, $isPrimary, $isActive) {
            if ($isPrimary) {
                BusinessEntity::where('is_primary', true)->update(['is_primary' => false]);
            }

            return BusinessEntity::create([
                ...$validated,
                'code' => strtoupper($code),
                'is_primary' => $isPrimary,
                'is_active' => $isActive,
            ]);
        });

        ActivityLog::log(
            $request->user()->id,
            'BUSINESS_ENTITY_CREATED',
            'BusinessEntity',
            $entity->id,
            "Created business entity '{$entity->name}' ({$entity->code}).",
            null,
            $entity->toArray()
        );

        return $this->sendResponse($entity, 'Business entity created successfully.', 201);
    }

    /**
     * Show single business entity with its audit trail.
     */
    public function show(int $id): JsonResponse
    {
        $entity = BusinessEntity::find($id);
        if (!$entity) {
            return $this->sendError('Business entity not found.', 404, 'NOT_FOUND');
        }

        $auditTrail = ActivityLog::where('entity_type', 'BusinessEntity')
            ->where('entity_id', $id)
            ->with('user')
            ->latest('created_at')
            ->get();

        return $this->sendResponse([
            'entity' => $entity,
            'audit_trail' => $auditTrail,
        ]);
    }

    /**
     * Update an existing studio or legal business entity.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $entity = BusinessEntity::find($id);
        if (!$entity) {
            return $this->sendError('Business entity not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'legal_name' => 'nullable|string|max:200',
            'code' => 'sometimes|required|string|max:50',
            'entity_type' => 'sometimes|in:' . implode(',', self::ENTITY_TYPES),
            'gstin' => 'nullable|string|max:30',
            'pan' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:150',
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'pincode' => 'nullable|string|max:20',
            'upi_id' => 'nullable|string|max:100',
            'bank_name' => 'nullable|string|max:120',
            'bank_account_number' => 'nullable|string|max:50',
            'bank_ifsc' => 'nullable|string|max:25',
            'is_primary' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        if (isset($validated['code'])) {
            $normalizedCode = strtoupper(trim($validated['code']));
            $duplicate = BusinessEntity::where('id', '!=', $entity->id)
                ->whereRaw('LOWER(code) = ?', [strtolower($normalizedCode)])
                ->exists();
            if ($duplicate) {
                return $this->sendError('Another business entity already uses this code.', 422, 'ENTITY_CODE_EXISTS');
            }
            $validated['code'] = $normalizedCode;
        }

        if ($entity->is_primary && array_key_exists('is_active', $validated) && !$validated['is_active']) {
            return $this->sendError(
                'Cannot deactivate the primary studio entity. Assign another entity as primary first.',
                422,
                'PRIMARY_ENTITY_PROTECTED'
            );
        }

        $oldSnapshot = $entity->toArray();

        DB::transaction(function () use ($entity, $validated) {
            if (!empty($validated['is_primary'])) {
                BusinessEntity::where('id', '!=', $entity->id)
                    ->where('is_primary', true)
                    ->update(['is_primary' => false]);
                $validated['is_active'] = true;
            }

            $entity->fill($validated);
            $entity->save();
        });

        ActivityLog::log(
            $request->user()->id,
            'BUSINESS_ENTITY_UPDATED',
            'BusinessEntity',
            $entity->id,
            "Updated business entity '{$entity->name}' ({$entity->code}).",
            $oldSnapshot,
            $entity->toArray()
        );

        return $this->sendResponse($entity->fresh(), 'Business entity updated successfully.');
    }

    /**
     * Delete a non-primary business entity.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $entity = BusinessEntity::find($id);
        if (!$entity) {
            return $this->sendError('Business entity not found.', 404, 'NOT_FOUND');
        }

        if ($entity->is_primary) {
            return $this->sendError(
                'Cannot delete the primary studio entity. Promote another studio entity to primary first.',
                422,
                'PRIMARY_ENTITY_PROTECTED'
            );
        }

        $oldSnapshot = $entity->toArray();
        $name = $entity->name;
        $code = $entity->code;
        $entity->delete();

        ActivityLog::log(
            $request->user()->id,
            'BUSINESS_ENTITY_DELETED',
            'BusinessEntity',
            $id,
            "Deleted business entity '{$name}' ({$code}).",
            $oldSnapshot,
            null
        );

        return $this->sendResponse(null, 'Business entity deleted successfully.');
    }

    private function resolveUniqueCode(?string $requestedCode, string $name): string
    {
        if ($requestedCode && trim($requestedCode) !== '') {
            return strtoupper(Str::slug(trim($requestedCode), '-'));
        }

        $base = strtoupper(Str::slug($name, '-'));
        $base = $base !== '' ? substr($base, 0, 40) : 'ENTITY';
        $candidate = $base;
        $suffix = 2;

        while (BusinessEntity::whereRaw('LOWER(code) = ?', [strtolower($candidate)])->exists()) {
            $candidate = substr($base, 0, 36) . '-' . $suffix;
            $suffix++;
        }

        return $candidate;
    }
}
