import { describe, expect, it } from "vitest";
import { formatDays, formatHour, peakHour, userHref } from "@/features/stats-v2/components/people/people-format";

describe("people-format", () => {
    it("formats hours on a 12-hour clock", () => {
        expect(formatHour(0)).toBe("12 AM");
        expect(formatHour(9)).toBe("9 AM");
        expect(formatHour(12)).toBe("12 PM");
        expect(formatHour(21)).toBe("9 PM");
    });

    it("finds the peak hour, earliest on ties, null without plays", () => {
        const hours = Array.from({ length: 24 }, () => 0);
        expect(peakHour(hours)).toBeNull();
        hours[20] = 3;
        hours[21] = 3;
        expect(peakHour(hours)).toBe(20);
    });

    it("formats day counts and user links", () => {
        expect(formatDays(76.4)).toBe("76d");
        expect(formatDays(-2)).toBe("0d");
        expect(userHref("A B")).toBe("/settings/users/A%20B?from=statistics");
    });
});
