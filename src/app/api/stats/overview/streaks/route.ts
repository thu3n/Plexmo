import { NextResponse } from "next/server";
import { getTopStreaks } from "@/lib/stats/streak-leaderboard";
import {
    STREAKS_CACHE_TTL_MS,
    buildStatsKey,
    getCachedStats,
    statsScopeKey,
} from "@/lib/stats/stats-cache";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { scopedServerIds, canAccessServer } from "@/lib/authz";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));
    const serverIdParam = searchParams.get("serverId") ?? undefined;
    const serverId = serverIdParam && serverIdParam !== "all" ? serverIdParam : undefined;

    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        // The leaderboard scans all-time history — cache it aggressively.
        const key = buildStatsKey("streaks", {
            limit,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const items = getCachedStats(key, STREAKS_CACHE_TTL_MS, () =>
            getTopStreaks({ serverId, allowedServerIds, limit }),
        );
        return NextResponse.json({ items });
    } catch (error) {
        Logger.error("Failed to fetch streak leaderboard:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
