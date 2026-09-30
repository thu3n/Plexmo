import { NextResponse } from "next/server";
import { getTopGenres, hasGenreData } from "@/lib/stats/user-insights-genres";
import { MAX_ACCOUNT_ID_LENGTH, clampInt, parsePeopleQuery } from "@/lib/stats/user-insights-query";
import { STATS_CACHE_TTL_MS, buildStatsKey, getCachedStats, statsScopeKey } from "@/lib/stats/stats-cache";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { scopedServerIds, canAccessServer } from "@/lib/authz";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

/** Top genres by qualified plays, optionally for one account (`userId`). */
export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { days, serverId, since, until } = parsePeopleQuery(searchParams);
    const limit = clampInt(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const userId = searchParams.get("userId") || undefined;
    if (userId && userId.length > MAX_ACCOUNT_ID_LENGTH) {
        return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }
    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const key = buildStatsKey("people-genres", {
            days,
            limit,
            user: userId ?? "all",
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const data = getCachedStats(key, STATS_CACHE_TTL_MS, () => ({
            items: getTopGenres({ since, until, serverId, allowedServerIds, userId, limit }),
            hasGenreData: hasGenreData(),
        }));
        return NextResponse.json({ days, ...data });
    } catch (error) {
        Logger.error("Failed to fetch genre stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
