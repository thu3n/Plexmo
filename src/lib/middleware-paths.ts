/**
 * Request-path classification for the middleware. Pure string logic, kept out
 * of middleware.ts so it can be unit tested without an edge-runtime harness.
 */

/**
 * Paths served as-is, before any auth runs.
 *
 * SECURITY: the extension heuristic must never apply to /api. It is a
 * substring test, so a dot anywhere in a dynamic segment
 * (/api/rules/instances/5.) would otherwise skip authentication, setup
 * containment and the onboarding allowlist for the whole request.
 *
 * The heuristic stays for pages because Next.js serves several dotted routes
 * that the matcher does not exclude — /manifest.webmanifest, /sw.js,
 * /icon.png, /apple-icon.png — alongside everything under public/
 * (/noise.svg, /icons/*, /splash/*, /images/**). Redirecting those to /login
 * breaks PWA install and service worker registration.
 */
export const isStaticAssetPath = (pathname: string): boolean =>
    !pathname.startsWith("/api/") &&
    (pathname.startsWith("/_next") || pathname.includes(".") || pathname === "/favicon.ico");

/**
 * API routes reachable without a session cookie because they authenticate
 * themselves — hybrid session-or-API-key handlers, and the auth/setup
 * endpoints the login and wizard flows need before a session exists.
 *
 * Exact matches only. A prefix test would make /api/historyEVIL public and
 * would silently extend public status to every future subroute — that is how
 * /api/history/export/debug-fetch became unauthenticated.
 */
export const PUBLIC_API_PATHS = new Set([
    "/api/auth/plex",
    "/api/auth/logout",
    // Returns clean 401 JSON without a session — SessionGuard needs that
    // instead of a 307-to-/login HTML page, since the SW can serve the cached
    // "/" shell to a logged-out client.
    "/api/auth/me",
    "/api/setup/status",
    "/api/invites/validate", // token validated by the route
    // Hybrid auth (session or API key), enforced in each handler.
    "/api/history",
    "/api/history/export",
    "/api/stats/home",
    "/api/stats/media",
    "/api/stats/user",
    "/api/stats/graphs",
    "/api/stats/overview/summary",
    "/api/stats/overview/streaks",
    "/api/stats/overview/top-media",
]);

/** Pages that render their own logged-out state, matched per path segment. */
const PUBLIC_PAGE_PREFIXES = ["/login", "/setup", "/invite"];

export const isPublicPath = (pathname: string): boolean =>
    PUBLIC_API_PATHS.has(pathname) ||
    PUBLIC_PAGE_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
