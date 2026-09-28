/** One row per (accountId, server membership) as returned by GET /api/users. */
export type DirectoryUserRow = {
    id: string; // canonical accountId
    title: string;
    username: string;
    email: string;
    thumb: string;
    serverId: string;
    serverName: string;
    isAdmin?: boolean;
    /** Activity on THIS server (user_activity_summary bucket). */
    plays?: number;
    watchSeconds?: number;
    /** Epoch ms of the latest play on this server; null if never played. */
    lastPlayedAt?: number | null;
};

/** One server membership of a canonical identity, with that server's activity. */
export type DirectoryMembership = {
    serverId: string;
    serverName: string;
    plays: number;
    watchSeconds: number;
    lastPlayedAt: number | null;
};

/** One entry per canonical identity, memberships collapsed. */
export type DirectoryUser = {
    accountId: string;
    title: string;
    username: string;
    email: string;
    thumb: string | null;
    /** Admin on ANY server. */
    isAdmin: boolean;
    servers: DirectoryMembership[];
};

/** Activity totals for a user, summed over the memberships in view. */
export type UserActivity = {
    plays: number;
    watchSeconds: number;
    lastPlayedAt: number | null;
};
