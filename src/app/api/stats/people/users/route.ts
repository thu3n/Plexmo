import { NextResponse } from "next/server";
import { listProfileUsers } from "@/lib/stats/user-insights-profile";
import { clampInt, parsePeopleQuery } from "@/lib/stats/user-insights-query";
import { STATS_CACHE_TTL_MS, buildStatsKey, getCachedStats, statsScopeKey } from "@/lib/stats/stats-cache";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { scopedServerIds, canAccessServer } from "@/lib/authz";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Users with plays in the window (most active first) — options for the profile picker. */
export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { days, serverId, since, until } = parsePeopleQuery(searchParams);
    const limit = clampInt(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const key = buildStatsKey("people-users", {
            days,
            limit,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const items = getCachedStats(key, STATS_CACHE_TTL_MS, () =>
            listProfileUsers({ since, until, serverId, allowedServerIds, limit }),
        );
        return NextResponse.json({ days, items });
    } catch (error) {
        Logger.error("Failed to fetch profile users:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
