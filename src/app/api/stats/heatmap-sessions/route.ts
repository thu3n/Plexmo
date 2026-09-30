import { NextResponse } from "next/server";
import { getHeatmapSessions, isValidHeatmapCell } from "@/lib/stats/heatmap-sessions";
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
const SMALL_INT_PATTERN = /^\d{1,2}$/;

const parseSmallInt = (value: string | null): number =>
    value !== null && SMALL_INT_PATTERN.test(value) ? Number(value) : Number.NaN;

export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cell = {
        weekday: parseSmallInt(searchParams.get("weekday")),
        hour: parseSmallInt(searchParams.get("hour")),
    };
    if (!isValidHeatmapCell(cell)) {
        return NextResponse.json({ error: "Invalid weekday/hour" }, { status: 400 });
    }
    const days = Math.min(MAX_DAYS, Math.max(1, Number(searchParams.get("days")) || DEFAULT_DAYS));
    const serverIdParam = searchParams.get("serverId") ?? undefined;
    const serverId = serverIdParam && serverIdParam !== "all" ? serverIdParam : undefined;

    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const key = buildStatsKey("heatmap-sessions", {
            weekday: cell.weekday,
            hour: cell.hour,
            days,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const result = getCachedStats(key, STATS_CACHE_TTL_MS, () =>
            getHeatmapSessions(cell, { since: Date.now() - days * ONE_DAY_MS, serverId, allowedServerIds }),
        );
        return NextResponse.json({ days, ...cell, ...result });
    } catch (error) {
        Logger.error("Failed to fetch heatmap sessions:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
