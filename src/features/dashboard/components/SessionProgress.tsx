"use client";

import { useEffect, useState } from "react";
import { formatTime } from "../utils/sessionUtils";

const TICK_MS = 1000;

/**
 * Owns the per-second playback ticker. Extracted from SessionCard so the 1s
 * tick re-renders only these few nodes instead of the whole card — on iOS
 * WebKit a full-card re-render invalidated the card's backdrop-filter layers
 * every second, which was the core of the dashboard render lag.
 */
function useLiveOffset(viewOffset: number, duration: number, state: string): number {
    const [currentOffset, setCurrentOffset] = useState(viewOffset);

    useEffect(() => { setCurrentOffset(viewOffset); }, [viewOffset]);

    useEffect(() => {
        if (state !== "playing") return;
        const interval = setInterval(() => {
            setCurrentOffset((prev) => Math.min(prev + TICK_MS, duration));
        }, TICK_MS);
        return () => clearInterval(interval);
    }, [state, duration]);

    return currentOffset;
}

/** Proportional progress line; caller supplies positioning + height classes. */
export function SessionProgressBar({
    viewOffset,
    duration,
    state,
    color,
    className = "",
}: {
    viewOffset: number;
    duration: number;
    state: string;
    color: string;
    className?: string;
}) {
    const currentOffset = useLiveOffset(viewOffset, duration, state);
    const percent = duration > 0 ? Math.min(100, (currentOffset / duration) * 100) : 0;
    return (
        <div className={`w-full bg-white/5 overflow-hidden ${className}`}>
            <div
                className="absolute top-0 left-0 h-full transition-[width] duration-1000 ease-linear"
                style={{ width: `${percent}%`, backgroundColor: color }}
            />
        </div>
    );
}

/** "elapsed / total" footer text, ticking in step with the bar. */
export function SessionElapsedTime({
    viewOffset,
    duration,
    state,
}: {
    viewOffset: number;
    duration: number;
    state: string;
}) {
    const currentOffset = useLiveOffset(viewOffset, duration, state);
    return (
        <span className="font-mono opacity-80">
            {formatTime(currentOffset)} / {formatTime(duration)}
        </span>
    );
}
