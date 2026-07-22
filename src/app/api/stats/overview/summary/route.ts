import { NextResponse } from "next/server";
import { getOverviewSummaryWithPeaks, SUMMARY_MAX_DAYS } from "@/lib/stats/overview-stats";
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
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(SUMMARY_MAX_DAYS, Math.max(1, Number(searchParams.get("days")) || DEFAULT_DAYS));
    const serverIdParam = searchParams.get("serverId") ?? undefined;
    const serverId = serverIdParam && serverIdParam !== "all" ? serverIdParam : undefined;

    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const key = buildStatsKey("summary", {
            days,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const data = getCachedStats(key, STATS_CACHE_TTL_MS, () =>
            getOverviewSummaryWithPeaks(
                { since: Date.now() - days * ONE_DAY_MS, serverId, allowedServerIds },
                days,
            ),
        );
        return NextResponse.json(data);
    } catch (error) {
        Logger.error("Failed to fetch overview summary:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
