import { describe, expect, it } from "vitest";
import {
    buildShareUrl,
    buildStoryCards,
    dayLabel,
    formatDuration,
    formatWrappedHours,
    hourLabel,
    hourPersona,
    hoursInDays,
    normalize,
    rankLabel,
} from "@/features/wrapped/lib/wrapped-format";
import type { WrappedData } from "@/lib/stats/wrapped";

const data = (over: Partial<WrappedData> = {}): WrappedData => ({
    userId: "u1",
    userName: "Alice",
    year: 2026,
    totals: { plays: 10, seconds: 36_000, activeDays: 4, titles: 6 },
    topMovies: [],
    topShows: [],
    longestBinge: null,
    busiestDay: null,
    busiestMonth: null,
    favouriteHour: null,
    monthlySeconds: Array(12).fill(0),
    hourlyPlays: Array(24).fill(0),
    devices: [],
    genres: null,
    rank: null,
    ...over,
});

describe("formatting", () => {
    it("formats hours, minutes and durations", () => {
        expect(formatWrappedHours(1_800)).toEqual({ value: "30", unit: "minutes" });
        expect(formatWrappedHours(3_600)).toEqual({ value: "1", unit: "hour" });
        expect(formatWrappedHours(3_600 * 1234)).toEqual({ value: "1,234", unit: "hours" });
        expect(formatDuration(45 * 60)).toBe("45m");
        expect(formatDuration(2 * 3600)).toBe("2h");
        expect(formatDuration(5 * 3600 + 20 * 60)).toBe("5h 20m");
        expect(hoursInDays(3600)).toBeNull();
        expect(hoursInDays(36 * 3600)).toBe("1.5 days");
    });

    it("labels hours and local dates", () => {
        expect(hourLabel(0)).toBe("12 AM");
        expect(hourLabel(12)).toBe("12 PM");
        expect(hourLabel(21)).toBe("9 PM");
        expect(dayLabel("2026-03-14")).toBe("Saturday, March 14");
    });

    it("maps hours to personas, wrapping the night owl past midnight", () => {
        expect(hourPersona(7).name).toBe("Early bird");
        expect(hourPersona(20).name).toBe("Primetime regular");
        expect(hourPersona(23).name).toBe("Night owl");
        expect(hourPersona(2).name).toBe("Night owl");
    });

    it("words rank only when there is someone to compare with", () => {
        expect(rankLabel(null)).toBeNull();
        expect(rankLabel({ position: 1, of: 1 })).toBeNull();
        expect(rankLabel({ position: 2, of: 9 })).toBe("#2 of 9 viewers");
    });

    it("builds an encoded share link", () => {
        expect(buildShareUrl("https://plex.example", "a b", 2025)).toBe("https://plex.example/wrapped?user=a+b&year=2025");
    });

    it("normalizes bar heights", () => {
        expect(normalize([0, 5, 10])).toEqual([0, 0.5, 1]);
        expect(normalize([0, 0])).toEqual([0, 0]);
    });
});

describe("buildStoryCards", () => {
    it("shows only intro and outro for an empty year", () => {
        expect(buildStoryCards(data({ totals: { plays: 0, seconds: 0, activeDays: 0, titles: 0 } }))).toEqual(["intro", "outro"]);
    });

    it("includes only cards with data, in story order", () => {
        const title = { mediaId: 1, title: "X", year: null, plays: 1, seconds: 1, thumb: null };
        const cards = buildStoryCards(
            data({
                topShows: [title],
                favouriteHour: { hour: 21, plays: 3 },
                devices: [{ name: "Roku", plays: 1, seconds: 1 }],
                genres: [{ genre: "Drama", plays: 2 }],
            }),
        );
        expect(cards).toEqual(["intro", "time", "shows", "rhythm", "devices", "genres", "outro"]);
    });
});
