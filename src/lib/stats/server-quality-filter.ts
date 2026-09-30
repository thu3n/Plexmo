/**
 * Shared window + scope filter for the server-quality stats. Mirrors the
 * graph-stats filter: `allowedServerIds` is the authorization scope (a revoked
 * scope arrives as [NO_SERVER_ID], never []), `serverId` the UI's filter.
 */

export type QualityParams = {
    since: number;
    until?: number;
    serverId?: string;
    allowedServerIds?: string[];
};

export const WAN_LOCATION = "wan";

export const buildQualityFilter = ({ since, until, serverId, allowedServerIds }: QualityParams) => {
    const conditions: string[] = ["h.startTime >= ?"];
    const args: (string | number)[] = [since];

    if (until !== undefined) {
        conditions.push("h.startTime < ?");
        args.push(until);
    }
    if (allowedServerIds && allowedServerIds.length > 0) {
        conditions.push(`h.serverId IN (${allowedServerIds.map(() => "?").join(",")})`);
        args.push(...allowedServerIds);
    }
    if (serverId && serverId !== "all") {
        conditions.push("h.serverId = ?");
        args.push(serverId);
    }
    return { where: conditions.join(" AND "), args };
};
