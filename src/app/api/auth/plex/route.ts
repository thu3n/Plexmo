import { NextRequest, NextResponse } from "next/server";
import { createSession, getPlexUser, verifyAccess } from "@/lib/auth";

// ... (imports)

export async function GET(req: NextRequest) {
    try {
        const clientIdentifier = "plexmo-server";

        const headers = {
            "Accept": "application/json",
            "X-Plex-Product": "Plexmo",
            "X-Plex-Client-Identifier": clientIdentifier,
            "X-Plex-Device": "Web",
            "X-Plex-Model": "Plexmo",
        };

        const response = await fetch("https://plex.tv/api/v2/pins?strong=true", {
            method: "POST",
            headers,
        });

        if (!response.ok) {
            console.error("Plex PIN error", await response.text());
            return NextResponse.json({ error: "Failed to create PIN" }, { status: response.status });
        }

        const data = await response.json();

        // Construct the auth URL
        const authUrl = `https://app.plex.tv/auth#?clientID=${clientIdentifier}&code=${data.code}&context[device][product]=Plexmo`;

        return NextResponse.json({
            id: data.id,
            code: data.code,
            authUrl
        });

    } catch (error) {
        console.error("GET Auth Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { pinId, clientIdentifier, mode } = body;

        if (!pinId) {
            return NextResponse.json({ error: "Missing pinId" }, { status: 400 });
        }

        const clientId = clientIdentifier || "plexmo-server";

        // 2. Check PIN status
        const pinResponse = await fetch(`https://plex.tv/api/v2/pins/${pinId}`, {
            headers: {
                "Accept": "application/json",
                "X-Plex-Client-Identifier": clientId,
            },
        });

        if (!pinResponse.ok) {
            return NextResponse.json({ error: "Failed to check PIN status" }, { status: 500 });
        }

        const pinData = await pinResponse.json();

        if (!pinData.authToken) {
            return NextResponse.json({ error: "PIN not claimed yet", status: "polling" }, { status: 401 });
        }

        const token = pinData.authToken;

        // DISCOVERY MODE: Return token directly, no session, no strict checks
        if (mode === "discovery") {
            return NextResponse.json({ success: true, token });
        }

        // 3. Verify Ownership or Whitelist
        const isOwner = await verifyAccess(token);

        if (!isOwner) {
            return NextResponse.json({ error: "Access Denied. You are not an owner of any configured server." }, { status: 403 });
        }

        // 4. Get User Details
        const user = await getPlexUser(token);

        // 5. Create Session
        const jwt = await createSession({ ...user, accessToken: token });

        // 6. Set Cookie
        const response = NextResponse.json({ success: true, user });

        // Determine if we should use secure cookies
        // We trust the protocol of the incoming request. If it's HTTPS, we use Secure.
        // We also check NODE_ENV, but we must allow HTTP in production for internal networks if accessed via IP.
        const isHttps = req.nextUrl.protocol === "https:";

        response.cookies.set("token", jwt, {
            httpOnly: true,
            secure: isHttps, // Only set Secure if we are actually on HTTPS
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: "/",
            sameSite: "lax",
        });

        return response;

    } catch (error) {
        console.error("Auth error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
