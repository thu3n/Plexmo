import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PlexSession } from "@/lib/plex/plex-types";
import type { CountRow } from "@/lib/db-types";

vi.mock("@/lib/db", async () => {
  const { createTestDb } = await import("@/test/db-helper");
  return { db: createTestDb() };
});

vi.mock("@/lib/plex", async () => {
  const types = await import("@/lib/plex/plex-types");
  return {
    ...types,
    terminateSession: vi.fn().mockResolvedValue(undefined),
    plexFetch: vi.fn(),
  };
});

vi.mock("@/lib/discord", () => ({
  sendSessionTerminatedNotification: vi.fn().mockResolvedValue(undefined),
  sendSessionStartNotification: vi.fn().mockResolvedValue(undefined),
  sendSessionStopNotification: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "@/lib/db";
import { terminateSession } from "@/lib/plex";
import { checkAndLogViolations } from "@/lib/rules";

const SRV_A = "srv-a";
const SRV_B = "srv-b";
const ELIAS = "100";
const KIDS = "200";

const terminateMock = vi.mocked(terminateSession);

const seedBase = () => {
  const now = new Date().toISOString();
  const insertServer = db.prepare(
    "INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt) VALUES (?, ?, 'http://x', 't', ?, ?)"
  );
  insertServer.run(SRV_A, "Alpha", now, now);
  insertServer.run(SRV_B, "Beta", now, now);

  const insertIdentity = db.prepare(
    "INSERT INTO user_identities (accountId, username, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)"
  );
  insertIdentity.run(ELIAS, "elias", "Elias", now, now);
  insertIdentity.run(KIDS, "kids_tv", "Kids TV", now, now);
};

const createRule = (
  id: string,
  type: string,
  settings: Record<string, unknown>,
  assignments?: { userIds?: string[]; serverIds?: string[] }
) => {
  db.prepare(
    "INSERT INTO rule_instances (id, type, name, enabled, settings, createdAt) VALUES (?, ?, ?, 1, ?, ?)"
  ).run(id, type, id, JSON.stringify(settings), new Date().toISOString());
  for (const userId of assignments?.userIds ?? []) {
    db.prepare("INSERT INTO user_rules (userId, ruleKey) VALUES (?, ?)").run(userId, id);
  }
  for (const serverId of assignments?.serverIds ?? []) {
    db.prepare("INSERT INTO server_rules (serverId, ruleKey) VALUES (?, ?)").run(serverId, id);
  }
};

let keyCounter = 0;
const makeSession = (overrides: Partial<PlexSession>): PlexSession => {
  const key = String(++keyCounter);
  return {
    id: `${overrides.serverId ?? SRV_A}:${key}`,
    sessionKey: key,
    sessionId: `plex-session-${key}`,
    title: "Movie",
    user: "Elias",
    userId: ELIAS,
    username: "elias",
    state: "playing",
    bandwidth: 0,
    progressPercent: 0,
    duration: 7_200_000,
    viewOffset: 0,
    isOriginalQuality: true,
    ratingKey: "1234",
    serverId: SRV_A,
    ...overrides,
  };
};

/** Register the live session in active_sessions with a given start time. */
const storeActive = (session: PlexSession, startTime: number, pausedSince: number | null = null) => {
  db.prepare(
    `INSERT INTO active_sessions (serverId, sessionKey, plexSessionId, userId, user, title, ratingKey, startTime, lastSeen, pausedCounter, pausedSince)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    session.serverId,
    session.sessionKey,
    session.sessionId,
    session.userId,
    session.user,
    session.title,
    session.ratingKey,
    startTime,
    Date.now(),
    pausedSince
  );
};

const openEventCount = (): number =>
  (db.prepare("SELECT COUNT(*) as count FROM rule_events WHERE endedAt IS NULL").get() as CountRow).count;

beforeEach(() => {
  for (const table of [
    "servers",
    "user_identities",
    "server_users",
    "rule_instances",
    "user_rules",
    "server_rules",
    "rule_events",
    "active_sessions",
  ]) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
  terminateMock.mockClear();
  seedBase();
});

describe("concurrent stream rule — multi-server semantics", () => {
  it("counts a user's sessions ACROSS servers for a global rule", async () => {
    createRule("global-2", "max_concurrent_streams", { limit: 1, enforce: false, kill_all: false, message: "" });

    await checkAndLogViolations([
      makeSession({ serverId: SRV_A }),
      makeSession({ serverId: SRV_B }),
    ]);

    expect(openEventCount()).toBe(1);
    const event = db
      .prepare("SELECT userId, details FROM rule_events WHERE endedAt IS NULL")
      .get() as { userId: string; details: string };
    expect(event.userId).toBe(ELIAS);
    expect(JSON.parse(event.details).count).toBe(2);
  });

  it("server-scoped rules do NOT count sessions on out-of-scope servers", async () => {
    createRule(
      "scoped-a",
      "max_concurrent_streams",
      { limit: 1, enforce: false, kill_all: false, message: "" },
      { serverIds: [SRV_A] }
    );

    // 1 stream on the scoped server, 2 on another: in-scope count is 1 <= limit.
    await checkAndLogViolations([
      makeSession({ serverId: SRV_A }),
      makeSession({ serverId: SRV_B }),
      makeSession({ serverId: SRV_B }),
    ]);

    expect(openEventCount()).toBe(0);

    // Two streams on the scoped server: now it violates.
    await checkAndLogViolations([
      makeSession({ serverId: SRV_A }),
      makeSession({ serverId: SRV_A }),
    ]);
    expect(openEventCount()).toBe(1);
  });

  it("matches managed users by accountId even when display title differs from username", async () => {
    createRule(
      "kids-rule",
      "max_concurrent_streams",
      { limit: 0, enforce: false, kill_all: false, message: "" },
      { userIds: [KIDS] }
    );

    // Session carries the display TITLE in `user` — the old engine's
    // username-string comparison silently missed this.
    await checkAndLogViolations([
      makeSession({ user: "Kids TV", userId: KIDS, username: "kids_tv" }),
    ]);

    const event = db
      .prepare("SELECT userId FROM rule_events WHERE endedAt IS NULL")
      .get() as { userId: string };
    expect(event.userId).toBe(KIDS);
  });

  it("kills the NEWEST stream by wall-clock start time, across servers", async () => {
    createRule("enforce-1", "max_concurrent_streams", {
      limit: 1,
      enforce: true,
      kill_all: false,
      message: "",
    });

    const older = makeSession({ serverId: SRV_B });
    const newer = makeSession({ serverId: SRV_A });
    const now = Date.now();
    storeActive(older, now - 60 * 60 * 1000);
    storeActive(newer, now - 5 * 60 * 1000);

    await checkAndLogViolations([newer, older]);

    expect(terminateMock).toHaveBeenCalledTimes(1);
    const [terminatedId, serverConfig] = terminateMock.mock.calls[0];
    expect(terminatedId).toBe(newer.sessionId);
    expect(serverConfig.id).toBe(SRV_A);
  });

  it("enforces only once per violation (no double-terminate on repeated ticks)", async () => {
    createRule("enforce-once", "max_concurrent_streams", {
      limit: 1,
      enforce: true,
      kill_all: true,
      message: "",
    });

    const s1 = makeSession({ serverId: SRV_A });
    const s2 = makeSession({ serverId: SRV_B });
    storeActive(s1, Date.now() - 1000);
    storeActive(s2, Date.now() - 2000);

    await checkAndLogViolations([s1, s2]);
    expect(terminateMock).toHaveBeenCalledTimes(2);

    // Next tick: sessions still up (Plex lag) — must NOT re-terminate.
    await checkAndLogViolations([s1, s2]);
    expect(terminateMock).toHaveBeenCalledTimes(2);
  });

  it("closes the open event when the user drops back under the limit", async () => {
    createRule("close-me", "max_concurrent_streams", { limit: 1, enforce: false, kill_all: false, message: "" });

    await checkAndLogViolations([
      makeSession({ serverId: SRV_A }),
      makeSession({ serverId: SRV_B }),
    ]);
    expect(openEventCount()).toBe(1);

    await checkAndLogViolations([makeSession({ serverId: SRV_A })]);
    expect(openEventCount()).toBe(0);
    const closed = db
      .prepare("SELECT COUNT(*) as count FROM rule_events WHERE endedAt IS NOT NULL")
      .get() as CountRow;
    expect(closed.count).toBe(1);
  });
});

describe("kill_paused_streams — per-stream identity", () => {
  it("looks up pause state by (serverId, sessionKey), not media key", async () => {
    createRule("paused-1", "kill_paused_streams", { limit: 10, enforce: true, kill_all: false, message: "" });

    const pausedFor20Min = Date.now() - 20 * 60 * 1000;
    const paused = makeSession({ serverId: SRV_A, state: "paused" });
    // A DIFFERENT viewer on server B shares the same ratingKey but is playing.
    const playing = makeSession({ serverId: SRV_B, user: "Kids TV", userId: KIDS, username: "kids_tv" });
    storeActive(paused, Date.now() - 60 * 60 * 1000, pausedFor20Min);
    storeActive(playing, Date.now() - 60 * 60 * 1000, null);

    await checkAndLogViolations([paused, playing]);

    expect(terminateMock).toHaveBeenCalledTimes(1);
    const [terminatedId] = terminateMock.mock.calls[0];
    expect(terminatedId).toBe(paused.sessionId);
  });
});
