// Standalone migration runner. Importing the db module triggers runMigrations()
// as a side effect during initialization, so by the time the import resolves the
// schema is fully migrated. Use this to apply migrations without booting the app
// (e.g. in CI or a Docker entrypoint): `npx tsx scripts/migrate.ts`.
import { db } from "../src/lib/db";

try {
  // Confirm the connection is live and report the applied schema version.
  const row = db
    .prepare("SELECT MAX(version) as version FROM schema_migrations")
    .get() as { version: number | null };
  console.log(`Migrations applied. Schema is at version ${row.version ?? 0}.`);
  process.exit(0);
} catch (e) {
  console.error("Migration check failed:", e);
  process.exit(1);
}
