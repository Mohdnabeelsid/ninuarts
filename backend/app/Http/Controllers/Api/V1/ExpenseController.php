<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Carbon\Carbon;

class ExpenseController extends BaseApiController
{
    /**
     * List expenses with category, search, and date filters, plus monthly summary.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Expense::with(['category', 'recorder']);

        if ($categoryId = $request->query('category_id')) {
            $query->where('category_id', $categoryId);
        }

        if ($categoryCode = $request->query('category_code')) {
            $query->whereHas('category', function ($q) use ($categoryCode) {
                $q->where('code', $categoryCode);
            });
        }

        if ($paymentMethod = $request->query('payment_method')) {
            $query->where('payment_method', $paymentMethod);
        }

        if ($fromDate = $request->query('from_date')) {
            $query->whereDate('expense_date', '>=', $fromDate);
        }

        if ($toDate = $request->query('to_date')) {
            $query->whereDate('expense_date', '<=', $toDate);
        }

        if ($month = $request->query('month')) {
            // Month format: YYYY-MM
            $query->where('expense_date', 'like', "{$month}%");
        } elseif (!$fromDate && !$toDate) {
            $periodStart = $request->attributes->get('active_period_start');
            $periodEnd = $request->attributes->get('active_period_end');
            if ($periodStart && $periodEnd) {
                $query->whereDate('expense_date', '>=', $periodStart->toDateString())
                      ->whereDate('expense_date', '<=', $periodEnd->toDateString());
            }
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('vendor_name', 'like', "%{$search}%")
                  ->orWhere('bill_reference', 'like', "%{$search}%")
                  ->orWhere('notes', 'like', "%{$search}%");
            });
        }

        // Clone query for monthly/filter summary
        $summaryQuery = clone $query;
        $totalAmount = (float)$summaryQuery->sum('amount');
        $expenseCount = $summaryQuery->count();

        // Group by category for summary
        $categoryBreakdown = (clone $query)
            ->join('expense_categories', 'expenses.category_id', '=', 'expense_categories.id')
            ->selectRaw('expense_categories.name, expense_categories.code, SUM(expenses.amount) as total_amount, COUNT(expenses.id) as count')
            ->groupBy('expense_categories.id', 'expense_categories.name', 'expense_categories.code')
            ->get();

        $perPage = (int)$request->query('per_page', 25);
        $expenses = $query->latest('expense_date')->paginate($perPage);

        return $this->sendResponse($expenses->items(), null, 200, [
            'current_page' => $expenses->currentPage(),
            'per_page' => $expenses->perPage(),
            'total' => $expenses->total(),
            'last_page' => $expenses->lastPage(),
            'summary' => [
                'total_amount' => round($totalAmount, 2),
                'expense_count' => $expenseCount,
                'category_breakdown' => $categoryBreakdown,
            ],
        ]);
    }

    /**
     * Show single expense details.
     */
    public function show(int $id): JsonResponse
    {
        $expense = Expense::with(['category', 'recorder'])->find($id);

        if (!$expense) {
            return $this->sendError('Expense record not found.', 404, 'NOT_FOUND');
        }

        $logs = ActivityLog::where('entity_type', 'Expense')
            ->where('entity_id', $id)
            ->with('user')
            ->latest()
            ->get();

        return $this->sendResponse([
            'expense' => $expense,
            'audit_trail' => $logs,
        ]);
    }

    /**
     * List all active expense categories.
     */
    public function categories(): JsonResponse
    {
        $categories = ExpenseCategory::where('is_active', true)
            ->withCount('expenses')
            ->get();

        return $this->sendResponse($categories);
    }

