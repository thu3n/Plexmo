/**
 * Validation for URLs the server is asked to call on a user's behalf —
 * Discord webhooks and the Tautulli importer.
 *
 * Deliberately NOT a private-IP blocklist: Plexmo is self-hosted, so Tautulli
 * and self-run Discord relays legitimately live on the LAN. What we do reject
 * is the class of targets that only ever serves an SSRF: non-HTTP schemes,
 * embedded credentials, and cloud instance-metadata endpoints, which hand out
 * IAM credentials to anything that can issue a plain GET.
 */

/** Link-local (RFC 3927) covers 169.254.169.254 and its IPv6 counterpart. */
const BLOCKED_HOST_PATTERNS = [
    /^169\.254\./,
    /^0\.0\.0\.0$/,
    /^\[?::\]?$/,
    /^\[?fe80:/i,
    /^metadata\.google\.internal$/i,
    /^metadata\.goog$/i,
];

const isBlockedHost = (hostname: string): boolean =>
    BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));

/**
 * Parse a caller-supplied outbound URL, or return null if it must not be
 * fetched. Callers should treat null as a 400 — never as "try anyway".
 */
export const parseOutboundUrl = (raw: unknown): URL | null => {
    if (typeof raw !== "string" || raw.trim() === "") return null;

    let url: URL;
    try {
        url = new URL(raw.trim());
    } catch {
        return null;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Credentials in the authority would let a crafted value point the request
    // somewhere other than the hostname a reader sees.
    if (url.username || url.password) return null;
    if (isBlockedHost(url.hostname)) return null;

    return url;
};

/** True when the URL is safe to fetch server-side. */
export const isAllowedOutboundUrl = (raw: unknown): boolean => parseOutboundUrl(raw) !== null;
