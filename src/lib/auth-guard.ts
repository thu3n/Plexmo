import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { validateApiKey } from "@/lib/api-auth";
import { getIdentity, isAdminAnywhere } from "@/lib/identity";
import { getServerCount } from "@/lib/servers";
import { resolveScope, isOwnerLike, type AccessScope } from "@/lib/authz";
import { isOnboardingAllowedApi } from "@/lib/onboarding-allowlist";

export type AuthorizedUser = {
    id: string;
    username: string;
    email: string;
    role?: string;
    isAdmin?: boolean;
    scope: AccessScope;
};

/**
 * Verifies if the request is authorized via Session OR API Key.
 * Returns the session user (with resolved access scope) if the session is
 * valid, or a placeholder "API Key User" if the API key is valid.
 * Returns null if unauthorized.
 */
export async function authorizeApiKeyOrSession(request: Request): Promise<AuthorizedUser | null> {
    // 1. Check Session
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (token) {
        const sessionPayload = await verifyToken(token);
        if (sessionPayload) {
            // Setup-mode tokens are only valid while NO server is configured.
            // The moment the first server exists, they die here.
            if (sessionPayload.role === "setup" && getServerCount() > 0) {
                return null;
            }

            // Onboarding sessions (invite-minted, 30 min) are contained to the
            // wizard's exact API surface — defense in depth behind the same
            // check in middleware.
            if (sessionPayload.role === "onboarding") {
                const { pathname } = new URL(request.url);
                if (!isOnboardingAllowedApi(pathname, request.method)) {
                    return null;
                }
            }

            const scope = resolveScope(sessionPayload);

            // Re-fetch from DB to ensure we have the latest admin status —
            // the session token might be stale.
            const identity = getIdentity(sessionPayload.id);
            if (identity) {
                return {
                    ...sessionPayload,
                    isAdmin: isAdminAnywhere(identity.accountId),
                    scope,
                };
            }
            // Fallback to session payload if db lookup fails (unlikely)
            return { ...sessionPayload, scope };
        }
    }

    // 2. Check API Key
    if (validateApiKey(request)) {
        return {
            id: "apikey",
            username: "API Key",
            email: "apikey@system",
            role: "admin",
            scope: { role: "api", serverIds: "all" },
        };
    }

    return null;
}

export { isOwnerLike };

/**
 * Instance-administration gate: authorize, then apply `isOwnerLike` (see
 * src/lib/authz.ts for the exact policy). Returns null on deny.
 */
export async function requireOwner(request: Request): Promise<AuthorizedUser | null> {
    const user = await authorizeApiKeyOrSession(request);
    if (!user || !isOwnerLike(user)) return null;
    return user;
}
