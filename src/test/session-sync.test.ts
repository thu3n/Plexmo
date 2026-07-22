import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PlexSession, PlexServerConfig } from "@/lib/plex";
import type { ActiveSessionRow, CountRow } from "@/lib/db-types";

vi.mock("@/lib/db", async () => {
  const { createTestDb } = await import("@/test/db-helper");
  return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { syncHistory, flushStaleSessions } from "@/lib/history";

const SRV_A: PlexServerConfig = { id: "srv-a", name: "Alpha", baseUrl: "http://a", token: "t" };
const SRV_B: PlexServerConfig = { id: "srv-b", name: "Beta", baseUrl: "http://b", token: "t" };

// viewOffset below the 60s resume threshold -> start time is backfilled
// (now - viewOffset) regardless of process uptime, keeping tests deterministic.
const WATCHED_MS = 30_000;

let keyCounter = 0;
const makeSession = (overrides: Partial<PlexSession>): PlexSession => ({
  id: `test:${++keyCounter}`,
  sessionKey: String(keyCounter),
  title: "Movie",
  user: "Elias",
  userId: "100",
  state: "playing",
  bandwidth: 0,
  progressPercent: 0,
  duration: 7_200_000,
  viewOffset: WATCHED_MS,
  isOriginalQuality: true,
  ratingKey: "1234",
  ...overrides,
});

const activeRows = (): ActiveSessionRow[] =>
  db.prepare("SELECT * FROM active_sessions ORDER BY serverId, sessionKey").all() as ActiveSessionRow[];

const historyCount = (): number =>
  (db.prepare("SELECT COUNT(*) as count FROM activity_history").get() as CountRow).count;

beforeEach(() => {
  db.prepare("DELETE FROM active_sessions").run();
  db.prepare("DELETE FROM activity_history").run();
  db.prepare("DELETE FROM user_activity_summary").run();
});

describe("session sync keyed on (serverId, sessionKey)", () => {
  it("tracks two same-title viewers on one server as two sessions", () => {
    const s1 = makeSession({ sessionKey: "10", user: "Elias", userId: "100" });
    const s2 = makeSession({ sessionKey: "11", user: "Frank", userId: "300" });

    syncHistory(SRV_A, [s1, s2]);
    expect(activeRows()).toHaveLength(2);

    // Both end -> two history rows, one per viewer.
    syncHistory(SRV_A, []);
    expect(activeRows()).toHaveLength(0);
    expect(historyCount()).toBe(2);

    const users = db
      .prepare("SELECT userId FROM activity_history ORDER BY userId")
      .all() as { userId: string }[];
    expect(users.map((u) => u.userId)).toEqual(["100", "300"]);
  });

  it("keeps identical sessionKey+ratingKey on two servers independent", () => {
    const onA = makeSession({ sessionKey: "17", ratingKey: "1234" });
    const onB = makeSession({ sessionKey: "17", ratingKey: "1234", user: "Frank", userId: "300" });

    syncHistory(SRV_A, [onA]);
    syncHistory(SRV_B, [onB]);
    expect(activeRows()).toHaveLength(2);

    // Server A's stream ends; server B's must be untouched.
    syncHistory(SRV_A, []);
    const remaining = activeRows();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].serverId).toBe("srv-b");
    expect(historyCount()).toBe(1);

    const logged = db.prepare("SELECT serverId FROM activity_history").get() as {
      serverId: string;
    };
    expect(logged.serverId).toBe("srv-a");
  });

  it("captures GUIDs and a canonical media item at live sync time", () => {
    const session = makeSession({
      sessionKey: "20",
      ratingKey: "555",
      guid: "plex://movie/abc123",
      Guid: [{ id: "imdb://tt0111161" }, { id: "tmdb://278" }],
      type: "movie",
      originalTitle: "The Shawshank Redemption",
    });

    syncHistory(SRV_A, [session]);
    const [row] = activeRows();
    expect(row.plex_guid).toBe("plex://movie/abc123");
    expect(row.imdb_id).toBe("tt0111161");
    expect(row.tmdb_id).toBe("278");
    expect(row.mediaId).not.toBeNull();

    const source = db
      .prepare("SELECT mediaId FROM media_sources WHERE serverId = ? AND ratingKey = '555'")
      .get("srv-a") as { mediaId: number };
    expect(source.mediaId).toBe(row.mediaId);

    // The ended history row carries the identity along.
    syncHistory(SRV_A, []);
    const hist = db
      .prepare("SELECT plex_guid, imdb_id, mediaId FROM activity_history")
      .get() as { plex_guid: string; imdb_id: string; mediaId: number };
    expect(hist.plex_guid).toBe("plex://movie/abc123");
    expect(hist.imdb_id).toBe("tt0111161");
    expect(hist.mediaId).toBe(row.mediaId);
  });

  it("flushes stale sessions to history instead of dropping them", () => {
    const now = Date.now();
    const threeHoursAgo = now - 3 * 60 * 60 * 1000;
    db.prepare(
      `INSERT INTO active_sessions (serverId, sessionKey, userId, user, title, ratingKey, startTime, lastSeen, pausedCounter)
       VALUES ('srv-a', '30', '100', 'Elias', 'Zombie Movie', '777', ?, ?, 0)`
    ).run(threeHoursAgo, threeHoursAgo + 45 * 60 * 1000);

    const flushed = flushStaleSessions(now - 2 * 60 * 60 * 1000);
    expect(flushed).toHaveLength(1);
    expect(activeRows()).toHaveLength(0);

    const row = db
      .prepare("SELECT stopTime, duration FROM activity_history WHERE ratingKey = '777'")
      .get() as { stopTime: number; duration: number };
    // Stop time is the last heartbeat, not the flush time — 45 min watched.
    expect(row.stopTime).toBe(threeHoursAgo + 45 * 60 * 1000);
    expect(row.duration).toBe(45 * 60);
  });

  it("does not double-log a session whose history row already exists (restart guard)", () => {
    const session = makeSession({ sessionKey: "40", ratingKey: "888" });
    syncHistory(SRV_A, [session]);
    syncHistory(SRV_A, []);
    expect(historyCount()).toBe(1);

    // Same stream reappears with the same backfilled start time (e.g. the
    // process restarted and re-observed it) and ends again.
    syncHistory(SRV_A, [session]);
    syncHistory(SRV_A, []);
    expect(historyCount()).toBe(1);
  });

  it("logs sequential playback (same stream key, new content) as separate history rows", () => {
    const first = makeSession({ sessionKey: "50", ratingKey: "111", title: "Episode 1" });
    syncHistory(SRV_A, [first]);

    const second = makeSession({ sessionKey: "50", ratingKey: "112", title: "Episode 2" });
    syncHistory(SRV_A, [second]);

    // Episode 1 closed to history; episode 2 is the live row.
    expect(historyCount()).toBe(1);
    const [row] = activeRows();
    expect(row.ratingKey).toBe("112");
  });
});
