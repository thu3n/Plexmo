import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
});

type PlexConnection = {
    uri: string;
    local: string | number;
};

type PlexResource = {
    name: string;
    product: string;
    productVersion: string;
    platform: string;
    clientIdentifier: string;
    createdAt: string;
    lastSeenAt: string;
    provides: string;
    ownerId: string | null;
    sourceTitle: string | null;
    publicAddress: string;
    accessToken: string;
    owned: string | number;
    home: string | number;
    synced: string | number;
    relay: string | number;
    presence: string | number;
    httpsRequired: string | number;
    dnsRebindingProtection: string | number;
    natLoopbackSupported: string | number;
    publicAddressMatches: string | number;
    connections: PlexConnection[];
};

export async function GET(req: NextRequest) {
    let accessToken = req.headers.get("X-Plex-Token") || req.headers.get("Authorization")?.replace("Bearer ", "");

    // Fallback to session cookie if no header token provided
    if (!accessToken) {
        const tokenCookie = req.cookies.get("token")?.value;
        if (!tokenCookie) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const session = await verifyToken(tokenCookie);
        // console.log("DEBUG: Session:", session);
        if (!session || !session.accessToken) {
            console.error("DEBUG: Missing accessToken in session");
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }
        accessToken = session.accessToken;
    }

    try {
        const response = await fetch("https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1", {
            headers: {
                "X-Plex-Token": accessToken,
                "X-Plex-Client-Identifier": "plexmo-server",
                "Accept": "application/json"
            },
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Failed to fetch Plex resources" }, { status: response.status });
        }

        const data = await response.json();
        const resources = data as PlexResource[];

        const servers = resources
            .filter((r) => r.product === "Plex Media Server")
            .map((r) => ({
                name: r.name,
                clientIdentifier: r.clientIdentifier,
                platform: r.platform,
                productVersion: r.productVersion,
                connections: r.connections, // We might need to process these to find the best URL
                token: r.accessToken || accessToken, // Use resource token if available (usually same for owned)
            }));

        return NextResponse.json({ servers });
    } catch (error) {
        console.error("Error fetching resources:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
