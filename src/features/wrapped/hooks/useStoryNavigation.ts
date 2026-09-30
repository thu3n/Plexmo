"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** A card counts as "current" once this much of it is inside the strip. */
const VISIBLE_THRESHOLD = 0.6;

/**
 * Scroll-snap story strip: native swipe on touch, arrow keys and buttons on
 * desktop. The active card is tracked with an IntersectionObserver rather than
 * scroll math, so it stays right whatever the card width at each breakpoint.
 * The strip must be `position: relative` (the cards' offsetParent) for goTo.
 */
export function useStoryNavigation(count: number): {
    stripRef: RefObject<HTMLDivElement | null>;
    active: number;
    goTo: (index: number) => void;
} {
    const stripRef = useRef<HTMLDivElement | null>(null);
    const [active, setActive] = useState(0);

    useEffect(() => {
        const strip = stripRef.current;
        if (!strip) return;
        const cards = Array.from(strip.children) as HTMLElement[];
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) setActive(cards.indexOf(entry.target as HTMLElement));
                }
            },
            { root: strip, threshold: VISIBLE_THRESHOLD },
        );
        cards.forEach((card) => observer.observe(card));
        return () => observer.disconnect();
    }, [count]);

    const goTo = useCallback(
        (index: number) => {
            const strip = stripRef.current;
            const clamped = Math.max(0, Math.min(count - 1, index));
            const card = strip?.children[clamped] as HTMLElement | undefined;
            if (!strip || !card) return;
            strip.scrollTo({ left: card.offsetLeft - (strip.clientWidth - card.clientWidth) / 2, behavior: "smooth" });
        },
        [count],
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
            if (e.key === "ArrowRight") goTo(active + 1);
            if (e.key === "ArrowLeft") goTo(active - 1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [active, goTo]);

    return { stripRef, active, goTo };
}
