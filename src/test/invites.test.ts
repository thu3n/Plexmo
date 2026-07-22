import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import {
    createInvite,
    findValidInvite,
    consumeInvite,
    redeemInvite,
    listInvites,
    revokeInvite,
    hashInviteToken,
} from "@/lib/invites";
import { allowInviteAttempt, resetInviteThrottle } from "@/lib/invite-throttle";
import type { AllowedUserRow } from "@/lib/db-types";

const FUTURE = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
const PAST = new Date(Date.now() - 3600_000).toISOString();
const PLEX_USER = { id: "555", email: "Friend@Example.com", username: "friend" };

beforeEach(() => {
    db.prepare("DELETE FROM invite_links").run();
    db.prepare("DELETE FROM allowed_users").run();
    resetInviteThrottle();
});

describe("invite lifecycle", () => {
    it("creates a 43-char base64url secret and stores only its sha256", () => {
        const { invite, rawToken } = createInvite({
            type: "onboarding",
            expiresAt: FUTURE,
            createdByAccountId: "100",
        });
        expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(invite.tokenHash).toBe(hashInviteToken(rawToken));
        const stored = db.prepare("SELECT tokenHash FROM invite_links WHERE id = ?").get(invite.id) as { tokenHash: string };
        expect(stored.tokenHash).not.toContain(rawToken);
    });

    it("validates active invites and rejects expired ones uniformly", () => {
        const { rawToken } = createInvite({ type: "access", expiresAt: FUTURE, createdByAccountId: "100" });
        expect(findValidInvite(rawToken)?.type).toBe("access");
        expect(findValidInvite("not-a-real-token")).toBeNull();

        const expired = createInvite({ type: "access", expiresAt: FUTURE, createdByAccountId: "100" });
        db.prepare("UPDATE invite_links SET expiresAt = ? WHERE id = ?").run(PAST, expired.invite.id);
        expect(findValidInvite(expired.rawToken)).toBeNull();
    });

    it("consumes exactly once — replay returns null", () => {
        const { rawToken } = createInvite({ type: "onboarding", expiresAt: FUTURE, createdByAccountId: "100" });
        const first = consumeInvite(rawToken, "555");
        expect(first).toMatchObject({ usedByAccountId: "555" });
        expect(first?.usedAt).toBeTruthy();
        expect(consumeInvite(rawToken, "555")).toBeNull();
        expect(consumeInvite(rawToken, "666")).toBeNull();
    });

    it("re-checks expiry at the moment of consumption", () => {
        const { invite, rawToken } = createInvite({ type: "onboarding", expiresAt: FUTURE, createdByAccountId: "100" });
        db.prepare("UPDATE invite_links SET expiresAt = ? WHERE id = ?").run(PAST, invite.id);
        expect(consumeInvite(rawToken, "555")).toBeNull();
    });
});

describe("redeemInvite", () => {
    it("access invite: consumes + inserts a persistent whitelist row with copied serverIds", () => {
        const { rawToken } = createInvite({
            type: "access",
            expiresAt: FUTURE,
            serverIds: ["srv-a"],
            createdByAccountId: "100",
        });
        const invite = redeemInvite(rawToken, PLEX_USER);
        expect(invite?.type).toBe("access");
        const row = db.prepare("SELECT * FROM allowed_users WHERE email = ?").get("friend@example.com") as AllowedUserRow;
        expect(row).toMatchObject({ removeAfterLogin: 0, expiresAt: null, serverIds: JSON.stringify(["srv-a"]) });
    });

    it("access invite is idempotent for an already-whitelisted email", () => {
        db.prepare(
            "INSERT INTO allowed_users (id, email, username, createdAt, removeAfterLogin, expiresAt, serverIds) VALUES ('w1', 'friend@example.com', 'friend', '2026-01-01', 0, NULL, NULL)"
        ).run();
        const { rawToken } = createInvite({ type: "access", expiresAt: FUTURE, createdByAccountId: "100" });
        expect(redeemInvite(rawToken, PLEX_USER)).not.toBeNull();
        expect(
            (db.prepare("SELECT COUNT(*) as count FROM allowed_users").get() as { count: number }).count
        ).toBe(1);
    });

    it("onboarding invite: consumes without touching the whitelist", () => {
        const { rawToken } = createInvite({ type: "onboarding", expiresAt: FUTURE, createdByAccountId: "100" });
        expect(redeemInvite(rawToken, PLEX_USER)?.type).toBe("onboarding");
        expect(
            (db.prepare("SELECT COUNT(*) as count FROM allowed_users").get() as { count: number }).count
        ).toBe(0);
    });

    it("invalid or used invite redeems to null", () => {
        expect(redeemInvite("bogus", PLEX_USER)).toBeNull();
        const { rawToken } = createInvite({ type: "access", expiresAt: FUTURE, createdByAccountId: "100" });
        redeemInvite(rawToken, PLEX_USER);
        expect(redeemInvite(rawToken, PLEX_USER)).toBeNull();
    });
});

describe("listInvites / revokeInvite", () => {
    it("computes statuses and purges rows finished more than 30 days ago", () => {
        const active = createInvite({ type: "access", expiresAt: FUTURE, createdByAccountId: "100" });
        const used = createInvite({ type: "access", expiresAt: FUTURE, createdByAccountId: "100" });
        consumeInvite(used.rawToken, "555");
        const expired = createInvite({ type: "access", expiresAt: FUTURE, createdByAccountId: "100" });
        db.prepare("UPDATE invite_links SET expiresAt = ? WHERE id = ?").run(PAST, expired.invite.id);
        const ancient = createInvite({ type: "access", expiresAt: FUTURE, createdByAccountId: "100" });
        db.prepare("UPDATE invite_links SET expiresAt = ? WHERE id = ?").run(
            new Date(Date.now() - 40 * 24 * 3600_000).toISOString(),
            ancient.invite.id
        );

        const list = listInvites();
        const byId = new Map(list.map((i) => [i.id, i.status]));
        expect(byId.get(active.invite.id)).toBe("active");
        expect(byId.get(used.invite.id)).toBe("used");
        expect(byId.get(expired.invite.id)).toBe("expired");
        expect(byId.has(ancient.invite.id)).toBe(false);

        revokeInvite(active.invite.id);
        expect(findValidInvite(active.rawToken)).toBeNull();
    });
});

describe("invite throttle", () => {
    it("allows 10 attempts per key per window, then blocks, then resets", () => {
        const t0 = 1_000_000;
        for (let i = 0; i < 10; i++) {
            expect(allowInviteAttempt("1.2.3.4", t0 + i)).toBe(true);
        }
        expect(allowInviteAttempt("1.2.3.4", t0 + 11)).toBe(false);
        // Other keys are unaffected; the window resets after 60s.
        expect(allowInviteAttempt("5.6.7.8", t0 + 12)).toBe(true);
        expect(allowInviteAttempt("1.2.3.4", t0 + 61_000)).toBe(true);
    });
});
