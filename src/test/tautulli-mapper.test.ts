import { describe, it, expect } from "vitest";
import { mapTautulliToPlexmo, type TautulliFullEntry } from "@/lib/tautulli-mapper";

const baseEntry = (overrides: Partial<TautulliFullEntry>): TautulliFullEntry => ({
    id: 1,
    reference_id: 1,
    started: 1_700_000_000,
    stopped: 1_700_003_600,
    server_id: 1,
    rating_key: 123,
    user_id: 100,
    user: "elias",
    ip_address: "1.2.3.4",
    paused_counter: 0,
    player: "Plex Web",
    product: "Plex Web",
    platform: "Chrome",
    media_type: "movie",
    view_offset: 0,
    title: "Movie",
    ...overrides,
} as TautulliFullEntry);

const metaOf = (entry: TautulliFullEntry) =>
    JSON.parse(mapTautulliToPlexmo(entry, { 1: "srv-1" }).meta_json!) as {
        decision: string;
        videoDecision: string;
        audioDecision: string;
    };

describe("tautulli mapper stream decisions", () => {
    it("maps 'transcode' to transcode", () => {
        const meta = metaOf(baseEntry({ transcode_decision: "transcode" }));
        expect(meta.decision).toBe("transcode");
    });

    it("maps 'copy' to direct stream (not direct play)", () => {
        const meta = metaOf(baseEntry({ transcode_decision: "copy" }));
        expect(meta.decision).toBe("direct stream");
        expect(meta.videoDecision).toBe("direct stream");
    });

    it("maps 'direct play' with the app's exact spelling and never empty strings", () => {
        const meta = metaOf(baseEntry({ transcode_decision: "direct play" }));
        expect(meta.decision).toBe("direct play");
        expect(meta.videoDecision).toBe("direct play");
        expect(meta.audioDecision).toBe("direct play");
    });

    it("defaults missing decision to direct play, per-stream decisions win when present", () => {
        const meta = metaOf(baseEntry({ transcode_decision: undefined, video_decision: "transcode" }));
        expect(meta.decision).toBe("direct play");
        expect(meta.videoDecision).toBe("transcode");
    });
});
