import Database from "better-sqlite3";
import { runMigrations } from "@/lib/migrations";

/**
 * Create an in-memory SQLite database migrated to `targetVersion`
 * (or fully migrated when omitted).
 *
 * Migration tests stop at version 1, seed v1-shaped data, then call
 * `migrateTo(db)` to exercise the real upgrade path.
 *
 * To run lib modules against a test database, mock the shared handle:
 *
 *   vi.mock("@/lib/db", async () => {
 *     const { createTestDb } = await import("@/test/db-helper");
 *     return { db: createTestDb() };
 *   });
 */
export function createTestDb(targetVersion?: number): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, targetVersion);
  return db;
}

/** Apply remaining migrations up to `targetVersion` (or all) on an existing test db. */
export function migrateTo(db: Database.Database, targetVersion?: number): void {
  runMigrations(db, targetVersion);
}
