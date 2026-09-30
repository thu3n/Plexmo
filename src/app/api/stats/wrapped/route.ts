import { NextResponse } from "next/server";
import { getWrapped, yearBounds } from "@/lib/stats/wrapped";
import { getWrappedPeople, getWrappedYears } from "@/lib/stats/wrapped-people";
import { resolveWrappedTarget } from "@/lib/stats/wrapped-access";
import { STATS_CACHE_TTL_MS, buildStatsKey, getCachedStats, statsScopeKey } from "@/lib/stats/stats-cache";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { scopedServerIds } from "@/lib/authz";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/stats/wrapped?year=2026&user=<accountId>
 *
 * Authorization (resolveWrappedTarget): a viewer only ever gets their own
 * Wrapped — naming anyone else is a 403, not a silent fallback. Owners (and
 * read-only API keys, which already see every user via the history export)
 * may pick any user; data stays inside the caller's server scope either way.
 */
export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const target = resolveWrappedTarget(user, searchParams.get("user"), searchParams.get("year"), new Date());
    if (!target.ok) {
        return NextResponse.json({ error: target.error }, { status: target.status });
    }
    const { userId, year, canPickUser } = target;

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const scope = statsScopeKey(allowedServerIds);
        const wrapped = getCachedStats(buildStatsKey("wrapped", { user: userId, year, scope }), STATS_CACHE_TTL_MS, () =>
            getWrapped({ userId, year, allowedServerIds }),
        );
        const years = getWrappedYears(userId, allowedServerIds);
        const { since, until } = yearBounds(year);
        const people = canPickUser
            ? getCachedStats(buildStatsKey("wrapped-people", { year, scope }), STATS_CACHE_TTL_MS, () =>
                  getWrappedPeople(since, until, allowedServerIds),
              )
            : null;

        return NextResponse.json({ wrapped, years, people, canPickUser });
    } catch (error) {
        Logger.error("Failed to build Wrapped:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
