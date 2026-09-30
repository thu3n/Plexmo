import { describe, expect, it } from "vitest";
import {
    episodeCode,
    formatPauseRate,
    formatSpan,
    plural,
} from "@/features/stats-v2/components/behaviour/behaviour-format";

const MINUTE = 60_000;

describe("behaviour-format", () => {
    it("formats episode codes, null when numbering is unknown", () => {
        expect(episodeCode(1, 4)).toBe("S1 · E4");
        expect(episodeCode(null, 4)).toBeNull();
    });

    it("formats binge spans", () => {
        expect(formatSpan(0, 45 * MINUTE)).toBe("45m");
        expect(formatSpan(0, 120 * MINUTE)).toBe("2h");
        expect(formatSpan(0, 200 * MINUTE)).toBe("3h 20m");
        expect(formatSpan(10, 0)).toBe("0m");
    });

    it("formats pause rates and plurals", () => {
        expect(formatPauseRate(3)).toBe("3.0 min/h");
        expect(plural(1, "viewer")).toBe("1 viewer");
        expect(plural(1200, "viewer")).toBe("1,200 viewers");
        expect(plural(2, "series", "series")).toBe("2 series");
    });
});
