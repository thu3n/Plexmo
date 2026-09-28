// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { parseTestConnectionBody, resolveTestCredentials } from "@/lib/server-connection-test";
import { maskToken } from "@/lib/server-token-mask";

const STORED = "stored-real-token-xyz";
const identity = (raw: string) => raw;
const lookup = vi.fn(async (id: string) => (id === "srv-1" ? STORED : null));

describe("parseTestConnectionBody", () => {
    it("normalizes the URL and drops non-string / empty fields", () => {
        const body = parseTestConnectionBody(
            { baseUrl: " plex.local:32400 ", token: "   ", serverId: 42 },
            (raw) => `http://${raw}`
        );
        expect(body).toEqual({ baseUrl: "http://plex.local:32400", token: null, serverId: null });
    });

    it("tolerates a non-object body", () => {
        expect(parseTestConnectionBody(null, identity)).toEqual({ baseUrl: "", token: null, serverId: null });
    });
});

describe("resolveTestCredentials", () => {
    const base = { baseUrl: "http://plex.local:32400", token: null, serverId: null };

    it("uses a freshly typed token as-is and never touches the stored one", async () => {
        lookup.mockClear();
        const r = await resolveTestCredentials({ ...base, token: "typed-token" }, { isOwner: false, lookupStoredToken: lookup });
        expect(r).toEqual({ ok: true, baseUrl: base.baseUrl, token: "typed-token", usedStoredToken: false });
        expect(lookup).not.toHaveBeenCalled();
    });

    it("resolves a MASKED token to the stored token for the owner", async () => {
        const r = await resolveTestCredentials(
            { ...base, token: maskToken(STORED), serverId: "srv-1" },
            { isOwner: true, lookupStoredToken: lookup }
        );
        expect(r).toEqual({ ok: true, baseUrl: base.baseUrl, token: STORED, usedStoredToken: true });
    });

    it("resolves an omitted token via serverId for the owner", async () => {
        const r = await resolveTestCredentials({ ...base, serverId: "srv-1" }, { isOwner: true, lookupStoredToken: lookup });
        expect(r.ok && r.token).toBe(STORED);
    });

    it("never sends the masked placeholder itself to Plex", async () => {
        const r = await resolveTestCredentials({ ...base, token: maskToken(STORED) }, { isOwner: true, lookupStoredToken: lookup });
        expect(r).toEqual({ ok: false, status: 400, error: "Enter the server token." });
    });

    it("refuses stored-token resolution for non-owners (onboarding sessions)", async () => {
        lookup.mockClear();
        const r = await resolveTestCredentials({ ...base, serverId: "srv-1" }, { isOwner: false, lookupStoredToken: lookup });
        expect(r).toMatchObject({ ok: false, status: 403 });
        expect(lookup).not.toHaveBeenCalled();
    });

    it("404s an unknown serverId", async () => {
        const r = await resolveTestCredentials({ ...base, serverId: "nope" }, { isOwner: true, lookupStoredToken: lookup });
        expect(r).toMatchObject({ ok: false, status: 404 });
    });

    it("requires a URL", async () => {
        const r = await resolveTestCredentials({ ...base, baseUrl: "", token: "t" }, { isOwner: true, lookupStoredToken: lookup });
        expect(r).toMatchObject({ ok: false, status: 400 });
    });
});
