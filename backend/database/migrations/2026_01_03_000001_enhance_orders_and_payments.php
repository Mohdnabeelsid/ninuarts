<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Soft Deletes and Status Flexibility on Orders
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'deleted_at')) {
                $table->softDeletes()->after('updated_at');
            }
        });

        // 2. Enhance Order Modification History
        Schema::table('order_modification_history', function (Blueprint $table) {
            if (!Schema::hasColumn('order_modification_history', 'previous_values')) {
                $table->json('previous_values')->nullable()->after('modified_by');
            }
            if (!Schema::hasColumn('order_modification_history', 'new_values')) {
                $table->json('new_values')->nullable()->after('previous_values');
            }
            if (!Schema::hasColumn('order_modification_history', 'modification_reason')) {
                $table->text('modification_reason')->nullable()->after('new_values');
            }
        });

        // 3. Enhance Refunds with Notes
        Schema::table('refunds', function (Blueprint $table) {
            if (!Schema::hasColumn('refunds', 'notes')) {
                $table->text('notes')->nullable()->after('reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            $table->dropColumn(['notes']);
        });

        Schema::table('order_modification_history', function (Blueprint $table) {
            $table->dropColumn(['previous_values', 'new_values', 'modification_reason']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
