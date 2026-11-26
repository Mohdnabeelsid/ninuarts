<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Business & Studio Entities (Legal profiles, branches, workshops, brands)
        Schema::create('business_entities', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('legal_name', 200)->nullable();
            $table->string('code', 50)->unique();
            $table->string('entity_type', 50)->default('STUDIO')->index(); // STUDIO, BRANCH, WORKSHOP, BRAND
            $table->string('gstin', 30)->nullable();
            $table->string('pan', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('phone', 30)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('pincode', 20)->nullable();
            $table->string('upi_id', 100)->nullable();
            $table->string('bank_name', 120)->nullable();
            $table->string('bank_account_number', 50)->nullable();
            $table->string('bank_ifsc', 25)->nullable();
            $table->boolean('is_primary')->default(false)->index();
            $table->boolean('is_active')->default(true)->index();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // 2. Vendors, Suppliers & Fulfillment Partner Entities
        Schema::create('vendors', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150)->index();
            $table->string('code', 50)->unique();
            $table->string('entity_type', 50)->default('SUPPLIER')->index(); // SUPPLIER, PRINT_PARTNER, COURIER, SERVICE
            $table->string('contact_person', 120)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('city', 100)->nullable();
            $table->text('address')->nullable();
            $table->string('gstin', 30)->nullable();
            $table->string('upi_id', 100)->nullable();
            $table->string('payment_terms', 50)->default('IMMEDIATE'); // IMMEDIATE, NET_7, NET_15, NET_30, ADVANCE
            $table->string('default_category', 50)->nullable();
            $table->string('tracking_url_template', 255)->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // 3. Optional relational link from expenses to registered vendors (keeps vendor_name intact)
        Schema::table('expenses', function (Blueprint $table) {
            if (!Schema::hasColumn('expenses', 'vendor_id')) {
                $table->foreignId('vendor_id')
                    ->nullable()
                    ->after('payment_method')
                    ->constrained('vendors')
                    ->nullOnDelete();
            }
        });

        // 4. Ensure default Primary Studio entity exists out of the box
        DB::table('business_entities')->updateOrInsert(
            ['code' => 'NINU-HQ'],
            [
                'name' => 'Ninu Arts Studio',
                'legal_name' => 'Ninu Arts Custom Framing & Gifts',
                'entity_type' => 'STUDIO',
                'email' => 'nidha@ninuarts.com',
                'phone' => '+91 94471 00000',
                'city' => 'Alappuzha',
                'state' => 'Kerala',
                'pincode' => '688001',
                'is_primary' => true,
                'is_active' => true,
                'notes' => 'Primary bespoke art, framing & gifting studio.',
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            if (Schema::hasColumn('expenses', 'vendor_id')) {
                $table->dropConstrainedForeignId('vendor_id');
            }
        });

        Schema::dropIfExists('vendors');
        Schema::dropIfExists('business_entities');
    }
};
