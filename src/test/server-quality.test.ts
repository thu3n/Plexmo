import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { getTranscodeReasons, getTranscodingClients } from "@/lib/stats/server-quality";
import { formatCodec, reasonHint } from "@/lib/stats/server-quality-hints";
import { extractSessionFacts } from "@/lib/history/session-facts";

const DAY = 24 * 3600 * 1000;
const NOW = new Date(2026, 8, 30, 12).getTime();
const SINCE = NOW - 30 * DAY;
const IN_WINDOW = NOW - 2 * DAY;

type Row = {
    serverId?: string;
    startTime?: number;
    decision?: string | null;
    video?: string;
    audio?: string;
    subtitle?: string | null;
    subtitleCodec?: string;
    videoCodec?: string;
    audioCodec?: string;
    res?: string;
    streamRes?: string;
    bitrate?: number;
    sourceBitrate?: number;
    location?: string;
    platform?: string;
    player?: string;
};

let seq = 0;
const insert = (row: Row = {}) => {
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration,
            transcode_decision, video_decision, audio_decision, subtitle_decision, subtitle_codec,
            video_codec, audio_codec, video_resolution, stream_video_resolution, bitrate, source_bitrate,
            location, platform, player
        ) VALUES (?, ?, 'u1', 'alice', 'T', '1', ?, ?, 600, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        `q-${seq++}`,
        row.serverId ?? "srv-a",
        row.startTime ?? IN_WINDOW,
        (row.startTime ?? IN_WINDOW) + 600_000,
        row.decision === undefined ? "transcode" : row.decision,
        row.video ?? "direct play",
        row.audio ?? "direct play",
        row.subtitle === undefined ? "direct play" : row.subtitle,
        row.subtitleCodec ?? null,
        row.videoCodec ?? null,
        row.audioCodec ?? null,
        row.res ?? "1080p",
        row.streamRes ?? "1080p",
        row.bitrate ?? null,
        row.sourceBitrate ?? null,
        row.location ?? "lan",
        row.platform ?? "Roku",
        row.player ?? "Roku Ultra",
    );
};

const params = (extra: { serverId?: string; allowedServerIds?: string[] } = {}) => ({ since: SINCE, until: NOW, ...extra });

beforeEach(() => {
    seq = 0;
    db.prepare("DELETE FROM activity_history").run();
});

describe("getTranscodeReasons", () => {
    it("assigns one primary reason per transcode in causal priority", () => {
        // Subtitle burn-in wins even though video also transcodes.
        insert({ subtitle: "burn", subtitleCodec: "hdmv_pgs_subtitle", video: "transcode" });
        insert({ subtitle: "burn", subtitleCodec: "hdmv_pgs_subtitle", video: "transcode" });
        // WAN + delivered below source = bandwidth, despite the downscale.
        insert({ video: "transcode", location: "wan", bitrate: 4000, sourceBitrate: 20000, res: "4k", streamRes: "1080p" });
        // Downscale on LAN.
        insert({ video: "transcode", res: "4k", streamRes: "1080p", videoCodec: "hevc" });
        // Same resolution video transcode = codec.
        insert({ video: "transcode", videoCodec: "hevc" });
        // Audio only.
        insert({ audio: "transcode", audioCodec: "truehd" });
        // Pre-v17 row with nothing explaining it.
        insert({ subtitle: null });
        // Direct plays count toward totals only.
        insert({ decision: "direct play" });

        const result = getTranscodeReasons(params());
        expect(result.totalPlays).toBe(8);
        expect(result.transcodes).toBe(7);
        const byKey = Object.fromEntries(result.reasons.map((r) => [r.key, r]));
        expect(result.reasons[0].key).toBe("subtitle");
        expect(byKey.subtitle).toMatchObject({ count: 2, share: 29, topDetail: "PGS", topDetailShare: 100 });
        expect(byKey.subtitle.hint).toContain("prefer SRT");
        expect(byKey.bandwidth).toMatchObject({ count: 1, topDetail: null });
        expect(byKey.bandwidth.hint).toContain("~20% of source");
        expect(byKey.video_resolution).toMatchObject({ count: 1, topDetail: "4k → 1080p" });
        expect(byKey.video_codec).toMatchObject({ count: 1, topDetail: "HEVC" });
        expect(byKey.audio).toMatchObject({ count: 1, topDetail: "TrueHD" });
        expect(byKey.unknown).toMatchObject({ count: 1, label: "Unknown / not recorded" });
    });

    it("does not call a WAN stream bandwidth-limited without a known source bitrate", () => {
        insert({ video: "transcode", location: "wan", bitrate: 4000, videoCodec: "hevc" });
        insert({ video: "transcode", location: "wan", bitrate: 19500, sourceBitrate: 20000, videoCodec: "hevc" });
        const [only] = getTranscodeReasons(params()).reasons;
        expect(only).toMatchObject({ key: "video_codec", count: 2 });
    });

    it("honours window, server filter and authorization scope", () => {
        insert({ video: "transcode", serverId: "srv-a" });
        insert({ audio: "transcode", serverId: "srv-b" });
        insert({ video: "transcode", startTime: SINCE - DAY });

        expect(getTranscodeReasons(params()).transcodes).toBe(2);
        expect(getTranscodeReasons(params({ serverId: "srv-b" })).reasons.map((r) => r.key)).toEqual(["audio"]);
        expect(getTranscodeReasons(params({ allowedServerIds: ["srv-a"] })).reasons.map((r) => r.key)).toEqual(["video_codec"]);
        expect(getTranscodeReasons(params({ allowedServerIds: ["srv-a"], serverId: "srv-b" })).transcodes).toBe(0);
    });

    it("returns an empty breakdown when nothing transcoded", () => {
        insert({ decision: "direct play" });
        expect(getTranscodeReasons(params())).toEqual({ totalPlays: 1, transcodes: 0, reasons: [] });
    });
});

