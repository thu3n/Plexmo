"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import useSWR from "swr";

/**
 * Client-side session guard. The service worker serves the cached "/" shell
 * instantly on cold opens — including to a logged-out client, which therefore
 * never sees the middleware's 307 to /login. This component closes that gap:
 * a clean 401 from /api/auth/me (public in middleware) triggers a full
 * navigation to /login so the server-side flow takes over. Network errors
 * (offline cold open) deliberately do NOT redirect. Renders nothing.
 */
const HTTP_UNAUTHORIZED = 401;

export const GUARD_EXEMPT_PREFIXES = ["/login", "/setup", "/invite"];

export const isGuardExempt = (pathname: string): boolean =>
    GUARD_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));

type AuthError = Error & { status?: number };

const authFetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        const error: AuthError = new Error("auth check failed");
        error.status = response.status;
        throw error;
    }
    return response.json();
};

export function SessionGuard() {
    const pathname = usePathname();
    // Same key as GlobalDock/UserMenu — SWR dedupes the request.
    const { error } = useSWR("/api/auth/me", authFetcher);
    const status = (error as AuthError | undefined)?.status;

    useEffect(() => {
        if (status !== HTTP_UNAUTHORIZED || isGuardExempt(pathname)) return;
        // Full navigation (not router.push) so middleware runs; replace avoids a
        // back-button trap into the unauthenticated shell.
        window.location.replace("/login");
    }, [status, pathname]);

    return null;
}
