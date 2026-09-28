import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", async () => {
  const { createTestDb } = await import("@/test/db-helper");
  return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { importUsers, listDirectoryUsers } from "@/lib/users";

const NOW = 1_790_000_000_000;

const member = (id: string, serverId: string, username: string) => ({
  id,
  serverId,
  username,
  title: username,
  email: `${username}@example.com`,
  thumb: "",
  isAdmin: false,
});

const summary = (accountId: string, serverId: string, count: number, duration: number, last: number) =>
  db
    .prepare(
      `INSERT INTO user_activity_summary (accountId, serverId, total_count, total_duration, last_played_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(accountId, serverId, count, duration, last, NOW);

beforeEach(() => {
  db.prepare("DELETE FROM user_activity_summary").run();
  db.prepare("DELETE FROM server_users").run();
  db.prepare("DELETE FROM user_identities").run();
});

describe("listDirectoryUsers", () => {
  it("folds each membership's own activity bucket into its row", () => {
    importUsers([member("100", "srv-a", "alice"), member("100", "srv-b", "alice"), member("200", "srv-a", "bob")]);
    summary("100", "srv-a", 10, 3600, NOW - 1000);
    summary("100", "srv-b", 3, 600, NOW - 5000);

    const rows = listDirectoryUsers();
    const byKey = new Map(rows.map((r) => [`${r.id}/${r.serverId}`, r]));

    expect(rows).toHaveLength(3);
    expect(byKey.get("100/srv-a")).toMatchObject({ plays: 10, watchSeconds: 3600, lastPlayedAt: NOW - 1000 });
    expect(byKey.get("100/srv-b")).toMatchObject({ plays: 3, watchSeconds: 600, lastPlayedAt: NOW - 5000 });
    // No summary bucket = never played, not a missing row.
    expect(byKey.get("200/srv-a")).toMatchObject({ plays: 0, watchSeconds: 0, lastPlayedAt: null });
  });

  it("limits memberships to the viewer's allowed servers", () => {
    importUsers([member("100", "srv-a", "alice"), member("100", "srv-b", "alice")]);
    expect(listDirectoryUsers(["srv-b"]).map((r) => r.serverId)).toEqual(["srv-b"]);
  });

  it("treats an empty scope list as unscoped", () => {
    importUsers([member("100", "srv-a", "alice"), member("200", "srv-b", "bob")]);
    expect(listDirectoryUsers([])).toHaveLength(2);
  });
});
