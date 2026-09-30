import { ONE_DAY_MS } from "./user-insights-shared";

/**
 * Query-string parsing shared by the /api/stats/people/* routes. Every value
 * is untrusted: numbers are clamped, and the serverId is only a filter
 * request — each route still checks it against the caller's scope.
 */

const DEFAULT_DAYS = 30;
const MAX_DAYS = 7300;
/** Plex accountIds are numeric; legacy identities are "legacy:<name>". Only the length is bounded. */
export const MAX_ACCOUNT_ID_LENGTH = 128;

export type PeopleQuery = {
    days: number;
    serverId: string | undefined;
    since: number;
    until: number;
};

export const clampInt = (raw: string | null, fallback: number, max: number): number =>
    Math.min(max, Math.max(1, Math.floor(Number(raw)) || fallback));

export const parsePeopleQuery = (searchParams: URLSearchParams, now: number = Date.now()): PeopleQuery => {
    const days = clampInt(searchParams.get("days"), DEFAULT_DAYS, MAX_DAYS);
    const serverIdParam = searchParams.get("serverId") ?? undefined;
    return {
        days,
        serverId: serverIdParam && serverIdParam !== "all" ? serverIdParam : undefined,
        since: now - days * ONE_DAY_MS,
        until: now,
    };
};
