import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import { Logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
    // Security Check: Ensure user is logged in
    const token = req.cookies.get("token")?.value;
    if (!token) {
        return new NextResponse("Unauthorized", { status: 401 });
    }
    const user = await verifyToken(token);
    if (!user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get("serverId");
    const thumb = searchParams.get("thumb");

    if (!serverId || !thumb) {
        return new NextResponse("Missing serverId or thumb", { status: 400 });
    }

    try {
        const server = db.prepare("SELECT baseUrl, token FROM servers WHERE id = ?").get(serverId) as { baseUrl: string, token: string };

        if (!server) {
            return new NextResponse("Server not found", { status: 404 });
        }

        const plexUrl = `${server.baseUrl}${thumb}?X-Plex-Token=${server.token}`;

        const response = await fetch(plexUrl);

        if (!response.ok) {
            return new NextResponse(`Failed to fetch from Plex: ${response.statusText}`, { status: 502 });
        }

        const headers = new Headers();
        headers.set("Content-Type", response.headers.get("Content-Type") || "image/jpeg");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");

        return new NextResponse(response.body, {
            status: 200,
            headers,
        });

    } catch (e: any) {
        Logger.error("Proxy Error:", e);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
