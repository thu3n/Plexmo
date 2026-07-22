import { NextResponse } from "next/server";
import { getGraphData, GRAPH_TYPES, type GraphType } from "@/lib/stats/graph-stats";
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
    const type = searchParams.get("type") as GraphType | null;
    if (!type || !GRAPH_TYPES.includes(type)) {
        return NextResponse.json(
            { error: `Invalid type. Expected one of: ${GRAPH_TYPES.join(", ")}` },
            { status: 400 }
        );
    }

    const days = Math.min(MAX_DAYS, Math.max(1, Number(searchParams.get("days")) || DEFAULT_DAYS));
    const serverId = searchParams.get("serverId") ?? undefined;
    const userParam = searchParams.get("user");
    const userId = userParam && userParam.length <= MAX_USER_ID_LENGTH ? userParam : undefined;

    if (serverId && serverId !== "all" && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const key = buildStatsKey("graphs", {
            type,
            days,
            server: serverId ?? "all",
            user: userId,
            scope: statsScopeKey(allowedServerIds),
        });
        const data = getCachedStats(key, STATS_CACHE_TTL_MS, () =>
            getGraphData(type, {
                since: Date.now() - days * ONE_DAY_MS,
                serverId,
                allowedServerIds,
                userId,
            }),
        );
        return NextResponse.json({ type, days, data });
    } catch (error) {
        Logger.error("Failed to fetch graph stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
