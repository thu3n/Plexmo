import { NextResponse } from "next/server";
import { getTranscodingClients } from "@/lib/stats/server-quality";
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

const DEFAULT_LIMIT = 10;

export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = parseQualityRequest(user, request.url, DEFAULT_LIMIT);
    if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { days, limit, serverId, allowedServerIds } = parsed.value;

    try {
        const key = buildStatsKey("quality-clients", {
            days,
            limit,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const data = getCachedStats(key, STATS_CACHE_TTL_MS, () => getTranscodingClients(parsed.value));
        return NextResponse.json({ days, items: data });
    } catch (error) {
        Logger.error("Failed to fetch transcoding clients:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
