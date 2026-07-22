import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, migrateTo } from "./db-helper";
import { seedV1Fixture, SRV_A, ACC_ELIAS, BASE_TIME } from "./fixtures/v1-seed";

const HOUR = 3600000;

/**
 * Fact-rich v1 row for the v5 fact-column backfill — full session meta with
 * decisions, resolutions, bandwidth and a 92%-complete viewOffset, plus 10
 * minutes of pause that v5 must subtract from play_duration. Seeded here (not
 * in the shared fixture) so v2 aggregate expectations stay untouched.
 */
const seedFactRow = (db: Database.Database) => {
  db.prepare(
    `INSERT INTO activity_history (
       id, serverId, userId, user, title, subtitle, ratingKey,
       startTime, stopTime, duration, platform, device, player, ip, meta_json,
       pausedCounter, plex_guid, imdb_id, tmdb_id, tvdb_id, repair_status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "h7", SRV_A, ACC_ELIAS, "Elias", "Facts Movie", null, "7000",
    BASE_TIME + 12 * HOUR, BASE_TIME + 14 * HOUR, 7200, "Chrome", "Desktop", "Plex Web", "1.2.3.4",
    JSON.stringify({
      title: "Facts Movie",
      decision: "transcode",
      videoDecision: "transcode",
      audioDecision: "direct play",
      resolution: "720p",
      originalHeight: "1080p",
      transcodeHeight: "720p",
      quality: "3.5 Mbps",
      bandwidth: 4200,
      location: "wan",
      viewOffset: 6624000,
      duration: 7200000,
    }),
    600, null, null, null, null, null
  );
};

type FactRow = {
  transcode_decision: string | null;
  video_decision: string | null;
  audio_decision: string | null;
  video_resolution: string | null;
  stream_video_resolution: string | null;
  bitrate: number | null;
  bandwidth: number | null;
  location: string | null;
  view_offset_ms: number | null;
  percent_complete: number | null;
  watched: number | null;
  play_duration: number | null;
};

describe("migration v5: history_fact_columns", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb(1);
    seedV1Fixture(db);
    seedFactRow(db);
    migrateTo(db);
  });

  afterEach(() => {
    db.close();
  });

  const factsOf = (id: string): FactRow =>
    db.prepare("SELECT * FROM activity_history WHERE id = ?").get(id) as FactRow;

  it("backfills fact columns from a full session meta (h7)", () => {
    const h7 = factsOf("h7");
    expect(h7.transcode_decision).toBe("transcode");
    expect(h7.video_decision).toBe("transcode");
    expect(h7.audio_decision).toBe("direct play");
    expect(h7.video_resolution).toBe("1080p");
    expect(h7.stream_video_resolution).toBe("720p");
    expect(h7.bitrate).toBe(3500);
    expect(h7.bandwidth).toBe(4200);
    expect(h7.location).toBe("wan");
    expect(h7.view_offset_ms).toBe(6624000);
    // 6 624 000 / 7 200 000 = 92% >= the 85% watched threshold.
    expect(h7.percent_complete).toBe(92);
    expect(h7.watched).toBe(1);
  });

  it("subtracts pause time into play_duration", () => {
    const h7 = factsOf("h7");
    // 7200s wallclock - 600s paused.
    expect(h7.play_duration).toBe(6600);
  });

  it("leaves facts NULL (unknown) when meta lacks them, but still derives play_duration", () => {
    // h2 has no meta_json at all.
    const h2 = factsOf("h2");
    expect(h2.transcode_decision).toBeNull();
    expect(h2.percent_complete).toBeNull();
    expect(h2.watched).toBeNull();
    expect(h2.play_duration).toBe(3600);

    // h1 has meta_json without decision/viewOffset fields.
    const h1 = factsOf("h1");
    expect(h1.transcode_decision).toBeNull();
    expect(h1.watched).toBeNull();
    expect(h1.play_duration).toBe(7200);
  });

  it("creates the v6 library tables empty", () => {
    const sections = db.prepare("SELECT COUNT(*) as count FROM library_sections").get() as { count: number };
    const items = db.prepare("SELECT COUNT(*) as count FROM library_items").get() as { count: number };
    expect(sections.count).toBe(0);
    expect(items.count).toBe(0);
  });

  it("v6 replaces dead unified-library-era tables (legacy databases)", () => {
    // Reproduces the staging failure: pre-consolidation DBs carry a
    // library_items table (different schema) from the removed unified-library
    // feature; v6 must drop and recreate rather than fail on CREATE.
    const legacy = createTestDb(1);
    seedV1Fixture(legacy);
    legacy.exec(`
      CREATE TABLE library_items (ratingKey TEXT PRIMARY KEY, title TEXT, unifiedItemId TEXT);
      INSERT INTO library_items VALUES ('1234', 'Movie X', 'u1');
    `);

    migrateTo(legacy);

    const cols = (legacy.prepare("PRAGMA table_info(library_items)").all() as { name: string }[])
      .map((c) => c.name);
    expect(cols).toContain("serverId");
    expect(cols).toContain("mediaId");
    expect(cols).not.toContain("unifiedItemId");
    const items = legacy.prepare("SELECT COUNT(*) as count FROM library_items").get() as { count: number };
    expect(items.count).toBe(0);
    legacy.close();
  });
});
