<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Enhance Expenses table
        Schema::table('expenses', function (Blueprint $table) {
            if (!Schema::hasColumn('expenses', 'attachment_path')) {
                $table->string('attachment_path', 255)->nullable()->after('bill_reference');
            }
            if (!Schema::hasColumn('expenses', 'notes')) {
                $table->text('notes')->nullable()->after('description');
            }
        });

        // 2. Enhance Deliveries table
        Schema::table('deliveries', function (Blueprint $table) {
            if (!Schema::hasColumn('deliveries', 'recipient_name')) {
                $table->string('recipient_name', 150)->nullable()->after('delivery_type');
            }
            if (!Schema::hasColumn('deliveries', 'recipient_phone')) {
                $table->string('recipient_phone', 30)->nullable()->after('recipient_name');
            }
            if (!Schema::hasColumn('deliveries', 'delivery_address')) {
                $table->text('delivery_address')->nullable()->after('recipient_phone');
            }
            if (!Schema::hasColumn('deliveries', 'shipping_charge')) {
                $table->decimal('shipping_charge', 10, 2)->default(0.00)->after('tracking_number');
            }
            if (!Schema::hasColumn('deliveries', 'delay_reason')) {
                $table->string('delay_reason', 255)->nullable()->after('delivery_notes');
            }
            if (!Schema::hasColumn('deliveries', 'dispatch_date')) {
                $table->dateTime('dispatch_date')->nullable()->after('shipping_charge');
            }
        });

        // 3. Seed Default Expense Categories
        $defaultCategories = [
            ['name' => 'Printing', 'code' => 'PRINTING', 'description' => 'Photo paper, canvas printing, inks, press costs'],
            ['name' => 'Packaging', 'code' => 'PACKAGING', 'description' => 'Boxes, bubble wraps, ribbons, tapes, stickers'],
            ['name' => 'Courier', 'code' => 'COURIER', 'description' => 'Postal, DTDC, Delhivery, speed post, logistics'],
            ['name' => 'Materials', 'code' => 'MATERIALS', 'description' => 'Wood frames, glass, acrylic sheets, resin, canvas boards'],
            ['name' => 'Marketing', 'code' => 'MARKETING', 'description' => 'Instagram promotions, Meta ads, flyers, influencer gifting'],
            ['name' => 'Transportation', 'code' => 'TRANSPORTATION', 'description' => 'Local travel, fuel, material collection logistics'],
            ['name' => 'Software', 'code' => 'SOFTWARE', 'description' => 'Design subscriptions, cloud hosting, Canva, domain'],
            ['name' => 'Other', 'code' => 'OTHER', 'description' => 'Miscellaneous workspace utilities, maintenance'],
        ];

        foreach ($defaultCategories as $cat) {
            DB::table('expense_categories')->updateOrInsert(
                ['code' => $cat['code']],
                [
                    'name' => $cat['name'],
                    'description' => $cat['description'],
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn(['attachment_path', 'notes']);
        });

        Schema::table('deliveries', function (Blueprint $table) {
            $table->dropColumn([
                'recipient_name',
                'recipient_phone',
                'delivery_address',
                'shipping_charge',
                'delay_reason',
                'dispatch_date'
            ]);
        });
    }
};
