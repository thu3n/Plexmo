import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { isRevokedScope, resolveScope } from "@/lib/authz";

export async function GET(req: NextRequest) {
    const token = req.cookies.get("token")?.value;

    if (!token) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await verifyToken(token);

    if (!user) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Revoked viewers get a 401 here too, so the client drops to /login
    // instead of rendering an app whose every data call now fails.
    if (isRevokedScope(resolveScope(user))) {
        return NextResponse.json({ error: "Access revoked" }, { status: 401 });
    }

    // Explicit whitelist. The session payload carries the user's full plex.tv
    // accessToken; returning it here would put a complete Plex credential in
    // the JS heap on every page view, where httpOnly buys nothing. Server-side
    // consumers (e.g. /api/plex/resources) read it from the cookie instead.
    return NextResponse.json({
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            thumb: user.thumb,
            role: user.role,
        },
    });
}
