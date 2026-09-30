import { isOwnerLike, type AccessScope } from "../authz";

/**
 * Who may see whose Wrapped. Pure so the policy is unit-tested apart from the
 * route. A viewer is pinned to their own account id; naming another user is
 * refused outright (403) instead of silently showing their own recap, so a
 * crafted link can never be mistaken for access.
 */

/** Plex launched in 2008 — nothing to recap before it; also bounds the year param. */
export const MIN_WRAPPED_YEAR = 2008;
const MAX_USER_ID_LENGTH = 128;

type Caller = { id: string; scope: AccessScope };

export type WrappedTarget =
    | { ok: true; userId: string; year: number; canPickUser: boolean }
    | { ok: false; status: 400 | 403; error: string };

const parseYear = (raw: string | null, now: Date): number | null => {
    const current = now.getFullYear();
    if (raw === null || raw === "") return current;
    if (!/^\d{4}$/.test(raw)) return null;
    const year = Number(raw);
    return year >= MIN_WRAPPED_YEAR && year <= current ? year : null;
};

export const resolveWrappedTarget = (
    caller: Caller,
    rawUser: string | null,
    rawYear: string | null,
    now: Date,
): WrappedTarget => {
    const year = parseYear(rawYear, now);
    if (year === null) return { ok: false, status: 400, error: "Invalid year" };

    const requested = rawUser?.trim() || null;
    if (requested && requested.length > MAX_USER_ID_LENGTH) {
        return { ok: false, status: 400, error: "Invalid user" };
    }

    const isApiKey = caller.scope.role === "api";
    const canPickUser = isOwnerLike(caller) || isApiKey;

    if (isApiKey && !requested) {
        // An API key has no account of its own to default to.
        return { ok: false, status: 400, error: "user is required for API key requests" };
    }
    if (requested && requested !== caller.id && !canPickUser) {
        return { ok: false, status: 403, error: "Forbidden: you can only view your own Wrapped" };
    }
    return { ok: true, userId: requested ?? caller.id, year, canPickUser };
};
