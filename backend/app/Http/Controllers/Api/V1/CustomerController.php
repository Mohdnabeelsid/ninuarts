<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Customer;
use App\Models\CustomerNote;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CustomerController extends BaseApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Customer::query()
            ->withCount('orders')
            ->with(['orders' => function ($q) {
                $q->select('id', 'customer_id', 'total_paid', 'status');
            }]);

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($city = $request->query('city')) {
            $query->where('city', $city);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('customer_code', 'like', "%{$search}%")
                  ->orWhere('instagram_handle', 'like', "%{$search}%");
            });
        }

        $customers = $query->latest()->paginate($request->query('per_page', 20));

        // Append computed lifetime spend
        $items = collect($customers->items())->map(function ($cust) {
            $custArray = $cust->toArray();
            $custArray['lifetime_spend'] = (float) $cust->orders
                ->where('status', '!=', 'CANCELLED')
                ->sum('total_paid');
            return $custArray;
        });

        return $this->sendResponse($items, null, 200, [
            'current_page' => $customers->currentPage(),
            'per_page' => $customers->perPage(),
            'total' => $customers->total(),
            'last_page' => $customers->lastPage(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'phone' => 'required|string|max:25',
            'instagram_handle' => 'nullable|string|max:100',
            'email' => 'nullable|email|max:150',
            'source_channel' => 'nullable|in:INSTAGRAM,WHATSAPP,REFERRAL,DIRECT',
            'delivery_address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'pincode' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
            'status' => 'nullable|in:ACTIVE,INACTIVE',
        ]);

        // Phone Duplicate Detection
        $cleanPhone = preg_replace('/[^0-9]/', '', $validated['phone']);
        if (strlen($cleanPhone) < 5) {
            return $this->sendError('Please enter a valid phone number with at least 5 digits.', 422, 'INVALID_PHONE');
        }
        $existing = Customer::whereRaw("REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?", ["%{$cleanPhone}%"])->first();

        if ($existing) {
            return $this->sendError(
                "A customer profile with this phone number already exists: {$existing->name} ({$existing->customer_code}).",
                422,
                'DUPLICATE_PHONE',
                [
                    'existing_customer' => [
                        'id' => $existing->id,
                        'customer_code' => $existing->customer_code,
                        'name' => $existing->name,
                        'phone' => $existing->phone,
                    ],
                ]
            );
        }

        $validated['source_channel'] = $validated['source_channel'] ?? 'INSTAGRAM';
        $validated['city'] = $validated['city'] ?? 'Alappuzha';
        $validated['status'] = $validated['status'] ?? 'ACTIVE';

        $customer = Customer::create($validated);

        ActivityLog::log(
            $request->user()->id,
            'CUSTOMER_CREATED',
            'Customer',
            $customer->id,
            "Added customer profile for {$customer->name} ({$customer->customer_code})."
        );

        return $this->sendResponse($customer, 'Customer created successfully.', 201);
    }

    public function show(int $id): JsonResponse
    {
        $customer = Customer::with([
            'orders.items',
            'enquiries',
            'notesHistory.author',
            'occasions',
        ])->find($id);

        if (!$customer) {
            return $this->sendError('Customer profile not found.', 404, 'NOT_FOUND');
        }

        $customerData = $customer->toArray();
        $customerData['lifetime_spend'] = (float) $customer->orders
            ->where('status', '!=', 'CANCELLED')
            ->sum('total_paid');
        $customerData['orders_count'] = $customer->orders->count();

        return $this->sendResponse($customerData);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $customer = Customer::find($id);

        if (!$customer) {
            return $this->sendError('Customer not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'phone' => ['sometimes', 'required', 'string', 'max:25'],
            'instagram_handle' => 'nullable|string|max:100',
            'email' => 'nullable|email|max:150',
            'source_channel' => 'nullable|in:INSTAGRAM,WHATSAPP,REFERRAL,DIRECT',
            'delivery_address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'pincode' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
            'status' => 'nullable|in:ACTIVE,INACTIVE',
        ]);

        if (isset($validated['phone']) && $validated['phone'] !== $customer->phone) {
            $cleanPhone = preg_replace('/[^0-9]/', '', $validated['phone']);
            if (strlen($cleanPhone) < 5) {
                return $this->sendError('Please enter a valid phone number with at least 5 digits.', 422, 'INVALID_PHONE');
            }
            $existing = Customer::where('id', '!=', $id)
                ->whereRaw("REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?", ["%{$cleanPhone}%"])
                ->first();

            if ($existing) {
                return $this->sendError(
                    "Cannot update: phone number already belongs to {$existing->name} ({$existing->customer_code}).",
                    422,
                    'DUPLICATE_PHONE'
                );
            }
        }

        $oldValues = $customer->toArray();
        $customer->update($validated);

        ActivityLog::log(
            $request->user()->id,
            'CUSTOMER_UPDATED',
            'Customer',
            $customer->id,
            "Updated customer profile for {$customer->name} ({$customer->customer_code}).",
            $oldValues,
            $customer->toArray()
        );

        return $this->sendResponse($customer, 'Customer profile updated successfully.');
    }

    public function addNote(Request $request, int $id): JsonResponse
    {
        $customer = Customer::find($id);

        if (!$customer) {
            return $this->sendError('Customer not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'note' => 'required|string|max:2000',
        ]);

        $note = CustomerNote::create([
            'customer_id' => $customer->id,
            'user_id' => $request->user()->id,
            'note' => $validated['note'],
        ]);

        ActivityLog::log(
            $request->user()->id,
            'CUSTOMER_NOTE_ADDED',
            'Customer',
            $customer->id,
            "Added an internal note for {$customer->name}."
        );

        return $this->sendResponse($note->load('author'), 'Customer note added.', 201);
    }

    public function importPreview(Request $request): JsonResponse
    {
        $request->validate([
            'rows' => 'required|array|min:1',
            'rows.*.name' => 'required|string',
            'rows.*.phone' => 'required|string',
        ]);

        $rows = $request->input('rows');
        $preview = [];
        $seenPhones = [];
        $validCount = 0;
        $duplicateCount = 0;
        $invalidCount = 0;

        foreach ($rows as $index => $row) {
            $name = trim($row['name'] ?? '');
            $phone = trim($row['phone'] ?? '');
            $cleanPhone = preg_replace('/[^0-9]/', '', $phone);

            if (empty($name) || strlen($cleanPhone) < 7) {
                $preview[] = array_merge($row, [
                    'row_number' => $index + 1,
                    'validation_status' => 'INVALID',
                    'error' => 'Invalid name or phone number format.',
                ]);
                $invalidCount++;
                continue;
            }

            if (in_array($cleanPhone, $seenPhones, true)) {
                $preview[] = array_merge($row, [
                    'row_number' => $index + 1,
                    'validation_status' => 'DUPLICATE',
                    'error' => 'Duplicate phone number within this import file.',
                ]);
                $duplicateCount++;
                continue;
            }

            $existing = Customer::whereRaw("REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?", ["%{$cleanPhone}%"])->first();
            if ($existing) {
                $preview[] = array_merge($row, [
                    'row_number' => $index + 1,
                    'validation_status' => 'DUPLICATE',
                    'error' => "Phone already registered to {$existing->name} ({$existing->customer_code}).",
                ]);
                $duplicateCount++;
                continue;
            }

            $seenPhones[] = $cleanPhone;
            $preview[] = array_merge($row, [
                'row_number' => $index + 1,
                'validation_status' => 'VALID',
                'error' => null,
            ]);
            $validCount++;
        }

        return $this->sendResponse([
            'preview' => $preview,
            'total_rows' => count($rows),
            'valid_count' => $validCount,
            'duplicate_count' => $duplicateCount,
            'invalid_count' => $invalidCount,
        ], 'Import preview generated.');
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'rows' => 'required|array|min:1',
            'rows.*.name' => 'required|string',
            'rows.*.phone' => 'required|string',
        ]);

        $rows = $request->input('rows');
        $importedCount = 0;
        $skippedCount = 0;
        $seenPhones = [];

        DB::beginTransaction();
        try {
            foreach ($rows as $row) {
                $name = trim($row['name'] ?? '');
                $phone = trim($row['phone'] ?? '');
                $cleanPhone = preg_replace('/[^0-9]/', '', $phone);

                if (empty($name) || strlen($cleanPhone) < 7 || in_array($cleanPhone, $seenPhones, true)) {
                    $skippedCount++;
                    continue;
                }

                $existing = Customer::whereRaw("REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?", ["%{$cleanPhone}%"])->first();
                if ($existing) {
                    $skippedCount++;
                    continue;
                }

                $seenPhones[] = $cleanPhone;

                // Imported records must NOT automatically be treated as verified purchases
                Customer::create([
                    'name' => $name,
                    'phone' => $phone,
                    'instagram_handle' => $row['instagram_handle'] ?? null,
                    'email' => $row['email'] ?? null,
                    'source_channel' => $row['source_channel'] ?? 'INSTAGRAM',
                    'city' => $row['city'] ?? 'Alappuzha',
                    'delivery_address' => $row['delivery_address'] ?? null,
                    'notes' => $row['notes'] ?? 'Imported historical record.',
                    'status' => 'ACTIVE',
                ]);

                $importedCount++;
            }

            DB::commit();

            ActivityLog::log(
                $request->user()->id,
                'CUSTOMERS_IMPORTED',
                'Customer',
                0,
                "Batch imported {$importedCount} customers (skipped {$skippedCount} duplicates/invalids)."
            );

            return $this->sendResponse([
                'imported_count' => $importedCount,
                'skipped_count' => $skippedCount,
                'total_processed' => count($rows),
            ], "Successfully imported {$importedCount} customers.");
        } catch (\Throwable $e) {
            DB::rollBack();
            return $this->sendError('Failed to import customers: ' . $e->getMessage(), 500, 'IMPORT_FAILED');
        }
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $customer = Customer::find($id);

        if (!$customer) {
            return $this->sendError('Customer not found.', 404, 'NOT_FOUND');
        }

        $customer->delete();

        ActivityLog::log(
            $request->user()->id,
            'CUSTOMER_DELETED',
            'Customer',
            $id,
            "Soft-deleted customer record for {$customer->name} ({$customer->customer_code})."
        );

        return $this->sendResponse(null, 'Customer deactivated successfully.');
    }
}
