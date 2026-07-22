import { NextResponse } from "next/server";
import { getHomeStats } from "@/lib/stats/home-stats";
import { getHomeStatsLight } from "@/lib/stats/home-stats-light";
import {
    STATS_CACHE_TTL_MS,
    buildStatsKey,
    getCachedStats,
    statsScopeKey,
} from "@/lib/stats/stats-cache";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { scopedServerIds, canAccessServer } from "@/lib/authz";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 30;
// 20 years — predates Plex itself, so the max window is effectively all time.
const MAX_DAYS = 7300;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// accountIds are plex.tv ids or synthetic `legacy:<name>` — never longer than this.
const MAX_USER_ID_LENGTH = 64;

export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(MAX_DAYS, Math.max(1, Number(searchParams.get("days")) || DEFAULT_DAYS));
    const serverId = searchParams.get("serverId") ?? undefined;
    const userParam = searchParams.get("user");
    const userId = userParam && userParam.length <= MAX_USER_ID_LENGTH ? userParam : undefined;
    // media=0 skips the movie/show aggregations for consumers that discard them.
    const includeMedia = searchParams.get("media") !== "0";

    if (serverId && serverId !== "all" && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const key = buildStatsKey("home", {
            days,
            server: serverId ?? "all",
            user: userId,
            media: includeMedia ? 1 : 0,
            scope: statsScopeKey(allowedServerIds),
        });
        const stats = getCachedStats(key, STATS_CACHE_TTL_MS, () => {
            const params = {
                since: Date.now() - days * ONE_DAY_MS,
                serverId,
                allowedServerIds,
                userId,
            };
            return includeMedia ? getHomeStats(params) : getHomeStatsLight(params);
        });
        return NextResponse.json({ days, ...stats });
    } catch (error) {
        Logger.error("Failed to fetch home stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
