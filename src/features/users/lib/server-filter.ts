"use client";

import { useSyncExternalStore } from "react";

/**
 * Users-directory view preferences (server filter, sort) are personal —
 * persisted in localStorage so they survive refreshes and the detour into a
 * user's stats page. Same useSyncExternalStore pattern as the dock
 * preference: SSR renders the default and the custom event keeps the same tab
 * in sync (the storage event only fires in OTHER tabs).
 */
const FILTER_KEY = "plexmo.users.serverFilter";
const SORT_KEY = "plexmo.users.sort";
const CHANGE_EVENT = "plexmo:users-server-filter";

const subscribe = (callback: () => void) => {
    window.addEventListener("storage", callback);
    window.addEventListener(CHANGE_EVENT, callback);
    return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(CHANGE_EVENT, callback);
    };
};

const readKey = (key: string): string => {
    try {
        return localStorage.getItem(key) ?? "";
    } catch {
        return "";
    }
};

const writeKey = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Storage blocked (private mode): the preference just won't persist.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
};

const getServerSnapshot = () => "";

function usePersistedString(key: string): [string, (value: string) => void] {
    const value = useSyncExternalStore(subscribe, () => readKey(key), getServerSnapshot);
    return [value, (next: string) => writeKey(key, next)];
}

export function useUsersServerFilter(): [string, (value: string) => void] {
    return usePersistedString(FILTER_KEY);
}

/** Raw persisted sort ("key:dir"); parse with parseSort. Empty = default. */
export function useUsersSortPreference(): [string, (value: string) => void] {
    return usePersistedString(SORT_KEY);
}
