// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PlexSession } from "@/lib/plex";
import { formatMbps, summarizeSessions } from "@/features/dashboard/utils/sessionSummary";

const session = (overrides: Partial<PlexSession>): PlexSession =>
    ({ state: "playing", bandwidth: 0, decision: "direct play", location: "lan", ...overrides }) as PlexSession;

describe("summarizeSessions", () => {
    it("counts paused on top of the decision, never instead of it", () => {
        const summary = summarizeSessions([
            session({ decision: "transcode", state: "paused" }),
            session({ decision: "direct stream" }),
            session({ decision: "direct play", state: "paused" }),
        ]);
        expect(summary).toMatchObject({ active: 3, paused: 2, transcoding: 1, directStream: 1, directPlay: 1 });
        expect(summary.directPlay + summary.directStream + summary.transcoding).toBe(summary.active);
    });

    it("splits bandwidth into LAN and everything that leaves the network", () => {
        const summary = summarizeSessions([
            session({ bandwidth: 4000, location: "lan" }),
            session({ bandwidth: 2500, location: "wan" }),
            session({ bandwidth: 500, location: "cellular" }),
        ]);
        expect(summary).toMatchObject({ bandwidth: 7000, lanBandwidth: 4000, wanBandwidth: 3000 });
    });

    it("treats a missing decision as direct play and a missing bandwidth as zero", () => {
        const summary = summarizeSessions([session({ decision: undefined, bandwidth: undefined as unknown as number })]);
        expect(summary).toMatchObject({ directPlay: 1, bandwidth: 0 });
    });

    it("returns a fresh zero summary for no sessions", () => {
        expect(summarizeSessions([])).toMatchObject({ active: 0, bandwidth: 0 });
    });
});

describe("formatMbps", () => {
    it("formats kbps as one-decimal Mbps", () => {
        expect(formatMbps(0)).toBe("0 Mbps");
        expect(formatMbps(12345)).toBe("12.3 Mbps");
    });
});
