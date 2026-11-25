<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Enquiry;
use App\Models\Customer;
use App\Models\FollowUp;
use App\Models\ActivityLog;
use App\Services\OrderService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class EnquiryController extends BaseApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Enquiry::with(['customer', 'convertedOrder', 'followUps']);

        if ($channel = $request->query('channel')) {
            $query->where('channel', $channel);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('product_interest', 'like', "%{$search}%")
                  ->orWhere('requirements', 'like', "%{$search}%")
                  ->orWhere('notes', 'like', "%{$search}%")
                  ->orWhereHas('customer', function ($cq) use ($search) {
                      $cq->where('name', 'like', "%{$search}%")
                         ->orWhere('phone', 'like', "%{$search}%")
                         ->orWhere('customer_code', 'like', "%{$search}%")
                         ->orWhere('instagram_handle', 'like', "%{$search}%");
                  });
            });
        }

        $enquiries = $query->latest('enquiry_date')->latest('id')->paginate($request->query('per_page', 20));

        return $this->sendResponse($enquiries->items(), null, 200, [
            'current_page' => $enquiries->currentPage(),
            'per_page' => $enquiries->perPage(),
            'total' => $enquiries->total(),
            'last_page' => $enquiries->lastPage(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (empty($request->input('customer_id')) && is_array($request->input('customer'))) {
            $request->merge([
                'customer_name' => $request->input('customer_name') ?? $request->input('customer.name'),
                'customer_phone' => $request->input('customer_phone') ?? $request->input('customer.phone'),
                'instagram_handle' => $request->input('instagram_handle') ?? $request->input('customer.instagram_handle'),
            ]);
        }

        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'customer_name' => 'required_without:customer_id|string|max:150',
            'customer_phone' => 'required_without:customer_id|string|max:25',
            'instagram_handle' => 'nullable|string|max:100',
            'channel' => 'required|in:INSTAGRAM,WHATSAPP,CALL,OTHER',
            'product_interest' => 'required|string|max:255',
            'budget_range' => 'nullable|string|max:100',
            'estimated_value' => 'nullable|numeric|min:0',
            'enquiry_date' => 'nullable|date',
            'requirements' => 'nullable|string',
            'status' => 'nullable|in:NEW,CONTACTED,DISCUSSING,QUOTED,ESTIMATE_SENT,CONVERTED,LOST',
            'follow_up_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $customerId = $validated['customer_id'] ?? null;

        // Auto-resolve or reuse customer to prevent duplicates
        if (!$customerId) {
            $cleanPhone = preg_replace('/[^0-9]/', '', $validated['customer_phone']);
            if (strlen($cleanPhone) < 5) {
                return $this->sendError('Please provide a valid phone number with at least 5 digits.', 422, 'INVALID_PHONE');
            }
            $existingCustomer = Customer::whereRaw("REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?", ["%{$cleanPhone}%"])->first();

            if ($existingCustomer) {
                $customerId = $existingCustomer->id;
            } else {
                $newCustomer = Customer::create([
                    'name' => $validated['customer_name'],
                    'phone' => $validated['customer_phone'],
                    'instagram_handle' => $validated['instagram_handle'] ?? null,
                    'source_channel' => in_array($validated['channel'], ['INSTAGRAM', 'WHATSAPP']) ? $validated['channel'] : 'DIRECT',
                    'city' => 'Alappuzha',
                    'status' => 'ACTIVE',
                ]);
                $customerId = $newCustomer->id;
            }
        }

        $enquiry = Enquiry::create([
            'customer_id' => $customerId,
            'channel' => $validated['channel'],
            'product_interest' => $validated['product_interest'],
            'budget_range' => $validated['budget_range'] ?? null,
            'estimated_value' => $validated['estimated_value'] ?? null,
            'enquiry_date' => $validated['enquiry_date'] ?? now()->toDateString(),
            'requirements' => $validated['requirements'] ?? null,
            'status' => $validated['status'] ?? 'NEW',
            'follow_up_date' => $validated['follow_up_date'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        ActivityLog::log(
            $request->user()->id,
            'ENQUIRY_CREATED',
            'Enquiry',
            $enquiry->id,
            "Logged incoming enquiry from {$enquiry->channel}: {$enquiry->product_interest}."
        );

        return $this->sendResponse($enquiry->load('customer'), 'Enquiry created successfully.', 201);
    }

    public function show(int $id): JsonResponse
    {
        $enquiry = Enquiry::with(['customer.orders', 'convertedOrder', 'followUps.operator'])->find($id);

        if (!$enquiry) {
            return $this->sendError('Enquiry record not found.', 404, 'NOT_FOUND');
        }

        return $this->sendResponse($enquiry);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $enquiry = Enquiry::find($id);

        if (!$enquiry) {
            return $this->sendError('Enquiry not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'channel' => 'sometimes|required|in:INSTAGRAM,WHATSAPP,CALL,OTHER',
            'product_interest' => 'sometimes|required|string|max:255',
            'budget_range' => 'nullable|string|max:100',
            'estimated_value' => 'nullable|numeric|min:0',
            'enquiry_date' => 'nullable|date',
            'requirements' => 'nullable|string',
            'status' => 'sometimes|required|in:NEW,CONTACTED,DISCUSSING,QUOTED,ESTIMATE_SENT,CONVERTED,LOST',
            'lost_reason' => 'nullable|string|max:255',
            'follow_up_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $enquiry->update($validated);

        ActivityLog::log(
            $request->user()->id,
            'ENQUIRY_UPDATED',
            'Enquiry',
            $enquiry->id,
            "Updated enquiry details for lead #{$enquiry->id}."
        );

        return $this->sendResponse($enquiry->load('customer'), 'Enquiry updated successfully.');
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $enquiry = Enquiry::find($id);

        if (!$enquiry) {
            return $this->sendError('Enquiry not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'status' => 'required|in:NEW,CONTACTED,DISCUSSING,QUOTED,ESTIMATE_SENT,CONVERTED,LOST',
            'lost_reason' => 'nullable|string|max:255',
        ]);

        $fromStatus = $enquiry->status;
        $enquiry->status = $validated['status'];
        if ($validated['status'] === 'LOST') {
            $enquiry->lost_reason = $validated['lost_reason'] ?? 'Customer dropped / no response';
        }
        $enquiry->save();

        ActivityLog::log(
            $request->user()->id,
            'ENQUIRY_STATUS_CHANGED',
            'Enquiry',
            $enquiry->id,
            "Shifted enquiry status from {$fromStatus} to {$enquiry->status}."
        );

        return $this->sendResponse($enquiry->load('customer'), 'Enquiry status updated.');
    }

    public function addFollowUp(Request $request, int $id): JsonResponse
    {
        $enquiry = Enquiry::find($id);

        if (!$enquiry) {
            return $this->sendError('Enquiry not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'scheduled_date' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        $followUp = FollowUp::create([
            'enquiry_id' => $enquiry->id,
            'user_id' => $request->user()->id,
            'scheduled_date' => $validated['scheduled_date'],
            'notes' => $validated['notes'] ?? null,
            'status' => 'PENDING',
        ]);

        $enquiry->update([
            'follow_up_date' => substr($validated['scheduled_date'], 0, 10),
            'status' => $enquiry->status === 'NEW' ? 'CONTACTED' : $enquiry->status,
        ]);

        ActivityLog::log(
            $request->user()->id,
            'FOLLOW_UP_SCHEDULED',
            'Enquiry',
            $enquiry->id,
            "Scheduled follow-up on {$followUp->scheduled_date->format('d-M-Y H:i')}."
        );

        return $this->sendResponse($followUp->load('operator'), 'Follow-up scheduled.', 201);
    }

    /**
     * Convert Enquiry to Customer and Order with duplicate prevention.
     */
    public function convertToOrder(Request $request, int $id, OrderService $orderService): JsonResponse
    {
        $enquiry = Enquiry::with(['customer', 'convertedOrder'])->find($id);

        if (!$enquiry) {
            return $this->sendError('Enquiry not found.', 404, 'NOT_FOUND');
        }

        // CRITICAL REQUIREMENT: Prevent Accidental Double Conversion
        if ($enquiry->status === 'CONVERTED' || $enquiry->converted_order_id !== null) {
            $existingOrder = $enquiry->convertedOrder;
            $orderNum = $existingOrder ? $existingOrder->order_number : ('ID #' . $enquiry->converted_order_id);
            return $this->sendError(
                "This enquiry has already been converted to Order {$orderNum}. Double conversion is prevented to protect financial integrity.",
                422,
                'ENQUIRY_ALREADY_CONVERTED',
                ['converted_order' => $existingOrder]
            );
        }

        $validated = $request->validate([
            'advance_amount_required' => 'required|numeric|min:0',
            'delivery_charge' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'target_delivery_date' => 'nullable|date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.item_name' => 'required|string|max:200',
            'items.*.item_type' => 'required|in:CATALOG,CUSTOM',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.customization_details' => 'nullable|string',
        ]);

        // CRITICAL REQUIREMENT: Reuse existing customer and prevent duplicate customer creation
        $customer = $enquiry->customer;

        $orderData = [
            'customer_id' => $customer->id,
            'advance_amount_required' => $validated['advance_amount_required'],
            'delivery_charge' => $validated['delivery_charge'] ?? 0.00,
            'discount_amount' => $validated['discount_amount'] ?? 0.00,
            'target_delivery_date' => $validated['target_delivery_date'] ?? null,
            'internal_notes' => "Converted from Enquiry #{$enquiry->id} ({$enquiry->channel}). Requirements: " . ($enquiry->requirements ?? $enquiry->notes ?? 'None'),
            'items' => $validated['items'],
        ];

        return DB::transaction(function () use ($orderData, $enquiry, $customer, $orderService, $request) {
            $order = $orderService->createOrder($orderData, $request->user()->id);

            // Link the eventual order to the original enquiry and update state
            $enquiry->update([
                'status' => 'CONVERTED',
                'converted_order_id' => $order->id,
            ]);

            ActivityLog::log(
                $request->user()->id,
                'LEAD_CONVERTED',
                'Enquiry',
                $enquiry->id,
                "Converted enquiry #{$enquiry->id} into Draft Order {$order->order_number} for client {$customer->name}."
            );

            return $this->sendResponse([
                'order' => $order,
                'customer' => $customer,
                'enquiry' => $enquiry,
            ], "Enquiry converted to Order {$order->order_number} successfully.", 201);
        });
    }
}
