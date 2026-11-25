<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->index(['status', 'created_at'], 'idx_orders_status_created');
            $table->index('payment_status', 'idx_orders_payment_status');
            $table->index('target_delivery_date', 'idx_orders_target_delivery');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->index(['order_id', 'status'], 'idx_payments_order_status');
            $table->index('payment_date', 'idx_payments_date');
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->index('expense_date', 'idx_expenses_date');
            $table->index('payment_method', 'idx_expenses_method');
        });

        Schema::table('deliveries', function (Blueprint $table) {
            $table->index(['status', 'estimated_delivery_date'], 'idx_deliveries_status_est');
        });

        Schema::table('enquiries', function (Blueprint $table) {
            $table->index(['status', 'channel'], 'idx_enquiries_status_channel');
            $table->index('enquiry_date', 'idx_enquiries_date');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('idx_orders_status_created');
            $table->dropIndex('idx_orders_payment_status');
            $table->dropIndex('idx_orders_target_delivery');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('idx_payments_order_status');
            $table->dropIndex('idx_payments_date');
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->dropIndex('idx_expenses_date');
            $table->dropIndex('idx_expenses_method');
        });

        Schema::table('deliveries', function (Blueprint $table) {
            $table->dropIndex('idx_deliveries_status_est');
        });

        Schema::table('enquiries', function (Blueprint $table) {
            $table->dropIndex('idx_enquiries_status_channel');
            $table->dropIndex('idx_enquiries_date');
        });
    }
};
