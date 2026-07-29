import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { PUBLIC_API_PATHS } from "@/lib/middleware-paths";

/**
 * Static guard coverage. Middleware is the outer gate, but it only proves a
 * caller has *a* session — it cannot tell an owner from an invited viewer, and
 * a matcher exemption or a setup-mode branch can take it out of the path
 * entirely. Every route therefore has to make its own authorization decision.
 *
 * A new unguarded route fails here instead of waiting for the next audit.
 */

const APP_ROOT = resolve(__dirname, "..", "app");

const GUARD_MARKERS = [
    "requireOwner",
    "authorizeApiKeyOrSession",
    "validateApiKey",
    "isOwnerLike",
    "verifyToken",
];

/**
 * Routes deliberately reachable WITHOUT a session. Each either needs to answer
 * before a session can exist, or validates its own bearer token. Middleware
 * must agree — see the PUBLIC_API_PATHS assertion below.
 */
const PUBLIC_ROUTES = new Set([
    "/api/auth/logout", // clears the cookie; nothing to authorize
    "/api/setup/status", // middleware bootstraps from this
    "/api/invites/validate", // the invite token is the credential
]);

/**
 * Routes where middleware's session check IS the whole authorization story:
 * they expose nothing beyond what any authenticated user may already see, and
 * touch neither instance data nor credentials.
 */
const SESSION_ONLY_ROUTES = new Set([
    "/api/version", // build metadata only
    "/api/avatar-fallback", // initials SVG generated from the ?name param
]);

const EXEMPT_ROUTES = new Set([...PUBLIC_ROUTES, ...SESSION_ONLY_ROUTES]);

const collectRouteFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return collectRouteFiles(full);
        return entry.name === "route.ts" ? [full] : [];
    });

/** File path -> request path, e.g. src/app/api/jobs/route.ts -> /api/jobs */
const toRoutePath = (file: string): string =>
    `/${file
        .slice(APP_ROOT.length + 1)
        .split(sep)
        .slice(0, -1)
        .join("/")}`.replace(/\/$/, "");

describe("API route authorization coverage", () => {
    // Walks all of src/app, not just src/app/api: route handlers also live
    // under page namespaces (/library/metadata/[...path]), and the api-only
    // sweep is exactly why the image proxy there kept leaking a Plex token.
    const routeFiles = collectRouteFiles(APP_ROOT);

    it("finds the API routes", () => {
        expect(routeFiles.length).toBeGreaterThan(40);
    });

    it("covers route handlers outside /api too", () => {
        expect(routeFiles.map(toRoutePath)).toContain("/library/metadata/[...path]");
    });

    it("every route either authorizes or is a documented public route", () => {
        const unguarded = routeFiles
            .filter((file) => {
                const source = readFileSync(file, "utf8");
                return !GUARD_MARKERS.some((marker) => source.includes(marker));
            })
            .map(toRoutePath)
            .filter((route) => !EXEMPT_ROUTES.has(route));

        expect(unguarded).toEqual([]);
    });

    it("keeps the exemption lists honest — every entry still exists", () => {
        const routes = new Set(routeFiles.map(toRoutePath));
        for (const exempt of EXEMPT_ROUTES) {
            expect(routes).toContain(exempt);
        }
    });

    it("middleware agrees on which routes need no session", () => {
        // Drift here is silent: a route listed as public in this file but
        // absent from PUBLIC_API_PATHS reads as unauthenticated while
        // middleware actually 307s it — which is how /api/image ended up
        // documented as a login-shell route it could never serve.
        for (const publicRoute of PUBLIC_ROUTES) {
            expect(PUBLIC_API_PATHS.has(publicRoute)).toBe(true);
        }
        for (const sessionOnly of SESSION_ONLY_ROUTES) {
            expect(PUBLIC_API_PATHS.has(sessionOnly)).toBe(false);
        }
    });
});
