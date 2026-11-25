<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect(env('FRONTEND_URL', 'http://localhost:3000'));
});

Route::get('/api', function () {
    return response()->json([
        'service' => 'Ninu Arts Business Manager API',
        'status' => 'ONLINE',
        'version' => 'v1',
        'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),
    ]);
});
