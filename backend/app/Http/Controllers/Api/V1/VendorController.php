<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\ActivityLog;
use App\Models\Delivery;
use App\Models\Expense;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class VendorController extends BaseApiController
{
    public const ENTITY_TYPES = ['SUPPLIER', 'PRINT_PARTNER', 'COURIER', 'SERVICE'];
    public const PAYMENT_TERMS = ['IMMEDIATE', 'NET_7', 'NET_15', 'NET_30', 'ADVANCE'];

    /**
     * List vendors, suppliers, and fulfillment partners with live ledger stats.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Vendor::query();

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
                    ->orWhereRaw('LOWER(code) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(COALESCE(contact_person, \'\')) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(COALESCE(phone, \'\')) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(COALESCE(city, \'\')) LIKE ?', [$needle]);
            });
        }

        $vendors = $query->orderByDesc('is_active')->orderBy('name')->get();

        // Batch-aggregate linked & name-matched expenses without N+1 queries
        $byVendorId = Expense::whereNotNull('vendor_id')
            ->selectRaw('vendor_id, COUNT(*) as cnt, SUM(amount) as total')
            ->groupBy('vendor_id')
            ->get()
            ->keyBy('vendor_id');

        $byVendorName = Expense::whereNull('vendor_id')
            ->whereNotNull('vendor_name')
            ->selectRaw('LOWER(TRIM(vendor_name)) as vname, COUNT(*) as cnt, SUM(amount) as total')
            ->groupByRaw('LOWER(TRIM(vendor_name))')
            ->get()
            ->keyBy('vname');

        $deliveriesByCourier = Delivery::whereNotNull('courier_partner')
            ->selectRaw('LOWER(TRIM(courier_partner)) as cname, COUNT(*) as cnt')
            ->groupByRaw('LOWER(TRIM(courier_partner))')
            ->get()
            ->keyBy('cname');

        $totalTrackedSpend = 0.0;
        $enriched = $vendors->map(function (Vendor $vendor) use ($byVendorId, $byVendorName, $deliveriesByCourier, &$totalTrackedSpend) {
            $nameKey = strtolower(trim($vendor->name));
            $idStats = $byVendorId->get($vendor->id);
            $nameStats = $byVendorName->get($nameKey);
            $courierStats = $deliveriesByCourier->get($nameKey);

            $expenseCount = (int) ($idStats->cnt ?? 0) + (int) ($nameStats->cnt ?? 0);
            $totalSpent = round((float) ($idStats->total ?? 0) + (float) ($nameStats->total ?? 0), 2);
            $deliveryCount = (int) ($courierStats->cnt ?? 0);

            $totalTrackedSpend += $totalSpent;

            $data = $vendor->toArray();
            $data['expense_count'] = $expenseCount;
            $data['total_spent'] = $totalSpent;
            $data['delivery_count'] = $deliveryCount;
            return $data;
        });

        return $this->sendResponse($enriched, null, 200, [
            'total' => Vendor::count(),
            'active_count' => Vendor::where('is_active', true)->count(),
            'suppliers_count' => Vendor::whereIn('entity_type', ['SUPPLIER', 'PRINT_PARTNER'])->count(),
            'couriers_count' => Vendor::where('entity_type', 'COURIER')->count(),
            'total_tracked_spend' => round($totalTrackedSpend, 2),
        ]);
    }

    /**
     * Register a new vendor, supplier, or fulfillment partner.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'code' => 'nullable|string|max:50',
            'entity_type' => 'required|in:' . implode(',', self::ENTITY_TYPES),
            'contact_person' => 'nullable|string|max:120',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:150',
            'city' => 'nullable|string|max:100',
            'address' => 'nullable|string',
            'gstin' => 'nullable|string|max:30',
            'upi_id' => 'nullable|string|max:100',
            'payment_terms' => 'nullable|in:' . implode(',', self::PAYMENT_TERMS),
            'default_category' => 'nullable|string|max:50',
            'tracking_url_template' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        if (Vendor::whereRaw('LOWER(name) = ?', [strtolower(trim($validated['name']))])->exists()) {
            return $this->sendError('A vendor or partner with this name already exists.', 422, 'VENDOR_EXISTS');
        }

        $code = $this->resolveUniqueCode($validated['code'] ?? null, $validated['name']);
        if (Vendor::whereRaw('LOWER(code) = ?', [strtolower($code)])->exists()) {
            return $this->sendError('A vendor or partner with this short code already exists.', 422, 'VENDOR_CODE_EXISTS');
        }

        $vendor = Vendor::create([
            ...$validated,
            'name' => trim($validated['name']),
            'code' => strtoupper($code),
            'payment_terms' => $validated['payment_terms'] ?? 'IMMEDIATE',
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
        ]);

        ActivityLog::log(
            $request->user()->id,
            'VENDOR_CREATED',
            'Vendor',
            $vendor->id,
            "Registered {$vendor->entity_type} entity '{$vendor->name}' ({$vendor->code}).",
            null,
            $vendor->toArray()
        );

        return $this->sendResponse($vendor, 'Vendor entity registered successfully.', 201);
    }

    /**
     * Show vendor details along with recent linked expenses, deliveries, and audit trail.
     */
    public function show(int $id): JsonResponse
    {
        $vendor = Vendor::find($id);
        if (!$vendor) {
            return $this->sendError('Vendor entity not found.', 404, 'NOT_FOUND');
        }

        $nameKey = strtolower(trim($vendor->name));

        $recentExpenses = Expense::with('category')
            ->where(function ($q) use ($vendor, $nameKey) {
                $q->where('vendor_id', $vendor->id)
                    ->orWhere(function ($sq) use ($nameKey) {
                        $sq->whereNull('vendor_id')
                            ->whereRaw('LOWER(TRIM(COALESCE(vendor_name, \'\'))) = ?', [$nameKey]);
                    });
            })
            ->latest('expense_date')
            ->limit(10)
            ->get();

        $totalSpent = (float) Expense::where(function ($q) use ($vendor, $nameKey) {
            $q->where('vendor_id', $vendor->id)
                ->orWhere(function ($sq) use ($nameKey) {
                    $sq->whereNull('vendor_id')
                        ->whereRaw('LOWER(TRIM(COALESCE(vendor_name, \'\'))) = ?', [$nameKey]);
                });
        })->sum('amount');

        $recentDeliveries = $vendor->entity_type === 'COURIER'
            ? Delivery::with('order:id,order_number,total_amount')
                ->whereRaw('LOWER(TRIM(COALESCE(courier_partner, \'\'))) = ?', [$nameKey])
                ->latest()
                ->limit(10)
                ->get()
            : collect();

        $auditTrail = ActivityLog::where('entity_type', 'Vendor')
            ->where('entity_id', $id)
            ->with('user')
            ->latest('created_at')
            ->get();

        return $this->sendResponse([
            'vendor' => $vendor,
            'stats' => [
                'total_spent' => round($totalSpent, 2),
                'expense_count' => $recentExpenses->count(),
                'delivery_count' => $recentDeliveries->count(),
            ],
            'recent_expenses' => $recentExpenses,
            'recent_deliveries' => $recentDeliveries,
            'audit_trail' => $auditTrail,
        ]);
    }

    /**
     * Update a vendor or fulfillment partner.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $vendor = Vendor::find($id);
        if (!$vendor) {
            return $this->sendError('Vendor entity not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'code' => 'sometimes|required|string|max:50',
            'entity_type' => 'sometimes|in:' . implode(',', self::ENTITY_TYPES),
            'contact_person' => 'nullable|string|max:120',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:150',
            'city' => 'nullable|string|max:100',
            'address' => 'nullable|string',
            'gstin' => 'nullable|string|max:30',
            'upi_id' => 'nullable|string|max:100',
            'payment_terms' => 'nullable|in:' . implode(',', self::PAYMENT_TERMS),
            'default_category' => 'nullable|string|max:50',
            'tracking_url_template' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        if (isset($validated['name'])) {
            $trimmedName = trim($validated['name']);
            $duplicateName = Vendor::where('id', '!=', $vendor->id)
                ->whereRaw('LOWER(name) = ?', [strtolower($trimmedName)])
                ->exists();
            if ($duplicateName) {
                return $this->sendError('Another vendor or partner already uses this name.', 422, 'VENDOR_EXISTS');
            }
            $validated['name'] = $trimmedName;
        }

        if (isset($validated['code'])) {
            $normalizedCode = strtoupper(trim($validated['code']));
            $duplicateCode = Vendor::where('id', '!=', $vendor->id)
                ->whereRaw('LOWER(code) = ?', [strtolower($normalizedCode)])
                ->exists();
            if ($duplicateCode) {
                return $this->sendError('Another vendor or partner already uses this code.', 422, 'VENDOR_CODE_EXISTS');
            }
            $validated['code'] = $normalizedCode;
        }

        $oldSnapshot = $vendor->toArray();
        $vendor->fill($validated);
        $vendor->save();

        ActivityLog::log(
            $request->user()->id,
            'VENDOR_UPDATED',
            'Vendor',
            $vendor->id,
            "Updated vendor entity '{$vendor->name}' ({$vendor->code}).",
            $oldSnapshot,
            $vendor->toArray()
        );

        return $this->sendResponse($vendor->fresh(), 'Vendor entity updated successfully.');
    }

    /**
     * Delete a vendor if no expenses are explicitly linked; otherwise prompt deactivation.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $vendor = Vendor::withCount('expenses')->find($id);
        if (!$vendor) {
            return $this->sendError('Vendor entity not found.', 404, 'NOT_FOUND');
        }

        if ($vendor->expenses_count > 0) {
            return $this->sendError(
                "Cannot delete vendor: {$vendor->expenses_count} expense records are linked to it. Deactivate the vendor instead.",
                422,
                'VENDOR_HAS_EXPENSES'
            );
        }

        $oldSnapshot = $vendor->toArray();
        $name = $vendor->name;
        $code = $vendor->code;
        $vendor->delete();

        ActivityLog::log(
            $request->user()->id,
            'VENDOR_DELETED',
            'Vendor',
            $id,
            "Deleted vendor entity '{$name}' ({$code}).",
            $oldSnapshot,
            null
        );

        return $this->sendResponse(null, 'Vendor entity deleted successfully.');
    }

    private function resolveUniqueCode(?string $requestedCode, string $name): string
    {
        if ($requestedCode && trim($requestedCode) !== '') {
            return strtoupper(Str::slug(trim($requestedCode), '-'));
        }

        $base = 'VND-' . strtoupper(Str::slug($name, '-'));
        $base = substr($base, 0, 42);
        $candidate = $base;
        $suffix = 2;

        while (Vendor::whereRaw('LOWER(code) = ?', [strtolower($candidate)])->exists()) {
            $candidate = substr($base, 0, 38) . '-' . $suffix;
            $suffix++;
        }

        return $candidate;
    }
}