    /**
     * Create a new custom expense category.
     */
    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:255',
        ]);

        $code = Str::slug($validated['name'], '_');
        $code = strtoupper($code);

        $existing = ExpenseCategory::where('code', $code)->first();
        if ($existing) {
            return $this->sendResponse($existing, 'Category already exists.');
        }

        $category = ExpenseCategory::create([
            'name' => $validated['name'],
            'code' => $code,
            'description' => $validated['description'] ?? null,
            'is_active' => true,
        ]);

        return $this->sendResponse($category, 'Category created successfully.', 201);
    }

    /**
     * Upload receipt attachment securely into private storage.
     */
    public function uploadReceipt(Request $request): JsonResponse
    {
        $request->validate([
            'receipt' => 'required|file|mimes:jpeg,png,jpg,webp,pdf|max:5120',
        ]);

        $file = $request->file('receipt');
        $ext = strtolower($file->getClientOriginalExtension());
        $fileName = 'receipt_' . time() . '_' . Str::random(6) . '.' . $ext;
        $file->storeAs('receipts', $fileName, 'local');

        return $this->sendResponse([
            'path' => '/api/v1/expenses/receipts/' . $fileName,
            'file_name' => $fileName,
        ], 'Receipt uploaded successfully.');
    }

    /**
     * Secure authenticated access to stored receipt files (Owner-only).
     */
    public function downloadReceipt(string $filename): StreamedResponse|JsonResponse
    {
        $safeName = basename($filename);
        if (!preg_match('/^receipt_[0-9]+_[A-Za-z0-9]+\.(jpeg|jpg|png|webp|pdf)$/i', $safeName)) {
            return $this->sendError('Invalid receipt filename.', 400, 'INVALID_FILENAME');
        }

        $storagePath = 'receipts/' . $safeName;
        if (!Storage::disk('local')->exists($storagePath)) {
            return $this->sendError('Receipt file not found.', 404, 'NOT_FOUND');
        }

        return Storage::disk('local')->response($storagePath, $safeName, [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    /**
     * Store a new expense with category resolution and audit trail.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => 'nullable|exists:expense_categories,id',
            'custom_category' => 'nullable|string|max:100',
            'amount' => 'required|numeric|min:0.5',
            'expense_date' => 'required|date',
            'payment_method' => 'required|in:UPI,BANK_TRANSFER,CASH',
            'vendor_name' => 'nullable|string|max:150',
            'bill_reference' => 'nullable|string|max:100',
            'description' => 'required|string|max:500',
            'attachment_path' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        // Resolve or create category
        $categoryId = $validated['category_id'] ?? null;
        if (!$categoryId && !empty($validated['custom_category'])) {
            $catCode = strtoupper(Str::slug($validated['custom_category'], '_'));
            $cat = ExpenseCategory::firstOrCreate(
                ['code' => $catCode],
                ['name' => $validated['custom_category'], 'is_active' => true]
            );
            $categoryId = $cat->id;
        }

        if (!$categoryId) {
            // Default to 'OTHER' if no category provided
            $other = ExpenseCategory::firstOrCreate(
                ['code' => 'OTHER'],
                ['name' => 'Other', 'is_active' => true]
            );
            $categoryId = $other->id;
        }

        $expense = Expense::create([
            'category_id' => $categoryId,
            'amount' => round((float)$validated['amount'], 2),
            'expense_date' => $validated['expense_date'],
            'payment_method' => $validated['payment_method'],
            'vendor_name' => $validated['vendor_name'] ?? null,
            'bill_reference' => $validated['bill_reference'] ?? null,
            'description' => $validated['description'],
            'attachment_path' => $validated['attachment_path'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'recorded_by' => $request->user()->id,
        ]);

        ActivityLog::log(
            $request->user()->id,
            'EXPENSE_CREATED',
            'Expense',
            $expense->id,
            "Recorded expense #{$expense->id} of INR {$expense->amount} for '{$expense->description}'.",
            null,
            $expense->toArray()
        );

        return $this->sendResponse($expense->load('category'), 'Expense recorded successfully.', 201);
    }

    /**
     * Update an existing expense with audit trail.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $expense = Expense::find($id);

        if (!$expense) {
            return $this->sendError('Expense record not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'category_id' => 'nullable|exists:expense_categories,id',
            'custom_category' => 'nullable|string|max:100',
            'amount' => 'sometimes|numeric|min:0.5',
            'expense_date' => 'sometimes|date',
            'payment_method' => 'sometimes|in:UPI,BANK_TRANSFER,CASH',
            'vendor_name' => 'nullable|string|max:150',
            'bill_reference' => 'nullable|string|max:100',
            'description' => 'sometimes|string|max:500',
            'attachment_path' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        if (!empty($validated['custom_category'])) {
            $catCode = strtoupper(Str::slug($validated['custom_category'], '_'));
            $cat = ExpenseCategory::firstOrCreate(
                ['code' => $catCode],
                ['name' => $validated['custom_category'], 'is_active' => true]
            );
            $validated['category_id'] = $cat->id;
            unset($validated['custom_category']);
        }

        $oldSnapshot = $expense->toArray();

        $expense->fill($validated);
        if (isset($validated['amount'])) {
            $expense->amount = round((float)$validated['amount'], 2);
        }
        $expense->save();

        ActivityLog::log(
            $request->user()->id,
            'EXPENSE_UPDATED',
            'Expense',
            $expense->id,
            "Updated expense record #{$expense->id} (Amount: INR {$expense->amount}).",
            $oldSnapshot,
            $expense->toArray()
        );

        return $this->sendResponse($expense->load('category'), 'Expense updated successfully.');
    }

    /**
     * Delete an expense record with audit trail.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $expense = Expense::find($id);

        if (!$expense) {
            return $this->sendError('Expense record not found.', 404, 'NOT_FOUND');
        }

        $oldSnapshot = $expense->toArray();
        $expense->delete();

        ActivityLog::log(
            $request->user()->id,
            'EXPENSE_DELETED',
            'Expense',
            $id,
            "Deleted expense record #{$id} of INR {$expense->amount} ('{$expense->description}').",
            $oldSnapshot,
            null
        );

        return $this->sendResponse(null, 'Expense deleted successfully.');
    }
}
