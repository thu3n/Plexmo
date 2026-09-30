import { NextResponse } from "next/server";
import { DEFAULT_STALE_MONTHS, getLibraryValue } from "@/lib/stats/library-value";
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

const MAX_STALE_MONTHS = 120;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

/**
 * Library value (dead weight, cost per play, time to first play, coverage).
 * Lifetime metrics over the current inventory — no `days` window; see
 * src/lib/stats/library-value.ts for why.
 */
export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const staleMonths = Math.min(
        MAX_STALE_MONTHS,
        Math.max(1, Math.floor(Number(searchParams.get("months")) || DEFAULT_STALE_MONTHS)),
    );
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(searchParams.get("limit")) || DEFAULT_LIMIT)));
    const serverIdParam = searchParams.get("serverId") ?? undefined;
    const serverId = serverIdParam && serverIdParam !== "all" ? serverIdParam : undefined;

    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const key = buildStatsKey("library-value", {
            months: staleMonths,
            limit,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const data = getCachedStats(key, STATS_CACHE_TTL_MS, () =>
            getLibraryValue({ serverId, allowedServerIds, staleMonths, limit }),
        );
        return NextResponse.json(data);
    } catch (error) {
        Logger.error("Failed to compute library value stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
