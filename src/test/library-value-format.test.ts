import { describe, expect, it } from "vitest";
import {
    formatBytes,
    formatDelay,
    lastPlayedLabel,
    titleWithYear,
} from "@/features/stats-v2/components/library/library-format";

const HOUR = 3600000;
const DAY = 24 * HOUR;
const GB = 1024 ** 3;

describe("library-format", () => {
    it("formats bytes in MB / GB / TB", () => {
        expect(formatBytes(500 * 1024 ** 2)).toBe("500 MB");
        expect(formatBytes(4.7 * GB)).toBe("4.7 GB");
        expect(formatBytes(58.4 * GB)).toBe("58 GB");
        expect(formatBytes(1.25 * 1024 * GB)).toBe("1.3 TB");
    });

    it("formats delays at human scale", () => {
        expect(formatDelay(10 * 60000)).toBe("1h");
        expect(formatDelay(5 * HOUR)).toBe("5h");
        expect(formatDelay(DAY)).toBe("1 day");
        expect(formatDelay(12 * DAY)).toBe("12 days");
        expect(formatDelay(240 * DAY)).toBe("8 mo");
        expect(formatDelay(3 * 365.25 * DAY)).toBe("3.0 years");
    });

    it("labels last play and titles", () => {
        expect(lastPlayedLabel(null, 0)).toBe("Never played");
        expect(lastPlayedLabel(0, 12 * DAY)).toBe("Last played 12 days ago");
        expect(titleWithYear("Heat", 1995)).toBe("Heat (1995)");
        expect(titleWithYear("Heat", null)).toBe("Heat");
    });
});
