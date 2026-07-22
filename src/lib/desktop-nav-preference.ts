"use client";

import { useSyncExternalStore } from "react";

/**
 * Desktop navigation style is a personal UI preference — persisted in
 * localStorage, no server round-trip. Below lg the dock is always shown and
 * this preference has no effect; on lg+ it picks ONE of three modes:
 *   "dropdown" — nav links live in the top-right user menu
 *   "dock"     — the bottom dock stays visible on desktop
 *   "header"   — always-visible nav buttons in the page header (default)
 * Custom event keeps the same tab in sync (the storage event only fires in
 * OTHER tabs). SSR renders the default; non-default users get the same
 * post-hydration swap the old dock preference had.
 */
export type DesktopNavMode = "dropdown" | "dock" | "header";

const NAV_MODE_KEY = "plexmo.desktopNav";
// Pre-1.8.0 boolean "show dock on desktop" preference, migrated lazily.
const LEGACY_DOCK_KEY = "plexmo.dockDesktop";
const CHANGE_EVENT = "plexmo:desktop-nav-pref";

const NAV_MODES: DesktopNavMode[] = ["dropdown", "dock", "header"];

const subscribe = (callback: () => void) => {
    window.addEventListener("storage", callback);
    window.addEventListener(CHANGE_EVENT, callback);
    return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(CHANGE_EVENT, callback);
    };
};

const getSnapshot = (): DesktopNavMode => {
    const stored = localStorage.getItem(NAV_MODE_KEY) as DesktopNavMode | null;
    if (stored && NAV_MODES.includes(stored)) return stored;
    return localStorage.getItem(LEGACY_DOCK_KEY) === "1" ? "dock" : "header";
};

const getServerSnapshot = (): DesktopNavMode => "header";

export function useDesktopNavMode(): [DesktopNavMode, (mode: DesktopNavMode) => void] {
    const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const setMode = (value: DesktopNavMode) => {
        localStorage.setItem(NAV_MODE_KEY, value);
        localStorage.removeItem(LEGACY_DOCK_KEY);
        window.dispatchEvent(new Event(CHANGE_EVENT));
    };
    return [mode, setMode];
}
