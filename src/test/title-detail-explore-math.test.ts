import { describe, expect, it } from "vitest";
import {
    buildCalendarGrid,
    compareOffsetDays,
    formatCompletion,
    formatTitleMeta,
    groupBySeason,
    mergeCompareSeries,
    shiftBucket,
    titleHref,
} from "@/features/stats-v2/lib/explore-math";

describe("shiftBucket", () => {
    it("moves day buckets across month and year edges", () => {
        expect(shiftBucket("2026-01-25", 7)).toBe("2026-02-01");
        expect(shiftBucket("2025-12-31", 1)).toBe("2026-01-01");
    });

    it("moves month buckets by whole months", () => {
        expect(shiftBucket("2025-11", 61)).toBe("2026-01");
    });
});

describe("mergeCompareSeries", () => {
    it("overlays the previous window on the current buckets and keeps one-sided days", () => {
        const current = [
            { bucket: "2026-09-08", value: 4 },
            { bucket: "2026-09-10", value: 2 },
        ];
        const previous = [
            { bucket: "2026-09-01", value: 1 }, // → 09-08
            { bucket: "2026-09-02", value: 5 }, // → 09-09, missing in current
            { bucket: "2026-08-20", value: 9 }, // → 08-27, before the current series
        ];
        expect(mergeCompareSeries(current, previous, 7)).toEqual([
            { bucket: "2026-09-08", value: 4, previous: 1 },
            { bucket: "2026-09-09", value: 0, previous: 5 },
            { bucket: "2026-09-10", value: 2, previous: 0 },
        ]);
    });
});

describe("compareOffsetDays", () => {
    it("has no previous window for all time", () => {
        expect(compareOffsetDays(30, 7300)).toBe(30);
        expect(compareOffsetDays(7300, 7300)).toBeNull();
    });
});

describe("buildCalendarGrid", () => {
    it("builds Monday-first full weeks covering exactly dayCount in-range days", () => {
        const end = new Date(2026, 8, 30); // Wednesday
        const grid = buildCalendarGrid([{ bucket: "2026-09-30", total: 3 }, { bucket: "2020-01-01", total: 9 }], end, 365);
        const cells = grid.weeks.flat();
        expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
        expect(cells.filter((c) => c.inRange)).toHaveLength(365);
        expect(new Date(2025, 9, 1).getDay()).toBe(3);
        // First in-range day 2025-10-01 is a Wednesday → two padding cells (Mon, Tue).
        expect(grid.weeks[0].slice(0, 3).map((c) => c.inRange)).toEqual([false, false, true]);
        expect(cells.find((c) => c.date === "2026-09-30")).toEqual({ date: "2026-09-30", value: 3, inRange: true });
        expect(cells.some((c) => c.date === "2020-01-01")).toBe(false);
        expect(grid.monthLabels).toHaveLength(grid.weeks.length);
    });

    it("drops a month label that would collide with the next one", () => {
        const grid = buildCalendarGrid([], new Date(2026, 8, 30), 365);
        const labelled = grid.monthLabels.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
        for (let i = 1; i < labelled.length; i++) expect(labelled[i] - labelled[i - 1]).toBeGreaterThanOrEqual(3);
    });
});

describe("title formatting", () => {
    it("formats the meta line per type", () => {
        const base = { year: 2019, seasonNumber: null, episodeNumber: null, showTitle: null };
        expect(formatTitleMeta({ ...base, type: "movie" })).toBe("Movie · 2019");
        expect(formatTitleMeta({ ...base, type: "episode", seasonNumber: 2, episodeNumber: 5, showTitle: "BB" })).toBe("Episode · S2E5 · BB");
    });

    it("formats completion and links", () => {
        expect(formatCompletion(null)).toBe("—");
        expect(formatCompletion(87.4)).toBe("87%");
        expect(titleHref(42)).toBe("/statistics/title/42");
    });

    it("groups episodes by season in order", () => {
        const groups = groupBySeason([{ seasonNumber: 1 }, { seasonNumber: 1 }, { seasonNumber: 2 }]);
        expect(groups.map((g) => [g.season, g.episodes.length])).toEqual([[1, 2], [2, 1]]);
    });
});
