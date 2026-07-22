/**
 * Avatar URLs point at third-party origins (plex.tv, previously ui-avatars.com).
 * A client whose route to such an origin is broken stalls those image loads for
 * seconds and blocks the page load event (observed on iOS: ~5s stall per
 * avatar) — so external avatars are ALWAYS routed through the server-side
 * /api/image proxy (LAN-fast, in-memory cached, ETagged), and missing thumbs
 * use the local SVG initials fallback instead of an external generator.
 */
/**
 * Strict host allowlist for absolute avatar URLs proxied by /api/image. A
 * substring check like path.includes("plex.tv") would pass plex.tv.evil.com —
 * parse and match the hostname exactly instead.
 */
export function isAllowedExternalImageUrl(raw: string): boolean {
    try {
        const url = new URL(raw);
        return (
            url.protocol === "https:" &&
            (url.hostname === "plex.tv" || url.hostname.endsWith(".plex.tv"))
        );
    } catch {
        return false;
    }
}

export function avatarSrc(
    thumb: string | null | undefined,
    fallbackName: string,
    serverId?: string,
): string {
    if (thumb && thumb.startsWith("http")) {
        return `/api/image?path=${encodeURIComponent(thumb)}`;
    }
    if (thumb && serverId) {
        return `/api/image?path=${encodeURIComponent(thumb)}&serverId=${encodeURIComponent(serverId)}`;
    }
    return `/api/avatar-fallback?name=${encodeURIComponent(fallbackName)}`;
}
