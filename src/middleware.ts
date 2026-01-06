import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/jwt";

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Define public paths that don't require authentication
    const publicPaths = [
        "/login",
        "/api/auth/plex",
        "/api/auth/logout",
        "/setup",
        "/api/auth/maintenance",
        "/api/setup/status",
        "/api/history/export",
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
    if (pathname.startsWith("/api/setup")) {
        return NextResponse.next();
    }

    // Optimization: Check for setup cookie to avoid API spam
    const setupCookie = request.cookies.get("plexmo_setup_complete");
    let isConfigured = !!setupCookie;
    let shouldSetCookie = false;

    if (!isConfigured) {
        try {
            const setupRes = await fetch(`${localApiUrl}/api/setup/status`, { cache: 'no-store' }); // Disable cache
            if (setupRes.ok) {
                const { configured } = await setupRes.json();
                // console.log(`[Middleware] Setup Check: Configured=${configured}`);
                isConfigured = configured;
                if (configured) {
                    shouldSetCookie = true;
                }
            } else {
                // console.log(`[Middleware] Setup Check Failed: Status ${setupRes.status}`);
            }
        } catch (e) {
            // console.log("[Middleware] Setup Check Exception:", e);
        }
    }

    let response: NextResponse;

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
        }

        // If user is NOT logged in and tries to access a protected route
        if (!user && !isPublicPath) {
            // CHECK MAINTENANCE MODE
            // Note: This fetch might still happen often for unauthenticated users. 
            // Could consider caching this too, but less critical than setup check which hits everyone.
            let accessAllowed = false;
            try {
                const maintenanceRes = await fetch(`${localApiUrl}/api/auth/maintenance`);
                if (maintenanceRes.ok) {
                    const { active } = await maintenanceRes.json();
                    if (active) {
                        accessAllowed = true;
                    }
                }
            } catch (e) {
                // console.error("Middleware Maintenance Check Failed", e);
            }

            if (accessAllowed) {
                response = NextResponse.next();
            } else {
                const loginUrl = new URL("/login", request.url);
                response = NextResponse.redirect(loginUrl);
            }
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