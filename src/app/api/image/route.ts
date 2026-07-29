import { NextRequest, NextResponse } from "next/server";
import { getServerById } from "@/lib/servers";
import {
    getCachedImage,
    imageCacheKey,
    makeImageEtag,
    setCachedImage,
} from "@/lib/image-cache";
import { Logger } from "@/lib/logger";
import { isAllowedExternalImageUrl } from "@/lib/avatar";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";

const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_DIM = 1200;
const IMAGE_CACHE_CONTROL = "public, max-age=86400";

/**
 * Relative paths become a PMS request carrying the server's admin token, so
 * only the image-shaped paths Plex actually emits are accepted. A bare
 * `/library/` prefix would not be enough — `/library/sections/1/all` is the
 * full library listing. Everything else PMS exposes (`/accounts`,
 * `/status/sessions`, `/:/prefs`, `/myplex/account`) is off the list entirely.
 *
 * Shapes in use: `/library/metadata/<ratingKey>/thumb/<ts>` from
 * library_items.thumb and live sessions, and the `/thumb`-suffixed form
 * synthesized in src/lib/stats/media-thumbs.ts.
 */
const PMS_IMAGE_PATH = /^\/library\/(metadata|sections)\/[^/]+\/(thumb|art|banner|theme|composite)(\/[^/]+)?$/;

const isAllowedPmsPath = (path: string): boolean =>
    PMS_IMAGE_PATH.test(path) && !path.includes("..");

const parseDim = (raw: string | null): number | undefined => {
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) return undefined;
    return Math.min(value, MAX_IMAGE_DIM);
};


const fetchWithTimeout = (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    return fetch(url, { headers: { Accept: "image/*" }, signal: controller.signal }).finally(() =>
        clearTimeout(timer),
    );
};

const imageResponse = (entry: { bytes: Buffer; contentType: string; etag: string }, ifNoneMatch: string | null) => {
    if (ifNoneMatch && ifNoneMatch === entry.etag) {
        return new NextResponse(null, {
            status: 304,
            headers: { ETag: entry.etag, "Cache-Control": IMAGE_CACHE_CONTROL },
        });
    }
    return new NextResponse(new Uint8Array(entry.bytes), {
        headers: {
            "Content-Type": entry.contentType,
            ETag: entry.etag,
            "Cache-Control": IMAGE_CACHE_CONTROL,
        },
    });
};

export async function GET(request: NextRequest) {
    if (!(await authorizeApiKeyOrSession(request))) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get("path");
    const serverId = searchParams.get("serverId");
    const w = parseDim(searchParams.get("w"));
    const h = parseDim(searchParams.get("h"));
    const ifNoneMatch = request.headers.get("if-none-match");

    // Secure mode: relative paths require serverId to look up credentials; absolute
    // URLs are allowed WITHOUT serverId but only against the strict plex.tv
    // allowlist (avatars — no credentials involved). Full PMS URLs from the client
    // are still rejected to prevent token leakage.
    if (!path || (!serverId && !path.startsWith("http"))) {
        return new NextResponse("Missing path or serverId", { status: 400 });
    }

    const cacheKey = imageCacheKey(serverId ?? "external", path, w, h);
    const cached = getCachedImage(cacheKey);
    if (cached) {
        return imageResponse(cached, ifNoneMatch);
    }

    try {
        // Construct the target URL server-side.
        let targetUrl = "";
        let transcodeUrl: string | null = null;
        if (path.startsWith("http")) {
            // plex.tv avatars etc. — proxied as-is; the PMS photo transcoder
            // cannot resize a foreign absolute URL.
            if (!isAllowedExternalImageUrl(path)) {
                return new NextResponse("External URLs not allowed", { status: 403 });
            }
            targetUrl = path;
        } else {
            if (!isAllowedPmsPath(path)) {
                return new NextResponse("Path not allowed", { status: 400 });
            }
            const server = serverId ? await getServerById(serverId) : null;
            if (!server) {
                return new NextResponse("Server not found", { status: 404 });
            }
            // Built through the URL API so the token lands in its own parameter
            // rather than being absorbed into a crafted path.
            const target = new URL(`${server.baseUrl}${path}`);
            target.searchParams.set("X-Plex-Token", server.token);
            targetUrl = target.toString();

            if (w && h) {
                // PMS photo transcoder: a poster thumb weighs kilobytes instead
                // of the full-resolution original.
                const transcode = new URL(`${server.baseUrl}/photo/:/transcode`);
                transcode.searchParams.set("width", String(w));
                transcode.searchParams.set("height", String(h));
                transcode.searchParams.set("minSize", "1");
                transcode.searchParams.set("upscale", "1");
                transcode.searchParams.set("url", path);
                transcode.searchParams.set("X-Plex-Token", server.token);
                transcodeUrl = transcode.toString();
            }
        }

        // Prefer the transcoded thumb; fall back to the raw original if the
        // transcoder rejects the path (older PMS versions, odd art types).
        let response = transcodeUrl ? await fetchWithTimeout(transcodeUrl) : await fetchWithTimeout(targetUrl);
        if (!response.ok && transcodeUrl) {
            response = await fetchWithTimeout(targetUrl);
        }
        if (!response.ok) {
            return new NextResponse(`Failed to fetch image: ${response.status}`, { status: response.status });
        }

        const contentType = response.headers.get("Content-Type") || "image/jpeg";
        const bytes = Buffer.from(await response.arrayBuffer());
        const entry = { bytes, contentType, etag: makeImageEtag(bytes) };
        setCachedImage(cacheKey, entry);

        return imageResponse(entry, ifNoneMatch);
    } catch (error) {
        Logger.error("Image proxy error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
