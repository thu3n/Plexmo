import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { DORMANT_DAYS, getUserLifecycle } from "@/lib/stats/user-insights-lifecycle";
import { insertIdentity, insertPlay, resetPeopleTables } from "./user-insights-test-utils";

const at = (month: number, day: number, year = 2026) => new Date(year, month - 1, day, 12, 0, 0).getTime();
const UNTIL = at(7, 20);
const SINCE = at(4, 1);

const lifecycle = (params: { serverId?: string; allowedServerIds?: string[] } = {}) =>
    getUserLifecycle({ since: SINCE, until: UNTIL, ...params });

beforeEach(() => {
    resetPeopleTables();
});

const seedCohort = () => {
    // A: long-time viewer, last seen early May.
    insertPlay({ userId: "A", startTime: at(1, 10) });
    insertPlay({ userId: "A", startTime: at(4, 5) });
    insertPlay({ userId: "A", startTime: at(5, 5) });
    // B: joins in April, back in June.
    insertPlay({ userId: "B", startTime: at(4, 10) });
    insertPlay({ userId: "B", startTime: at(6, 1) });
    // C: joins in May, never again.
    insertPlay({ userId: "C", startTime: at(5, 15) });
    // D: one play in February — dormant for the whole window.
    insertPlay({ userId: "D", startTime: at(2, 1) });
};

describe("getUserLifecycle", () => {
    it("classifies active / new / returning / dormant per month", () => {
        seedCohort();
        const { months, dormantDays } = lifecycle();
        expect(dormantDays).toBe(DORMANT_DAYS);
        expect(months).toEqual([
            { month: "2026-04", active: 2, new: 1, returning: 1, dormant: 1 },
            { month: "2026-05", active: 2, new: 1, returning: 1, dormant: 1 },
            { month: "2026-06", active: 1, new: 0, returning: 1, dormant: 1 },
            // Running month measured at `until`: A (76d) and C (66d) crossed 60 days.
            { month: "2026-07", active: 0, new: 0, returning: 0, dormant: 3 },
        ]);
    });

    it("lists current dormant users longest-silent first, with display names", () => {
        seedCohort();
        insertIdentity("A", "Alice", "/thumb/a");
        const { dormantUsers, dormantTotal } = lifecycle();
        expect(dormantTotal).toBe(3);
        expect(dormantUsers.map((u) => u.accountId)).toEqual(["D", "A", "C"]);
        expect(dormantUsers[1]).toMatchObject({ user: "Alice", thumb: "/thumb/a", plays: 3, daysSinceLastPlay: 76 });
        expect(dormantUsers[0]).toMatchObject({ user: "name-D", thumb: null, plays: 1 });
    });

    it("caps the dormant list but still reports the full total", () => {
        seedCohort();
        const result = getUserLifecycle({ since: SINCE, until: UNTIL, dormantLimit: 1 });
        expect(result.dormantUsers).toHaveLength(1);
        expect(result.dormantTotal).toBe(3);
    });

    it("clips the series to the first month with data", () => {
        insertPlay({ userId: "A", startTime: at(6, 3) });
        const { months } = getUserLifecycle({ since: at(1, 1, 2020), until: UNTIL });
        expect(months.map((m) => m.month)).toEqual(["2026-06", "2026-07"]);
    });

    it("returns an empty series without history", () => {
        expect(lifecycle()).toMatchObject({ months: [], dormantUsers: [], dormantTotal: 0 });
    });

    it("judges newness within the server filter and honours the auth scope", () => {
        // F played srv-b in January, first srv-a play in April.
        insertPlay({ userId: "F", startTime: at(1, 5), serverId: "srv-b" });
        insertPlay({ userId: "F", startTime: at(4, 20), serverId: "srv-a" });
        insertPlay({ userId: "G", startTime: at(4, 21), serverId: "srv-b" });

        const all = lifecycle();
        expect(all.months[0]).toMatchObject({ month: "2026-04", active: 2, new: 1, returning: 1 });

        const onA = lifecycle({ serverId: "srv-a" });
        expect(onA.months[0]).toMatchObject({ active: 1, new: 1, returning: 0 });

        const scoped = lifecycle({ allowedServerIds: ["srv-a"] });
        expect(scoped.months[0]).toMatchObject({ active: 1, new: 1 });

        expect(lifecycle({ allowedServerIds: ["srv-a"], serverId: "srv-b" }).months).toEqual([]);
    });

    it("ignores plays at or after `until`", () => {
        insertPlay({ userId: "A", startTime: at(5, 1) });
        insertPlay({ userId: "A", startTime: UNTIL });
        const { dormantUsers } = lifecycle();
        expect(dormantUsers.map((u) => u.accountId)).toEqual(["A"]);
    });
});
