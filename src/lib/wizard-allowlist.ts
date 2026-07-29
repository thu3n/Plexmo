/**
 * The ONLY API surface a setup wizard may reach: exactly what connecting a
 * first server needs, nothing more. Exact-path matches — no prefixes — so e.g.
 * PUT/DELETE /api/servers/[id] can never slip through.
 *
 * Shared by both wizards, which have an identical call surface:
 * - `onboarding`-role sessions (minted by a consumed onboarding invite).
 * - Unauthenticated requests while the instance has never been configured.
 *
 * Kept free of db/node imports: enforced both in middleware (edge runtime,
 * covers every route regardless of its internal auth style) and in
 * authorizeApiKeyOrSession (defense in depth).
 *
 * Note: the restore branch posts to /api/settings/import/plexmo, which the
 * middleware matcher exempts entirely — it self-guards with requireOwner (a
 * `setup` session passes) and needs no entry here.
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

export const isWizardAllowedApi = (pathname: string, method: string): boolean =>
    RULES.some(
        (rule) => pathname === rule.path && (!rule.methods || rule.methods.includes(method))
    );
