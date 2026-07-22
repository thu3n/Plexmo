import { listInternalServers } from "@/lib/servers";
import { fetchPlexUsers, PlexUser } from "@/lib/plex";
import { importUsers, listLocalUsers } from "@/lib/users";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { Logger } from "@/lib/logger";

// Simple sanitization helper
function sanitize(input: any): string {
    if (typeof input !== 'string') return input;
    return input
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export async function GET() {
    try {
        const localUsers = listLocalUsers();

        const syncUsers = async () => {
            try {
                const servers = await listInternalServers();
                const results = await Promise.all(
                    servers.map((server) => fetchPlexUsers(server))
                );
                const allUsers = results.flat();
                if (allUsers.length > 0) {
                    importUsers(allUsers);
                }
                return allUsers;
            } catch (err) {
                Logger.error("Background user sync failed:", err);
                return [];
            }
        };

        if (localUsers.length > 0) {
            // Return cached users immediately
            // Trigger background sync without awaiting
            syncUsers();

            const servers = await listInternalServers();
            const serverMap = new Map(servers.map(s => [s.id, s.name]));

            const mappedUsers = localUsers.map((u) => ({
                id: u.id,
                title: u.title || u.username,
                username: u.username,
                email: u.email || "",
                thumb: u.thumb || "",
                serverId: u.serverId,
                serverName: serverMap.get(u.serverId) || u.serverId, // Try to find friendly name, fallback to ID
                filterAll: "",
                filterMovies: "",
                filterMusic: "",
                filterPhotos: "",
                filterTelevision: "",
                isAdmin: u.isAdmin === 1,
            }));

            return NextResponse.json({ users: mappedUsers });
        } else {
            // First run or empty DB: await sync
            const allUsers = await syncUsers();
            return NextResponse.json({ users: allUsers });
        }
    } catch (error) {
        Logger.error("Error fetching users:", error);
        return NextResponse.json({ users: [] }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        // 1. Authorization Guard (Strict Session Only)
        // User requested that API Keys should NOT be allowed to create users.
        const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value;

        let sessionUser = null;
        if (token) {
            sessionUser = await verifyToken(token);
        }

        if (!sessionUser) {
            return NextResponse.json({ error: "Unauthorized: Valid Session Required" }, { status: 401 });
        }

        const body = await req.json();
        const { users } = body;

        if (!Array.isArray(users)) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }

        // 2. Input Sanitization
        const sanitizedUsers = users.map((u: any) => ({
            ...u,
            username: sanitize(u.username),
            title: sanitize(u.title),
            email: sanitize(u.email),
        }));

        importUsers(sanitizedUsers);

        return NextResponse.json({ success: true, count: sanitizedUsers.length });
    } catch (error) {
        Logger.error("Error importing users:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
