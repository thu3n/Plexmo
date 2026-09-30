import { describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, migrateTo } from "./db-helper";
import { LATEST_SCHEMA_VERSION } from "@/lib/migrations";

const NEW_COLUMNS = ["subtitle_decision", "subtitle_codec", "video_codec", "audio_codec", "source_bitrate"];

const historyColumns = (db: Database.Database): string[] =>
    (db.prepare("PRAGMA table_info(activity_history)").all() as { name: string }[]).map((c) => c.name);

const insertRow = (db: Database.Database, id: string, meta: string | null) =>
    db.prepare(
        `INSERT INTO activity_history (id, serverId, user, title, ratingKey, startTime, stopTime, duration, meta_json)
         VALUES (?, 'srv-a', 'alice', 'T', '1', 0, 1000, 1, ?)`
    ).run(id, meta);

type FactRow = {
    subtitle_decision: string | null;
    subtitle_codec: string | null;
    video_codec: string | null;
    audio_codec: string | null;
    source_bitrate: number | null;
};

const factsOf = (db: Database.Database, id: string) =>
    db.prepare(
        "SELECT subtitle_decision, subtitle_codec, video_codec, audio_codec, source_bitrate FROM activity_history WHERE id = ?"
    ).get(id) as FactRow;

describe("migration v17: history_quality_facts", () => {
    it("adds the quality fact columns on a fresh database", () => {
        const db = createTestDb();
        expect(historyColumns(db)).toEqual(expect.arrayContaining(NEW_COLUMNS));
        db.close();
    });

    it("backfills live-capture and Tautulli meta, leaving unknowns NULL", () => {
        const db = createTestDb(16);
        expect(historyColumns(db)).not.toContain("subtitle_decision");

        insertRow(db, "live", JSON.stringify({
            subtitleDecision: "Burn",
            originalSubtitleCodec: "PGS",
            originalVideoCodec: "HEVC",
            originalAudioCodec: "truehd",
            originalBitrateKbps: 24000,
        }));
        insertRow(db, "tautulli", JSON.stringify({ videoCodec: "h264", audioCodec: "AAC" }));
        insertRow(db, "no-meta", null);
        insertRow(db, "bad-meta", "{not json");

        migrateTo(db);

        expect(factsOf(db, "live")).toEqual({
            subtitle_decision: "burn",
            subtitle_codec: "pgs",
            video_codec: "hevc",
            audio_codec: "truehd",
            source_bitrate: 24000,
        });
        expect(factsOf(db, "tautulli")).toEqual({
            subtitle_decision: null,
            subtitle_codec: null,
            video_codec: "h264",
            audio_codec: "aac",
            source_bitrate: null,
        });
        const empty = { subtitle_decision: null, subtitle_codec: null, video_codec: null, audio_codec: null, source_bitrate: null };
        expect(factsOf(db, "no-meta")).toEqual(empty);
        expect(factsOf(db, "bad-meta")).toEqual(empty);
        db.close();
    });

    it("records version 17 as applied", () => {
        const db = createTestDb();
        const row = db
            .prepare("SELECT version FROM schema_migrations WHERE version = 17")
            .get() as { version: number } | undefined;
        expect(row?.version).toBe(17);
        expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(17);
        db.close();
    });
});
