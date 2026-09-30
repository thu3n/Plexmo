import type { AuthorizedUser } from "../auth-guard";
import { canAccessServer, scopedServerIds } from "../authz";

/**
 * Shared query-param parsing for /api/stats/quality/* GET routes. Each route
 * still authenticates itself (the guard test requires it); this only turns an
 * authorized user + URL into a validated window and scope.
 */

export const QUALITY_DEFAULT_DAYS = 30;
export const QUALITY_MAX_DAYS = 7300;
export const QUALITY_MAX_LIMIT = 25;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type QualityRequest = {
    days: number;
    since: number;
    until: number;
    limit: number;
    serverId: string | undefined;
    allowedServerIds: string[] | undefined;
};

export type QualityRequestResult = { ok: true; value: QualityRequest } | { ok: false; status: number; error: string };

export const parseQualityRequest = (
    user: AuthorizedUser,
    url: string,
    defaultLimit: number,
    now: number = Date.now(),
): QualityRequestResult => {
    const { searchParams } = new URL(url);
    const days = Math.min(QUALITY_MAX_DAYS, Math.max(1, Math.floor(Number(searchParams.get("days"))) || QUALITY_DEFAULT_DAYS));
    const limit = Math.min(QUALITY_MAX_LIMIT, Math.max(1, Math.floor(Number(searchParams.get("limit"))) || defaultLimit));
    const serverIdParam = searchParams.get("serverId") ?? undefined;
    const serverId = serverIdParam && serverIdParam !== "all" ? serverIdParam : undefined;

    if (serverId && !canAccessServer(user.scope, serverId)) {
        return { ok: false, status: 403, error: "Forbidden: server outside your scope" };
    }
    return {
        ok: true,
        value: {
            days,
            since: now - days * ONE_DAY_MS,
            until: now,
            limit,
            serverId,
            allowedServerIds: scopedServerIds(user.scope),
        },
    };
};
