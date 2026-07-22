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
    isImported?: boolean;
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
    isImported: boolean;
    servers: { serverId: string; serverName: string }[];
};
