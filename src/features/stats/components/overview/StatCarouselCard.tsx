"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { useAutoAdvance } from "../../hooks/useAutoAdvance";
import {
    STAT_CARD_ICON_TILE_CLASS,
    STAT_CARD_SHELL_CLASS,
} from "./stat-card-shell";

export type CarouselPage = { key: string; content: ReactNode };

// Read at call time via matchMedia instead of framer-motion's useReducedMotion —
// that single import was what pulled the ~110KB framer chunk onto the
// statistics route (same media-query pattern as useAutoAdvance).
const prefersReducedMotion = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ARROW_BUTTON_CLASS =
    "absolute top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#0b0e1a] text-white/60 shadow-lg transition-colors hover:bg-white/15 hover:text-white";

/**
 * Stat card with auto-advancing sub-pages: edge arrows + dots for manual paging,
 * native touch swipe via the scroll-snap track (scrollbar hidden everywhere).
 * Any interaction pauses the auto-advance; it also pauses off-viewport, in hidden
 * tabs, and under prefers-reduced-motion (all via useAutoAdvance).
 */
export function StatCarouselCard({
    label,
    icon,
    accent,
    pages,
}: {
    label: string;
    icon: ReactNode;
    accent: string;
    pages: CarouselPage[];
}) {
    const { t } = useLanguage();
    const trackRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const frame = useRef<number | null>(null);

    useEffect(() => () => {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
    }, []);

    const onScroll = () => {
        if (frame.current !== null) return;
        frame.current = requestAnimationFrame(() => {
            frame.current = null;
            const el = trackRef.current;
            if (!el || el.clientWidth === 0) return;
            setActive(Math.min(pages.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
        });
    };

    const scrollToPage = (index: number) => {
        const el = trackRef.current;
        if (el) {
            el.scrollTo({
                left: index * el.clientWidth,
                behavior: prefersReducedMotion() ? "auto" : "smooth",
            });
        }
    };

    const { containerRef, pauseForInteraction } = useAutoAdvance<HTMLDivElement>({
        enabled: pages.length > 1,
        onAdvance: () => scrollToPage((active + 1) % pages.length),
    });

    return (
        <div
            ref={containerRef}
            onPointerDownCapture={pauseForInteraction}
            onWheelCapture={pauseForInteraction}
            className={STAT_CARD_SHELL_CLASS}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold text-white/50">{label}</p>
                <div className={`${STAT_CARD_ICON_TILE_CLASS} ${accent}`}>{icon}</div>
            </div>
            <div
                ref={trackRef}
                onScroll={onScroll}
                className="mt-1 flex flex-1 snap-x snap-mandatory overflow-x-auto no-scrollbar"
            >
                {pages.map((page) => (
                    <div key={page.key} className="flex w-full shrink-0 snap-center flex-col">
                        {page.content}
                    </div>
                ))}
            </div>
            {pages.length > 1 && (
                <>
                    {/* 6px overhang: two adjacent cards' arrows must fit the 16px grid gap. */}
                    <button
                        aria-label={t("statistics.carousel.prev")}
                        onClick={() => scrollToPage((active - 1 + pages.length) % pages.length)}
                        className={`${ARROW_BUTTON_CLASS} -left-1.5`}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        aria-label={t("statistics.carousel.next")}
                        onClick={() => scrollToPage((active + 1) % pages.length)}
                        className={`${ARROW_BUTTON_CLASS} -right-1.5`}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="mt-3 flex justify-center gap-1.5">
                        {pages.map((page, i) => (
                            <button
                                key={page.key}
                                aria-label={`Page ${i + 1}`}
                                onClick={() => scrollToPage(i)}
                                className={`h-1.5 w-1.5 rounded-full transition-colors ${i === active ? "bg-white" : "bg-white/20 hover:bg-white/40"}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
