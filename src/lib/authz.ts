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

export const resolveScope = (user: Pick<SessionUser, "id" | "email" | "role"> | { id: string; email?: string; role?: string }): AccessScope => {
  if (user.id === "apikey") {
    return { role: "api", serverIds: "all" };
  }

  const role = (user.role as AccessScope["role"]) || "owner";
  if (role !== "viewer") {
    return { role, serverIds: "all" };
  }

  // Viewers: an explicit serverIds list on their whitelist entry narrows the
  // scope. A missing entry (e.g. one-time removeAfterLogin rows) or a NULL
  // list means "all servers" — the default equal-access policy.
  try {
    if (user.email) {
      const row = db
        .prepare<[string], { serverIds: string | null }>(
          "SELECT serverIds FROM allowed_users WHERE email = ?"
        )
        .get(user.email.toLowerCase());
      if (row?.serverIds) {
        const parsed = JSON.parse(row.serverIds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { role, serverIds: parsed.map(String) };
        }
      }
    }
  } catch (e) {
    Logger.error("[Authz] Failed to resolve viewer scope:", e);
  }

  return { role, serverIds: "all" };
};

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

/** The serverIds filter to apply to queries, or undefined for unrestricted. */
export const scopedServerIds = (scope: AccessScope): string[] | undefined =>
  scope.serverIds === "all" ? undefined : scope.serverIds;
