import type { DirectoryUser, UserActivity } from "../types";

/** A user with no play in this many days counts as inactive. */
export const INACTIVE_AFTER_DAYS = 30;
/** Cards rendered per "show more" step. */
export const DIRECTORY_PAGE_SIZE = 24;

const DAY_MS = 24 * 60 * 60 * 1000;

export type SortKey = "name" | "lastSeen" | "plays" | "watchTime";
export type SortDir = "asc" | "desc";
export type DirectorySort = { key: SortKey; dir: SortDir };

export const SORT_KEYS: { key: SortKey; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "lastSeen", label: "Last seen" },
    { key: "plays", label: "Plays" },
    { key: "watchTime", label: "Watch time" },
];

export const DEFAULT_SORT: DirectorySort = { key: "name", dir: "asc" };

export type DirectoryFilters = {
    search: string;
    /** Empty = all servers. */
    serverId: string;
    adminOnly: boolean;
    inactiveOnly: boolean;
};

export const EMPTY_FILTERS: Omit<DirectoryFilters, "serverId"> = {
    search: "",
    adminOnly: false,
    inactiveOnly: false,
};

/** Persisted as "key:dir"; anything unrecognised falls back to the default. */
export const parseSort = (raw: string): DirectorySort => {
    const [key, dir] = raw.split(":");
    const validKey = SORT_KEYS.some((s) => s.key === key);
    const validDir = dir === "asc" || dir === "desc";
    return validKey && validDir ? { key: key as SortKey, dir } : DEFAULT_SORT;
};

export const serializeSort = (sort: DirectorySort): string => `${sort.key}:${sort.dir}`;

/**
 * Activity summed over the memberships in view — a single server when the
 * server filter is set, otherwise every server the user belongs to.
 */
export const activityFor = (user: DirectoryUser, serverId: string): UserActivity => {
    const memberships = serverId ? user.servers.filter((s) => s.serverId === serverId) : user.servers;
    return memberships.reduce<UserActivity>(
        (acc, m) => ({
            plays: acc.plays + m.plays,
            watchSeconds: acc.watchSeconds + m.watchSeconds,
            lastPlayedAt:
                m.lastPlayedAt !== null && (acc.lastPlayedAt === null || m.lastPlayedAt > acc.lastPlayedAt)
                    ? m.lastPlayedAt
                    : acc.lastPlayedAt,
        }),
        { plays: 0, watchSeconds: 0, lastPlayedAt: null }
    );
};

export const isInactive = (activity: UserActivity, now: number): boolean =>
    activity.lastPlayedAt === null || now - activity.lastPlayedAt > INACTIVE_AFTER_DAYS * DAY_MS;

export const filterUsers = (users: DirectoryUser[], filters: DirectoryFilters, now: number): DirectoryUser[] => {
    const q = filters.search.trim().toLowerCase();
    return users.filter((user) => {
        if (filters.serverId && !user.servers.some((s) => s.serverId === filters.serverId)) return false;
        if (filters.adminOnly && !user.isAdmin) return false;
        if (filters.inactiveOnly && !isInactive(activityFor(user, filters.serverId), now)) return false;
        if (q) return user.title.toLowerCase().includes(q) || user.username.toLowerCase().includes(q);
        return true;
    });
};

const compareNumbers = (a: number, b: number) => a - b;

/**
 * Stable sort by the chosen key; ties (and never-played users) fall back to
 * name order so the list doesn't reshuffle. Users with no activity always
 * sink to the bottom for "last seen", whichever the direction.
 */
export const sortUsers = (users: DirectoryUser[], sort: DirectorySort, serverId: string): DirectoryUser[] => {
    const sign = sort.dir === "asc" ? 1 : -1;
    const byName = (a: DirectoryUser, b: DirectoryUser) => a.title.localeCompare(b.title);
    const withActivity = users.map((user) => ({ user, activity: activityFor(user, serverId) }));

    withActivity.sort((a, b) => {
        let diff = 0;
        switch (sort.key) {
            case "name":
                return sign * byName(a.user, b.user);
            case "plays":
                diff = compareNumbers(a.activity.plays, b.activity.plays);
                break;
            case "watchTime":
                diff = compareNumbers(a.activity.watchSeconds, b.activity.watchSeconds);
                break;
            case "lastSeen": {
                const aSeen = a.activity.lastPlayedAt;
                const bSeen = b.activity.lastPlayedAt;
                if (aSeen === null && bSeen === null) break;
                if (aSeen === null) return 1;
                if (bSeen === null) return -1;
                diff = compareNumbers(aSeen, bSeen);
                break;
            }
        }
        return diff !== 0 ? sign * diff : byName(a.user, b.user);
    });

    return withActivity.map((entry) => entry.user);
};
