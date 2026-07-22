"use client";

import { useSyncExternalStore } from "react";

const DEFAULT_THRESHOLD = 10;

/**
 * True once the window has scrolled past the threshold — drives the
 * "detached" backdrop styling on sticky filter bars. useSyncExternalStore
 * keeps it SSR-safe (server renders the at-rest state) and avoids the
 * setState-in-effect lint rule the hand-rolled listeners trip.
 */
export function useScrolled(threshold: number = DEFAULT_THRESHOLD): boolean {
    return useSyncExternalStore(
        (callback) => {
            window.addEventListener("scroll", callback, { passive: true });
            return () => window.removeEventListener("scroll", callback);
        },
        () => window.scrollY > threshold,
        () => false
    );
}
