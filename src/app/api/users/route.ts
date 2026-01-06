import { listInternalServers } from "@/lib/servers";
import { fetchPlexUsers, PlexUser } from "@/lib/plex";
import { importUsers, listLocalUsers } from "@/lib/users";
import { NextRequest, NextResponse } from "next/server";

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
                console.error("Background user sync failed:", err);
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
        console.error("Error fetching users:", error);
        return NextResponse.json({ users: [] }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { users } = body;

        if (!Array.isArray(users)) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }

        importUsers(users);

        return NextResponse.json({ success: true, count: users.length });
    } catch (error) {
        console.error("Error importing users:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
