<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('customer_code', 50)->nullable()->unique()->after('id');
            $table->string('status', 20)->default('ACTIVE')->after('notes');
        });

        Schema::table('enquiries', function (Blueprint $table) {
            $table->decimal('estimated_value', 10, 2)->nullable()->after('budget_range');
            $table->date('enquiry_date')->nullable()->after('estimated_value');
            $table->text('requirements')->nullable()->after('enquiry_date');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('internal_notes')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('enquiries', function (Blueprint $table) {
            $table->dropColumn(['estimated_value', 'enquiry_date', 'requirements']);
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['customer_code', 'status']);
        });
    }
};
