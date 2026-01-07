import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get("path");
    const serverId = searchParams.get("serverId");

    // Secure mode: We require serverId to look up the credentials.
    // We do NOT accept a full URL in 'url' param anymore to prevent token leakage in client.

    if (!path || !serverId) {
        return new NextResponse("Missing path or serverId", { status: 400 });
    }

    try {
        const { getServerById } = await import("@/lib/servers");
        const server = await getServerById(serverId);

        if (!server) {
            return new NextResponse("Server not found", { status: 404 });
        }

        // Construct the target URL server-side
        // Check if path is already absolute (e.g. some user thumbs)
        let targetUrl = "";
        if (path.startsWith("http")) {
            // For now, disallow arbitrary HTTP strings unless we decide how to handle them (e.g. plex.tv)
            // But usually session.thumb is /library/metadata/...
            // userThumb can be https://plex.tv/...
            if (path.includes("plex.tv")) {
                targetUrl = path; // Plex.tv usually has token embedded or needs it? 
                // If it has token embedded by Plex, we might be stuck proxying it, but we should strip it before sending to client.
                // Ideally client sends path="https://plex.tv/..." AND serverId.
                // We can append X-Plex-Token if needed, but if the URL already has it, we just fetch it.
            } else {
                return new NextResponse("External URLs not allowed", { status: 403 });
            }
        } else {
            targetUrl = `${server.baseUrl}${path}?X-Plex-Token=${server.token}`;
        }

        const response = await fetch(targetUrl, {
            headers: {
                "Accept": "image/*"
            }
        });

        if (!response.ok) {
            return new NextResponse(`Failed to fetch image: ${response.status}`, { status: response.status });
        }

        const upstreamType = response.headers.get("Content-Type") || "image/jpeg";

        // [SECURITY] Vulnerability Fix: Reflected XSS via Image Proxy
        const safeType = upstreamType.startsWith("image/") ? upstreamType : "application/octet-stream";
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": safeType,
                "Cache-Control": "public, max-age=3600",
                "X-Content-Type-Options": "nosniff" // Extra protection
            }
        });

    } catch (error) {
        console.error("Image proxy error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
