import { NextResponse } from "next/server";
import { resolveTitle, isTitleVisible } from "@/lib/stats/title-detail-query";
import { getAlsoWatched, DEFAULT_ALSO_WATCHED_LIMIT } from "@/lib/stats/title-detail-also-watched";
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

// 20 years — effectively all time, the title page's default window.
const MAX_DAYS = 7300;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LIMIT = 25;
const MEDIA_ID_PATTERN = /^\d{1,12}$/;

export async function GET(request: Request, props: { params: Promise<{ mediaId: string }> }) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mediaId: rawId } = await props.params;
    if (!MEDIA_ID_PATTERN.test(rawId)) {
        return NextResponse.json({ error: "Invalid mediaId" }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const days = Math.min(MAX_DAYS, Math.max(1, Number(searchParams.get("days")) || MAX_DAYS));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_ALSO_WATCHED_LIMIT));
    const serverIdParam = searchParams.get("serverId") ?? undefined;
    const serverId = serverIdParam && serverIdParam !== "all" ? serverIdParam : undefined;

    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const ref = resolveTitle(Number(rawId));
        // 404 rather than 403 for out-of-scope titles: a scoped viewer must not learn they exist.
        if (!ref || !isTitleVisible(ref, allowedServerIds)) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        const key = buildStatsKey("also-watched", {
            mediaId: ref.mediaId,
            days,
            limit,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const items = getCachedStats(key, STATS_CACHE_TTL_MS, () =>
            getAlsoWatched(ref, { since: Date.now() - days * ONE_DAY_MS, serverId, allowedServerIds }, limit),
        );
        return NextResponse.json({ days, items });
    } catch (error) {
        Logger.error("Failed to fetch also-watched titles:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
