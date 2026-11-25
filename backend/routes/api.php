<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\EnquiryController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\ProductCategoryController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\RefundController;
use App\Http\Controllers\Api\V1\DeliveryController;
use App\Http\Controllers\Api\V1\FulfillmentController;
use App\Http\Controllers\Api\V1\ExpenseController;
use App\Http\Controllers\Api\V1\AnalyticsController;
use App\Http\Controllers\Api\V1\ActivityLogController;
use App\Http\Middleware\ApplyActivePeriodScope;

/*
|--------------------------------------------------------------------------
| API Routes — Ninu Arts Business Manager v1
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {
    // Public Authentication & Catalog Media
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:15,1')
        ->name('login');
    Route::get('/products/images/{filename}', [ProductController::class, 'showImage']);

    // Protected Routes
    Route::middleware(['auth:sanctum', ApplyActivePeriodScope::class])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        // Customer CRM
        Route::post('/customers/import-preview', [CustomerController::class, 'importPreview']);
        Route::post('/customers/import', [CustomerController::class, 'import']);
        Route::post('/customers/{id}/notes', [CustomerController::class, 'addNote']);
        Route::apiResource('customers', CustomerController::class);

        // Enquiries
        Route::post('/enquiries/{id}/follow-ups', [EnquiryController::class, 'addFollowUp']);
        Route::patch('/enquiries/{id}/status', [EnquiryController::class, 'updateStatus']);
        Route::post('/enquiries/{id}/convert', [EnquiryController::class, 'convertToOrder']);
        Route::apiResource('enquiries', EnquiryController::class);

        // Product Offerings & Categories
        Route::post('/products/upload-image', [ProductController::class, 'uploadImage']);
        Route::patch('/products/{id}/restore', [ProductController::class, 'restore']);
        Route::apiResource('products', ProductController::class);
        Route::apiResource('product-categories', ProductCategoryController::class);

        // Orders
        Route::apiResource('orders', OrderController::class);
        Route::patch('/orders/{id}/status', [OrderController::class, 'updateStatus']);

        // Payments & Refunds
        Route::get('/payments', [PaymentController::class, 'index']);
        Route::get('/orders/{orderId}/payments', [PaymentController::class, 'index']);
        Route::post('/orders/{orderId}/payments', [PaymentController::class, 'store']);
        Route::get('/orders/{orderId}/refunds', [RefundController::class, 'index']);

        // Deliveries & Logistics Management (Staff & Owner)
        Route::get('/deliveries/overdue', [DeliveryController::class, 'overdue']);
        Route::patch('/deliveries/{id}/status', [DeliveryController::class, 'updateStatus']);
        Route::post('/deliveries/{id}/dispatch-template', [DeliveryController::class, 'dispatchTemplate']);
        Route::apiResource('deliveries', DeliveryController::class);

        // Backwards compatibility for fulfillment routes
        Route::put('/orders/{orderId}/fulfillment', [FulfillmentController::class, 'update']);
        Route::patch('/orders/{orderId}/fulfillment/status', [FulfillmentController::class, 'updateStatus']);

        // Owner-Only Protected Routes
        Route::middleware('role:OWNER')->group(function () {
            Route::post('/orders/{orderId}/refunds', [RefundController::class, 'store']);

            // Operating Expense Management
            Route::get('/expenses/categories', [ExpenseController::class, 'categories']);
            Route::post('/expense-categories', [ExpenseController::class, 'storeCategory']);
            Route::post('/expenses/upload-receipt', [ExpenseController::class, 'uploadReceipt']);
            Route::get('/expenses/receipts/{filename}', [ExpenseController::class, 'downloadReceipt']);
            Route::apiResource('expenses', ExpenseController::class);

            // Business Analytics & Reports
            Route::get('/analytics/dashboard', [AnalyticsController::class, 'dashboard']);
            Route::get('/analytics/monthly-revenue', [AnalyticsController::class, 'monthlyRevenue']);
            Route::get('/analytics/product-performance', [AnalyticsController::class, 'productPerformance']);
            Route::get('/analytics/order-performance', [AnalyticsController::class, 'orderPerformance']);
            Route::get('/analytics/enquiry-conversion', [AnalyticsController::class, 'enquiryConversion']);
            Route::get('/analytics/customer-analytics', [AnalyticsController::class, 'customerAnalytics']);
            Route::get('/analytics/expense-analytics', [AnalyticsController::class, 'expenseAnalytics']);
            Route::get('/analytics/delayed-orders', [AnalyticsController::class, 'delayedOrders']);

            // Activity & Audit Logs
            Route::get('/activity-logs', [ActivityLogController::class, 'index']);
            Route::get('/activity-logs/entity/{entityType}/{entityId}', [ActivityLogController::class, 'forEntity']);
        });
    });
});
