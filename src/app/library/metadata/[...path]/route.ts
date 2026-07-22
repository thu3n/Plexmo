
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";

// Handle /library/metadata/[...path]
// Example: http://localhost:3000/library/metadata/1064/thumb/1700000000
// params.path = ['1064', 'thumb', '1700000000']
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ path: string[] }> }
) {
    const params = await props.params;

    // Debug Log
    console.log(`[ImageProxy] Request URL: ${req.url}`);

    // 1. Security Check
    const token = req.cookies.get("token")?.value;
    if (!token) {
        console.log("[ImageProxy] No token");
        return new NextResponse("Unauthorized", { status: 401 });
    }
    const user = await verifyToken(token);
    if (!user) {
        console.log("[ImageProxy] Invalid token");
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Next.js 15 compat: params is now awaited
    console.log(`[ImageProxy] Params:`, params);

    const pathSegments = params.path;
    if (!pathSegments || pathSegments.length === 0) {
        console.log("[ImageProxy] Empty path segments");
        return new NextResponse("Invalid Path", { status: 400 });
    }

    // 2. Extract ratingKey (first segment)
    const ratingKey = pathSegments[0];
    console.log(`[ImageProxy] RatingKey: ${ratingKey}`);

    // 3. Find which server owns this ratingKey via media_sources (the
    // per-server ratingKey -> canonical media mapping). The URL shape carries
    // no serverId, so a cross-server ratingKey collision is inherently
    // ambiguous here — any owning server serves an identical image.
    const item = db.prepare(`
        SELECT s.baseUrl, s.token
        FROM media_sources ms
        JOIN servers s ON ms.serverId = s.id
        WHERE ms.ratingKey = ? AND s.archivedAt IS NULL
        LIMIT 1
    `).get(ratingKey) as { baseUrl: string, token: string } | undefined;

    // Fallback: items not yet canonicalized (e.g. Live TV) may still be in an
    // active session or recent history row.
    const resolved = item ?? db.prepare(`
        SELECT s.baseUrl, s.token
        FROM activity_history h
        JOIN servers s ON h.serverId = s.id
        WHERE h.ratingKey = ? AND s.archivedAt IS NULL
        ORDER BY h.startTime DESC
        LIMIT 1
    `).get(ratingKey) as { baseUrl: string, token: string } | undefined;

    if (!resolved) {
        console.log(`[ImageProxy] Item not found for ratingKey: ${ratingKey}`);
        return new NextResponse("Item not found or Server unknown", { status: 404 });
    }

    // 4. Construct Upstream URL
    // Plex expects: /library/metadata/1064/thumb/1700000000?X-Plex-Token=...
    const relativePath = pathSegments.join('/');
    // Check for double slashes or missing slashes?
    // baseUrl usually "http://host:port". relativePath "123/thumb/456".
    const upstreamUrl = `${resolved.baseUrl}/library/metadata/${relativePath}?X-Plex-Token=${resolved.token}`;
    console.log(`[ImageProxy] Upstream URL: ${upstreamUrl}`);

    try {
        const response = await fetch(upstreamUrl);

        if (!response.ok) {
            console.log(`[ImageProxy] Upstream Error: ${response.status} ${response.statusText}`);
            // Check if it really is the upstream returning 400
            if (response.status === 400) {
                const text = await response.text();
                console.log(`[ImageProxy] Upstream Body: ${text}`);
            }
            return new NextResponse(`Plex Upstream Error: ${response.statusText} (${response.status}). URL: ${upstreamUrl}`, { status: response.status });
        }

        const headers = new Headers();
        headers.set("Content-Type", response.headers.get("Content-Type") || "image/jpeg");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");

        return new NextResponse(response.body, {
            status: 200,
            headers
        });

    } catch (e) {
        console.error("[ImageProxy] Failed:", e);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
