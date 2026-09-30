import { NextResponse } from "next/server";
import { getSharedAccountSuspects } from "@/lib/stats/user-insights-sharing";
import { clampInt, parsePeopleQuery } from "@/lib/stats/user-insights-query";
import { STATS_CACHE_TTL_MS, buildStatsKey, getCachedStats, statsScopeKey } from "@/lib/stats/stats-cache";
import { authorizeApiKeyOrSession, isOwnerLike } from "@/lib/auth-guard";
import { scopedServerIds, canAccessServer } from "@/lib/authz";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

/**
 * Accounts streaming concurrently from different IPs. Owner-only: this is
 * account-policing information (who might be sharing a login), not a
 * viewing statistic, so invited viewers and read-only API keys get 403.
 */
export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isOwnerLike(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const { days, serverId, since, until } = parsePeopleQuery(searchParams);
    const limit = clampInt(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const key = buildStatsKey("people-shared", {
            days,
            limit,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const items = getCachedStats(key, STATS_CACHE_TTL_MS, () =>
            getSharedAccountSuspects({ since, until, serverId, allowedServerIds, limit }),
        );
        return NextResponse.json({ days, items });
    } catch (error) {
        Logger.error("Failed to fetch shared account suspects:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
