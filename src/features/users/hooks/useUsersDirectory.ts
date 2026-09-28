"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetchJsonOrThrow, requestJson } from "@/lib/swr-fetch";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import type { PublicServer } from "@/lib/servers";
import type { DirectoryUserRow } from "../types";
import { groupUsers } from "../lib/groupUsers";
import { useUsersServerFilter, useUsersSortPreference } from "../lib/server-filter";
import {
    activityFor,
    DIRECTORY_PAGE_SIZE,
    EMPTY_FILTERS,
    filterUsers,
    parseSort,
    serializeSort,
    sortUsers,
    type DirectoryFilters,
    type DirectorySort,
} from "../lib/directory-query";

type ToggleFilter = "adminOnly" | "inactiveOnly";

/** Data, view state and the Plex sync action behind the users directory. */
export function useUsersDirectory() {
    const { toast } = useFeedback();
    const usersSwr = useSWR<{ users: DirectoryUserRow[] }>("/api/users", fetchJsonOrThrow);
    const { data: serversData } = useSWR<{ servers: PublicServer[] }>("/api/servers", fetchJsonOrThrow);

    const [storedServerId, setServerId] = useUsersServerFilter();
    const [storedSort, setStoredSort] = useUsersSortPreference();
    const [localFilters, setLocalFilters] = useState(EMPTY_FILTERS);
    const [visibleCount, setVisibleCount] = useState(DIRECTORY_PAGE_SIZE);
    const [isSyncing, setIsSyncing] = useState(false);
    // Captured once per mount: "inactive" is a coarse day-scale window, and a
    // render-time Date.now() would make the filter impure.
    const [now] = useState(() => Date.now());

    // A persisted id whose server has since been removed falls back to "All
    // Servers" instead of silently filtering every user out.
    const serverId =
        serversData && !serversData.servers.some((s) => s.id === storedServerId) ? "" : storedServerId;
    const sort = useMemo(() => parseSort(storedSort), [storedSort]);
    const filters = useMemo<DirectoryFilters>(() => ({ ...localFilters, serverId }), [localFilters, serverId]);

    const rows = usersSwr.data?.users;
    const users = useMemo(() => groupUsers(rows ?? []), [rows]);
    const visibleUsers = useMemo(
        () => sortUsers(filterUsers(users, filters, now), sort, serverId),
        [users, filters, sort, serverId, now]
    );

    // Any view change starts the list from the first page again.
    const resetPaging = () => setVisibleCount(DIRECTORY_PAGE_SIZE);

    const setSearch = (search: string) => {
        setLocalFilters((prev) => ({ ...prev, search }));
        resetPaging();
    };
    const toggleFilter = (key: ToggleFilter) => {
        setLocalFilters((prev) => ({ ...prev, [key]: !prev[key] }));
        resetPaging();
    };
    const changeServer = (id: string) => {
        setServerId(id);
        resetPaging();
    };
    const setSort = (next: DirectorySort) => {
        setStoredSort(serializeSort(next));
        resetPaging();
    };
    const resetFilters = () => {
        setLocalFilters(EMPTY_FILTERS);
        setServerId("");
        resetPaging();
    };

    // Non-destructive (it only upserts what Plex reports), so no confirm step.
    const syncFromPlex = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            const result = await requestJson<{ count: number }>("/api/users", { method: "POST" });
            await usersSwr.mutate();
            toast(`Synced ${result.count} server membership${result.count === 1 ? "" : "s"} from Plex.`);
        } catch (err) {
            toast(errorMessage(err, "Failed to sync users from Plex."), "error");
        } finally {
            setIsSyncing(false);
        }
    };

    return {
        servers: serversData?.servers ?? [],
        totalUsers: users.length,
        isLoading: usersSwr.isLoading,
        error: usersSwr.error as Error | undefined,
        retry: () => usersSwr.mutate(),
        filters,
        sort,
        matchedCount: visibleUsers.length,
        now,
        shownUsers: visibleUsers
            .slice(0, visibleCount)
            .map((user) => ({ user, activity: activityFor(user, serverId) })),
        hasMore: visibleUsers.length > visibleCount,
        showMore: () => setVisibleCount((n) => n + DIRECTORY_PAGE_SIZE),
        setSearch,
        toggleFilter,
        changeServer,
        setSort,
        resetFilters,
        syncFromPlex,
        isSyncing,
    };
}

export type UsersDirectoryState = ReturnType<typeof useUsersDirectory>;
