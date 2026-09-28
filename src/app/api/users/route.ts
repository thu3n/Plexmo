import { listInternalServers, listServers } from "@/lib/servers";
import { fetchPlexUsers } from "@/lib/plex";
import { importUsers, listDirectoryUsers, type DirectoryUserDbRow } from "@/lib/users";
import { NextRequest, NextResponse } from "next/server";
import { authorizeApiKeyOrSession, requireOwner } from "@/lib/auth-guard";
import { scopedServerIds } from "@/lib/authz";
import { Logger } from "@/lib/logger";
import type { DirectoryUserRow } from "@/features/users/types";

export const dynamic = "force-dynamic";

const fetchAndStoreUsers = async (): Promise<number> => {
    const servers = await listInternalServers();
    const results = await Promise.all(servers.map((server) => fetchPlexUsers(server)));
    const allUsers = results.flat();
    if (allUsers.length > 0) {
        importUsers(allUsers);
    }
    return allUsers.length;
};

const syncUsers = async (): Promise<number> => {
    try {
        return await fetchAndStoreUsers();
    } catch (err) {
        Logger.error("Background user sync failed:", err);
        return 0;
    }
};

const toDirectoryRow = (u: DirectoryUserDbRow, serverNames: Map<string, string>): DirectoryUserRow => ({
    id: u.id,
    title: u.title || u.username,
    username: u.username,
    email: u.email || "",
    thumb: u.thumb || "",
    serverId: u.serverId,
    serverName: serverNames.get(u.serverId) || u.serverId,
    isAdmin: u.isAdmin === 1,
    plays: u.plays,
    watchSeconds: u.watchSeconds,
    lastPlayedAt: u.lastPlayedAt,
});

export async function GET(request: Request) {
    // Any signed-in user may browse the directory (equal-access policy), but a
    // scoped viewer only sees memberships on their servers. API keys are
    // refused: the listing carries email addresses.
    const user = await authorizeApiKeyOrSession(request);
    if (!user || user.scope.role === "api") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const allowedServerIds = scopedServerIds(user.scope);

    try {
        let rows = listDirectoryUsers(allowedServerIds);
        if (rows.length > 0) {
            // Serve the cached directory now; refresh from Plex in the background.
            void syncUsers();
        } else {
            // First run or empty DB: await the sync so the page isn't empty.
            await syncUsers();
            rows = listDirectoryUsers(allowedServerIds);
        }

        // Name lookup spans paused servers too — their memberships still show.
        const servers = await listServers();
        const serverNames = new Map(servers.map((s) => [s.id, s.name]));
        return NextResponse.json({ users: rows.map((u) => toDirectoryRow(u, serverNames)) });
    } catch (error) {
        Logger.error("Error fetching users:", error);
        return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    // Instance administration: owner sessions only (API keys and viewers are
    // refused by requireOwner). The directory is refreshed from Plex on the
    // server — clients never supply user rows, so there is nothing to forge.
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Only the instance owner can sync users" }, { status: 403 });
    }

    try {
        const count = await fetchAndStoreUsers();
        return NextResponse.json({ success: true, count });
    } catch (error) {
        Logger.error("Error syncing users from Plex:", error);
        return NextResponse.json({ error: "Failed to sync users from Plex" }, { status: 502 });
    }
}
