<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\User;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends BaseApiController
{
    /**
     * Authenticate operator and issue Sanctum token.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            return $this->sendError(
                'Invalid email or password credentials.',
                401,
                'INVALID_CREDENTIALS'
            );
        }

        if (!$user->is_active) {
            return $this->sendError(
                'Your operator account is currently deactivated. Please contact proprietor.',
                403,
                'ACCOUNT_DEACTIVATED'
            );
        }

        // Generate Sanctum access token
        $token = $user->createToken('ninu_arts_auth_token')->plainTextToken;

        // Log audit trail
        ActivityLog::log(
            $user->id,
            'USER_LOGIN',
            'User',
            $user->id,
            "Operator {$user->name} logged into the business workspace."
        );

        return $this->sendResponse([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'is_active' => $user->is_active,
            ],
            'token' => $token,
        ], 'Authentication successful.');
    }

    /**
     * Terminate current operator session and revoke token.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();

            ActivityLog::log(
                $user->id,
                'USER_LOGOUT',
                'User',
                $user->id,
                "Operator {$user->name} logged out."
            );
        }

        return $this->sendResponse(null, 'Logged out successfully.');
    }

    /**
     * Retrieve currently authenticated operator profile.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return $this->sendResponse([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'is_active' => $user->is_active,
            ],
        ]);
    }
}
