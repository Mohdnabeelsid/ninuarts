<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ActivityLogController extends BaseApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = ActivityLog::with('user');

        if ($action = $request->query('action')) {
            $query->where('action', $action);
        }

        if ($entityType = $request->query('entity_type')) {
            $query->where('entity_type', $entityType);
        }

        $logs = $query->latest('created_at')->paginate($request->query('per_page', 25));

        return $this->sendResponse($logs->items(), null, 200, [
            'current_page' => $logs->currentPage(),
            'per_page' => $logs->perPage(),
            'total' => $logs->total(),
            'last_page' => $logs->lastPage(),
        ]);
    }

    public function forEntity(string $entityType, int $entityId): JsonResponse
    {
        $logs = ActivityLog::where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->with('user')
            ->latest('created_at')
            ->get();

        return $this->sendResponse($logs);
    }
}
