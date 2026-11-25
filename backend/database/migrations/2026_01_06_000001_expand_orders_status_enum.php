<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Normalize any legacy 'READY' value prior to enforcing canonical enum list
        DB::table('orders')
            ->where('status', 'READY')
            ->update(['status' => 'READY_FOR_DELIVERY']);

        $allowed = [
            'DRAFT',
            'PENDING_ADVANCE',
            'CONFIRMED',
            'IN_PROGRESS',
            'READY_FOR_DELIVERY',
            'DISPATCHED',
            'DELIVERED',
            'ON_HOLD',
            'CANCELLED',
        ];

        $driver = DB::getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $enumSql = "'" . implode("','", $allowed) . "'";
            DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM({$enumSql}) NOT NULL DEFAULT 'DRAFT'");
        } elseif ($driver === 'pgsql') {
            $listSql = "'" . implode("','", $allowed) . "'";
            DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check');
            DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ({$listSql}))");
        } else {
            Schema::table('orders', function (Blueprint $table) use ($allowed) {
                $table->enum('status', $allowed)->default('DRAFT')->change();
            });
        }
    }

    public function down(): void
    {
        DB::table('orders')
            ->where('status', 'ON_HOLD')
            ->update(['status' => 'IN_PROGRESS']);

        $original = [
            'DRAFT',
            'PENDING_ADVANCE',
            'CONFIRMED',
            'IN_PROGRESS',
            'READY_FOR_DELIVERY',
            'DISPATCHED',
            'DELIVERED',
            'CANCELLED',
        ];

        $driver = DB::getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $enumSql = "'" . implode("','", $original) . "'";
            DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM({$enumSql}) NOT NULL DEFAULT 'DRAFT'");
        } elseif ($driver === 'pgsql') {
            $listSql = "'" . implode("','", $original) . "'";
            DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check');
            DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ({$listSql}))");
        } else {
            Schema::table('orders', function (Blueprint $table) use ($original) {
                $table->enum('status', $original)->default('DRAFT')->change();
            });
        }
    }
};
