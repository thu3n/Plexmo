import { NextResponse } from "next/server";
import type { AuthorizedUser } from "@/lib/auth-guard";
import { canAccessServer, scopedServerIds } from "@/lib/authz";
import { Logger } from "@/lib/logger";
import { STATS_CACHE_TTL_MS, buildStatsKey, getCachedStats, statsScopeKey } from "./stats-cache";
import { ONE_DAY_MS, type BehaviourParams } from "./viewing-behaviour";

/**
 * Shared request handling for /api/stats/behaviour/*: query parsing, the
 * server-scope check and caching. Each route still calls
 * authorizeApiKeyOrSession itself (the route-guard test requires the
 * decision to be visible in every route file) and hands the user in here.
 */

const DEFAULT_DAYS = 30;
const MAX_DAYS = 7300;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export const respondWithBehaviourStats = <T>(
    request: Request,
    user: AuthorizedUser,
    name: string,
    compute: (params: BehaviourParams) => T,
    extraKey: Record<string, string> = {},
): NextResponse => {
    const { searchParams } = new URL(request.url);
    const days = Math.min(MAX_DAYS, Math.max(1, Number(searchParams.get("days")) || DEFAULT_DAYS));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));
    const serverIdParam = searchParams.get("serverId") ?? undefined;
    const serverId = serverIdParam && serverIdParam !== "all" ? serverIdParam : undefined;

    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const allowedServerIds = scopedServerIds(user.scope);
        const key = buildStatsKey(`behaviour-${name}`, {
            ...extraKey,
            days,
            limit,
            server: serverId ?? "all",
            scope: statsScopeKey(allowedServerIds),
        });
        const data = getCachedStats(key, STATS_CACHE_TTL_MS, () => {
            const now = Date.now();
            return compute({ since: now - days * ONE_DAY_MS, until: now, serverId, allowedServerIds, limit });
        });
        return NextResponse.json({ days, ...extraKey, data });
    } catch (error) {
        Logger.error(`Failed to fetch ${name} behaviour stats:`, error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
};
