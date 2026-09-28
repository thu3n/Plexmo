import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "./db";
import type { AllowedUserRow, InviteLinkRow } from "./db-types";
import { parseServerIds } from "./authz";

/**
 * One-time invite links. The raw secret (256-bit base64url) exists only in
 * the creation response — the table stores its sha256, so a leaked DB or
 * backup never yields a live invite URL. Lookup is by digest (indexed, no
 * byte-comparison timing oracle on secret material). Consumption is one
 * atomic UPDATE gated on unused + unexpired: better-sqlite3's single-writer
 * model makes double-redeem impossible.
 */

export type InviteType = "onboarding" | "access";
export type InviteStatus = "active" | "used" | "expired";
export type InviteWithStatus = InviteLinkRow & { status: InviteStatus };
export type InvitePerson = { username: string | null; email: string | null };
/** Management-UI shape: parsed scope, who redeemed it, and the live grant it created. */
export type InviteView = Omit<InviteWithStatus, "serverIds"> & {
    serverIds: string[] | null;
    usedBy: InvitePerson | null;
    /** allowed_users id this access invite granted, while that grant still exists. */
    grantId: string | null;
};

/** Used/expired rows stay visible in the management UI this long, then purge. */
const RETAIN_FINISHED_MS = 30 * 24 * 60 * 60 * 1000;

export const hashInviteToken = (raw: string): string =>
    createHash("sha256").update(raw).digest("hex");

export const createInvite = (input: {
    type: InviteType;
    label?: string | null;
    expiresAt: string;
    serverIds?: string[] | null;
    createdByAccountId: string;
}): { invite: InviteLinkRow; rawToken: string } => {
    const rawToken = randomBytes(32).toString("base64url");
    const invite: InviteLinkRow = {
        id: randomUUID(),
        tokenHash: hashInviteToken(rawToken),
        type: input.type,
        label: input.label?.trim() || null,
        createdByAccountId: input.createdByAccountId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(input.expiresAt).toISOString(),
        usedAt: null,
        usedByAccountId: null,
        serverIds:
            input.serverIds && input.serverIds.length > 0 ? JSON.stringify(input.serverIds) : null,
    };
    db.prepare(
        `INSERT INTO invite_links (id, tokenHash, type, label, createdByAccountId, createdAt, expiresAt, usedAt, usedByAccountId, serverIds)
         VALUES (@id, @tokenHash, @type, @label, @createdByAccountId, @createdAt, @expiresAt, @usedAt, @usedByAccountId, @serverIds)`
    ).run(invite);
    return { invite, rawToken };
};

/** Unused, unexpired invite for a raw link secret — or null (uniform for every failure mode). */
export const findValidInvite = (rawToken: string): InviteLinkRow | null =>
    (db
        .prepare(
            "SELECT * FROM invite_links WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ?"
        )
        .get(hashInviteToken(rawToken), new Date().toISOString()) as InviteLinkRow | undefined) ??
    null;

/**
 * Atomically consume an invite: marks it used iff still unused AND unexpired
 * at this very moment (closes the opened-before-expiry / finished-after
 * window). Returns the consumed row, or null.
 */
export const consumeInvite = (rawToken: string, accountId: string): InviteLinkRow | null => {
    const now = new Date().toISOString();
    const hash = hashInviteToken(rawToken);
    const result = db
        .prepare(
            `UPDATE invite_links SET usedAt = ?, usedByAccountId = ?
             WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ?`
        )
        .run(now, accountId, hash, now);
    if (result.changes !== 1) return null;
    return db.prepare("SELECT * FROM invite_links WHERE tokenHash = ?").get(hash) as InviteLinkRow;
};

/**
 * Redeem an invite at successful Plex login. One transaction: consume, and
 * for 'access' invites also insert the whitelist membership (persistent,
 * owner-revocable via the existing Access UI; the LINK is one-time, the
 * granted membership is not). INSERT OR IGNORE handles an already-whitelisted
 * email (the pre-existing entry then stands in as the grant). Returns the consumed invite (its type decides the session role) or
 * null — callers must respond uniformly on null.
 */
