"use client";

import { useSyncExternalStore } from "react";

/**
 * History rows-per-page is a personal view preference — persisted in
 * localStorage so it survives refreshes instead of snapping back to the
 * default. Same useSyncExternalStore pattern as the desktop-nav and
 * users-server-filter preferences: SSR renders the default and the custom
 * event keeps the same tab in sync (the storage event only fires in OTHER
 * tabs). The stored value is validated against the allowed set so a stale or
 * hand-edited key can't push an out-of-range page size into the query.
 */
export const HISTORY_PAGE_SIZES = [25, 50, 100, 250];
const DEFAULT_PAGE_SIZE = 25;

const PAGE_SIZE_KEY = "plexmo.history.pageSize";
const CHANGE_EVENT = "plexmo:history-page-size";

const subscribe = (callback: () => void) => {
    window.addEventListener("storage", callback);
    window.addEventListener(CHANGE_EVENT, callback);
    return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(CHANGE_EVENT, callback);
    };
};

const getSnapshot = (): number => {
    const stored = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return HISTORY_PAGE_SIZES.includes(stored) ? stored : DEFAULT_PAGE_SIZE;
};

const getServerSnapshot = (): number => DEFAULT_PAGE_SIZE;

export function useHistoryPageSize(): [number, (size: number) => void] {
    const pageSize = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const setPageSize = (size: number) => {
        localStorage.setItem(PAGE_SIZE_KEY, String(size));
        window.dispatchEvent(new Event(CHANGE_EVENT));
    };
    return [pageSize, setPageSize];
}
