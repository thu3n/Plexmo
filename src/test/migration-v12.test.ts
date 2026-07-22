import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, migrateTo } from "./db-helper";

const NOW = 1_784_000_000_000;

const insertServer = (db: Database.Database, id: string, owner: string | null) => {
  db.prepare(
    `INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt, ownerAccountId)
     VALUES (?, ?, 'http://x', 't', '2026-01-01', '2026-01-01', ?)`
  ).run(id, id, owner);
};

const insertHistory = (
  db: Database.Database,
  id: string,
  serverId: string,
  userId: string,
  user: string,
  startTime = NOW
) => {
  db.prepare(
    `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration)
     VALUES (?, ?, ?, ?, 'Movie', '1234', ?, ?, 600)`
  ).run(id, serverId, userId, user, startTime, startTime + 600_000);
};

const insertIdentity = (db: Database.Database, accountId: string, username: string) => {
  db.prepare(
    `INSERT INTO user_identities (accountId, username, title, createdAt, updatedAt)
     VALUES (?, ?, ?, '2026-01-01', '2026-01-01')`
  ).run(accountId, username, username);
};

const userIdOf = (db: Database.Database, id: string): string =>
  (db.prepare("SELECT userId FROM activity_history WHERE id = ?").get(id) as { userId: string }).userId;

describe("migration v12: reattribute_owner_alias_rows", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb(11);
    // Two owned servers with different owners + one server whose owner is unknown.
    insertServer(db, "srv-a", "8736283");
    insertServer(db, "srv-b", "1862630");
    insertServer(db, "srv-c", null);
    insertIdentity(db, "8736283", "plexserverse");
    insertIdentity(db, "1", "klppl"); // the colliding shared alias identity

    // Alias rows: owner plays recorded under "1" on each server.
    insertHistory(db, "a1", "srv-a", "1", "plexserverse");
    insertHistory(db, "a2", "srv-a", "1", "plexserverse", NOW + 1000);
    insertHistory(db, "b1", "srv-b", "1", "klppl");
    insertHistory(db, "c1", "srv-c", "1", "unknownowner");
    // Import rows already on the real id + an unrelated user.
    insertHistory(db, "a3", "srv-a", "8736283", "plexserverse");
    insertHistory(db, "a4", "srv-a", "555", "guest");

    db.prepare(
      `INSERT INTO active_sessions (serverId, sessionKey, userId, user, title, ratingKey, startTime, lastSeen)
       VALUES ('srv-a', 'sk1', '1', 'plexserverse', 'Movie', '1234', ?, ?)`
    ).run(NOW, NOW);
    db.prepare(
      `INSERT INTO rule_events (ruleKey, userId, triggeredAt, serverId)
       VALUES ('r1', '1', '2026-07-01', 'srv-a')`
    ).run();

    migrateTo(db);
  });

  afterEach(() => {
    db.close();
  });

  it("reattributes alias rows per server to that server's owner", () => {
    expect(userIdOf(db, "a1")).toBe("8736283");
    expect(userIdOf(db, "a2")).toBe("8736283");
    expect(userIdOf(db, "b1")).toBe("1862630");
  });

  it("leaves alias rows untouched when the server's owner is unknown", () => {
    expect(userIdOf(db, "c1")).toBe("1");
  });

  it("does not touch rows already on a real accountId", () => {
    expect(userIdOf(db, "a3")).toBe("8736283");
    expect(userIdOf(db, "a4")).toBe("555");
  });

  it("reattributes active_sessions and rule_events", () => {
    const active = db.prepare("SELECT userId FROM active_sessions WHERE sessionKey = 'sk1'").get() as { userId: string };
    expect(active.userId).toBe("8736283");
    const event = db.prepare("SELECT userId FROM rule_events WHERE ruleKey = 'r1'").get() as { userId: string };
    expect(event.userId).toBe("8736283");
  });

  it("creates an identity for owners that only existed as alias rows", () => {
    const identity = db
      .prepare("SELECT username FROM user_identities WHERE accountId = '1862630'")
      .get() as { username: string };
    expect(identity.username).toBe("klppl");
  });

  it("rebuilds user_activity_summary buckets on the real accountId", () => {
    const owner = db
      .prepare("SELECT total_count FROM user_activity_summary WHERE accountId = '8736283' AND serverId = 'srv-a'")
      .get() as { total_count: number };
    expect(owner.total_count).toBe(3); // a1 + a2 + a3
    const alias = db
      .prepare("SELECT total_count FROM user_activity_summary WHERE accountId = '1' AND serverId = 'srv-a'")
      .get();
    expect(alias).toBeUndefined();
  });

  it("keeps the '1' identity while unattributable alias rows remain", () => {
    // srv-c still has an alias row, so the identity must survive.
    const identity = db.prepare("SELECT accountId FROM user_identities WHERE accountId = '1'").get();
    expect(identity).toBeDefined();
  });

  it("drops the '1' identity once nothing references it", () => {
    const clean = createTestDb(11);
    insertServer(clean, "srv-a", "8736283");
    insertIdentity(clean, "1", "klppl");
    insertHistory(clean, "a1", "srv-a", "1", "plexserverse");
    migrateTo(clean);
    const identity = clean.prepare("SELECT accountId FROM user_identities WHERE accountId = '1'").get();
    expect(identity).toBeUndefined();
    clean.close();
  });
});
