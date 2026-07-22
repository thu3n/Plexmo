import { NextRequest, NextResponse } from "next/server";

/**
 * Local initials avatar — replaces the external ui-avatars.com fallback so a
 * missing thumb never triggers a third-party fetch (which stalls for seconds
 * on clients with broken external connectivity, blocking page load).
 */
const AVATAR_SIZE = 64;
const NAME_MAX_LENGTH = 64;
// Deterministic per name, so effectively immutable.
const CACHE_CONTROL = "public, max-age=604800, immutable";
const PALETTE = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#f43f5e", "#84cc16"];

const escapeXml = (value: string) =>
    value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function GET(request: NextRequest) {
    const raw = (request.nextUrl.searchParams.get("name") || "?").slice(0, NAME_MAX_LENGTH);
    const initial = escapeXml(raw.trim().charAt(0).toUpperCase() || "?");
    let hash = 0;
    for (const ch of raw) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    const background = PALETTE[Math.abs(hash) % PALETTE.length];
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}">` +
        `<rect width="100%" height="100%" fill="${background}"/>` +
        `<text x="50%" y="50%" dy=".36em" text-anchor="middle" font-family="sans-serif" font-size="${AVATAR_SIZE / 2}" font-weight="bold" fill="#fff">${initial}</text>` +
        `</svg>`;
    return new NextResponse(svg, {
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": CACHE_CONTROL },
    });
}
