// @vitest-environment node
import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

// The guard reads the session cookie through next/headers; the owner lookup in
// verifyAccess goes through servers. Both are stubbed to isolate the policy.
const cookieJar: { token?: string } = {};
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && cookieJar.token ? { name, value: cookieJar.token } : undefined),
    }),
}));
vi.mock("@/lib/servers", () => ({
    hasCompletedSetup: () => true,
    listServersForOwnership: async () => [{ id: "srv-a", ownerAccountId: "1000", token: "owner-token" }],
}));

import { db } from "@/lib/db";
import { NO_SERVER_ID, isRevokedScope, resolveScope, scopedServerIds } from "@/lib/authz";
import { addAllowedUser, removeAllowedUser } from "@/lib/access";
import { createInvite, listInvites, redeemInvite, revokeInvite } from "@/lib/invites";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { createSession, type SessionUser } from "@/lib/jwt";
import { verifyAccess } from "@/lib/auth";

const FUTURE = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
const PAST = new Date(Date.now() - 3600_000).toISOString();
const FRIEND = { id: "555", email: "Friend@Example.com", username: "friend" };
const viewer = (email: string) => ({ id: "555", email, role: "viewer" });

beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-access-revocation-0123456789";
});

beforeEach(() => {
    db.prepare("DELETE FROM invite_links").run();
    db.prepare("DELETE FROM allowed_users").run();
    db.prepare("DELETE FROM user_identities").run();
    cookieJar.token = undefined;
    vi.unstubAllGlobals();
});

describe("viewer scope is re-checked against allowed_users", () => {
    it("unscoped grant = all servers, scoped grant = its list", async () => {
        await addAllowedUser("all@example.com", "all", false);
        await addAllowedUser("one@example.com", "one", false, null, ["srv-a"]);
        expect(resolveScope(viewer("ALL@example.com")).serverIds).toBe("all");
        expect(resolveScope(viewer("one@example.com")).serverIds).toEqual(["srv-a"]);
    });

    it("a missing or expired grant yields a revoked, match-nothing scope", async () => {
        const missing = resolveScope(viewer("nobody@example.com"));
        expect(isRevokedScope(missing)).toBe(true);
        expect(scopedServerIds(missing)).toEqual([NO_SERVER_ID]);

        await addAllowedUser("late@example.com", "late", false, PAST);
        expect(isRevokedScope(resolveScope(viewer("late@example.com")))).toBe(true);
    });

    it("removing the entry revokes the scope of an existing session", async () => {
        const user = await addAllowedUser("friend@example.com", "friend", false);
        expect(isRevokedScope(resolveScope(viewer("friend@example.com")))).toBe(false);
        expect(removeAllowedUser(user.id)).toBe(true);
        expect(isRevokedScope(resolveScope(viewer("friend@example.com")))).toBe(true);
        expect(removeAllowedUser(user.id)).toBe(false);
    });

    it("owners are never affected by the whitelist", () => {
        expect(resolveScope({ id: "1000", email: "owner@example.com", role: "owner" }).serverIds).toBe("all");
    });
});

describe("request guard rejects a still-signed viewer cookie after removal", () => {
    const session: SessionUser = {
        id: "555",
        username: "friend",
        email: "Friend@Example.com",
        thumb: "",
        accessToken: "plex-token",
        role: "viewer",
    };
    const request = () => new Request("http://localhost/api/history");

    it("authorizes while the grant exists, then returns null once it is removed", async () => {
        const grant = await addAllowedUser("friend@example.com", "friend", false);
        cookieJar.token = await createSession(session);
        expect(await authorizeApiKeyOrSession(request())).not.toBeNull();

        removeAllowedUser(grant.id);
        expect(await authorizeApiKeyOrSession(request())).toBeNull();
    });
});

