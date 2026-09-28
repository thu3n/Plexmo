import { db } from "./db";
import { Logger } from "./logger";
import type { SessionUser } from "./jwt";

/**
 * Per-request authorization scope.
 *
 * Default policy (per product decision): every authenticated user — owner or
 * whitelisted — sees everything ("alla admins är likvärdiga"). Scoping is
 * OPT-IN: a whitelist entry may carry a serverIds JSON array, in which case
 * that viewer only sees those servers' data.
 */
export type AccessScope = {
  role: "owner" | "viewer" | "setup" | "api" | "onboarding";
  serverIds: string[] | "all";
};

/** Parse a stored serverIds JSON column; NULL, malformed or empty = null (all servers). */
export const parseServerIds = (json: string | null): string[] | null => {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(String) : null;
  } catch {
    return null;
  }
};

type ViewerGrantRow = { serverIds: string | null; expiresAt: string | null };

const isGrantExpired = (expiresAt: string | null, now: number): boolean =>
  // Unparseable dates count as "no expiry", matching verifyAccess at login.
  !!expiresAt && new Date(expiresAt).getTime() <= now;

/**
 * The live whitelist grant behind a viewer session, or null when the owner
 * removed it or it expired. Viewer JWTs live 7 days, so this is re-read on
 * every request: removing a person from Settings -> Access must cut off a
 * session that is already open, not just the next login.
 */
export const findViewerGrant = (email: string, now: number = Date.now()): { serverIds: string[] | "all" } | null => {
  const row = db
    .prepare<[string], ViewerGrantRow>("SELECT serverIds, expiresAt FROM allowed_users WHERE email = ?")
    .get(email.toLowerCase().trim());
  if (!row || isGrantExpired(row.expiresAt, now)) return null;
  return { serverIds: parseServerIds(row.serverIds) ?? "all" };
};

export const resolveScope = (user: Pick<SessionUser, "id" | "email" | "role"> | { id: string; email?: string; role?: string }): AccessScope => {
  if (user.id === "apikey") {
    return { role: "api", serverIds: "all" };
  }

  const role = (user.role as AccessScope["role"]) || "owner";
  if (role !== "viewer") {
    return { role, serverIds: "all" };
  }

  // Viewers: a NULL serverIds list means "all servers" (the default
  // equal-access policy); an explicit list narrows the scope. A MISSING or
  // expired entry means access was revoked -> the empty, match-nothing scope.
  // Fail closed on DB errors: a viewer must never widen to "all" by accident.
  if (!user.email) return { role, serverIds: [] };
  try {
    const grant = findViewerGrant(user.email);
    return { role, serverIds: grant ? grant.serverIds : [] };
  } catch (e) {
    Logger.error("[Authz] Failed to resolve viewer scope:", e);
    return { role, serverIds: [] };
  }
};

/** A viewer whose whitelist entry is gone — the session must be rejected. */
export const isRevokedScope = (scope: AccessScope): boolean =>
  scope.serverIds !== "all" && scope.serverIds.length === 0;

/**
 * Instance-administration check. Allowed: owners and first-run `setup`
 * sessions (only valid while the instance has never been configured —
 * enforced by the request guard).
 *
 * Denied: viewers — including Plex-reported `isAdmin` viewers (that flag
 * mirrors Plex server admin status, not a Plexmo management grant);
 * `onboarding` sessions, whose one permitted mutation (server add) is granted
 * explicitly at the route; and `api` keys.
 *
 * API keys are READ-ONLY on purpose. They are a long-lived bearer credential
 * that travels in query strings for Wrapperr/Rewrap compatibility, so a leaked
 * key must not be able to reach /api/settings/export (every Plex token plus
 * the JWT secret) or rotate itself. Keys stay valid on the hybrid read
 * surfaces that call authorizeApiKeyOrSession without this check.
 */
export const isOwnerLike = (user: { scope: AccessScope }): boolean =>
  user.scope.role === "owner" || user.scope.role === "setup";

/**
 * First-server completion: may this session be upgraded to a normal owner
 * session? Only when the just-connected server provably belongs to the
 * session's own account (the submitted admin token resolved to their id).
 * Covers both fresh-install `setup` sessions and invite-minted `onboarding`
 * sessions — without the upgrade, a `setup` cookie turns into a 401 on every
 * data route the moment the first server exists (the request guard kills
 * setup tokens once hasCompletedSetup() is true). A foreign token never
 * upgrades: that is the anti-escalation backstop.
 */
export const canUpgradeSessionToOwner = (
  scopeRole: AccessScope["role"],
  ownerAccountId: string | null,
  userId: string,
): boolean =>
  (scopeRole === "setup" || scopeRole === "onboarding") &&
  !!ownerAccountId &&
  ownerAccountId === userId;

export const canAccessServer = (scope: AccessScope, serverId: string): boolean =>
  scope.serverIds === "all" || scope.serverIds.includes(serverId);

/**
 * Stand-in id that matches no server. Downstream query builders treat an
 * EMPTY allow-list as "no filter", so a revoked scope must never reach them
 * as [] — that would silently widen to every server.
 */
export const NO_SERVER_ID = "__plexmo_no_server__";

/** The serverIds filter to apply to queries, or undefined for unrestricted. */
export const scopedServerIds = (scope: AccessScope): string[] | undefined => {
  if (scope.serverIds === "all") return undefined;
  return scope.serverIds.length > 0 ? scope.serverIds : [NO_SERVER_ID];
};
