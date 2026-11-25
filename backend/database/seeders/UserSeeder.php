<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Seed Roles
        $ownerRoleId = DB::table('roles')->insertGetId([
            'name' => 'OWNER',
            'display_name' => 'Proprietor (Owner)',
            'description' => 'Full administrative, financial and operational authority.',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $staffRoleId = DB::table('roles')->insertGetId([
            'name' => 'STAFF',
            'display_name' => 'Staff Member',
            'description' => 'Assists with order processing, leads and logistics without access to financial P&L.',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 2. Seed Initial Owner Account: Nidha
        $ownerPassword = env('OWNER_DEFAULT_PASSWORD', 'Password@123');
        $owner = User::create([
            'name' => 'Nidha',
            'email' => 'nidha@ninuarts.com',
            'phone' => '+91 94471 00000',
            'password' => Hash::make($ownerPassword),
            'role' => 'OWNER',
            'is_active' => true,
        ]);

        DB::table('user_roles')->insert([
            'user_id' => $owner->id,
            'role_id' => $ownerRoleId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 3. Seed Development Staff Account
        $staff = User::create([
            'name' => 'Ninu Arts Assistant',
            'email' => 'staff@ninuarts.com',
            'phone' => '+91 98470 00000',
            'password' => Hash::make('Password@123'),
            'role' => 'STAFF',
            'is_active' => true,
        ]);

        DB::table('user_roles')->insert([
            'user_id' => $staff->id,
            'role_id' => $staffRoleId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
