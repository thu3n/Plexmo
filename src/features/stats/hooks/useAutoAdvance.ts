"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

/** Time between automatic advances. */
export const AUTO_ADVANCE_INTERVAL_MS = 8000;
/** Quiet period after any user interaction before auto-advance resumes. */
export const INTERACTION_PAUSE_MS = 12000;
/** Fraction of the container that must be on screen before auto runs. */
export const VIEWPORT_VISIBILITY_THRESHOLD = 0.5;

/** Pure: ms from `now` until the next advance may fire (unit-tested). */
export function nextTickDelay(now: number, lastInteractionAt: number, intervalMs: number): number {
    return Math.max(intervalMs, lastInteractionAt + INTERACTION_PAUSE_MS - now);
}

/**
 * Timer for auto-advancing carousels. Used by StatCarouselCard; keep the pause
 * semantics identical for any future consumer:
 * - any user interaction (report via `pauseForInteraction`) defers the next advance
 *   by INTERACTION_PAUSE_MS,
 * - nothing advances while the tab is hidden, while the container is (mostly)
 *   off-viewport, or when the user prefers reduced motion.
 *
 * Attach `containerRef` to the element whose viewport visibility should gate the
 * timer. IntersectionObserver/matchMedia are feature-detected (absent in jsdom and
 * old browsers) and default to visible / motion-allowed.
 */
export function useAutoAdvance<T extends HTMLElement>({
    enabled,
    intervalMs = AUTO_ADVANCE_INTERVAL_MS,
    onAdvance,
}: {
    enabled: boolean;
    intervalMs?: number;
    onAdvance: () => void;
}): { containerRef: RefObject<T | null>; pauseForInteraction: () => void } {
    const containerRef = useRef<T>(null);
    const lastInteractionAt = useRef(0);
    const intersecting = useRef(true);
    const reducedMotion = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onAdvanceRef = useRef(onAdvance);
    useEffect(() => {
        onAdvanceRef.current = onAdvance;
    });

    const pauseForInteraction = useCallback(() => {
        lastInteractionAt.current = Date.now();
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const clear = () => {
            if (timer.current) {
                clearTimeout(timer.current);
                timer.current = null;
            }
        };
        const schedule = (delay: number) => {
            clear();
            timer.current = setTimeout(tick, delay);
        };
        /** (Re)start the chain honoring any recent interaction. */
        const scheduleFromNow = () =>
            schedule(nextTickDelay(Date.now(), lastInteractionAt.current, intervalMs));
        const tick = () => {
            timer.current = null;
            const now = Date.now();
            const pauseRemaining = lastInteractionAt.current + INTERACTION_PAUSE_MS - now;
            if (pauseRemaining > 0) {
                schedule(pauseRemaining);
                return;
            }
            if (!document.hidden && intersecting.current && !reducedMotion.current) {
                onAdvanceRef.current();
            }
            schedule(intervalMs);
        };

        const onVisibilityChange = () => {
            // Coming back to a hidden-for-a-while tab shouldn't advance instantly.
            if (!document.hidden) scheduleFromNow();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        let observer: IntersectionObserver | null = null;
        if (typeof IntersectionObserver !== "undefined" && containerRef.current) {
            observer = new IntersectionObserver(
                ([entry]) => {
                    const wasIntersecting = intersecting.current;
                    intersecting.current = entry.isIntersecting;
                    if (!wasIntersecting && entry.isIntersecting) scheduleFromNow();
                },
                { threshold: VIEWPORT_VISIBILITY_THRESHOLD },
            );
            observer.observe(containerRef.current);
        }

        let media: MediaQueryList | null = null;
        const onMediaChange = (event: MediaQueryListEvent) => {
            reducedMotion.current = event.matches;
        };
        if (typeof window.matchMedia === "function") {
            media = window.matchMedia("(prefers-reduced-motion: reduce)");
            reducedMotion.current = media.matches;
            media.addEventListener("change", onMediaChange);
        }

        scheduleFromNow();
        return () => {
            clear();
            document.removeEventListener("visibilitychange", onVisibilityChange);
            observer?.disconnect();
            media?.removeEventListener("change", onMediaChange);
        };
    }, [enabled, intervalMs]);

    return { containerRef, pauseForInteraction };
}
