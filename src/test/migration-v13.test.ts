import { describe, it, expect } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, migrateTo } from "./db-helper";
import type { StreamPeakRow } from "@/lib/db-types";

const tableExists = (db: Database.Database, name: string): boolean =>
  (db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { count: number }).count > 0;

const indexExists = (db: Database.Database, name: string): boolean =>
  (db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'index' AND name = ?")
    .get(name) as { count: number }).count > 0;

const globalPeak = (db: Database.Database): StreamPeakRow | undefined =>
  db.prepare("SELECT * FROM stream_peaks WHERE scope = 'global'").get() as StreamPeakRow | undefined;

describe("migration v13: stream_peaks", () => {
  it("creates the table and snapshot index on a fresh database", () => {
    const db = createTestDb();
    expect(tableExists(db, "stream_peaks")).toBe(true);
    expect(indexExists(db, "idx_concurrent_snapshots_server_ts")).toBe(true);
    expect(globalPeak(db)).toBeUndefined();
    db.close();
  });

  it("backfills the global peak as the max count with the earliest timestamp", () => {
    const db = createTestDb(12);
    const insert = db.prepare(
      "INSERT INTO concurrent_snapshots (count, sessions, timestamp, serverId) VALUES (?, '[]', ?, ?)"
    );
    insert.run(3, 1000, null);
    insert.run(7, 3000, null); // later occurrence of the max
    insert.run(7, 2000, null); // first occurrence of the max — must win
    insert.run(9, 4000, "srv-a"); // per-server row must not influence the global backfill

    migrateTo(db);

    const peak = globalPeak(db);
    expect(peak).toMatchObject({ count: 7, timestamp: 2000 });
    expect(
      (db.prepare("SELECT COUNT(*) as count FROM stream_peaks").get() as { count: number }).count
    ).toBe(1);
    db.close();
  });

  it("backfills nothing when there are no cross-server snapshots", () => {
    const db = createTestDb(12);
    db.prepare(
      "INSERT INTO concurrent_snapshots (count, sessions, timestamp, serverId) VALUES (5, '[]', 1000, 'srv-a')"
    ).run();
    migrateTo(db);
    expect(globalPeak(db)).toBeUndefined();
    db.close();
  });
});
