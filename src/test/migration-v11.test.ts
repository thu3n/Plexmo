import { describe, it, expect } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, migrateTo } from "./db-helper";
import { seedV1Fixture } from "./fixtures/v1-seed";

const tableExists = (db: Database.Database, name: string): boolean =>
  (db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { count: number }).count > 0;

describe("migration v11: drop_streak_cache", () => {
  it("drops streak_cache on the upgrade path (v1 fixture seeds a cache row)", () => {
    const db = createTestDb(1);
    seedV1Fixture(db); // seeds a streak_cache row at v1
    migrateTo(db);
    expect(tableExists(db, "streak_cache")).toBe(false);
    db.close();
  });

  it("no streak_cache on a fresh database (full path)", () => {
    const db = createTestDb();
    expect(tableExists(db, "streak_cache")).toBe(false);
    db.close();
  });
});
