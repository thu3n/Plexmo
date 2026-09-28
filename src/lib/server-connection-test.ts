import { isMaskedToken } from "./server-token-mask";

/**
 * Decides which credentials the "Test connection" button may use.
 *
 * When editing a server the form shows a MASKED token; sending that verbatim
 * to Plex always fails (or, against the old unauthenticated /identity probe,
 * always "passed"). An unchanged token is therefore resolved server-side from
 * the stored row — which only the owner may do, since it lets the caller
 * point a stored credential at a URL of their choosing.
 */

export type TestConnectionBody = {
    baseUrl: string;
    token: string | null;
    serverId: string | null;
};

export type ResolvedTestCredentials =
    | { ok: true; baseUrl: string; token: string; usedStoredToken: boolean }
    | { ok: false; status: 400 | 403 | 404; error: string };

const MAX_TOKEN_LENGTH = 512;
const MAX_ID_LENGTH = 128;

const optionalString = (value: unknown, maxLength: number): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed && trimmed.length <= maxLength ? trimmed : null;
};

/** Shape-check the untrusted JSON body. `normalizeUrl` is injected to keep this pure. */
export const parseTestConnectionBody = (
    body: unknown,
    normalizeUrl: (raw: string) => string
): TestConnectionBody => {
    const record = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const rawUrl = typeof record.baseUrl === "string" ? record.baseUrl.trim() : "";
    return {
        baseUrl: rawUrl ? normalizeUrl(rawUrl) : "",
        token: optionalString(record.token, MAX_TOKEN_LENGTH),
        serverId: optionalString(record.serverId, MAX_ID_LENGTH),
    };
};

export const resolveTestCredentials = async (
    body: TestConnectionBody,
    ctx: { isOwner: boolean; lookupStoredToken: (serverId: string) => Promise<string | null> }
): Promise<ResolvedTestCredentials> => {
    if (!body.baseUrl) {
        return { ok: false, status: 400, error: "Enter the server URL." };
    }

    const typedToken = body.token && !isMaskedToken(body.token) ? body.token : null;
    if (typedToken) {
        return { ok: true, baseUrl: body.baseUrl, token: typedToken, usedStoredToken: false };
    }

    if (!body.serverId) {
        return { ok: false, status: 400, error: "Enter the server token." };
    }
    if (!ctx.isOwner) {
        return { ok: false, status: 403, error: "Only the owner can test with a saved token." };
    }
    const stored = await ctx.lookupStoredToken(body.serverId);
    if (!stored) {
        return { ok: false, status: 404, error: "Server not found or it has no saved token." };
    }
    return { ok: true, baseUrl: body.baseUrl, token: stored, usedStoredToken: true };
};
