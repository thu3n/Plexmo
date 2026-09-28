import { describe, it, expect } from "vitest";
import {
    buildHeatmapGrid,
    formatBucketLabel,
    formatDateRange,
    formatHours,
    percentOf,
    trendPercent,
} from "../lib/overview-math";

describe("overview-math", () => {
    it("trendPercent compares against the previous window", () => {
        expect(trendPercent(112, 212)).toBe(12);
        expect(trendPercent(50, 150)).toBe(-50);
        expect(trendPercent(10, 10)).toBeNull();
    });

    it("percentOf guards an empty total", () => {
        expect(percentOf(60, 100)).toBe(60);
        expect(percentOf(1, 0)).toBe(0);
    });

    it("formatHours renders whole thousands-separated hours", () => {
        expect(formatHours(62_561 * 3600)).toBe("62,561h");
    });

    it("buildHeatmapGrid orders rows Monday-first and fills gaps with zero", () => {
        const grid = buildHeatmapGrid([
            { bucket: "1-00", total: 3 },
            { bucket: "0-23", total: 7 },
        ]);
        expect(grid).toHaveLength(7);
        expect(grid[0][0]).toBe(3);
        expect(grid[6][23]).toBe(7);
        expect(grid[3].every((v) => v === 0)).toBe(true);
    });

    it("formatDateRange clamps all-time windows to the first activity", () => {
        const now = new Date(2026, 8, 28).getTime();
        const first = new Date(2025, 8, 1).getTime();
        expect(formatDateRange(7300, now, first)).toBe("Sep 1, 2025 – Sep 28, 2026");
    });

    it("formatBucketLabel handles monthly and daily buckets", () => {
        expect(formatBucketLabel("2024-04")).toBe("Apr 2024");
        expect(formatBucketLabel("2026-09-05")).toBe("Sep 5");
    });
});