describe("getTranscodingClients", () => {
    it("ranks clients by transcodes with share and top reason", () => {
        insert({ platform: "Roku", player: "Roku Ultra", audio: "transcode" });
        insert({ platform: "Roku", player: "Roku Ultra", audio: "transcode" });
        insert({ platform: "Roku", player: "Roku Ultra", decision: "direct play" });
        insert({ platform: "Chrome", player: "Plex Web", subtitle: "burn" });
        insert({ platform: "Chrome", player: "Plex Web", decision: "direct play" });
        insert({ platform: "tvOS", player: "Apple TV", decision: "direct play" });

        const clients = getTranscodingClients(params());
        expect(clients).toEqual([
            { platform: "Roku", player: "Roku Ultra", plays: 3, transcodes: 2, share: 67, topReason: "audio" },
            { platform: "Chrome", player: "Plex Web", plays: 2, transcodes: 1, share: 50, topReason: "subtitle" },
        ]);
        expect(getTranscodingClients({ ...params(), limit: 1 })).toHaveLength(1);
    });
});

describe("hints", () => {
    it("labels codecs for humans", () => {
        expect(formatCodec("hdmv_pgs_subtitle")).toBe("PGS");
        expect(formatCodec("dca")).toBe("DTS");
        expect(formatCodec("h264")).toBe("H264");
    });

    it("gives codec-specific advice", () => {
        expect(reasonHint({ reason: "subtitle", topDetail: "ass", bitrateRatio: null })).toContain("Styled ASS");
        expect(reasonHint({ reason: "video_codec", topDetail: "mpeg2video", bitrateRatio: null })).toContain("Legacy MPEG-2");
        expect(reasonHint({ reason: "audio", topDetail: "eac3", bitrateRatio: null })).toContain("E-AC3");
        expect(reasonHint({ reason: "video_resolution", topDetail: "1080p → 720p", bitrateRatio: null })).toContain("quality setting");
        expect(reasonHint({ reason: "bandwidth", topDetail: null, bitrateRatio: null })).toContain("below source bitrate");
    });
});

describe("extractSessionFacts (v17 fields)", () => {
    it("reads subtitle, codec and source bitrate facts from live and Tautulli meta", () => {
        expect(extractSessionFacts(JSON.stringify({
            subtitleDecision: "Burn",
            originalSubtitleCodec: "PGS",
            originalVideoCodec: "HEVC",
            originalAudioCodec: "DCA",
            originalBitrateKbps: 18000.4,
        }))).toMatchObject({
            subtitle_decision: "burn",
            subtitle_codec: "pgs",
            video_codec: "hevc",
            audio_codec: "dca",
            source_bitrate: 18000,
        });
        expect(extractSessionFacts(JSON.stringify({ videoCodec: "H264", audioCodec: "aac", originalBitrateKbps: 0 })))
            .toMatchObject({ subtitle_decision: null, video_codec: "h264", audio_codec: "aac", source_bitrate: null });
    });
});
