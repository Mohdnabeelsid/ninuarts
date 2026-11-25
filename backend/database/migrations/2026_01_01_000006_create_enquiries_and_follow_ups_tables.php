<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Leads & Enquiries Pipeline
        Schema::create('enquiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->enum('channel', ['INSTAGRAM', 'WHATSAPP', 'CALL', 'OTHER'])->default('INSTAGRAM');
            $table->string('product_interest', 255);
            $table->string('budget_range', 100)->nullable();
            $table->string('status', 50)->default('NEW');
            $table->string('lost_reason', 255)->nullable();
            $table->date('follow_up_date')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('converted_order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->timestamps();
        });

        // 2. Follow-Ups Scheduled Calls/Messages
        Schema::create('follow_ups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enquiry_id')->constrained('enquiries')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('scheduled_date');
            $table->dateTime('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['PENDING', 'COMPLETED', 'CANCELLED'])->default('PENDING');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('follow_ups');
        Schema::dropIfExists('enquiries');
    }
};
