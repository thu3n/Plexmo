import type Database from "better-sqlite3";

/**
 * Representative v1 dataset for migration tests. Every row exists to prove a
 * specific v2 migration behavior:
 *
 * - Same plex.tv account on two servers (duplicate `users` rows -> one identity).
 * - Managed user whose display title differs from username.
 * - Name-only history rows (userId NULL) matched by title/username, plus one
 *   unmatchable row that must receive a `legacy:` identity.
 * - History row whose userId never existed in `users` (fuzzy-era orphan).
 * - Tautulli-imported episode carrying the show GUID in plex_guid (the
 *   grandparent-guid bug) with the episode GUID recoverable from meta_json.
 * - Colliding ratingKeys across servers within the +/-60s dedup window.
 * - v1 active_sessions rows: one long enough to be flushed to history by the
 *   migration, one below the 10s threshold that must be dropped.
 * - Stale global aggregates (user_activity_summary / streak_cache) that the
 *   migration must rebuild from history.
 */

export const SRV_A = "srv-a-1111-uuid";
export const SRV_B = "srv-b-2222-uuid";

export const ACC_ELIAS = "100";
export const ACC_KIDS = "200";
export const ACC_FRANK = "300";
export const ACC_GHOST = "999";

/** 2025-01-01T00:00:00Z in ms. */
export const BASE_TIME = 1735689600000;

const HOUR = 3600000;

export const EPISODE_GUID = "plex://episode/epi-1";
export const SHOW_GUID = "plex://show/abc";

export function seedV1Fixture(db: Database.Database): void {
  const now = new Date(BASE_TIME).toISOString();

  const insertServer = db.prepare(
    `INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt, color)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  insertServer.run(SRV_A, "Alpha", "http://alpha.local:32400", "token-a", now, now, "#f97316");
  insertServer.run(SRV_B, "Beta", "http://beta.local:32400", "token-b", now, now, null);

  const insertUser = db.prepare(
    `INSERT INTO users (id, title, username, email, thumb, serverId, importedAt, isAdmin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  // Same human on both servers -> must collapse to one identity + two memberships.
  insertUser.run(ACC_ELIAS, "Elias", "elias", "elias@example.com", "/thumb/elias", SRV_A, now, 1);
  insertUser.run(ACC_ELIAS, "Elias", "elias", "elias@example.com", "/thumb/elias", SRV_B, new Date(BASE_TIME + HOUR).toISOString(), 0);
  // Managed user: display title differs from username.
  insertUser.run(ACC_KIDS, "Kids TV", "kids_tv", null, null, SRV_A, now, 0);
  insertUser.run(ACC_FRANK, "Frank", "frank", "frank@example.com", null, SRV_B, now, 0);

  const insertHistory = db.prepare(
    `INSERT INTO activity_history (
       id, serverId, userId, user, title, subtitle, ratingKey,
       startTime, stopTime, duration, platform, device, player, ip, meta_json,
       pausedCounter, plex_guid, imdb_id, tmdb_id, tvdb_id, repair_status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // h1: normal live row with userId, on server A.
  insertHistory.run(
    "h1", SRV_A, ACC_ELIAS, "Elias", "Movie X", null, "1234",
    BASE_TIME, BASE_TIME + 2 * HOUR, 7200, "Chrome", "Desktop", "Plex Web", null,
    JSON.stringify({ title: "Movie X", thumb: "/library/metadata/1234/thumb" }),
    0, null, null, null, null, null
  );

  // h2: name-only row (userId NULL) whose `user` matches an identity by USERNAME.
  insertHistory.run(
    "h2", SRV_B, null, "elias", "Show Y", "S1 E1", "77",
    BASE_TIME + 3 * HOUR, BASE_TIME + 4 * HOUR, 3600, null, null, null, null, null,
    0, null, null, null, null, null
  );

  // h3: name-only row with no matching identity -> must get legacy: identity.
  insertHistory.run(
    "h3", SRV_B, null, "OrphanGuy", "Old Movie", null, "88",
    BASE_TIME + 5 * HOUR, BASE_TIME + 6 * HOUR, 3600, null, null, null, null, null,
    0, null, null, null, null, null
  );

  // h4 (tautulli import): EPISODE row with the grandparent-guid bug — plex_guid
  // holds the SHOW guid; the true episode guid only lives in meta_json.Guid.
  insertHistory.run(
    "tautulli-555", SRV_A, ACC_ELIAS, "Elias", "The Show", "S1 E2", "9001",
    BASE_TIME + 7 * HOUR, BASE_TIME + 7 * HOUR + 1800000, 1800, "Android", "Phone", "Plex for Android", null,
    JSON.stringify({
      title: "The Show",
      grandparentTitle: "The Show",
      grandparentGuid: SHOW_GUID,
      parentIndex: 1,
      index: 2,
      Guid: [{ id: EPISODE_GUID }, { id: "imdb://tt1234567" }],
    }),
    0, SHOW_GUID, "tt1234567", "42", null, "repaired"
  );

  // h5: SAME ratingKey as h1 but on server B, different content, start within
  // the 60s dedup window of h1 — v1 dedup would have dropped this row.
  insertHistory.run(
    "h5", SRV_B, ACC_FRANK, "Frank", "Different Show", null, "1234",
    BASE_TIME + 30000, BASE_TIME + HOUR, 3570, null, null, null, null, null,
    0, null, null, null, null, null
  );

  // h6: userId set to an account that never existed in `users` (fuzzy era).
  insertHistory.run(
    "h6", SRV_A, ACC_GHOST, "Ghosty", "Mystery Film", null, "55",
    BASE_TIME + 8 * HOUR, BASE_TIME + 9 * HOUR, 3600, null, null, null, null, null,
    0, null, null, null, null, null
  );

  const insertActive = db.prepare(
    `INSERT INTO active_sessions (
       sessionId, serverId, userId, user, title, subtitle, ratingKey,
       startTime, lastSeen, state, platform, device, meta_json, pausedCounter, pausedSince
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // as1: 30 minutes watched -> the migration must flush this to history.
  insertActive.run(
    "4242", SRV_A, ACC_ELIAS, "Elias", "Live Movie", null, "4242",
    BASE_TIME + 10 * HOUR, BASE_TIME + 10 * HOUR + 1800000, "playing",
    "Chrome", "Desktop", JSON.stringify({ title: "Live Movie" }), 0, null
  );

  // as2: 5 seconds watched -> below the 10s threshold, must be dropped.
  insertActive.run(
    "31", SRV_B, ACC_FRANK, "Frank", "Blip", null, "31",
    BASE_TIME + 10 * HOUR, BASE_TIME + 10 * HOUR + 5000, "playing",
    null, null, null, 0, null
  );

  // Stale global aggregates the migration must drop and rebuild from history.
  db.prepare(
    `INSERT INTO user_activity_summary (userId, username, total_count, total_duration, last_played_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(ACC_ELIAS, "Elias", 999, 999999, BASE_TIME, BASE_TIME);

  db.prepare(
    `INSERT INTO streak_cache (username, userId, currentStreak, longestStreak, updatedAt)
     VALUES (?, ?, ?, ?, ?)`
  ).run("Elias", ACC_ELIAS, 5, 12, BASE_TIME);

  db.prepare(
    `INSERT INTO allowed_users (id, email, username, createdAt, removeAfterLogin, expiresAt)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run("wl1", "friend@example.com", "friend", now, 0, null);
}
