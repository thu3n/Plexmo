import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { HOURS_PER_DAY, getUserProfile, listProfileUsers } from "@/lib/stats/user-insights-profile";
import { insertIdentity, insertLibraryItem, insertMedia, insertPlay, resetPeopleTables } from "./user-insights-test-utils";

// 2026-07-18 is a Saturday, 2026-07-15 a Wednesday.
const SATURDAY_21H = new Date(2026, 6, 18, 21, 0, 0).getTime();
const WEDNESDAY_08H = new Date(2026, 6, 15, 8, 0, 0).getTime();
const WEDNESDAY_21H = new Date(2026, 6, 15, 21, 30, 0).getTime();
const UNTIL = new Date(2026, 6, 20, 12, 0, 0).getTime();
const SINCE = UNTIL - 30 * 24 * 3600_000;

const profile = (accountId: string, params: { serverId?: string; allowedServerIds?: string[] } = {}) =>
    getUserProfile({ accountId, since: SINCE, until: UNTIL, ...params });

beforeEach(() => {
    resetPeopleTables();
});

describe("getUserProfile", () => {
    it("builds hours, weekday/weekend split, clients and completion", () => {
        insertIdentity("P", "Pat", "/thumb/p");
        insertPlay({ userId: "P", startTime: SATURDAY_21H, platform: "Roku", device: "Living Room", percent: 100 });
        insertPlay({ userId: "P", startTime: WEDNESDAY_21H, platform: "Roku", device: "Living Room", percent: 50 });
        insertPlay({ userId: "P", startTime: WEDNESDAY_08H, platform: "iOS", device: "iPhone", percent: null });
        insertPlay({ userId: "P", startTime: WEDNESDAY_08H, platform: "Roku", device: "Bedroom", percent: 120 });

        const p = profile("P")!;
        expect(p).toMatchObject({
            accountId: "P",
            user: "Pat",
            thumb: "/thumb/p",
            plays: 4,
            seconds: 2400,
            weekendPlays: 1,
            weekdayPlays: 3,
            weekendShare: 0.25,
            // (100 + 50 + 100[clamped]) / 3 known positions.
            averageCompletion: 83,
        });
        expect(p.hours).toHaveLength(HOURS_PER_DAY);
        expect(p.hours[21]).toBe(2);
        expect(p.hours[8]).toBe(2);
        expect(p.topPlatforms).toEqual([{ name: "Roku", plays: 3 }, { name: "iOS", plays: 1 }]);
        expect(p.topDevices[0]).toEqual({ name: "Living Room", plays: 2 });
    });

    it("includes the user's top genres", () => {
        insertMedia(1, "movie", "Heat");
        insertLibraryItem("srv-a", "r1", 1, ["Crime", "Drama"]);
        insertPlay({ userId: "P", startTime: WEDNESDAY_21H, mediaId: 1 });
        insertPlay({ userId: "Q", startTime: WEDNESDAY_21H, mediaId: 1 });

        expect(profile("P")!.topGenres.map((g) => [g.genre, g.plays])).toEqual([["Crime", 1], ["Drama", 1]]);
    });

    it("returns an empty profile for a known user with no plays in the window", () => {
        insertPlay({ userId: "P", startTime: SINCE - 1000 });
        expect(profile("P")).toMatchObject({
            user: "name-P",
            plays: 0,
            weekendShare: null,
            averageCompletion: null,
            topPlatforms: [],
        });
    });

    it("returns null for unknown accounts and accounts outside the viewer's scope", () => {
        insertIdentity("B", "Bob");
        insertPlay({ userId: "B", startTime: WEDNESDAY_21H, serverId: "srv-b" });
        expect(profile("nobody")).toBeNull();
        expect(profile("B", { allowedServerIds: ["srv-a"] })).toBeNull();
        expect(profile("B", { serverId: "srv-b" })).toMatchObject({ user: "Bob", plays: 1 });
    });
});

describe("listProfileUsers", () => {
    it("lists users with plays in the window, most active first, within scope", () => {
        insertIdentity("A", "Ann");
        insertPlay({ userId: "A", startTime: WEDNESDAY_08H });
        insertPlay({ userId: "B", startTime: WEDNESDAY_08H });
        insertPlay({ userId: "B", startTime: WEDNESDAY_21H });
        insertPlay({ userId: "C", startTime: WEDNESDAY_21H, serverId: "srv-b" });
        insertPlay({ userId: "D", startTime: SINCE - 1000 });

        const all = listProfileUsers({ since: SINCE, until: UNTIL });
        expect(all.map((u) => [u.accountId, u.user, u.plays])).toEqual([
            ["B", "name-B", 2],
            ["A", "Ann", 1],
            ["C", "name-C", 1],
        ]);
        expect(listProfileUsers({ since: SINCE, until: UNTIL, allowedServerIds: ["srv-a"] }).map((u) => u.accountId))
            .toEqual(["B", "A"]);
        expect(listProfileUsers({ since: SINCE, until: UNTIL, limit: 1 })).toHaveLength(1);
    });
});
