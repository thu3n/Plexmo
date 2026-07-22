"use client";

import { useSyncExternalStore } from "react";

/**
 * The users-directory server filter is a personal view preference — persisted
 * in localStorage so it survives refreshes and the detour into a user's stats
 * page. Same useSyncExternalStore pattern as the dock preference: SSR renders
 * the default ("All Servers") and the custom event keeps the same tab in sync
 * (the storage event only fires in OTHER tabs).
 */
const FILTER_KEY = "plexmo.users.serverFilter";
const CHANGE_EVENT = "plexmo:users-server-filter";

const subscribe = (callback: () => void) => {
    window.addEventListener("storage", callback);
    window.addEventListener(CHANGE_EVENT, callback);
    return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(CHANGE_EVENT, callback);
    };
};

const getSnapshot = () => localStorage.getItem(FILTER_KEY) ?? "";

const getServerSnapshot = () => "";

export function useUsersServerFilter(): [string, (value: string) => void] {
    const serverId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const setServerId = (value: string) => {
        localStorage.setItem(FILTER_KEY, value);
        window.dispatchEvent(new Event(CHANGE_EVENT));
    };
    return [serverId, setServerId];
}
