import { listInternalServers } from "./servers";
import { db } from "./db";
import { reattributeOwnerAlias } from "./identity";
import { XMLParser } from "fast-xml-parser";
import { type SessionUser } from "./jwt";

export type PmoUser = {
    id: string;
    username: string;
    email: string;
    thumb: string;
    accessToken?: string; // Optional here as we might not always have it or need it in this type locally
};

// --- Plex API Helpers ---

/**
 * Fetches the Plex user details for a given Plex Token.
 */
export async function getPlexUser(token: string): Promise<PmoUser> {
    const response = await fetch("https://plex.tv/users/account.json", {
        headers: {
            "X-Plex-Token": token,
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        throw new Error("Failed to fetch Plex user");
    }

    const data = await response.json();
    const user = data.user;

    return {
        id: String(user.id),
        username: user.username,
        email: user.email,
        thumb: user.thumb,
    };
}


export type AccessCheck = {
    allowed: boolean;
    role: "owner" | "viewer" | "setup";
};

/**
 * Verifies if the user is an owner or in the allowed users list, and with
 * which role. `setup` is only issued while no servers are configured — such
 * tokens are rejected by the request guard once a server exists.
 */
export async function verifyAccess(userToken: string): Promise<AccessCheck> {
    const servers = await listInternalServers();

    // 1. If no servers, everyone is allowed (setup mode/fresh start)
    if (servers.length === 0) {
        return { allowed: true, role: "setup" };
    }

    let loggingInUser: PmoUser;
    try {
        loggingInUser = await getPlexUser(userToken);
    } catch (e) {
        console.error("Failed to fetch logging in user details", e);
        return { allowed: false, role: "viewer" };
    }

    // 2. Check Ownership — the cached ownerAccountId avoids one network call
    // per server per login; servers that predate the cache are fetched once
    // and written back.
    for (const server of servers) {
        if (server.ownerAccountId) {
            if (server.ownerAccountId === loggingInUser.id) {
                return { allowed: true, role: "owner" };
            }
            continue;
        }
        if (!server.token) continue;
        try {
            const serverOwner = await getPlexUser(server.token);
            db.prepare("UPDATE servers SET ownerAccountId = ? WHERE id = ?").run(serverOwner.id, server.id);
            // Rows recorded before the owner id was known carry the "1" alias.
            reattributeOwnerAlias(server.id, serverOwner.id);
            if (serverOwner.id === loggingInUser.id) {
                return { allowed: true, role: "owner" };
            }
        } catch (e) {
            // ignore
        }
    }


    // 3. Check Whitelist
    try {
        const stmt = db.prepare<[string], { id: string; removeAfterLogin: number; expiresAt: string | null }>("SELECT * FROM allowed_users WHERE email = ?");
        const allowed = stmt.get(loggingInUser.email);

        if (allowed) {
            // Check expiry
            if (allowed.expiresAt) {
                const expiryDate = new Date(allowed.expiresAt);
                const now = new Date();

                // If the stored date has no timezone (e.g. from datetime-local), standard Date parsing
                // might treat it as a different timezone than expected or Local.
                // However, ignoring that complexity for a moment, simply checking if now > expiry is the baseline.
                if (now > expiryDate) {
                    db.prepare("DELETE FROM allowed_users WHERE id = ?").run(allowed.id);
                    return { allowed: false, role: "viewer" };
                }
            }

            // Handle "Remove after login" (One-time access)
            if (allowed.removeAfterLogin === 1) {
                db.prepare("DELETE FROM allowed_users WHERE id = ?").run(allowed.id);
            }

            return { allowed: true, role: "viewer" };
        }
    } catch (e) {
        console.error("Whitelist check failed", e);
    }

    return { allowed: false, role: "viewer" };
}


// Re-export session helpers for convenience in API routes
export { createSession } from "./jwt";
