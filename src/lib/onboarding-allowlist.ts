/**
 * The ONLY API surface an `onboarding`-role session (minted by a consumed
 * onboarding invite) may reach: exactly what the connect-your-server wizard
 * needs, nothing more. Exact-path matches — no prefixes — so e.g.
 * PUT/DELETE /api/servers/[id] can never slip through.
 *
 * Kept free of db/node imports: enforced both in middleware (edge runtime,
 * covers every route regardless of its internal auth style) and in
 * authorizeApiKeyOrSession (defense in depth).
 */

const RULES: { path: string; methods?: string[] }[] = [
    { path: "/api/auth/me" },
    { path: "/api/auth/logout" },
    { path: "/api/auth/plex" },
    { path: "/api/plex/resources" },
    { path: "/api/servers/test", methods: ["POST"] },
    { path: "/api/servers", methods: ["POST"] },
    { path: "/api/setup/status" },
];

export const isOnboardingAllowedApi = (pathname: string, method: string): boolean =>
    RULES.some(
        (rule) => pathname === rule.path && (!rule.methods || rule.methods.includes(method))
    );
