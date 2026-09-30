import { NextResponse } from "next/server";
import { getWanLoad, pickGranularity, type WanGranularity } from "@/lib/stats/server-quality-wan";
import { getUploadCapacityMbps } from "@/lib/stats/server-quality-capacity";
import { parseQualityRequest } from "@/lib/stats/server-quality-request";
import {
    STATS_CACHE_TTL_MS,
    buildStatsKey,
    getCachedStats,
    statsScopeKey,
} from "@/lib/stats/stats-cache";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const GRANULARITIES: readonly WanGranularity[] = ["hour", "day", "month"];
/** Unused by this route, but parseQualityRequest always validates one. */
const DEFAULT_LIMIT = 1;

export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = parseQualityRequest(user, request.url, DEFAULT_LIMIT);
    if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { days, serverId, allowedServerIds } = parsed.value;
    const requested = new URL(request.url).searchParams.get("granularity") as WanGranularity | null;
    if (requested && !GRANULARITIES.includes(requested)) {
        return NextResponse.json({ error: "Invalid granularity" }, { status: 400 });
    }
    const granularity = requested ?? pickGranularity(days);

    try {
        const key = buildStatsKey("quality-wan", {
            days,
            granularity,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const data = getCachedStats(key, STATS_CACHE_TTL_MS, () => getWanLoad({ ...parsed.value, granularity }));
        // Capacity is read outside the cache so an owner's edit shows immediately.
        return NextResponse.json({ days, capacityMbps: getUploadCapacityMbps(), ...data });
    } catch (error) {
        Logger.error("Failed to fetch WAN load:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
