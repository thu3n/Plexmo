import { describe, it, expect } from "vitest";
import { applyStreamData, deriveLocationFromIp } from "@/lib/tautulli-client";
import { mapTautulliToPlexmo, type TautulliFullEntry } from "@/lib/tautulli-mapper";

describe("API import stream-data enrichment", () => {
    it("derives lan/wan from IP", () => {
        expect(deriveLocationFromIp("192.168.1.55")).toBe("lan");
        expect(deriveLocationFromIp("10.0.0.2")).toBe("lan");
        expect(deriveLocationFromIp("172.20.4.1")).toBe("lan");
        expect(deriveLocationFromIp("83.185.12.9")).toBe("wan");
        expect(deriveLocationFromIp(undefined)).toBeUndefined();
    });

    it("merges stream data and derives view_offset from percent_complete", () => {
        const entry: Record<string, unknown> = {
            duration: 7200000,
            transcode_decision: "transcode",
            ip_address: "83.185.12.9",
        };
        applyStreamData(entry, {
            video_decision: "transcode",
            audio_decision: "copy",
            container: "mkv",
            video_codec: "hevc",
            video_height: "2160",
            bitrate: "40000",
            video_resolution: "4k",
            stream_video_codec: "h264",
            stream_video_height: "1080",
            stream_bitrate: "8000",
            stream_video_resolution: "1080",
        }, { percent_complete: 92, ip_address: "83.185.12.9" });

        expect(entry.video_codec).toBe("hevc");
        expect(entry.height).toBe(2160);
        expect(entry.bitrate).toBe(40000);
        expect(entry.stream_bitrate).toBe(8000);
        expect(entry.location).toBe("wan");
        expect(entry.view_offset).toBe(Math.round(0.92 * 7200000));
    });

    it("round-trips percent_complete through the mapper facts pipeline", () => {
        const entry = {
            id: 1, reference_id: 1, started: 1_700_000_000, stopped: 1_700_003_600,
            server_id: 1, rating_key: 1, user_id: 1, user: "e", ip_address: "192.168.1.5",
            paused_counter: 0, player: "p", product: "p", platform: "p",
            media_type: "movie", title: "M",
            duration: 3600000, transcode_decision: "copy",
        } as unknown as TautulliFullEntry;

        applyStreamData(entry, undefined, { percent_complete: 85, ip_address: "192.168.1.5" });
        const mapped = mapTautulliToPlexmo(entry, { 1: "srv" });
        const meta = JSON.parse(mapped.meta_json!) as { viewOffset: number; duration: number; location: string; decision: string };

        expect(meta.decision).toBe("direct stream");
        expect(meta.location).toBe("lan");
        expect(Math.round((meta.viewOffset / meta.duration) * 100)).toBe(85);
    });
});
