import { getServerCount } from "@/lib/servers";
import { getGraphData, type GraphType } from "./graph-stats";
import { getHomeStatsLight } from "./home-stats-light";
import { getOverviewSummaryWithPeaks } from "./overview-stats";
import { getTopMediaBoth, type TopMediaType } from "./top-media-both";
import { getTopStreaks } from "./streak-leaderboard";
import { buildStatsKey, setCachedStats, statsScopeKey } from "./stats-cache";

/**
 * Cron-driven prewarm of the statistics cache for the GLOBAL owner-scope
 * default view (all servers, 30d) — the combination every owner/API-key page
 * load requests. Unconditional refresh keeps those keys permanently warm, so
 * the first /statistics open is served from cache instead of running ~10
 * synchronous full-table aggregations on the event loop.
 *
 * Key construction MUST mirror the routes exactly (same builder, same property
 * order, same values for the global scope): see each route's buildStatsKey call.
 */

const PREWARM_INTERVAL_MS = 5 * 60_000;
/** Half the streaks TTL — always warm at half the background scan cost. */
const STREAKS_PREWARM_INTERVAL_MS = 30 * 60_000;
const PREWARM_DAYS = 30;
const PREWARM_LIMIT = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// Exactly what ChartsSection requests at the 30d default.
const PREWARM_GRAPH_TYPES: GraphType[] = [
    "plays_by_day",
    "plays_by_hour",
    "plays_by_dayofweek",
    "transcode_share",
];
const MEDIA_TYPES: TopMediaType[] = ["movie", "show", "episode"];

const GLOBAL_SCOPE = statsScopeKey(undefined);

const globalAny = globalThis as unknown as {
    __plexmo_stats_prewarm_at?: number;
    __plexmo_streaks_prewarm_at?: number;
};

/** Each task is synchronous SQL — yield between them so the loop never blocks in one chunk. */
const yieldToEventLoop = () => new Promise<void>((resolve) => setImmediate(resolve));

export async function prewarmStatsCacheIfDue(): Promise<void> {
    const now = Date.now();
    if (now - (globalAny.__plexmo_stats_prewarm_at ?? 0) < PREWARM_INTERVAL_MS) return;
    if (getServerCount() === 0) return;
    globalAny.__plexmo_stats_prewarm_at = now;

    const since = now - PREWARM_DAYS * ONE_DAY_MS;
    const params = { since, serverId: undefined, allowedServerIds: undefined };

    setCachedStats(
        buildStatsKey("summary", { days: PREWARM_DAYS, server: "all", scope: GLOBAL_SCOPE }),
        getOverviewSummaryWithPeaks(params, PREWARM_DAYS),
    );
    await yieldToEventLoop();

    setCachedStats(
        buildStatsKey("home", {
            days: PREWARM_DAYS,
            server: "all",
            user: undefined,
            media: 0,
            scope: GLOBAL_SCOPE,
        }),
        getHomeStatsLight(params),
    );
    await yieldToEventLoop();

    for (const type of PREWARM_GRAPH_TYPES) {
        setCachedStats(
            buildStatsKey("graphs", {
                type,
                days: PREWARM_DAYS,
                server: "all",
                user: undefined,
                scope: GLOBAL_SCOPE,
            }),
            getGraphData(type, params),
        );
        await yieldToEventLoop();
    }

    for (const type of MEDIA_TYPES) {
        setCachedStats(
            buildStatsKey("top-media", {
                type,
                days: PREWARM_DAYS,
                limit: PREWARM_LIMIT,
                server: "all",
                scope: GLOBAL_SCOPE,
            }),
            getTopMediaBoth(type, { ...params, limit: PREWARM_LIMIT }),
        );
        await yieldToEventLoop();
    }

    if (now - (globalAny.__plexmo_streaks_prewarm_at ?? 0) >= STREAKS_PREWARM_INTERVAL_MS) {
        globalAny.__plexmo_streaks_prewarm_at = now;
        setCachedStats(
            buildStatsKey("streaks", { limit: PREWARM_LIMIT, server: "all", scope: GLOBAL_SCOPE }),
            getTopStreaks({ serverId: undefined, allowedServerIds: undefined, limit: PREWARM_LIMIT }),
        );
    }
}
