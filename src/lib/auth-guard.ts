import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import type { UserRow } from "@/lib/db-types";

/**
 * Verifies if the request is authorized via Session OR API Key.
 * Returns the session user if session is valid, or a placeholder "API Key User" if API key is valid.
 * Returns null if unauthorized.
 */
export async function authorizeApiKeyOrSession(request: Request) {
    // 1. Check Session
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (token) {
        const sessionPayload = await verifyToken(token);
        if (sessionPayload) {
            // Re-fetch user from DB to ensure we have the latest 'isAdmin' status
            // The session token might be stale.
            const dbUser = db.prepare<[string], UserRow>("SELECT * FROM users WHERE id = ?").get(sessionPayload.id);
            if (dbUser) {
                return {
                    ...sessionPayload,
                    isAdmin: dbUser.isAdmin === 1
                };
            }
            // Fallback to session payload if db lookup fails (unlikely)
            return sessionPayload;
        }
    }

    // 2. Check API Key
    if (validateApiKey(request)) {
        return { id: "apikey", username: "API Key", email: "apikey@system", role: "admin" };
    }

    return null;
}
