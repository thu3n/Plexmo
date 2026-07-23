import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { isOnboardingAllowedApi } from "@/lib/onboarding-allowlist";

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Define public paths that don't require authentication
    // Note: Some API paths here (statistics, history) are "public" to the middleware (to allow API Keys)
    // but are strictly secured inside their route handlers.
    const publicPaths = [
        "/login",
        "/api/auth/plex",
        "/api/auth/logout",
        "/api/auth/me",     // Returns clean 401 JSON without a session — SessionGuard
                            // needs that instead of a 307-to-/login HTML page, since the
                            // SW can serve the cached "/" shell to a logged-out client.
        "/setup",
        "/api/setup/status",
        "/invite",            // Invite links (token validated by the route)
        "/api/invites/validate",
        "/api/history",     // Hybrid Auth (Session or API Key)

        "/api/stats",       // Hybrid Auth
    ];

    // Check if the current path is public
    const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

    // Also exclude static files and Next.js internals
    const isStaticAsset = pathname.startsWith("/_next") ||
        pathname.includes(".") || // files with extensions (images, etc) usually public
        pathname === "/favicon.ico";

    if (isStaticAsset) {
        return NextResponse.next();
    }

    const port = process.env.PORT || "3000";
    const localApiUrl = `http://127.0.0.1:${port}`;

    // Optimization: Skip setup check for setup APIs to avoid recursion/double-hits
    // STRICT SECURITY: Only allow the status check, nothing else.
    if (pathname === "/api/setup/status") {
        return NextResponse.next();
    }

    // Optimization: Check for setup cookie to avoid API spam
    const setupCookie = request.cookies.get("plexmo_setup_complete");
    let isConfigured = !!setupCookie;
    let shouldSetCookie = false;
    let staleSetupCookie = false;

    const fetchConfigured = async (): Promise<boolean | null> => {
        try {
            const setupRes = await fetch(`${localApiUrl}/api/setup/status`, { cache: 'no-store' });
            if (setupRes.ok) {
                const { configured } = await setupRes.json();
                return configured === true;
            }
        } catch {
            // Status route unreachable — leave the current belief unchanged.
        }
        return null;
    };

    if (!isConfigured) {
        const live = await fetchConfigured();
        if (live === true) {
            isConfigured = true;
            shouldSetCookie = true;
        }
    } else if (pathname.startsWith("/setup") || pathname === "/login") {
        // The 30-day setup cookie survives an instance RESET behind the same
        // URL (wiped config volume, restore to a fresh box). Trusting it here
        // would make onboarding unreachable: /setup would bounce to /login
        // forever until the user clears site storage. These two pages are cold
        // paths, so re-verify against the live status and heal the cookie.
        const live = await fetchConfigured();
        if (live === false) {
            isConfigured = false;
            staleSetupCookie = true;
        }
    }

    let response: NextResponse;
    let invalidToken = false;

    // 1. Force Setup if NOT configured
    if (!isConfigured) {
        // Allowed paths during setup: /setup, /api/*
        if (pathname.startsWith("/setup") || pathname.startsWith("/api/")) {
            response = NextResponse.next();
        } else {
            // Redirect everything else to /setup
            response = NextResponse.redirect(new URL("/setup", request.url));
        }
    }
    // 2. If Configured, Prevent access to /setup
    else if (pathname.startsWith("/setup")) {
        // console.log("[Middleware] Configured but on /setup -> Redirecting to /login");
        response = NextResponse.redirect(new URL("/login", request.url));
    }
    // 3. Normal App Logic (Auth)
    else {
        const token = request.cookies.get("token")?.value;
        let user = null;

        if (token) {
            user = await verifyToken(token);
            // A present-but-unverifiable token is dead weight (expired, or the
            // instance was reset and signs with a new secret) — delete it so
            // the browser stops resending garbage.
            invalidToken = !user;
        }

        // Onboarding sessions (invite-minted) are contained to the wizard:
        // API calls outside the exact allowlist are refused here — this
        // covers every route regardless of its internal auth style — and
        // page requests resume the wizard instead of reaching the app.
        if (user?.role === "onboarding") {
            if (pathname.startsWith("/api/")) {
                response = isOnboardingAllowedApi(pathname, request.method)
                    ? NextResponse.next()
                    : NextResponse.json({ error: "Forbidden" }, { status: 403 });
            } else if (pathname.startsWith("/invite")) {
                response = NextResponse.next();
            } else {
                response = NextResponse.redirect(new URL("/invite/continue", request.url));
            }
        }
        // If user is NOT logged in and tries to access a protected route
        else if (!user && !isPublicPath) {
            const loginUrl = new URL("/login", request.url);
            response = NextResponse.redirect(loginUrl);
        }
        // If user IS logged in and tries to access Login page -> Redirect to Dashboard
        else if (user && pathname === "/login") {
            response = NextResponse.redirect(new URL("/", request.url));
        } else {
            response = NextResponse.next();
        }
    }

    // Apply the setup cookie if we just discovered we are configured
    if (shouldSetCookie) {
        response.cookies.set("plexmo_setup_complete", "true", {
            path: "/",
            // secure: process.env.NODE_ENV === "production", // Optional: usually good, but depends on local dev HTTPS
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30 // 30 days
        });
    }
    // Self-heal browser state left over from a previous instance at this URL.
    if (staleSetupCookie) response.cookies.delete("plexmo_setup_complete");
    if (invalidToken) response.cookies.delete("token");

    return response;
}

// Configure which paths the middleware runs on
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (except api/auth which we handle manually above, wait, we want to protect other APIs!)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api/settings/import/plexmo (bypass body size limit for large imports)
         */
        "/((?!_next/static|_next/image|favicon.ico|api/settings/import/plexmo).*)",
    ],
};