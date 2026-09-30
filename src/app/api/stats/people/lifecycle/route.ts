import { NextResponse } from "next/server";
import { getUserLifecycle } from "@/lib/stats/user-insights-lifecycle";
import { parsePeopleQuery } from "@/lib/stats/user-insights-query";
import { STATS_CACHE_TTL_MS, buildStatsKey, getCachedStats, statsScopeKey } from "@/lib/stats/stats-cache";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { scopedServerIds, canAccessServer } from "@/lib/authz";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Active / new / returning / dormant users per month + the current dormant list. */
export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { days, serverId, since, until } = parsePeopleQuery(new URL(request.url).searchParams);
    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const key = buildStatsKey("people-lifecycle", {
            days,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const data = getCachedStats(key, STATS_CACHE_TTL_MS, () =>
            getUserLifecycle({ since, until, serverId, allowedServerIds }),
        );
        return NextResponse.json({ days, ...data });
    } catch (error) {
        Logger.error("Failed to fetch user lifecycle:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
