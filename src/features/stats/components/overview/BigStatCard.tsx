"use client";

import type { ReactNode } from "react";
import {
    STAT_CARD_ICON_TILE_CLASS,
    STAT_CARD_SHELL_CLASS,
    STAT_CARD_VALUE_CLASS,
} from "./stat-card-shell";

/** Overview stat card: label + accent icon top, big value, sub-lines pinned to the bottom. */
export function BigStatCard({
    label,
    value,
    subline,
    detail,
    icon,
    accent,
}: {
    label: string;
    value: ReactNode;
    subline?: ReactNode;
    detail?: ReactNode;
    icon: ReactNode;
    /** Text color class for the icon, e.g. "text-amber-400". */
    accent: string;
}) {
    return (
        <div className={STAT_CARD_SHELL_CLASS}>
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold text-white/50">{label}</p>
                <div className={`${STAT_CARD_ICON_TILE_CLASS} ${accent}`}>{icon}</div>
            </div>
            <p className={STAT_CARD_VALUE_CLASS}>{value}</p>
            <div className="mt-auto pt-2">
                {subline && <p className="text-xs text-white/40">{subline}</p>}
                {detail && <p className="mt-0.5 text-[10px] font-mono text-white/30">{detail}</p>}
            </div>
        </div>
    );
}
