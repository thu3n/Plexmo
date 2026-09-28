import { listServersForOwnership } from "./servers";
import { db } from "./db";
import { reattributeOwnerAlias } from "./identity";

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


/** Matches the viewer session lifetime issued by /api/auth/plex ("7d"). */
const ONE_TIME_GRANT_MS = 7 * 24 * 60 * 60 * 1000;

export type AccessCheck = {
    allowed: boolean;
    role: "owner" | "viewer" | "setup";
};

/**
 * Verifies if the user is an owner or in the allowed users list, and with
 * which role. `setup` is only issued while the instance has never been
 * configured — such tokens are rejected by the request guard once a server
 * exists.
 *
 * Archived servers count here, both for the setup check and for ownership:
 * removing the last server must not re-open the instance for any Plex account
 * to claim, and must not lock the real owner out of their own data.
 */
export async function verifyAccess(userToken: string): Promise<AccessCheck> {
    const servers = await listServersForOwnership();

    // 1. Never configured — fresh install, everyone is allowed in to set up.
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
        } catch {
            // Unreachable server / revoked token: not this server's owner.
        }
    }


    // 3. Check Whitelist. Stored emails are lowercased (addAllowedUser,
    // redeemInvite); Plex may report mixed case.
    try {
        const stmt = db.prepare<[string], { id: string; removeAfterLogin: number; expiresAt: string | null }>(
            "SELECT id, removeAfterLogin, expiresAt FROM allowed_users WHERE email = ?"
        );
        const allowed = stmt.get(String(loggingInUser.email ?? "").toLowerCase().trim());

        if (allowed) {
            const now = Date.now();
            if (allowed.expiresAt && now > new Date(allowed.expiresAt).getTime()) {
                db.prepare("DELETE FROM allowed_users WHERE id = ?").run(allowed.id);
                return { allowed: false, role: "viewer" };
            }

            // One-time access: the entry is NOT deleted at login — viewer
            // sessions are re-checked against their entry on every request
            // (authz.resolveScope), so deleting it would kill the session just
            // issued. It becomes a grant bounded by that session's lifetime
            // instead (visible and revocable); after that, access ends.
            if (allowed.removeAfterLogin === 1) {
                const sessionEnd = now + ONE_TIME_GRANT_MS;
                const existingEnd = allowed.expiresAt ? new Date(allowed.expiresAt).getTime() : Infinity;
                const boundedEnd = Number.isFinite(existingEnd) ? Math.min(existingEnd, sessionEnd) : sessionEnd;
                db.prepare("UPDATE allowed_users SET removeAfterLogin = 0, expiresAt = ? WHERE id = ?").run(
                    new Date(boundedEnd).toISOString(),
                    allowed.id
                );
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
