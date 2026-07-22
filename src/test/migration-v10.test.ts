import { describe, it, expect } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, migrateTo } from "./db-helper";
import { seedV1Fixture } from "./fixtures/v1-seed";

const columnsOf = (db: Database.Database, table: string): string[] =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

describe("migration v10: library_thumbs_and_episodes", () => {
  it("adds thumb to library_items and creates library_episodes (upgrade path)", () => {
    const db = createTestDb(1);
    seedV1Fixture(db);
    migrateTo(db);

    expect(columnsOf(db, "library_items")).toContain("thumb");
    expect(columnsOf(db, "library_episodes").sort()).toEqual([
      "guid",
      "ratingKey",
      "sectionKey",
      "serverId",
    ]);

    const indexes = (db.prepare("PRAGMA index_list(library_episodes)").all() as { name: string }[]).map(
      (i) => i.name
    );
    expect(indexes).toContain("idx_library_episodes_section");
    expect(indexes).toContain("idx_library_episodes_guid");

    db.close();
  });

  it("applies on a fresh database (full path)", () => {
    const db = createTestDb();
    expect(columnsOf(db, "library_items")).toContain("thumb");
    expect(columnsOf(db, "library_episodes")).toContain("guid");
    db.close();
  });
});