export const redeemInvite: (
    rawToken: string,
    user: { id: string; email: string; username: string }
) => InviteLinkRow | null = db.transaction(
    (rawToken: string, user: { id: string; email: string; username: string }) => {
        const invite = consumeInvite(rawToken, user.id);
        if (!invite) return null;
        if (invite.type === "access") {
            // The grant reuses the invite's id: invite_links only records the
            // redeemer's Plex account id, not their email, and this link is
            // what lets revoking the invite also revoke the access it granted.
            db.prepare(
                `INSERT OR IGNORE INTO allowed_users (id, email, username, createdAt, removeAfterLogin, expiresAt, serverIds)
                 VALUES (?, ?, ?, ?, 0, NULL, ?)`
            ).run(
                invite.id,
                user.email.toLowerCase().trim(),
                user.username,
                new Date().toISOString(),
                invite.serverIds
            );
        }
        return invite;
    }
);

const inviteStatus = (invite: InviteLinkRow, nowIso: string): InviteStatus =>
    invite.usedAt ? "used" : invite.expiresAt <= nowIso ? "expired" : "active";

const findGrantById = db.prepare<[string], AllowedUserRow>("SELECT * FROM allowed_users WHERE id = ?");
const findGrantByEmail = db.prepare<[string], AllowedUserRow>("SELECT * FROM allowed_users WHERE email = ?");
const findIdentity = db.prepare<[string], { username: string; email: string | null }>(
    "SELECT username, email FROM user_identities WHERE accountId = ?"
);

/**
 * The whitelist entry a used access invite granted. Grants minted since the
 * id-linking change share the invite's id; older ones (random ids) and
 * already-whitelisted redeemers fall back to the redeemer's email via
 * user_identities, when Plexmo has seen that account.
 */
const findGrantForInvite = (invite: InviteLinkRow): AllowedUserRow | null => {
    if (invite.type !== "access" || !invite.usedByAccountId) return null;
    const linked = findGrantById.get(invite.id);
    if (linked) return linked;
    const email = findIdentity.get(invite.usedByAccountId)?.email;
    return email ? (findGrantByEmail.get(email.toLowerCase().trim()) ?? null) : null;
};

const resolveUsedBy = (invite: InviteLinkRow, grant: AllowedUserRow | null): InvitePerson | null => {
    if (!invite.usedByAccountId) return null;
    if (grant) return { username: grant.username, email: grant.email };
    const identity = findIdentity.get(invite.usedByAccountId);
    return identity ? { username: identity.username, email: identity.email } : null;
};

/** List invites newest-first with computed status; purges rows finished >30d ago. */
export const listInvites = (): InviteView[] => {
    const now = Date.now();
    const cutoff = new Date(now - RETAIN_FINISHED_MS).toISOString();
    db.prepare(
        `DELETE FROM invite_links
         WHERE (usedAt IS NOT NULL AND usedAt < ?) OR (usedAt IS NULL AND expiresAt < ?)`
    ).run(cutoff, cutoff);
    const nowIso = new Date(now).toISOString();
    return (
        db
            .prepare("SELECT * FROM invite_links ORDER BY datetime(createdAt) DESC")
            .all() as InviteLinkRow[]
    ).map((invite) => {
        const grant = findGrantForInvite(invite);
        return {
            ...invite,
            status: inviteStatus(invite, nowIso),
            serverIds: parseServerIds(invite.serverIds),
            usedBy: resolveUsedBy(invite, grant),
            grantId: grant?.id ?? null,
        };
    });
};

export type RevokeInviteResult = { found: boolean; removedAccessEmail: string | null };

/**
 * Delete an invite. For a USED access invite this also deletes the whitelist
 * entry it granted — deleting only the link row left the person with full,
 * now-invisible access. One transaction, so neither half can land alone.
 */
export const revokeInvite: (id: string) => RevokeInviteResult = db.transaction((id: string): RevokeInviteResult => {
    const invite = db.prepare<[string], InviteLinkRow>("SELECT * FROM invite_links WHERE id = ?").get(id);
    if (!invite) return { found: false, removedAccessEmail: null };
    const grant = findGrantForInvite(invite);
    if (grant) db.prepare("DELETE FROM allowed_users WHERE id = ?").run(grant.id);
    db.prepare("DELETE FROM invite_links WHERE id = ?").run(id);
    return { found: true, removedAccessEmail: grant?.email ?? null };
});
