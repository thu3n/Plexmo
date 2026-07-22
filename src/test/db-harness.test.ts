import { describe, it, expect } from "vitest";
import { createTestDb } from "./db-helper";
import { seedV1Fixture, SRV_A, SRV_B, ACC_ELIAS } from "./fixtures/v1-seed";
import type { CountRow, UserRow } from "@/lib/db-types";

describe("test db harness", () => {
  it("creates an in-memory db migrated to a target version", () => {
    const db = createTestDb(1);
    const version = db
      .prepare("SELECT MAX(version) as version FROM schema_migrations")
      .get() as { version: number };
    expect(version.version).toBe(1);
    db.close();
  });

  it("seeds the v1 fixture with the expected shape", () => {
    const db = createTestDb(1);
    seedV1Fixture(db);

    const servers = db.prepare("SELECT COUNT(*) as count FROM servers").get() as CountRow;
    expect(servers.count).toBe(2);

    // Same account on two servers = two v1 user rows.
    const eliasRows = db
      .prepare("SELECT * FROM users WHERE id = ? ORDER BY serverId")
      .all(ACC_ELIAS) as UserRow[];
    expect(eliasRows).toHaveLength(2);
    expect(eliasRows.map((r) => r.serverId).sort()).toEqual([SRV_A, SRV_B].sort());

    const history = db.prepare("SELECT COUNT(*) as count FROM activity_history").get() as CountRow;
    expect(history.count).toBe(6);

    const nullUserIds = db
      .prepare("SELECT COUNT(*) as count FROM activity_history WHERE userId IS NULL")
      .get() as CountRow;
    expect(nullUserIds.count).toBe(2);

    const active = db.prepare("SELECT COUNT(*) as count FROM active_sessions").get() as CountRow;
    expect(active.count).toBe(2);

    db.close();
  });
});
