<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Deliveries & Logistics Fulfillment
        Schema::create('deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->enum('delivery_type', ['COURIER', 'LOCAL_DELIVERY'])->default('COURIER');
            $table->string('courier_partner', 100)->nullable();
            $table->string('tracking_number', 150)->nullable()->index();
            $table->dateTime('shipped_date')->nullable();
            $table->date('estimated_delivery_date')->nullable();
            $table->dateTime('delivered_date')->nullable();
            $table->text('delivery_notes')->nullable();
            $table->enum('status', [
                'PENDING',
                'READY_FOR_DISPATCH',
                'PACKED',
                'DISPATCHED',
                'SHIPPED',
                'IN_TRANSIT',
                'OUT_FOR_DELIVERY',
                'DELIVERED',
                'DELIVERY_FAILED',
                'RETURNED'
            ])->default('PENDING');
            $table->timestamps();
        });

        // 2. Activity & Audit Logs (Append-only immutable audit trail)
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 100)->index();
            $table->string('entity_type', 100)->index();
            $table->unsignedBigInteger('entity_id')->index();
            $table->text('description');
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        // 3. Business Settings (Global active period, business profile, tax rules)
        Schema::create('business_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->longText('value')->nullable();
            $table->string('group', 50)->default('general');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_settings');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('deliveries');
    }
};
