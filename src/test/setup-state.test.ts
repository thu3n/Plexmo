import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { getServerCount, hasCompletedSetup } from "@/lib/servers";
import { verifyAccess } from "@/lib/auth";

const OWNER_ID = "111";
const STRANGER_ID = "999";
const OWNER_TOKEN = "owner-plex-token";
const STRANGER_TOKEN = "stranger-plex-token";

const plexAccounts: Record<string, { id: string; username: string; email: string }> = {
    [OWNER_TOKEN]: { id: OWNER_ID, username: "owner", email: "owner@example.com" },
    [STRANGER_TOKEN]: { id: STRANGER_ID, username: "stranger", email: "stranger@example.com" },
};

const insertServer = (archived: boolean) => {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt, color, machineIdentifier, ownerAccountId, archivedAt)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
    ).run(
        "srv-1",
        "Living Room",
        "http://plex.local:32400",
        "server-admin-token",
        now,
        now,
        "machine-1",
        OWNER_ID,
        archived ? now : null
    );
};

beforeEach(() => {
    db.prepare("DELETE FROM servers").run();
    db.prepare("DELETE FROM allowed_users").run();

    vi.stubGlobal("fetch", async (_url: string, init?: { headers?: Record<string, string> }) => {
        const token = init?.headers?.["X-Plex-Token"];
        const user = token ? plexAccounts[token] : undefined;
        if (!user) return { ok: false } as Response;
        return {
            ok: true,
            json: async () => ({ user: { ...user, thumb: "" } }),
        } as unknown as Response;
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("hasCompletedSetup", () => {
    it("is false on a fresh instance", () => {
        expect(hasCompletedSetup()).toBe(false);
        expect(getServerCount()).toBe(0);
    });

    it("stays true after the last server is archived", () => {
        insertServer(true);

        // Regression: setup state used to be derived from the live count, so
        // archiving the last server re-opened unauthenticated setup mode.
        expect(getServerCount()).toBe(0);
        expect(hasCompletedSetup()).toBe(true);
    });
});

describe("verifyAccess on an instance whose only server is archived", () => {
    beforeEach(() => {
        insertServer(true);
    });

    it("still recognises the owner via the archived server", () => {
        return expect(verifyAccess(OWNER_TOKEN)).resolves.toEqual({
            allowed: true,
            role: "owner",
        });
    });

    it("refuses to hand a stranger a setup session", async () => {
        // The takeover: a `setup` role is owner-like, so this would have given
        // any Plex account full administration of a populated instance.
        const result = await verifyAccess(STRANGER_TOKEN);
        expect(result.role).not.toBe("setup");
        expect(result.allowed).toBe(false);
    });

    it("still admits a whitelisted viewer", async () => {
        db.prepare(
            "INSERT INTO allowed_users (id, email, username, createdAt, removeAfterLogin) VALUES (?, ?, ?, ?, 0)"
        ).run("au-1", "stranger@example.com", "stranger", new Date().toISOString());

        await expect(verifyAccess(STRANGER_TOKEN)).resolves.toEqual({
            allowed: true,
            role: "viewer",
        });
    });
});

describe("verifyAccess on a genuinely fresh instance", () => {
    it("issues a setup session when no server has ever existed", async () => {
        await expect(verifyAccess(STRANGER_TOKEN)).resolves.toEqual({
            allowed: true,
            role: "setup",
        });
    });
});
