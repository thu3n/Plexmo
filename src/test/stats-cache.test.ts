import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    STATS_CACHE_TTL_MS,
    buildStatsKey,
    clearStatsCache,
    getCachedStats,
    setCachedStats,
    statsScopeKey,
} from "@/lib/stats/stats-cache";

describe("getCachedStats", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        clearStatsCache();
    });
    afterEach(() => {
        vi.useRealTimers();
        clearStatsCache();
    });

    it("computes once and serves the cached value within the TTL", () => {
        const compute = vi.fn(() => ({ n: 1 }));
        const first = getCachedStats("k", STATS_CACHE_TTL_MS, compute);
        const second = getCachedStats("k", STATS_CACHE_TTL_MS, compute);
        expect(compute).toHaveBeenCalledTimes(1);
        expect(second).toBe(first);
    });

    it("recomputes after the TTL expires", () => {
        const compute = vi.fn(() => Math.random());
        getCachedStats("k", STATS_CACHE_TTL_MS, compute);
        vi.advanceTimersByTime(STATS_CACHE_TTL_MS + 1);
        getCachedStats("k", STATS_CACHE_TTL_MS, compute);
        expect(compute).toHaveBeenCalledTimes(2);
    });

    it("keeps different keys isolated", () => {
        getCachedStats("a", STATS_CACHE_TTL_MS, () => "A");
        expect(getCachedStats("b", STATS_CACHE_TTL_MS, () => "B")).toBe("B");
        expect(getCachedStats("a", STATS_CACHE_TTL_MS, () => "changed")).toBe("A");
    });

    it("setCachedStats refreshes an entry unconditionally", () => {
        getCachedStats("k", STATS_CACHE_TTL_MS, () => "old");
        setCachedStats("k", "new");
        expect(getCachedStats("k", STATS_CACHE_TTL_MS, () => "compute")).toBe("new");
    });

    it("evicts the oldest entries past the size cap", () => {
        for (let i = 0; i < 205; i++) {
            setCachedStats(`key-${i}`, i);
        }
        // key-0..key-4 evicted (cap 200), the newest survive.
        expect(getCachedStats("key-0", STATS_CACHE_TTL_MS, () => "recomputed")).toBe("recomputed");
        expect(getCachedStats("key-204", STATS_CACHE_TTL_MS, () => "recomputed")).toBe(204);
    });
});

describe("statsScopeKey", () => {
    it("is order-independent and never collides with the unrestricted scope", () => {
        expect(statsScopeKey(["b", "a"])).toBe(statsScopeKey(["a", "b"]));
        expect(statsScopeKey(["a", "b"])).toBe("a,b");
        expect(statsScopeKey(undefined)).toBe("all");
        expect(statsScopeKey([])).toBe("all");
        expect(statsScopeKey(["srv-1"])).not.toBe("all");
    });
});

describe("buildStatsKey", () => {
    it("serializes route and parts deterministically", () => {
        expect(buildStatsKey("home", { days: 30, server: "all", user: undefined, scope: "all" })).toBe(
            "home|days=30|server=all|user=|scope=all",
        );
    });
});
