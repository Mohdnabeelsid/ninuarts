<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ApplyActivePeriodScope
{
    /**
     * Handle an incoming request and bind active period range to container.
     */
    public function handle(Request $request, Closure $next)
    {
        $periodString = $request->header('X-Active-Period') ?? $request->query('period');

        $start = null;
        $end = null;
        $resolvedPeriod = 'ALL';

        if ($periodString && strtoupper($periodString) !== 'ALL' && preg_match('/^\d{4}-\d{2}$/', $periodString)) {
            try {
                $start = Carbon::createFromFormat('Y-m', $periodString)->startOfMonth();
                $end = (clone $start)->endOfMonth();
                $resolvedPeriod = $start->format('Y-m');
            } catch (\Exception $e) {
                $start = null;
                $end = null;
                $resolvedPeriod = 'ALL';
            }
        }

        $request->attributes->set('active_period_start', $start);
        $request->attributes->set('active_period_end', $end);
        $request->attributes->set('active_period_string', $resolvedPeriod);

        return $next($request);
    }
}
