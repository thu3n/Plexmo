import { describe, it, expect } from "vitest";
import {
    buildHeatmapGrid,
    formatBucketLabel,
    formatDateRange,
    formatResolutionChange,
    levelFor,
    quantileThresholds,
    resolutionRank,
    groupResolutions,
    formatHours,
    formatShare,
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

    it("formatResolutionChange suffixes bare heights", () => {
        expect(formatResolutionChange("4k → 1080")).toBe("4K → 1080p");
        expect(formatResolutionChange("1080p → sd")).toBe("1080p → SD");
        expect(formatResolutionChange("1080 → 720")).toBe("1080p → 720p");
    });

    it("quantile levels spread skewed data across every shade", () => {
        // One huge evening spike must not collapse everything else into level 1.
        const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1000];
        const thresholds = quantileThresholds(values, 5);
        expect(thresholds).toHaveLength(5);
        expect(levelFor(0, thresholds)).toBe(0);
        expect(levelFor(1, thresholds)).toBe(1);
        expect(levelFor(5, thresholds)).toBe(3);
        expect(levelFor(1000, thresholds)).toBe(5);
        expect(quantileThresholds([0, 0], 5)).toEqual([]);
    });

    it("resolutionRank orders named and numeric resolutions", () => {
        const sorted = ["720", "sd", "4k", "1080p"].sort((a, b) => resolutionRank(b) - resolutionRank(a));
        expect(sorted).toEqual(["4k", "1080p", "720", "sd"]);
    });

    it("groupResolutions collapses raw heights into quality classes", () => {
        expect(
            groupResolutions([
                { bucket: "4k", total: 5 },
                { bucket: "1072", total: 3 },
                { bucket: "1080", total: 10 },
                { bucket: "804", total: 2 },
                { bucket: "sd", total: 4 },
                { bucket: "unknown", total: 99 },
            ]),
        ).toEqual([
            { label: "4K", total: 5 },
            { label: "1080p", total: 13 },
            { label: "720p", total: 2 },
            { label: "SD", total: 4 },
        ]);
    });

    it("formatShare never shows a real share as 0%", () => {
        expect(formatShare(258, 114_000)).toBe("<1%");
        expect(formatShare(0, 100)).toBe("0%");
        expect(formatShare(37, 100)).toBe("37%");
    });
});
