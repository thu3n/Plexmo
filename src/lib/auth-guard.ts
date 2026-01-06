import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { validateApiKey } from "@/lib/api-auth";

/**
 * Verifies if the request is authorized via Session OR API Key.
 * Returns the session user if session is valid, or a placeholder "API Key User" if API key is valid.
 * Returns null if unauthorized.
 */
export async function authorizeApiKeyOrSession(request: Request) {
    // 1. Check Session
    const token = cookies().get("token")?.value;
    if (token) {
        const user = await verifyToken(token);
        if (user) return user;
    }

    // 2. Check API Key
    if (validateApiKey(request)) {
        return { id: "apikey", username: "API Key", email: "apikey@system", role: "admin" };
    }

    return null;
}
