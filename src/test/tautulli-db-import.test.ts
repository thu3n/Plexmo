import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SRV_A, ACC_ELIAS } from "./fixtures/v1-seed";

vi.mock("@/lib/db", async () => {
    const { createTestDb, migrateTo } = await import("@/test/db-helper");
    const { seedV1Fixture } = await import("@/test/fixtures/v1-seed");
    const db = createTestDb(1);
    seedV1Fixture(db);
    migrateTo(db);
    return { db };
});

import { db } from "@/lib/db";
import { inspectTautulliDb, runTautulliDbImport } from "@/lib/tautulli-db-import";

const STARTED = 1_700_000_000;

let dir: string;
let sourcePath: string;

const createSourceDb = () => {
    dir = mkdtempSync(join(tmpdir(), "tautulli-test-"));
    sourcePath = join(dir, "tautulli.db");
    const src = new Database(sourcePath);
    src.exec(`
        CREATE TABLE session_history (
            id INTEGER PRIMARY KEY, reference_id INTEGER, started INTEGER, stopped INTEGER,
            server_id INTEGER, rating_key INTEGER, user_id INTEGER, user TEXT, ip_address TEXT,
            paused_counter INTEGER, player TEXT, product TEXT, platform TEXT, media_type TEXT,
            view_offset INTEGER, bandwidth INTEGER, location TEXT, quality_profile TEXT
        );
        CREATE TABLE session_history_media_info (
            id INTEGER PRIMARY KEY, video_decision TEXT, audio_decision TEXT, transcode_decision TEXT,
            container TEXT, video_codec TEXT, audio_codec TEXT, height INTEGER, bitrate INTEGER,
            video_resolution TEXT, stream_video_resolution TEXT
        );
        CREATE TABLE session_history_metadata (
            id INTEGER PRIMARY KEY, rating_key INTEGER, title TEXT, parent_title TEXT,
            grandparent_title TEXT, original_title TEXT, year INTEGER, media_index INTEGER,
            parent_media_index INTEGER, duration INTEGER, guid TEXT, thumb TEXT
        );
        CREATE TABLE servers (
            id INTEGER PRIMARY KEY, pms_name TEXT, pms_identifier TEXT, pms_is_deleted INTEGER DEFAULT 0
        );
        INSERT INTO servers VALUES (1, 'Alpha-Tautulli', 'machine-alpha', 0);
        INSERT INTO servers VALUES (2, 'Other', 'machine-unknown', 0);

        -- Row 901: matches an existing API-imported Plexmo row -> re-enrichment.
        INSERT INTO session_history VALUES
            (901, 901, ${STARTED}, ${STARTED + 3600}, 1, 555, 100, 'Elias', '1.2.3.4',
             120, 'Plex Web', 'Plex Web', 'Chrome', 'movie', 3060000, 8000, 'wan', 'Original');
        INSERT INTO session_history_media_info VALUES
            (901, 'copy', 'copy', 'copy', 'mkv', 'h264', 'dts', 1080, 12000, '1080', '1080');
        INSERT INTO session_history_metadata VALUES
            (901, 555, 'Enriched Movie', NULL, NULL, NULL, 2020, NULL, NULL, 3600000, 'plex://movie/enriched1', NULL);

        -- Row 902: not in Plexmo -> fresh insert.
        INSERT INTO session_history VALUES
            (902, 902, ${STARTED + 86400}, ${STARTED + 86400 + 1800}, 1, 556, 100, 'Elias', '1.2.3.4',
             0, 'Plex Web', 'Plex Web', 'Chrome', 'movie', 1800000, 4000, 'lan', 'Original');
        INSERT INTO session_history_media_info VALUES
            (902, 'transcode', 'direct play', 'transcode', 'mkv', 'hevc', 'aac', 2160, 40000, '4k', '1080');
        INSERT INTO session_history_metadata VALUES
            (902, 556, 'New Movie', NULL, NULL, NULL, 2021, NULL, NULL, 3600000, 'plex://movie/new1', NULL);

        -- Row 903: mapped to 'ignore' -> skipped.
        INSERT INTO session_history VALUES
            (903, 903, ${STARTED + 172800}, ${STARTED + 172800 + 1800}, 2, 557, 100, 'Elias', '1.2.3.4',
             0, 'Plex Web', 'Plex Web', 'Chrome', 'movie', 1800000, 0, 'lan', NULL);
        INSERT INTO session_history_media_info VALUES
            (903, 'direct play', 'direct play', 'direct play', 'mkv', 'h264', 'aac', 1080, 10000, '1080', '1080');
        INSERT INTO session_history_metadata VALUES
            (903, 557, 'Ignored Movie', NULL, NULL, NULL, 2022, NULL, NULL, 3600000, NULL, NULL);
    `);
    src.close();
};

beforeAll(() => {
    createSourceDb();

    // Plexmo server gets the matching machineIdentifier for auto-mapping.
    db.prepare("UPDATE servers SET machineIdentifier = 'machine-alpha' WHERE id = ?").run(SRV_A);

    // Pre-existing shallow API import of source row 901 (the enrichment target).
    db.prepare(`
        INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration,
            pausedCounter, meta_json, importSource, importRef
        ) VALUES ('api-901', ?, ?, 'Elias', 'Enriched Movie', '555', ?, ?, 3480, 120,
            '{"title":"Enriched Movie","decision":"direct play"}', 'tautulli:deadbeef', '901')
    `).run(SRV_A, ACC_ELIAS, STARTED * 1000, (STARTED + 3600) * 1000);
});

afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
});

describe("tautulli database-file import", () => {
    it("inspects the file: row count, servers and machineIdentifier auto-mapping", () => {
        const info = inspectTautulliDb(sourcePath);
        expect(info.rowCount).toBe(3);
        expect(info.hasServerColumn).toBe(true);
        expect(info.servers).toHaveLength(2);
        expect(info.suggestedMapping["1"]).toBe(SRV_A);
        expect(info.suggestedMapping["2"]).toBe("ignore");
    });

    it("enriches existing rows, inserts new ones, skips ignored servers", async () => {
        await runTautulliDbImport("job-test", { path: sourcePath, serverMapping: { "1": SRV_A, "2": "ignore" } });

        // 901: enriched in place — copy becomes direct stream, full facts land.
        const enrichedRow = db.prepare("SELECT * FROM activity_history WHERE id = 'api-901'").get() as Record<string, unknown>;
        expect(enrichedRow.transcode_decision).toBe("direct stream");
        expect(enrichedRow.video_resolution).toBe("1080p");
        expect(enrichedRow.bitrate).toBe(12000);
        expect(enrichedRow.bandwidth).toBe(8000);
        expect(enrichedRow.location).toBe("wan");
        expect(enrichedRow.percent_complete).toBe(85);
        expect(enrichedRow.watched).toBe(1);
        expect(enrichedRow.play_duration).toBe(3480 - 120);
        expect(enrichedRow.plex_guid).toBe("plex://movie/enriched1");

        // 902: inserted fresh with transcode facts.
        const inserted = db.prepare(
            "SELECT * FROM activity_history WHERE importRef = '902'"
        ).get() as Record<string, unknown>;
        expect(inserted).toBeDefined();
        expect(inserted.transcode_decision).toBe("transcode");
        expect(inserted.video_resolution).toBe("4k");
        expect(inserted.stream_video_resolution).toBe("1080p");

        // 903: ignored server — never imported.
        const ignored = db.prepare("SELECT COUNT(*) as c FROM activity_history WHERE importRef = '903'").get() as { c: number };
        expect(ignored.c).toBe(0);
    });
});
