<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class BaseApiController extends Controller
{
    /**
     * Return standardized success JSON response.
     */
    protected function sendResponse(mixed $data = null, ?string $message = null, int $code = 200, array $meta = []): JsonResponse
    {
        $response = [
            'success' => true,
        ];

        if ($message !== null) {
            $response['message'] = $message;
        }

        if ($data !== null) {
            $response['data'] = $data;
        }

        if (!empty($meta)) {
            $response['meta'] = $meta;
        }

        return response()->json($response, $code);
    }

    /**
     * Return standardized error JSON response.
     */
    protected function sendError(string $message, int $code = 400, string $errorCode = 'BAD_REQUEST', mixed $details = null): JsonResponse
    {
        $response = [
            'success' => false,
            'error' => [
                'code' => $errorCode,
                'message' => $message,
            ],
        ];

        if ($details !== null) {
            $response['error']['details'] = $details;
        }

        return response()->json($response, $code);
    }
}
