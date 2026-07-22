import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", async () => {
  const { createTestDb } = await import("@/test/db-helper");
  return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { resolveOwnerAlias, reattributeOwnerAlias } from "@/lib/identity";

const NOW = 1_784_000_000_000;

const insertServer = (id: string, owner: string | null) => {
  db.prepare(
    `INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt, ownerAccountId)
     VALUES (?, ?, 'http://x', 't', '2026-01-01', '2026-01-01', ?)`
  ).run(id, id, owner);
};

const insertHistory = (id: string, serverId: string, userId: string, user: string) => {
  db.prepare(
    `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration)
     VALUES (?, ?, ?, ?, 'Movie', '1234', ?, ?, 600)`
  ).run(id, serverId, userId, user, NOW, NOW + 600_000);
};

beforeEach(() => {
  db.prepare("DELETE FROM activity_history").run();
  db.prepare("DELETE FROM active_sessions").run();
  db.prepare("DELETE FROM rule_events").run();
  db.prepare("DELETE FROM user_activity_summary").run();
  db.prepare("DELETE FROM user_identities").run();
  db.prepare("DELETE FROM servers").run();
});

describe("resolveOwnerAlias", () => {
  it("translates the '1' alias to the server's ownerAccountId", () => {
    insertServer("srv-a", "8736283");
    expect(resolveOwnerAlias("srv-a", "1")).toBe("8736283");
  });

  it("passes real account ids through untouched", () => {
    insertServer("srv-a", "8736283");
    expect(resolveOwnerAlias("srv-a", "555")).toBe("555");
    expect(resolveOwnerAlias("srv-a", undefined)).toBeUndefined();
  });

  it("keeps the alias when the owner is unknown or the server is missing", () => {
    insertServer("srv-b", null);
    expect(resolveOwnerAlias("srv-b", "1")).toBe("1");
    expect(resolveOwnerAlias("nope", "1")).toBe("1");
    expect(resolveOwnerAlias(undefined, "1")).toBe("1");
  });
});

describe("reattributeOwnerAlias", () => {
  it("moves this server's alias rows to the owner and rebuilds the summary bucket", () => {
    insertServer("srv-a", "8736283");
    insertServer("srv-b", "1862630");
    insertHistory("a1", "srv-a", "1", "plexserverse");
    insertHistory("a2", "srv-a", "8736283", "plexserverse");
    insertHistory("b1", "srv-b", "1", "klppl"); // other server — must not move

    const changed = reattributeOwnerAlias("srv-a", "8736283");

    expect(changed).toBe(1);
    const a1 = db.prepare("SELECT userId FROM activity_history WHERE id = 'a1'").get() as { userId: string };
    expect(a1.userId).toBe("8736283");
    const b1 = db.prepare("SELECT userId FROM activity_history WHERE id = 'b1'").get() as { userId: string };
    expect(b1.userId).toBe("1");

    const bucket = db
      .prepare("SELECT total_count FROM user_activity_summary WHERE accountId = '8736283' AND serverId = 'srv-a'")
      .get() as { total_count: number };
    expect(bucket.total_count).toBe(2);
  });

  it("creates the owner identity from the alias rows' user string", () => {
    insertServer("srv-a", "8736283");
    insertHistory("a1", "srv-a", "1", "plexserverse");

    reattributeOwnerAlias("srv-a", "8736283");

    const identity = db
      .prepare("SELECT username FROM user_identities WHERE accountId = '8736283'")
      .get() as { username: string };
    expect(identity.username).toBe("plexserverse");
  });

  it("is a no-op when nothing is aliased or the owner id is the alias itself", () => {
    insertServer("srv-a", "8736283");
    insertHistory("a1", "srv-a", "8736283", "plexserverse");
    expect(reattributeOwnerAlias("srv-a", "8736283")).toBe(0);
    expect(reattributeOwnerAlias("srv-a", "1")).toBe(0);
  });
});
