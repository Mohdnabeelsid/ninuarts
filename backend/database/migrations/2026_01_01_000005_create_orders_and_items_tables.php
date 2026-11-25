<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Orders Master Table
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 50)->unique();
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $table->enum('status', [
                'DRAFT',
                'PENDING_ADVANCE',
                'CONFIRMED',
                'IN_PROGRESS',
                'READY_FOR_DELIVERY',
                'DISPATCHED',
                'DELIVERED',
                'CANCELLED'
            ])->default('DRAFT');
            $table->enum('payment_status', [
                'UNPAID',
                'PARTIALLY_PAID',
                'PAID',
                'OVERPAID'
            ])->default('UNPAID');

            // Strict Financial Precision: DECIMAL(10,2) in INR
            $table->decimal('subtotal_amount', 10, 2)->default(0.00);
            $table->decimal('delivery_charge', 10, 2)->default(0.00);
            $table->decimal('discount_amount', 10, 2)->default(0.00);
            $table->decimal('total_amount', 10, 2)->default(0.00);
            $table->decimal('advance_amount_required', 10, 2)->default(0.00);
            $table->decimal('total_paid', 10, 2)->default(0.00);
            $table->decimal('balance_amount', 10, 2)->default(0.00);

            $table->timestamp('confirmed_at')->nullable();
            $table->dateTime('target_delivery_date')->nullable();
            $table->text('internal_notes')->nullable();
            $table->timestamps();
        });

        // 2. Order Line Items
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('item_name', 200);
            $table->enum('item_type', ['CATALOG', 'CUSTOM'])->default('CATALOG');
            $table->decimal('unit_price', 10, 2);
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('total_price', 10, 2);
            $table->text('customization_details')->nullable();
            $table->timestamps();
        });

        // 3. Order Item Costs (Internal margin & materials breakdown)
        Schema::create('order_item_costs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_item_id')->constrained('order_items')->cascadeOnDelete();
            $table->enum('cost_type', ['RAW_MATERIAL', 'PRINT', 'FRAME', 'PACKAGING', 'OTHER'])->default('RAW_MATERIAL');
            $table->decimal('amount', 10, 2);
            $table->string('description', 255)->nullable();
            $table->timestamps();
        });

        // 4. Order Status History (Audit trail of lifecycle state transitions)
        Schema::create('order_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('from_status', 50)->nullable();
            $table->string('to_status', 50);
            $table->text('note')->nullable();
            $table->timestamps();
        });

        // 5. Order Modification History (Audit trail of customer amendments post-confirmation)
        Schema::create('order_modification_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('modified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('previous_total', 10, 2);
            $table->decimal('new_total', 10, 2);
            $table->text('change_summary');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_modification_history');
        Schema::dropIfExists('order_status_history');
        Schema::dropIfExists('order_item_costs');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
