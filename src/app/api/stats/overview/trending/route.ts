import { NextResponse } from "next/server";
import { getTrendingMedia, type TrendingMediaType } from "@/lib/stats/trending-media";
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
const MAX_DAYS = 7300;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

const MEDIA_TYPES: readonly TrendingMediaType[] = ["movie", "show"];

export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as TrendingMediaType | null;
    if (!type || !MEDIA_TYPES.includes(type)) {
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    const days = Math.min(MAX_DAYS, Math.max(1, Number(searchParams.get("days")) || DEFAULT_DAYS));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));
    const serverIdParam = searchParams.get("serverId") ?? undefined;
    const serverId = serverIdParam && serverIdParam !== "all" ? serverIdParam : undefined;

    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const key = buildStatsKey("trending", {
            type,
            days,
            limit,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const items = getCachedStats(key, STATS_CACHE_TTL_MS, () => {
            const now = Date.now();
            return getTrendingMedia(type, {
                since: now - days * ONE_DAY_MS,
                until: now,
                serverId,
                allowedServerIds,
                limit,
            });
        });

        return NextResponse.json({ days, type, items });
    } catch (error) {
        Logger.error("Failed to fetch trending media:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
