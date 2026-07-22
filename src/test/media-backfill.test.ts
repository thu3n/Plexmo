import { describe, it, expect } from "vitest";
import { vi } from "vitest";
import type { MediaItemRow } from "@/lib/db-types";
import { SRV_A, EPISODE_GUID, SHOW_GUID } from "./fixtures/v1-seed";

vi.mock("@/lib/db", async () => {
  const { createTestDb, migrateTo } = await import("@/test/db-helper");
  const { seedV1Fixture } = await import("@/test/fixtures/v1-seed");
  const db = createTestDb(1);
  seedV1Fixture(db);
  migrateTo(db);
  return { db };
});

import { db } from "@/lib/db";
import { runMediaBackfillBatch } from "@/lib/media/backfill-job";

describe("media canonicalization backfill", () => {
  it("repairs the legacy grandparent-guid bug and links episode -> show", () => {
    const result = runMediaBackfillBatch();
    expect(result.processed).toBeGreaterThan(0);

    // The episode row's plex_guid must now be the EPISODE's own guid,
    // recovered from meta_json.Guid — not the show's.
    const row = db
      .prepare("SELECT plex_guid, mediaId FROM activity_history WHERE importRef = '555'")
      .get() as { plex_guid: string; mediaId: number };
    expect(row.plex_guid).toBe(EPISODE_GUID);
    expect(row.mediaId).not.toBeNull();

    const episodeItem = db
      .prepare("SELECT * FROM media_items WHERE id = ?")
      .get(row.mediaId) as MediaItemRow;
    expect(episodeItem.type).toBe("episode");
    expect(episodeItem.plex_guid).toBe(EPISODE_GUID);
    expect(episodeItem.seasonNumber).toBe(1);
    expect(episodeItem.episodeNumber).toBe(2);

    const showItem = db
      .prepare("SELECT * FROM media_items WHERE id = ?")
      .get(episodeItem.showMediaId) as MediaItemRow;
    expect(showItem.type).toBe("show");
    expect(showItem.plex_guid).toBe(SHOW_GUID);

    // Source mapping registered for cross-server aggregation.
    const source = db
      .prepare("SELECT mediaId FROM media_sources WHERE serverId = ? AND ratingKey = '9001'")
      .get(SRV_A) as { mediaId: number };
    expect(source.mediaId).toBe(row.mediaId);
  });

  it("is idempotent — a second run finds nothing left to do", () => {
    const again = runMediaBackfillBatch();
    expect(again.processed).toBe(0);
  });

  it("processes rows without promoted guid columns (meta-only guid, media_sources cache, hopeless)", () => {
    // (a) GUID lives only inside meta_json.Guid — no promoted columns.
    db.prepare(
      `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration, pausedCounter, meta_json)
       VALUES ('bf1', ?, '100', 'Elias', 'Meta Only Movie', '5001', 1000, 2000, 100, 0, ?)`
    ).run(SRV_A, JSON.stringify({ type: "movie", title: "Meta Only Movie", Guid: [{ id: "plex://movie/metaonly1" }] }));

    // (b) No GUIDs at all, but the library sync has cached the ratingKey.
    const mid = db.prepare(
      `INSERT INTO media_items (type, plex_guid, title, createdAt, updatedAt)
       VALUES ('movie', 'plex://movie/libsynced1', 'Lib Movie', '2026-01-01', '2026-01-01')`
    ).run().lastInsertRowid;
    db.prepare(
      `INSERT INTO media_sources (serverId, ratingKey, mediaId, updatedAt) VALUES (?, '5002', ?, '2026-01-01')`
    ).run(SRV_A, mid);
    db.prepare(
      `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration, pausedCounter)
       VALUES ('bf2', ?, '100', 'Elias', 'Lib Movie', '5002', 3000, 4000, 100, 0)`
    ).run(SRV_A);

    // (c) Hopeless: no GUIDs anywhere, ratingKey unknown to the library.
    db.prepare(
      `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration, pausedCounter)
       VALUES ('bf3', ?, '100', 'Elias', 'Ghost', '9999x', 5000, 6000, 100, 0)`
    ).run(SRV_A);

    const res = runMediaBackfillBatch();
    expect(res.processed).toBe(3);
    expect(res.linked).toBe(2);

    const rowOf = (id: string) =>
      db.prepare("SELECT mediaId, repair_status FROM activity_history WHERE id = ?").get(id) as {
        mediaId: number | null;
        repair_status: string | null;
      };
    expect(rowOf("bf1").mediaId).not.toBeNull();
    expect(rowOf("bf2").mediaId).toBe(Number(mid));
    expect(rowOf("bf3").mediaId).toBeNull();
    expect(rowOf("bf3").repair_status).toBe("no_media_identity");

    // Marked rows are not re-read: the queue is truly drained.
    expect(runMediaBackfillBatch().processed).toBe(0);
  });

  it("links legacy episodes carrying only show-level external ids via (show, S, E)", () => {
    // The show exists canonically with a tvdb id (library sync enrichment).
    const showId = db.prepare(
      `INSERT INTO media_items (type, plex_guid, tvdb_id, title, createdAt, updatedAt)
       VALUES ('show', 'plex://show/extshow1', '7777', 'Ext Show', '2026-01-01', '2026-01-01')`
    ).run().lastInsertRowid;

    // Legacy Tautulli episode row: no promoted guids, no grandparentGuid —
    // only the SHOW's tvdb id inside meta_json.Guid, plus (S, E).
    db.prepare(
      `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration, pausedCounter, meta_json)
       VALUES ('bf4', ?, '100', 'Elias', 'Ext Show', '6001', 7000, 8000, 100, 0, ?)`
    ).run(SRV_A, JSON.stringify({
      type: "episode",
      grandparentTitle: "Ext Show",
      parentIndex: 2,
      index: 5,
      Guid: [{ id: "tvdb://7777" }],
    }));

    const res = runMediaBackfillBatch();
    expect(res.linked).toBe(1);

    const row = db.prepare("SELECT mediaId FROM activity_history WHERE id = 'bf4'").get() as { mediaId: number };
    const episode = db.prepare("SELECT * FROM media_items WHERE id = ?").get(row.mediaId) as MediaItemRow;
    expect(episode.type).toBe("episode");
    expect(episode.showMediaId).toBe(Number(showId));
    expect(episode.seasonNumber).toBe(2);
    expect(episode.episodeNumber).toBe(5);
  });

  it("falls back to unique show title when the row's ids are episode-level", () => {
    db.prepare(
      `INSERT INTO media_items (type, plex_guid, title, createdAt, updatedAt)
       VALUES ('show', 'plex://show/titleshow1', 'Unique Title Show', '2026-01-01', '2026-01-01')`
    ).run();

    // Episode-level ids match no show; grandparentTitle is the only bridge.
    db.prepare(
      `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration, pausedCounter, meta_json)
       VALUES ('bf5', ?, '100', 'Elias', 'Unique Title Show', '7001', 9000, 10000, 100, 0, ?)`
    ).run(SRV_A, JSON.stringify({
      type: "episode",
      grandparentTitle: "Unique Title Show",
      parentIndex: 1,
      index: 3,
      Guid: [{ id: "tvdb://9999999" }],
    }));

    const res = runMediaBackfillBatch();
    expect(res.linked).toBe(1);
    const row = db.prepare("SELECT mediaId FROM activity_history WHERE id = 'bf5'").get() as { mediaId: number };
    const episode = db.prepare("SELECT * FROM media_items WHERE id = ?").get(row.mediaId) as MediaItemRow;
    expect(episode.seasonNumber).toBe(1);
    expect(episode.episodeNumber).toBe(3);
  });

  it("refuses the title fallback when two shows share the title", () => {
    db.prepare(
      `INSERT INTO media_items (type, plex_guid, title, createdAt, updatedAt)
       VALUES ('show', 'plex://show/dup1', 'Duplicate Show', '2026-01-01', '2026-01-01')`
    ).run();
    db.prepare(
      `INSERT INTO media_items (type, plex_guid, title, createdAt, updatedAt)
       VALUES ('show', 'plex://show/dup2', 'Duplicate Show', '2026-01-01', '2026-01-01')`
    ).run();

    db.prepare(
      `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration, pausedCounter, meta_json)
       VALUES ('bf6', ?, '100', 'Elias', 'Duplicate Show', '7002', 11000, 12000, 100, 0, ?)`
    ).run(SRV_A, JSON.stringify({
      type: "episode",
      grandparentTitle: "Duplicate Show",
      parentIndex: 1,
      index: 1,
      Guid: [],
    }));

    runMediaBackfillBatch();
    const row = db.prepare("SELECT mediaId, repair_status FROM activity_history WHERE id = 'bf6'").get() as {
      mediaId: number | null;
      repair_status: string | null;
    };
    expect(row.mediaId).toBeNull();
    expect(row.repair_status).toBe("no_media_identity");
  });
});
