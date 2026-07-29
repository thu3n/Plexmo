import { parseOutboundUrl } from "./outbound-url";

/**
 * URL construction for the Tautulli API.
 *
 * String concatenation was the original approach and it leaked twice: a
 * trailing `#` on the base truncated the appended `/api/v2`, pointing the
 * request at an arbitrary path, and an unencoded apiKey could inject extra
 * query parameters. Everything goes through the URL API here instead.
 */

const TAUTULLI_TIMEOUT_MS = 20_000;

/** Resolve a caller-supplied base URL to its `/api/v2` endpoint, or null if it must not be fetched. */
export const resolveTautulliApiBase = (raw: unknown): string | null => {
    const url = parseOutboundUrl(raw);
    if (!url) return null;

    // A query or fragment on the base would swallow the path we append.
    url.search = "";
    url.hash = "";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/v2`;

    return url.toString();
};

export const tautulliApiUrl = (
    apiBase: string,
    apiKey: string,
    params: Record<string, string | number>,
): string => {
    const url = new URL(apiBase);
    url.searchParams.set("apikey", apiKey);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
    }
    return url.toString();
};

/** Single entry point for Tautulli calls: encoded parameters plus a hard timeout. */
export const tautulliFetch = (
    apiBase: string,
    apiKey: string,
    params: Record<string, string | number>,
): Promise<Response> =>
    fetch(tautulliApiUrl(apiBase, apiKey, params), {
        signal: AbortSignal.timeout(TAUTULLI_TIMEOUT_MS),
    });
