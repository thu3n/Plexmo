import { NextResponse } from "next/server";
import { getUserProfile } from "@/lib/stats/user-insights-profile";
import { MAX_ACCOUNT_ID_LENGTH, parsePeopleQuery } from "@/lib/stats/user-insights-query";
import { STATS_CACHE_TTL_MS, buildStatsKey, getCachedStats, statsScopeKey } from "@/lib/stats/stats-cache";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { scopedServerIds, canAccessServer } from "@/lib/authz";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Viewing profile for one account: hours, weekday/weekend, clients, completion, genres. */
export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    if (!accountId || accountId.length > MAX_ACCOUNT_ID_LENGTH) {
        return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
    }
    const { days, serverId, since, until } = parsePeopleQuery(searchParams);
    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const key = buildStatsKey("people-profile", {
            accountId,
            days,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const profile = getCachedStats(key, STATS_CACHE_TTL_MS, () =>
            getUserProfile({ accountId, since, until, serverId, allowedServerIds }),
        );
        if (!profile) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        return NextResponse.json({ days, profile });
    } catch (error) {
        Logger.error("Failed to fetch user profile:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
