import { createHash, timingSafeEqual } from "crypto";
import { getSetting } from "./settings";

/**
 * Constant-time comparison over fixed-width digests, so neither the key
 * contents nor its length leaks through timing. Comparing the raw strings
 * would short-circuit on the first differing byte.
 */
const digestsMatch = (a: string, b: string): boolean =>
    timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export const validateApiKey = (request: Request): boolean => {
    const headerKey = request.headers.get("x-api-key");
    const authorization = request.headers.get("authorization");
    const bearerKey = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;

    // Headers take priority: the query form is legacy Wrapperr/Rewrap
    // compatibility and lands verbatim in reverse-proxy access logs.
    const { searchParams } = new URL(request.url);
    const providedKey = headerKey || bearerKey || searchParams.get("apiKey");

    if (!providedKey) return false;

    // No key generated yet means the API surface is simply closed.
    const storedKey = getSetting("API_KEY");
    if (!storedKey) return false;

    return digestsMatch(providedKey, storedKey);
};
