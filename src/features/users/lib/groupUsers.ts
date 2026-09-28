import type { DirectoryMembership, DirectoryUser, DirectoryUserRow } from "../types";

const toMembership = (row: DirectoryUserRow): DirectoryMembership => ({
    serverId: row.serverId,
    serverName: row.serverName,
    plays: row.plays ?? 0,
    watchSeconds: row.watchSeconds ?? 0,
    // 0 is the summary's IFNULL sentinel, not a real 1970 play.
    lastPlayedAt: row.lastPlayedAt || null,
});

/**
 * Collapse per-(user, server) membership rows into one entry per canonical
 * identity (accountId). Display-only — imports still operate on the raw rows.
 */
export const groupUsers = (rows: DirectoryUserRow[]): DirectoryUser[] => {
    const byAccount = new Map<string, DirectoryUser>();

    for (const row of rows) {
        const existing = byAccount.get(row.id);
        if (!existing) {
            byAccount.set(row.id, {
                accountId: row.id,
                title: row.title || row.username,
                username: row.username,
                email: row.email || "",
                thumb: row.thumb || null,
                isAdmin: Boolean(row.isAdmin),
                servers: [toMembership(row)],
            });
            continue;
        }
        existing.isAdmin = existing.isAdmin || Boolean(row.isAdmin);
        // Prefer a row that actually has a thumb/title over an empty one.
        if (!existing.thumb && row.thumb) existing.thumb = row.thumb;
        if (!existing.title && (row.title || row.username)) existing.title = row.title || row.username;
        if (!existing.servers.some((s) => s.serverId === row.serverId)) {
            existing.servers.push(toMembership(row));
        }
    }

    return Array.from(byAccount.values());
};
