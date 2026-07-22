import { db } from "../../db";
import { listInternalServers } from "../../servers";
import { Logger } from "../../logger";
import type { PlexSession, PlexServerConfig } from "../../plex";
import type { PersistedRuleInstance } from "../types";
import { getRuleAssignmentIds } from "../rules-assignments";

export type RuleUser = { accountId: string; username: string; title: string | null };
export type ScopedUser = RuleUser & { sessions: PlexSession[] };

export type ViolationSource = "global_rule" | "server_rule" | "user_rule";

export type RuleScope = {
  isGlobal: boolean;
  /** null = rule sees every server. */
  serverScope: Set<string> | null;
  source: ViolationSource;
  /** Users the rule applies to, each with ONLY their in-scope sessions. */
  scopedUsers: ScopedUser[];
  /** serverId recorded on rule_events when the scope is a single server. */
  eventServerId: string | null;
};

const listIdentities = db.prepare<[], RuleUser>(
  "SELECT accountId, username, title FROM user_identities"
);

/** Canonical user match: plex.tv account id first, names only as fallback. */
export const sessionBelongsTo = (session: PlexSession, user: RuleUser): boolean => {
  if (session.userId) return String(session.userId) === user.accountId;
  if (session.username && session.username === user.username) return true;
  return session.user === (user.title ?? user.username);
};

/**
 * Explicit scoping semantics:
 * - Global rule (no assignments): applies to every user, counts every session.
 * - User-assigned: applies to those users, counts all their sessions.
 * - Server-assigned: sessions on out-of-scope servers are INVISIBLE to the
 *   rule — filtered here, before any counting or kill selection.
 * - Both: assigned users, in-scope sessions only.
 */
export const resolveRuleScope = (
  instance: PersistedRuleInstance,
  sessions: PlexSession[]
): RuleScope => {
  const { userIds, serverIds } = getRuleAssignmentIds(instance.id);
  const isGlobal = userIds.length === 0 && serverIds.length === 0;
  const serverScope = serverIds.length > 0 ? new Set(serverIds) : null;

  const scopedSessions = serverScope
    ? sessions.filter((s) => s.serverId && serverScope.has(s.serverId))
    : sessions;

  const identities = listIdentities.all();
  const userIdSet = new Set(userIds);
  const applicable = userIds.length > 0
    ? identities.filter((u) => userIdSet.has(u.accountId))
    : identities;

  const source: ViolationSource = isGlobal
    ? "global_rule"
    : userIds.length > 0
      ? "user_rule"
      : "server_rule";

  return {
    isGlobal,
    serverScope,
    source,
    eventServerId: serverScope && serverScope.size === 1 ? [...serverScope][0] : null,
    scopedUsers: applicable.map((u) => ({
      ...u,
      sessions: scopedSessions.filter((s) => sessionBelongsTo(s, u)),
    })),
  };
};

export const loadServerConfigs = async (): Promise<Map<string, PlexServerConfig>> => {
  const serverConfigMap: Map<string, PlexServerConfig> = new Map();
  try {
    const internalServers = await listInternalServers();
    internalServers.forEach((s) => {
      if (s.id) {
        serverConfigMap.set(s.id, {
          id: s.id,
          name: s.name,
          baseUrl: s.baseUrl,
          token: s.token,
        });
      }
    });
  } catch (e) {
    Logger.error("Failed to list internal servers for enforcement:", e);
  }
  return serverConfigMap;
};

const activeRowStmt = db.prepare<[string, string], { startTime: number; pausedSince: number | null }>(
  "SELECT startTime, pausedSince FROM active_sessions WHERE serverId = ? AND sessionKey = ?"
);

/** The stored active row for a live session, keyed by (serverId, sessionKey). */
export const getActiveStreamRow = (
  session: PlexSession
): { startTime: number; pausedSince: number | null } | undefined => {
  if (!session.serverId || !session.sessionKey) return undefined;
  return activeRowStmt.get(session.serverId, session.sessionKey);
};

// --- Open rule_events helpers ---

export type OpenRuleEvent = { id: number; userId: string; details: Record<string, unknown> };

const openEventsStmt = db.prepare<[string], { id: number; userId: string; details: string | null }>(
  "SELECT id, userId, details FROM rule_events WHERE ruleKey = ? AND endedAt IS NULL"
);

export const getOpenEvents = (ruleKey: string): OpenRuleEvent[] => {
  return openEventsStmt.all(ruleKey).map((row) => {
    let details: Record<string, unknown> = {};
    try {
      details = row.details ? JSON.parse(row.details) : {};
    } catch {
      // Corrupt details — treat as empty; callers decide what to do.
    }
    return { id: row.id, userId: row.userId, details };
  });
};
