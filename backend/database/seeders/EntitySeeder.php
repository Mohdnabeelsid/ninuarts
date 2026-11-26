<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class EntitySeeder extends Seeder
{
    public function run(): void
    {
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

        $vendors = [
            [
                'code' => 'VND-KERALA-FRAME-MART',
                'name' => 'Kerala Glass & Frame Mart',
                'entity_type' => 'SUPPLIER',
                'contact_person' => 'Ramesh Nair',
                'phone' => '+91 98472 11223',
                'city' => 'Alappuzha',
                'payment_terms' => 'IMMEDIATE',
                'default_category' => 'MATERIALS',
                'notes' => 'Teak & pine photo frames, anti-glare glass, backing boards.',
            ],
            [
                'code' => 'VND-MALABAR-PRESS',
                'name' => 'Malabar Fine Art Press',
                'entity_type' => 'PRINT_PARTNER',
                'contact_person' => 'Suresh Menon',
                'phone' => '+91 98951 44556',
                'city' => 'Kochi',
                'payment_terms' => 'NET_7',
                'default_category' => 'PRINTING',
                'notes' => 'Archival matte photo prints, magazine albums, metallic foil sleeves.',
            ],
            [
                'code' => 'VND-DTDC',
                'name' => 'DTDC Express',
                'entity_type' => 'COURIER',
                'contact_person' => 'Alappuzha Hub Desk',
                'phone' => '+91 94460 77889',
                'city' => 'Alappuzha',
                'payment_terms' => 'NET_15',
                'default_category' => 'COURIER',
                'tracking_url_template' => 'https://www.dtdc.in/tracking.asp?strCnno={tracking}',
                'notes' => 'Primary interstate courier for framed artwork.',
            ],
            [
                'code' => 'VND-DELHIVERY',
                'name' => 'Delhivery Surface',
                'entity_type' => 'COURIER',
                'contact_person' => 'Kerala Dispatch Support',
                'phone' => '+91 90480 22334',
                'city' => 'Ernakulam',
                'payment_terms' => 'IMMEDIATE',
                'default_category' => 'COURIER',
                'tracking_url_template' => 'https://www.delhivery.com/track-v2/package/{tracking}',
                'notes' => 'Pan-India gift hamper & parcel shipping.',
            ],
        ];

        foreach ($vendors as $vendor) {
            DB::table('vendors')->updateOrInsert(
                ['code' => $vendor['code']],
                [
                    'name' => $vendor['name'],
                    'entity_type' => $vendor['entity_type'],
                    'contact_person' => $vendor['contact_person'],
                    'phone' => $vendor['phone'],
                    'city' => $vendor['city'],
                    'payment_terms' => $vendor['payment_terms'],
                    'default_category' => $vendor['default_category'],
                    'tracking_url_template' => $vendor['tracking_url_template'] ?? null,
                    'is_active' => true,
                    'notes' => $vendor['notes'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}
