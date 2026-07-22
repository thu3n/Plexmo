import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { calculateStreaks, computeStreaksFromDays } from "@/lib/stats/streaks";
import { getTopStreaks } from "@/lib/stats/streak-leaderboard";

const HOUR = 3600000;
const DAY = 24 * HOUR;

// Fixed local noon — keeps "today"/"yesterday" and day-bucketing deterministic.
const NOW = new Date(2026, 6, 15, 12, 0, 0).getTime();

const at = (daysAgo: number, hour: number) => {
    const d = new Date(NOW);
    d.setHours(0, 0, 0, 0);
    return d.getTime() - daysAgo * DAY + hour * HOUR;
};

let seq = 0;
const insertPlay = (userId: string, daysAgo: number, serverId = "srv-a") => {
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime,
            duration, pausedCounter, play_duration, percent_complete
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 900, 0, 900, NULL)`
    ).run(`lb-${seq++}`, serverId, userId, userId, "Test", "1", at(daysAgo, 9), at(daysAgo, 10));
};

const insertIdentity = (accountId: string, title: string, thumb: string | null = null) => {
    db.prepare(
        `INSERT INTO user_identities (accountId, username, title, email, thumb, createdAt, updatedAt)
         VALUES (?, ?, ?, NULL, ?, '2026-01-01', '2026-01-01')`
    ).run(accountId, title.toLowerCase(), title, thumb);
};

beforeEach(() => {
    db.prepare("DELETE FROM activity_history").run();
    db.prepare("DELETE FROM user_identities").run();
});

describe("computeStreaksFromDays (pure helper)", () => {
    it("handles empty, single-day, and gapped inputs", () => {
        expect(computeStreaksFromDays([], NOW)).toEqual({ current: 0, longest: 0 });
        expect(computeStreaksFromDays(["2026-07-15"], NOW)).toEqual({ current: 1, longest: 1 });
        // Run of 3 long ago, then a stale single day: longest survives, current dead.
        expect(
            computeStreaksFromDays(["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-10"], NOW)
        ).toEqual({ current: 0, longest: 3 });
    });
});

describe("getTopStreaks (leaderboard)", () => {
    it("ranks by longest, tiebreaks by current then name, and hydrates identities", () => {
        insertIdentity("100", "Elias", "/thumb/elias");
        insertIdentity("200", "Kids");
        insertIdentity("300", "Frank");

        for (const d of [9, 8, 7, 6]) insertPlay("100", d); // longest 4, current 0
        for (const d of [2, 1, 0]) insertPlay("200", d); // longest 3, current 3
        for (const d of [8, 7, 6]) insertPlay("300", d); // longest 3, current 0

        const top = getTopStreaks({ now: NOW });
        expect(top.map((e) => e.accountId)).toEqual(["100", "200", "300"]);
        expect(top[0]).toMatchObject({ user: "Elias", thumb: "/thumb/elias", longest: 4, current: 0 });
        expect(top[1]).toMatchObject({ user: "Kids", longest: 3, current: 3 });
    });

    it("matches calculateStreaks for the same account (shared semantics)", () => {
        insertIdentity("100", "Elias");
        for (const d of [9, 8, 7, 4, 3]) insertPlay("100", d);

        const solo = calculateStreaks({ accountId: "100", now: NOW });
        const entry = getTopStreaks({ now: NOW }).find((e) => e.accountId === "100");
        expect(entry).toMatchObject({ longest: solo.longest, current: solo.current });
    });

    it("applies limit and falls back to the accountId for unknown identities", () => {
        insertPlay("100", 0);
        insertPlay("200", 1);
        insertPlay("200", 0);

        const top = getTopStreaks({ now: NOW, limit: 1 });
        expect(top).toHaveLength(1);
        expect(top[0]).toMatchObject({ accountId: "200", user: "200", thumb: null });
    });

    it("filters by serverId and by allowedServerIds", () => {
        insertIdentity("100", "Elias");
        insertIdentity("300", "Frank");
        insertPlay("100", 0, "srv-a");
        insertPlay("300", 0, "srv-b");

        expect(getTopStreaks({ now: NOW, serverId: "srv-a" }).map((e) => e.accountId)).toEqual(["100"]);
        expect(getTopStreaks({ now: NOW, allowedServerIds: ["srv-b"] }).map((e) => e.accountId)).toEqual(["300"]);
        expect(getTopStreaks({ now: NOW, allowedServerIds: ["srv-c"] })).toEqual([]);
    });

    it("ignores future-dated rows (clock skew guard)", () => {
        insertIdentity("100", "Elias");
        insertPlay("100", 0);
        db.prepare(
            `INSERT INTO activity_history (
                id, serverId, userId, user, title, ratingKey, startTime, stopTime,
                duration, pausedCounter, play_duration, percent_complete
            ) VALUES ('future-1', 'srv-a', '100', 'Elias', 'Test', '1', ?, ?, 900, 0, 900, NULL)`
        ).run(NOW + 3 * DAY, NOW + 3 * DAY + HOUR);

        expect(getTopStreaks({ now: NOW })[0]).toMatchObject({ longest: 1, current: 1 });
    });
});
