<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Customers Table
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('phone', 20)->index();
            $table->string('instagram_handle', 100)->nullable()->index();
            $table->string('email', 150)->nullable();
            $table->enum('source_channel', ['INSTAGRAM', 'WHATSAPP', 'REFERRAL', 'DIRECT'])->default('INSTAGRAM');
            $table->text('delivery_address')->nullable();
            $table->string('city', 100)->default('Alappuzha');
            $table->string('pincode', 10)->nullable();
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        // 2. Customer Notes (Internal Operator Log per client)
        Schema::create('customer_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note');
            $table->timestamps();
        });

        // 3. Customer Occasions (Birthdays, Anniversaries for automated follow-ups)
        Schema::create('customer_occasions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('occasion_name', 100); // e.g. "Wedding Anniversary", "Birthday"
            $table->date('occasion_date');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_occasions');
        Schema::dropIfExists('customer_notes');
        Schema::dropIfExists('customers');
    }
};
