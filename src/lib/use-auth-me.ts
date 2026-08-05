"use client";

import useSWR from "swr";

/** Whitelisted session payload from /api/auth/me (never the Plex accessToken). */
export type AuthMeUser = {
    id: string;
    username: string;
    email: string;
    thumb: string;
    role?: string;
};

type AuthMeResponse = { user: AuthMeUser };

type AuthMeError = Error & { status?: number };

/**
 * Single fetcher for the shared "/api/auth/me" SWR key. Every consumer MUST go
 * through this hook: SWR dedupes by key, so whichever component mounts first
 * supplies the fetcher for all of them. A non-throwing fetcher here once
 * parsed the 401 body as data, which silently disarmed SessionGuard's
 * login redirect (GlobalDock mounts before it in the root layout).
 */
const authMeFetcher = async (url: string): Promise<AuthMeResponse> => {
    // no-store: iOS standalone PWAs may otherwise satisfy this from the HTTP
    // cache and keep reporting a session the server has already expired.
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
        const error: AuthMeError = new Error("auth check failed");
        error.status = response.status;
        throw error;
    }
    return response.json();
};

export function useAuthMe() {
    const { data, error, mutate } = useSWR<AuthMeResponse>("/api/auth/me", authMeFetcher);
    return {
        user: data?.user,
        /** HTTP status of a failed auth check (e.g. 401), undefined while ok/loading. */
        status: (error as AuthMeError | undefined)?.status,
        mutate,
    };
}
