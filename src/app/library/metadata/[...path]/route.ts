import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";

/** Segments that would let the caller steer the upstream URL off the metadata path. */
const UNSAFE_SEGMENT = /[/\\?#]|^\.\.?$/;

// Handle /library/metadata/[...path]
// Example: http://localhost:3000/library/metadata/1064/thumb/1700000000
// params.path = ['1064', 'thumb', '1700000000']
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ path: string[] }> }
) {
    const params = await props.params;

    if (!(await authorizeApiKeyOrSession(req))) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const pathSegments = params.path;
    if (!pathSegments || pathSegments.length === 0) {
        return new NextResponse("Invalid Path", { status: 400 });
    }
    if (pathSegments.some((segment) => UNSAFE_SEGMENT.test(segment))) {
        return new NextResponse("Invalid Path", { status: 400 });
    }

    // Extract ratingKey (first segment)
    const ratingKey = pathSegments[0];

    // Find which server owns this ratingKey via media_sources (the
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
        return new NextResponse("Item not found or Server unknown", { status: 404 });
    }

    try {
        // Build the upstream URL through the URL API so the admin token can
        // never be absorbed into a caller-supplied query string, and never
        // surface the resulting URL — it carries that token in the clear.
        const upstreamUrl = new URL(`${resolved.baseUrl}/library/metadata/${pathSegments.join("/")}`);
        upstreamUrl.searchParams.set("X-Plex-Token", resolved.token);

        const response = await fetch(upstreamUrl);

        if (!response.ok) {
            Logger.warn(`[ImageProxy] Upstream returned ${response.status} for ratingKey ${ratingKey}`);
            return new NextResponse("Plex upstream error", { status: response.status });
        }

        const headers = new Headers();
        headers.set("Content-Type", response.headers.get("Content-Type") || "image/jpeg");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");

        return new NextResponse(response.body, {
            status: 200,
            headers
        });

    } catch (e) {
        Logger.error("[ImageProxy] Failed:", e);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
