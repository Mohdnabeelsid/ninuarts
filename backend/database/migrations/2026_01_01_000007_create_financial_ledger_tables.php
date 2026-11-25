<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Payments Ledger
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->restrictOnDelete();
            $table->enum('payment_type', ['ADVANCE', 'PARTIAL', 'INTERIM', 'ADDITIONAL', 'BALANCE_FINAL'])->default('ADVANCE');
            $table->decimal('amount', 10, 2);
            $table->enum('payment_method', ['UPI', 'BANK_TRANSFER', 'CASH'])->default('UPI');
            $table->string('transaction_reference', 150)->nullable()->index(); // Optional across all methods
            $table->dateTime('payment_date');
            $table->enum('status', ['SUCCESS', 'VOIDED'])->default('SUCCESS');
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 2. Refunds Ledger
        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->restrictOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->decimal('amount', 10, 2);
            $table->enum('refund_method', ['UPI', 'BANK_TRANSFER', 'CASH'])->default('UPI');
            $table->string('transaction_reference', 150)->nullable();
            $table->string('reason', 255);
            $table->dateTime('refund_date');
            $table->enum('status', ['COMPLETED', 'FAILED'])->default('COMPLETED');
            $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 3. Operating Expense Categories
        Schema::create('expense_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('code', 50)->unique(); // RAW_MATERIALS, PACKAGING, COURIER_SHIPPING, etc.
            $table->string('description', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 4. Operating Expenses Ledger
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('expense_categories')->restrictOnDelete();
            $table->decimal('amount', 10, 2);
            $table->date('expense_date');
            $table->enum('payment_method', ['UPI', 'BANK_TRANSFER', 'CASH'])->default('UPI');
            $table->string('vendor_name', 150)->nullable();
            $table->string('bill_reference', 100)->nullable();
            $table->text('description');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('expense_categories');
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('payments');
    }
};
