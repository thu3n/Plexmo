"use client";

import { useEffect, useState, type RefObject } from "react";

/** Tolerance for float scroll positions / sub-pixel layout when detecting the edges. */
export const EDGE_EPSILON_PX = 2;

export type ScrollEdges = { atStart: boolean; atEnd: boolean };

export function computeScrollEdges(
    scrollLeft: number,
    clientWidth: number,
    scrollWidth: number,
): ScrollEdges {
    return {
        atStart: scrollLeft <= EDGE_EPSILON_PX,
        atEnd: scrollLeft + clientWidth >= scrollWidth - EDGE_EPSILON_PX,
    };
}

/** Maps edge state to the globals.css mask utilities — fade only where content is hidden. */
export function edgeMaskClass({ atStart, atEnd }: ScrollEdges): string {
    if (atStart && atEnd) return "";
    if (atStart) return "mask-fade-right";
    if (atEnd) return "mask-fade-left";
    return "mask-fade-both";
}

/**
 * Tracks whether a horizontal scroller sits at its start/end so edge fades can be
 * toggled dynamically (a static fade obscures the last item once scrolled fully).
 * Pass content-affecting values in `deps` (e.g. the items array) to recompute after
 * data loads. Initial state is both-edges (no fade) so SSR/first paint never masks.
 */
export function useScrollEdges<T extends HTMLElement>(
    ref: RefObject<T | null>,
    deps: readonly unknown[] = [],
): ScrollEdges {
    const [edges, setEdges] = useState<ScrollEdges>({ atStart: true, atEnd: true });

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let frame = 0;
        const update = () => {
            frame = 0;
            const next = computeScrollEdges(el.scrollLeft, el.clientWidth, el.scrollWidth);
            setEdges((prev) =>
                prev.atStart === next.atStart && prev.atEnd === next.atEnd ? prev : next,
            );
        };
        const scheduleUpdate = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };

        update();
        el.addEventListener("scroll", scheduleUpdate, { passive: true });
        const resizeObserver =
            typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleUpdate) : null;
        resizeObserver?.observe(el);

        return () => {
            el.removeEventListener("scroll", scheduleUpdate);
            resizeObserver?.disconnect();
            if (frame) cancelAnimationFrame(frame);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ref, ...deps]);

    return edges;
}
