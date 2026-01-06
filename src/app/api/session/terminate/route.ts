
import { NextResponse } from "next/server";
import { terminateSession, getDashboardSnapshot } from "@/lib/plex";
import { listInternalServers, DbServer } from "@/lib/servers";
import { sendSessionTerminatedNotification } from "@/lib/discord";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sessionId, serverId, reason } = body;


        if (!sessionId || !serverId) {
            return NextResponse.json(
                { error: "Missing sessionId or serverId" },
                { status: 400 }
            );
        }

        // Resolve server config
        // Use listInternalServers to get servers WITH tokens (PublicServer hides token)
        const servers = await listInternalServers();
        const server = servers.find((s: DbServer) => s.id === serverId);

        if (!server) {
            return NextResponse.json(
                { error: "Server not found" },
                { status: 404 }
            );
        }

        // Try to fetch the session info before we terminate to ensure we have details
        let sessionToNotify = null;
        try {
            const snapshot = await getDashboardSnapshot(server);
            sessionToNotify = snapshot.sessions.find(s => s.id === sessionId || s.sessionKey === sessionId);
        } catch (e) {
            console.error("Failed to fetch session details for notification", e);
        }

        // Call the lib function
        await terminateSession(sessionId, server, reason || "Terminated via Plexmo");

        if (sessionToNotify) {
            // Send notification asynchronously
            sendSessionTerminatedNotification(sessionToNotify, reason || "Terminated via Plexmo").catch(console.error);
        }

        return NextResponse.json({ success: true, message: "Session terminated" });
    } catch (error: any) {
        console.error("Terminate API Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to terminate session" },
            { status: 500 }
        );
    }
}
