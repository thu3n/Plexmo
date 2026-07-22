/**
 * In-memory TTL cache for the statistics API routes. better-sqlite3 queries are
 * synchronous and serialize on the single Node event loop — without this cache
 * every /statistics page load re-runs ~10 heavy aggregations back to back.
 *
 * CRITICAL: cache keys must encode the FULL authorization scope (see
 * statsScopeKey) plus every query parameter — a key missing the scope would
 * leak cross-tenant data between scoped viewers and owners.
 */

export const STATS_CACHE_TTL_MS = 5 * 60_000;
/** The streak leaderboard moves at most daily — cache it much longer. */
export const STREAKS_CACHE_TTL_MS = 60 * 60_000;
const STATS_CACHE_MAX_ENTRIES = 200;

type StatsCacheEntry = { data: unknown; cachedAt: number };

const globalAny = globalThis as unknown as {
    __plexmo_stats_cache?: Map<string, StatsCacheEntry>;
};
const cache: Map<string, StatsCacheEntry> = globalAny.__plexmo_stats_cache ?? new Map();
globalAny.__plexmo_stats_cache = cache;

const evictOverflow = () => {
    while (cache.size > STATS_CACHE_MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
    }
};

export function getCachedStats<T>(key: string, ttlMs: number, compute: () => T): T {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.cachedAt < ttlMs) {
        return entry.data as T;
    }
    const data = compute();
    // delete+set keeps Map insertion order = recency order for eviction.
    cache.delete(key);
    cache.set(key, { data, cachedAt: Date.now() });
    evictOverflow();
    return data;
}

/** Unconditional store — used by the cron prewarm to refresh still-warm entries. */
export function setCachedStats(key: string, data: unknown): void {
    cache.delete(key);
    cache.set(key, { data, cachedAt: Date.now() });
    evictOverflow();
}

export function clearStatsCache(): void {
    cache.clear();
}

/**
 * Scope component of every cache key: "all" for unrestricted access, else the
 * sorted allowed server ids — sorted so key equality means scope equality.
 */
export const statsScopeKey = (allowedServerIds: string[] | undefined): string =>
    allowedServerIds && allowedServerIds.length > 0 ? [...allowedServerIds].sort().join(",") : "all";

export const buildStatsKey = (
    route: string,
    parts: Record<string, string | number | undefined>,
): string =>
    `${route}|${Object.entries(parts)
        .map(([key, value]) => `${key}=${value ?? ""}`)
        .join("|")}`;
