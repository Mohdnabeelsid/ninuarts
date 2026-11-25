<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProductCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Customized Photo Frames',
                'slug' => 'photo-frames',
                'description' => 'Bespoke wooden and acrylic frames with archival prints and mounts.',
            ],
            [
                'name' => 'Magazine-Style Albums',
                'slug' => 'magazine-albums',
                'description' => 'High-fashion editorial layout photobooks replicating luxury magazines.',
            ],
            [
                'name' => 'Gift Hampers',
                'slug' => 'gift-hampers',
                'description' => 'Curated custom gift boxes with bespoke keepsakes and chocolates.',
            ],
            [
                'name' => 'Custom Gifting Products',
                'slug' => 'custom-gifts',
                'description' => 'Spotify acrylic stands, resin clocks, engraved plaques and custom keepsakes.',
            ],
        ];

        foreach ($categories as $cat) {
            DB::table('product_categories')->insertOrIgnore([
                'name' => $cat['name'],
                'slug' => $cat['slug'],
                'description' => $cat['description'],
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
