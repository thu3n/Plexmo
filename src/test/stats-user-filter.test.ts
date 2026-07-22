import { describe, it, expect, vi } from "vitest";
import { SRV_A, SRV_B, ACC_ELIAS, ACC_FRANK } from "./fixtures/v1-seed";

vi.mock("@/lib/db", async () => {
    const { createTestDb, migrateTo } = await import("@/test/db-helper");
    const { seedV1Fixture } = await import("@/test/fixtures/v1-seed");
    const db = createTestDb(1);
    seedV1Fixture(db);
    migrateTo(db);
    return { db };
});

import { getTopPlatforms } from "@/lib/stats/home-stats";
import { getGraphData } from "@/lib/stats/graph-stats";

type PlatformRow = { platform: string; plays: number; uniqueUsers: number };
type GraphRow = { bucket: string; total: number };

const totalOf = (rows: GraphRow[]) => rows.reduce((sum, r) => sum + r.total, 0);

// Fixture (post-migration) history rows per identity:
// Elias: h1 (Chrome, SRV_A), h2 (SRV_B, no platform), tautulli-555 (Android,
// SRV_A) + the flushed active session as1 (Chrome, SRV_A) = 4 rows.
// Frank: h5 (SRV_B, no platform) = 1 row. Total rows incl. legacy/ghost = 7.
describe("per-user stats filter (userId)", () => {
    it("getTopPlatforms returns only the user's platforms", () => {
        const elias = getTopPlatforms({ since: 0, userId: ACC_ELIAS }) as PlatformRow[];
        expect(elias.map((p) => p.platform).sort()).toEqual(["Android", "Chrome"]);
        expect(elias.find((p) => p.platform === "Chrome")?.plays).toBe(2);
        expect(elias.every((p) => p.uniqueUsers === 1)).toBe(true);

        // Frank has no platform-tagged rows at all.
        const frank = getTopPlatforms({ since: 0, userId: ACC_FRANK }) as PlatformRow[];
        expect(frank).toHaveLength(0);
    });

    it("getGraphData counts only the user's rows", () => {
        const all = getGraphData("plays_by_day", { since: 0 }) as GraphRow[];
        const elias = getGraphData("plays_by_day", { since: 0, userId: ACC_ELIAS }) as GraphRow[];
        const frank = getGraphData("plays_by_day", { since: 0, userId: ACC_FRANK }) as GraphRow[];

        expect(totalOf(all)).toBe(7);
        expect(totalOf(elias)).toBe(4);
        expect(totalOf(frank)).toBe(1);
    });

    it("userId composes with serverId and allowedServerIds", () => {
        const eliasOnA = getGraphData("plays_by_day", { since: 0, userId: ACC_ELIAS, serverId: SRV_A }) as GraphRow[];
        expect(totalOf(eliasOnA)).toBe(3);

        const eliasScopedToB = getGraphData("plays_by_day", {
            since: 0,
            userId: ACC_ELIAS,
            allowedServerIds: [SRV_B],
        }) as GraphRow[];
        expect(totalOf(eliasScopedToB)).toBe(1);

        // Scope ∧ explicit server ∧ user — all AND.
        const eliasScopedAndFiltered = getGraphData("plays_by_day", {
            since: 0,
            userId: ACC_ELIAS,
            serverId: SRV_A,
            allowedServerIds: [SRV_B],
        }) as GraphRow[];
        expect(totalOf(eliasScopedAndFiltered)).toBe(0);
    });
});
