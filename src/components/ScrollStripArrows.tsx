"use client";

import type { RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ScrollEdges } from "@/lib/use-scroll-edges";

// Fraction of the visible width advanced per press — a full page loses the
// reader's place; 80% keeps roughly one card of overlap for continuity.
const SCROLL_PAGE_FRACTION = 0.8;

const ARROW_BUTTON_CLASS =
    "absolute top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#0b0e1a]/90 text-white/70 shadow-lg transition-colors hover:bg-white/15 hover:text-white";

const prefersReducedMotion = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Edge arrows for a horizontal poster/scroll strip — the same click affordance
 * the statistics carousel cards have, for strips that otherwise only pan via
 * drag or touch. Render as a sibling of the scroller inside a `relative`
 * wrapper. Each arrow hides at its own edge, mirroring the edge fade mask.
 */
export function ScrollStripArrows<T extends HTMLElement>({
    scrollRef,
    edges,
}: {
    scrollRef: RefObject<T | null>;
    edges: ScrollEdges;
}) {
    const scrollByPage = (direction: 1 | -1) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({
            left: direction * el.clientWidth * SCROLL_PAGE_FRACTION,
            behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
    };

    return (
        <>
            {!edges.atStart && (
                <button
                    aria-label="Scroll left"
                    onClick={() => scrollByPage(-1)}
                    className={`${ARROW_BUTTON_CLASS} left-2`}
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
            )}
            {!edges.atEnd && (
                <button
                    aria-label="Scroll right"
                    onClick={() => scrollByPage(1)}
                    className={`${ARROW_BUTTON_CLASS} right-2`}
                >
                    <ChevronRight className="h-5 w-5" />
                </button>
            )}
        </>
    );
}
