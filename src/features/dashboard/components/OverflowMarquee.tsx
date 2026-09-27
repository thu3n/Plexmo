"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

// Glide speed for the peek animation; the pauses at each end are baked into
// the keyframes, so short overflows still get time to be read.
const MARQUEE_PX_PER_SECOND = 30;
const MARQUEE_MIN_DURATION_MS = 3000;

/**
 * Right-aligned value that, when clipped, glides to its end and back while the
 * surrounding card (`.group`) is hovered or tap-revealed. Overflow is measured
 * with a ResizeObserver and written straight to the DOM (data attribute + CSS
 * vars) so a resize never re-renders the memoized card.
 */
export const OverflowMarquee = ({ children }: { children: ReactNode }) => {
    const outerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const outer = outerRef.current;
        const track = trackRef.current;
        if (!outer || !track) return;

        const measure = () => {
            const overflow = track.scrollWidth - outer.clientWidth;
            if (overflow > 0) {
                const duration = Math.max(MARQUEE_MIN_DURATION_MS, (overflow / MARQUEE_PX_PER_SECOND) * 1000 * 2);
                outer.dataset.overflow = "true";
                // Full text on long-press/hover for reduced-motion users who get no glide
                outer.title = track.textContent ?? "";
                track.style.setProperty("--marquee-shift", `-${overflow}px`);
                track.style.setProperty("--marquee-duration", `${duration}ms`);
            } else {
                delete outer.dataset.overflow;
                outer.removeAttribute("title");
            }
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(outer);
        observer.observe(track);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={outerRef} className="marquee flex min-w-0 flex-1 overflow-hidden">
            {/* ml-auto right-aligns when it fits; auto margins never go negative,
                so an overflowing track spills to the right where the fade is */}
            <div ref={trackRef} className="marquee-track ml-auto flex w-max shrink-0 items-center gap-1">
                {children}
            </div>
        </div>
    );
};
