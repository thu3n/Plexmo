"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthMe } from "@/lib/use-auth-me";

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

export function SessionGuard() {
    const pathname = usePathname();
    // Shared key AND shared fetcher with GlobalDock/UserMenu (useAuthMe) — a
    // divergent non-throwing fetcher on this key once won SWR's dedupe race
    // and swallowed the 401 this guard depends on.
    const { status } = useAuthMe();

    useEffect(() => {
        if (status !== HTTP_UNAUTHORIZED || isGuardExempt(pathname)) return;
        // Full navigation (not router.push) so middleware runs; replace avoids a
        // back-button trap into the unauthenticated shell.
        window.location.replace("/login");
    }, [status, pathname]);

    return null;
}