describe("revoking an access invite revokes the access it granted", () => {
    it("used invite: deletes the linked grant and reports whose access went", () => {
        const { invite, rawToken } = createInvite({ type: "access", expiresAt: FUTURE, createdByAccountId: "1000" });
        redeemInvite(rawToken, FRIEND);

        const listed = listInvites().find((i) => i.id === invite.id);
        expect(listed?.grantId).toBe(invite.id);
        expect(listed?.usedBy).toEqual({ username: "friend", email: "friend@example.com" });

        expect(revokeInvite(invite.id)).toEqual({ found: true, removedAccessEmail: "friend@example.com" });
        expect(db.prepare("SELECT COUNT(*) AS n FROM allowed_users").get()).toEqual({ n: 0 });
        expect(isRevokedScope(resolveScope(viewer("friend@example.com")))).toBe(true);
    });

    it("legacy grant (random id) is found through the redeemer's identity email", async () => {
        const { invite, rawToken } = createInvite({ type: "access", expiresAt: FUTURE, createdByAccountId: "1000" });
        redeemInvite(rawToken, FRIEND);
        db.prepare("UPDATE allowed_users SET id = 'legacy-uuid' WHERE id = ?").run(invite.id);
        db.prepare(
            "INSERT INTO user_identities (accountId, username, title, email, createdAt, updatedAt) VALUES ('555', 'friend', 'friend', 'Friend@Example.com', '2026-01-01', '2026-01-01')"
        ).run();

        expect(listInvites().find((i) => i.id === invite.id)?.grantId).toBe("legacy-uuid");
        expect(revokeInvite(invite.id).removedAccessEmail).toBe("friend@example.com");
    });

    it("unused invite and onboarding invite leave the whitelist alone", async () => {
        await addAllowedUser("other@example.com", "other", false);
        const unused = createInvite({ type: "access", expiresAt: FUTURE, createdByAccountId: "1000" });
        const onboarding = createInvite({ type: "onboarding", expiresAt: FUTURE, createdByAccountId: "1000" });
        redeemInvite(onboarding.rawToken, FRIEND);

        expect(revokeInvite(unused.invite.id)).toEqual({ found: true, removedAccessEmail: null });
        expect(revokeInvite(onboarding.invite.id)).toEqual({ found: true, removedAccessEmail: null });
        expect(revokeInvite("does-not-exist")).toEqual({ found: false, removedAccessEmail: null });
        expect(db.prepare("SELECT COUNT(*) AS n FROM allowed_users").get()).toEqual({ n: 1 });
    });

    it("a grant removed from the people list shows as unlinked on the invite", async () => {
        const { invite, rawToken } = createInvite({ type: "access", expiresAt: FUTURE, createdByAccountId: "1000" });
        redeemInvite(rawToken, FRIEND);
        removeAllowedUser(invite.id);
        expect(listInvites().find((i) => i.id === invite.id)?.grantId).toBeNull();
    });
});

describe("verifyAccess whitelist login", () => {
    const stubPlexAccount = (email: string) =>
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify({ user: { id: 555, username: "friend", email, thumb: "" } })))
        );

    it("matches a mixed-case Plex email against the lowercased entry", async () => {
        await addAllowedUser("friend@example.com", "friend", false);
        stubPlexAccount("Friend@Example.com");
        expect(await verifyAccess("viewer-token")).toEqual({ allowed: true, role: "viewer" });
    });

    it("one-time entries survive login as a session-bounded grant (so the session is not killed)", async () => {
        const user = await addAllowedUser("friend@example.com", "friend", true);
        stubPlexAccount("friend@example.com");
        expect((await verifyAccess("viewer-token")).allowed).toBe(true);

        const row = db.prepare("SELECT removeAfterLogin, expiresAt FROM allowed_users WHERE id = ?").get(user.id) as {
            removeAfterLogin: number;
            expiresAt: string;
        };
        expect(row.removeAfterLogin).toBe(0);
        const remainingMs = new Date(row.expiresAt).getTime() - Date.now();
        expect(remainingMs).toBeGreaterThan(6 * 24 * 3600_000);
        expect(remainingMs).toBeLessThanOrEqual(7 * 24 * 3600_000);
        expect(isRevokedScope(resolveScope(viewer("friend@example.com")))).toBe(false);
    });

    it("expired entries are rejected and purged", async () => {
        await addAllowedUser("friend@example.com", "friend", false, PAST);
        stubPlexAccount("friend@example.com");
        expect((await verifyAccess("viewer-token")).allowed).toBe(false);
        expect(db.prepare("SELECT COUNT(*) AS n FROM allowed_users").get()).toEqual({ n: 0 });
    });
});
