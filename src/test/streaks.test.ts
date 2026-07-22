import { describe, it, expect, beforeEach, vi } from "vitest";
import { SRV_A, ACC_ELIAS } from "./fixtures/v1-seed";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() }; // fully migrated, incl. v11 (streak_cache dropped)
});

import { db } from "@/lib/db";
import { calculateStreaks } from "@/lib/stats/streaks";

const HOUR = 3600000;
const DAY = 24 * HOUR;

// Fixed local noon — keeps "today"/"yesterday" and day-bucketing deterministic
// regardless of when the test runs.
const NOW = new Date(2026, 6, 15, 12, 0, 0).getTime();

// Local midnight of the day `offset` days before NOW, plus `hour` hours.
const at = (daysAgo: number, hour: number) => {
    const d = new Date(NOW);
    d.setHours(0, 0, 0, 0);
    return d.getTime() - daysAgo * DAY + hour * HOUR;
};

let seq = 0;
const insertRow = (
    startTime: number,
    facts: { playDuration?: number | null; duration?: number; percentComplete?: number | null }
) => {
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime,
            duration, pausedCounter, play_duration, percent_complete
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
        `st-${seq++}`, SRV_A, ACC_ELIAS, "Elias", "Test", "1",
        startTime, startTime + (facts.duration ?? 600) * 1000,
        facts.duration ?? 600,
        facts.playDuration === undefined ? facts.duration ?? 600 : facts.playDuration,
        facts.percentComplete ?? null
    );
};

const streaks = () => calculateStreaks({ accountId: ACC_ELIAS, now: NOW });

beforeEach(() => {
    db.prepare("DELETE FROM activity_history").run();
});

describe("streak calculation (per-day aggregate over fact columns)", () => {
    it("(a) three sub-threshold fragments in one day qualify via the daily SUM", () => {
        // 3 x 240s = 720s >= 600s fallback — the old per-row test dropped all
        // three. Hours kept before the injected NOW (12:00) so the
        // future-guard doesn't filter them.
        insertRow(at(0, 8), { playDuration: 240, duration: 240 });
        insertRow(at(0, 9), { playDuration: 240, duration: 240 });
        insertRow(at(0, 10), { playDuration: 240, duration: 240 });
        expect(streaks()).toEqual({ current: 1, longest: 1 });
    });

    it("(b) a single row crossing midnight credits only its start day", () => {
        // Starts 23:00 two days ago, runs 2h into yesterday — bucketed on startTime.
        insertRow(at(2, 23), { playDuration: 7200, duration: 7200 });
        const result = streaks();
        expect(result.longest).toBe(1);
        // Start day = 2 days ago, not yesterday -> current streak is dead.
        expect(result.current).toBe(0);
    });

    it("(c) a session resumed after midnight credits both days (documented behavior)", () => {
        // Playback genuinely happened on both calendar days.
        insertRow(at(1, 23), { playDuration: 900, duration: 900 });
        insertRow(at(0, 0), { playDuration: 900, duration: 900 });
        expect(streaks()).toEqual({ current: 2, longest: 2 });
    });

    it("(d) paused wallclock time no longer qualifies", () => {
        // 15 min wallclock but only 2 min real playback, completion unknown.
        insertRow(at(0, 9), { playDuration: 120, duration: 900, percentComplete: null });
        expect(streaks()).toEqual({ current: 0, longest: 0 });
    });

    it("(d2) a short clip still qualifies via percent_complete", () => {
        insertRow(at(0, 9), { playDuration: 120, duration: 120, percentComplete: 95 });
        expect(streaks()).toEqual({ current: 1, longest: 1 });
    });

    it("(e) a future-dated row cannot kill the current streak", () => {
        insertRow(at(0, 9), { playDuration: 900 });
        insertRow(NOW + 3 * DAY, { playDuration: 900 }); // bad import / clock skew
        expect(streaks()).toEqual({ current: 1, longest: 1 });
    });

    it("(f) yesterday keeps the current streak alive (grace day)", () => {
        insertRow(at(2, 10), { playDuration: 900 });
        insertRow(at(1, 10), { playDuration: 900 });
        expect(streaks()).toEqual({ current: 2, longest: 2 });
    });

    it("(g) longest survives across a gap while current dies when stale", () => {
        // Days 9,8,7 (run of 3), gap, days 4,3 (run of 2, ends stale).
        for (const d of [9, 8, 7, 4, 3]) insertRow(at(d, 10), { playDuration: 900 });
        expect(streaks()).toEqual({ current: 0, longest: 3 });
    });

    it("scopes to allowedServerIds", () => {
        insertRow(at(0, 9), { playDuration: 900 });
        const scoped = calculateStreaks({ accountId: ACC_ELIAS, now: NOW, allowedServerIds: ["other-server"] });
        expect(scoped).toEqual({ current: 0, longest: 0 });
    });
});
