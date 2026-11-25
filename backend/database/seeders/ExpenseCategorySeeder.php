<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ExpenseCategorySeeder extends Seeder
{
    public function run(): void
    {
        // Canonical expense categories matching frontend options and analytics taxonomy
        $categories = [
            [
                'name' => 'Printing',
                'code' => 'PRINTING',
                'description' => 'Photo paper, canvas printing, inks, press costs.',
            ],
            [
                'name' => 'Packaging',
                'code' => 'PACKAGING',
                'description' => 'Corrugated boxes, bubble wrap rolls, custom stickers, ribbons.',
            ],
            [
                'name' => 'Courier',
                'code' => 'COURIER',
                'description' => 'Postal, DTDC, Delhivery, speed post, and shipping logistics.',
            ],
            [
                'name' => 'Materials',
                'code' => 'MATERIALS',
                'description' => 'Wood frames, glass mounts, acrylic sheets, resin pigments, canvas boards.',
            ],
            [
                'name' => 'Marketing',
                'code' => 'MARKETING',
                'description' => 'Instagram promotions, Meta ads, flyers, photography backdrops.',
            ],
            [
                'name' => 'Transportation',
                'code' => 'TRANSPORTATION',
                'description' => 'Local conveyance, fuel, material collection logistics.',
            ],
            [
                'name' => 'Software',
                'code' => 'SOFTWARE',
                'description' => 'Design subscriptions, cloud hosting, Canva, domain.',
            ],
            [
                'name' => 'Other',
                'code' => 'OTHER',
                'description' => 'Tools, workshop utilities, maintenance, miscellaneous expenses.',
            ],
        ];

        foreach ($categories as $cat) {
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
}
