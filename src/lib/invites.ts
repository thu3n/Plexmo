import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "./db";
import type { InviteLinkRow } from "./db-types";

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
 * email. Returns the consumed invite (its type decides the session role) or
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
            db.prepare(
                `INSERT OR IGNORE INTO allowed_users (id, email, username, createdAt, removeAfterLogin, expiresAt, serverIds)
                 VALUES (?, ?, ?, ?, 0, NULL, ?)`
            ).run(
                randomUUID(),
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

/** List invites newest-first with computed status; purges rows finished >30d ago. */
export const listInvites = (): InviteWithStatus[] => {
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
    ).map((invite) => ({ ...invite, status: inviteStatus(invite, nowIso) }));
};

export const revokeInvite = (id: string): void => {
    db.prepare("DELETE FROM invite_links WHERE id = ?").run(id);
};
