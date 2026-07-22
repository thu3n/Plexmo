import type { DirectoryUser, DirectoryUserRow } from "../types";

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
                isImported: Boolean(row.isImported),
                servers: [{ serverId: row.serverId, serverName: row.serverName }],
            });
            continue;
        }
        existing.isAdmin = existing.isAdmin || Boolean(row.isAdmin);
        existing.isImported = existing.isImported || Boolean(row.isImported);
        // Prefer a row that actually has a thumb/title over an empty one.
        if (!existing.thumb && row.thumb) existing.thumb = row.thumb;
        if (!existing.title && (row.title || row.username)) existing.title = row.title || row.username;
        if (!existing.servers.some((s) => s.serverId === row.serverId)) {
            existing.servers.push({ serverId: row.serverId, serverName: row.serverName });
        }
    }

    return Array.from(byAccount.values());
};
