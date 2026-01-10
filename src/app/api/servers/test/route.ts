import { NextResponse } from "next/server";
import { plexFetch, normalizePlexUrl } from "@/lib/plex";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const rawUrl = String(body.baseUrl || "").trim();
        const baseUrl = normalizePlexUrl(rawUrl);
        const token = String(body.token || "").trim();

        if (!baseUrl || !token) {
            return NextResponse.json(
                { error: "Ange både server-URL och token." },
                { status: 400 },
            );
        }

        // Attempt to fetch basic identity info to verify connection
        // We use a temporary server config object
        const tempServerConfig = {
            baseUrl,
            token,
            name: "Test Server",
            id: "test",
        };

        // We can fetch /identity via plexFetch, but plexFetch is generic.
        // Let's just try to fetch the root or identity.
        try {
            const result = await plexFetch("/identity", {}, tempServerConfig) as any;
            const container = result.MediaContainer || {};
            const serverName = container.friendlyName || "Okänd server";

            return NextResponse.json({
                success: true,
                message: "Connected!",
            });
        } catch (plexError: any) {
            // Pass through the nice error message we added to plexFetch
            throw new Error(plexError.message);
        }

    } catch (error) {
        const message = error instanceof Error ? error.message : "Kunde inte ansluta";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
