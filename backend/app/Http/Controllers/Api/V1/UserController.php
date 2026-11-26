<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class UserController extends BaseApiController
{
    public const ROLES_CONFIG = [
        'OWNER' => [
            'name' => 'Proprietor (Owner)',
            'code' => 'OWNER',
            'badge' => 'OWNER',
            'description' => 'Full administrative, financial, operational, and team governance authority.',
            'permissions' => [
                ['name' => 'Financial P&L & Cash Collections', 'granted' => true],
                ['name' => 'Expense Ledger & Receipt Audits', 'granted' => true],
                ['name' => 'Customer CRM & Lifetime Value', 'granted' => true],
                ['name' => 'Order Management & Price Modifications', 'granted' => true],
                ['name' => 'Refund Processing & Adjustments', 'granted' => true],
                ['name' => 'Deliveries, Logistics & Courier Tracking', 'granted' => true],
                ['name' => 'Product Catalog & Pricing Control', 'granted' => true],
                ['name' => 'Activity Audit Logs (Immutable Trail)', 'granted' => true],
                ['name' => 'Operator & Role Management', 'granted' => true],
                ['name' => 'Workspace Settings & Active Month Scope', 'granted' => true],
            ],
        ],
        'STAFF' => [
            'name' => 'Staff Member',
            'code' => 'STAFF',
            'badge' => 'STAFF',
            'description' => 'Assists with customer inquiries, daily order intake, catalog updates, and shipping dispatches.',
            'permissions' => [
                ['name' => 'Financial P&L & Cash Collections', 'granted' => false],
                ['name' => 'Expense Ledger & Receipt Audits', 'granted' => false],
                ['name' => 'Customer CRM & Contact Info', 'granted' => true],
                ['name' => 'Order Intake & Status Progressions', 'granted' => true],
                ['name' => 'Refund Processing & Adjustments', 'granted' => false],
                ['name' => 'Deliveries, Logistics & Courier Tracking', 'granted' => true],
                ['name' => 'Product Catalog & Offerings View', 'granted' => true],
                ['name' => 'Activity Audit Logs (Immutable Trail)', 'granted' => false],
                ['name' => 'Operator & Role Management', 'granted' => false],
                ['name' => 'Workspace Settings & Active Month Scope', 'granted' => false],
            ],
        ],
    ];

    /**
     * List all dashboard operators and users with summary metrics and activity timestamps.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::query();

        if ($role = $request->query('role')) {
            $query->where('role', strtoupper($role));
        }

        if ($request->has('is_active') && $request->query('is_active') !== '') {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $needle = '%' . strtolower($search) . '%';
            $query->where(function ($q) use ($needle) {
                $q->whereRaw('LOWER(name) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(COALESCE(phone, \'\')) LIKE ?', [$needle]);
            });
        }

        // Defensive relation counting: only query orders if created_by column exists
        $hasCreatedBy = Schema::hasColumn('orders', 'created_by');
        $withCounts = ['payments', 'expenses'];
        if ($hasCreatedBy) {
            $withCounts[] = 'orders';
        }

        $users = $query->withCount($withCounts)
            ->orderByRaw("CASE WHEN role = 'OWNER' THEN 1 ELSE 2 END")
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get();

        // Batch resolve last login timestamps from ActivityLog without N+1 queries
        $lastLogins = ActivityLog::where('action', 'USER_LOGIN')
            ->selectRaw('user_id, MAX(created_at) as last_login')
            ->groupBy('user_id')
            ->pluck('last_login', 'user_id');

        $enriched = $users->map(function (User $u) use ($lastLogins, $hasCreatedBy) {
            $data = $u->toArray();
            $data['last_login_at'] = $lastLogins->get($u->id);
            if (!$hasCreatedBy) {
                $data['orders_count'] = 0;
            }
            return $data;
        });

        return $this->sendResponse($enriched, null, 200, [
            'total' => User::count(),
            'active_count' => User::where('is_active', true)->count(),
            'owner_count' => User::where('role', 'OWNER')->count(),
            'staff_count' => User::where('role', 'STAFF')->count(),
            'roles_matrix' => self::ROLES_CONFIG,
        ]);
    }

    /**
     * Create / Invite a new dashboard user or operator.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|max:150|unique:users,email',
            'phone' => 'nullable|string|max:30',
            'password' => 'required|string|min:6|max:100',
            'role' => 'required|in:OWNER,STAFF',
            'is_active' => 'nullable|boolean',
        ]);

        $role = strtoupper($validated['role']);
        $isActive = array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true;

        $user = DB::transaction(function () use ($validated, $role, $isActive) {
            $newUser = User::create([
                'name' => trim($validated['name']),
                'email' => strtolower(trim($validated['email'])),
                'phone' => isset($validated['phone']) ? trim($validated['phone']) : null,
                'password' => Hash::make($validated['password']),
                'role' => $role,
                'is_active' => $isActive,
            ]);

            // Sync user_roles pivot table if matching role entry exists
            $roleId = DB::table('roles')->where('name', $role)->value('id');
            if ($roleId) {
                DB::table('user_roles')->updateOrInsert(
                    ['user_id' => $newUser->id, 'role_id' => $roleId],
                    ['created_at' => now(), 'updated_at' => now()]
                );
            }

            return $newUser;
        });

        ActivityLog::log(
            $request->user()->id,
            'USER_CREATED',
            'User',
            $user->id,
            "Created operator account '{$user->name}' ({$user->email}, Role: {$user->role})."
        );

        return $this->sendResponse($user->fresh(), 'Operator account created successfully.', 201);
    }

    /**
     * Inspect details, activity stats, and history for a specific operator.
     */
    public function show(int $id): JsonResponse
    {
        $user = User::withCount(['orders', 'payments', 'expenses'])->find($id);
        if (!$user) {
            return $this->sendError('Operator account not found.', 404, 'NOT_FOUND');
        }

        $lastLogin = ActivityLog::where('user_id', $id)
            ->where('action', 'USER_LOGIN')
            ->latest('created_at')
            ->value('created_at');

        $recentActivity = ActivityLog::where('user_id', $id)
            ->latest('created_at')
            ->limit(15)
            ->get();

        $userData = $user->toArray();
        $userData['last_login_at'] = $lastLogin;

        return $this->sendResponse([
            'user' => $userData,
            'stats' => [
                'orders_created' => $user->orders_count,
                'payments_recorded' => $user->payments_count,
                'expenses_recorded' => $user->expenses_count,
                'total_actions_logged' => ActivityLog::where('user_id', $id)->count(),
            ],
            'recent_activity' => $recentActivity,
        ]);
    }

    /**
     * Update an operator's profile, role, or active status.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::find($id);
        if (!$user) {
            return $this->sendError('Operator account not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'email' => "sometimes|required|email|max:150|unique:users,email,{$id}",
            'phone' => 'nullable|string|max:30',
            'role' => 'sometimes|required|in:OWNER,STAFF',
            'is_active' => 'nullable|boolean',
        ]);

        $currentUser = $request->user();

        // Guard: Prevent deactivating oneself
        if (array_key_exists('is_active', $validated) && !$validated['is_active'] && $currentUser->id === $user->id) {
            return $this->sendError(
                'You cannot deactivate your own active operator account.',
                422,
                'CANNOT_DEACTIVATE_SELF'
            );
        }

        // Guard: Prevent deactivating or demoting the last remaining active OWNER
        $newRole = isset($validated['role']) ? strtoupper($validated['role']) : $user->role;
        $newIsActive = array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : $user->is_active;

        if ($user->role === 'OWNER' && ($newRole !== 'OWNER' || !$newIsActive)) {
            $otherActiveOwners = User::where('role', 'OWNER')
                ->where('is_active', true)
                ->where('id', '!=', $user->id)
                ->count();

            if ($otherActiveOwners === 0) {
                return $this->sendError(
                    'Cannot demote or deactivate the only active Owner account. Promote another user to Owner first.',
                    422,
                    'LAST_OWNER_PROTECTED'
                );
            }
        }

        $oldSnapshot = $user->toArray();

        DB::transaction(function () use ($user, $validated, $newRole, $newIsActive) {
            $user->fill($validated);
            if (isset($validated['role'])) {
                $user->role = $newRole;
            }
            if (array_key_exists('is_active', $validated)) {
                $user->is_active = $newIsActive;
            }
            $user->save();

            // Sync user_roles pivot
            if (isset($validated['role'])) {
                $roleId = DB::table('roles')->where('name', $newRole)->value('id');
                if ($roleId) {
                    DB::table('user_roles')->where('user_id', $user->id)->delete();
                    DB::table('user_roles')->insert([
                        'user_id' => $user->id,
                        'role_id' => $roleId,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            // If account was deactivated, revoke all active sessions immediately
            if (!$newIsActive) {
                $user->tokens()->delete();
            }
        });

        ActivityLog::log(
            $currentUser->id,
            'USER_UPDATED',
            'User',
            $user->id,
            "Updated operator account '{$user->name}' ({$user->email}).",
            $oldSnapshot,
            $user->fresh()->toArray()
        );

        return $this->sendResponse($user->fresh(), 'Operator account updated successfully.');
    }

    /**
     * Reset / Change password for an operator account.
     */
    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $user = User::find($id);
        if (!$user) {
            return $this->sendError('Operator account not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'password' => 'required|string|min:6|max:100',
        ]);

        $user->update([
            'password' => Hash::make($validated['password']),
        ]);

        // Revoke active sessions to ensure operator re-authenticates with new password
        if ($request->user()->id !== $user->id) {
            $user->tokens()->delete();
        }

        ActivityLog::log(
            $request->user()->id,
            'USER_PASSWORD_RESET',
            'User',
            $user->id,
            "Reset credentials for operator '{$user->name}' ({$user->email})."
        );

        return $this->sendResponse(null, "Password reset successfully for operator {$user->name}.");
    }

    /**
     * Delete an operator account with historical integrity guards.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = User::find($id);
        if (!$user) {
            return $this->sendError('Operator account not found.', 404, 'NOT_FOUND');
        }

        $currentUser = $request->user();

        // Guard: Cannot delete self
        if ($currentUser->id === $user->id) {
            return $this->sendError(
                'You cannot delete your own operator account.',
                422,
                'CANNOT_DELETE_SELF'
            );
        }

        // Guard: Cannot delete the last remaining OWNER
        if ($user->role === 'OWNER') {
            $otherOwners = User::where('role', 'OWNER')->where('id', '!=', $user->id)->count();
            if ($otherOwners === 0) {
                return $this->sendError(
                    'Cannot delete the sole Owner account.',
                    422,
                    'LAST_OWNER_PROTECTED'
                );
            }
        }

        // Guard: Check if operator has created orders, payments, or expenses
        $ordersCount = $user->orders()->count();
        $paymentsCount = $user->payments()->count();
        $expensesCount = $user->expenses()->count();
        $totalRecords = $ordersCount + $paymentsCount + $expensesCount;

        if ($totalRecords > 0) {
            return $this->sendError(
                "Cannot delete operator: account has {$totalRecords} linked records ({$ordersCount} orders, {$paymentsCount} payments, {$expensesCount} expenses). Deactivate the account instead to maintain historical integrity.",
                422,
                'USER_HAS_RECORDS'
            );
        }

        $oldSnapshot = $user->toArray();
        $name = $user->name;
        $email = $user->email;

        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            DB::table('user_roles')->where('user_id', $user->id)->delete();
            $user->delete();
        });

        ActivityLog::log(
            $currentUser->id,
            'USER_DELETED',
            'User',
            $id,
            "Deleted operator account '{$name}' ({$email}).",
            $oldSnapshot,
            null
        );

        return $this->sendResponse(null, "Operator account {$name} deleted successfully.");
    }
}
