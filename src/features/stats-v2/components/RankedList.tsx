"use client";

import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { SkeletonRows } from "@/components/Skeleton";
import { EmptyRow } from "./Panel";

export type RankedRow = {
    key: string | number;
    label: string;
    sub?: string;
    href?: string;
    icon?: ReactNode;
    /** Right-aligned value columns, in `columns` order. */
    values: string[];
    /** Drives the magnitude bar; compared against the list maximum. */
    magnitude: number;
};

/**
 * Ranked list shared by every top list: the label column takes all spare width
 * (no premature truncation), a thin one-hue bar under it shows magnitude so the
 * row's width carries data instead of dead space, values align in fixed columns.
 */
export function RankedList({
    rows,
    columns,
    unit,
    skeletonRows = 8,
}: {
    rows: RankedRow[] | undefined;
    /** Value column headers; omitted for single-value lists that use `unit`. */
    columns?: string[];
    /** Caption under a single value (e.g. "users"). */
    unit?: string;
    skeletonRows?: number;
}) {
    if (!rows) return <SkeletonRows count={skeletonRows} rowClassName="h-10 rounded-lg" />;
    if (rows.length === 0) return <EmptyRow />;

    const max = Math.max(...rows.map((r) => r.magnitude), 1);
    const valueCols = columns?.length ?? 1;
    const gridCols = valueCols === 1 ? "grid-cols-[1.5rem_minmax(0,1fr)_auto]" : "grid-cols-[1.5rem_minmax(0,1fr)_4rem_4.5rem]";

    return (
        <div>
            {columns && (
                <div className={clsx("grid gap-x-3 pb-2 text-[11px] uppercase tracking-wide text-white/40", gridCols)}>
                    <span />
                    <span />
                    {columns.map((c) => <span key={c} className="text-right">{c}</span>)}
                </div>
            )}
            <ol className="space-y-1">
                {rows.map((row, i) => (
                    <li
                        key={row.key}
                        className={clsx("grid items-center gap-x-3 rounded-lg px-0 py-1.5 transition-colors hover:bg-white/[0.03]", gridCols)}
                    >
                        <span className="text-center text-xs tabular-nums text-white/45">{i + 1}</span>
                        <div className="flex min-w-0 items-center gap-3">
                            {row.icon}
                            <div className="min-w-0 flex-1">
                                {row.href ? (
                                    <Link href={row.href} className="block truncate text-[13px] font-medium text-white hover:text-[#8aaeff]">
                                        {row.label}
                                    </Link>
                                ) : (
                                    <p className="truncate text-[13px] font-medium text-white">{row.label}</p>
                                )}
                                {row.sub && <p className="truncate text-[11px] text-white/55">{row.sub}</p>}
                                <div className="mt-1.5 h-[3px] rounded-full bg-white/[0.06]">
                                    <div
                                        className="h-full rounded-full bg-[#3987e5]"
                                        style={{ width: `${Math.max(2, (row.magnitude / max) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        {row.values.map((v, vi) => (
                            <div key={vi} className="text-right">
                                <p className={clsx("text-[13px] tabular-nums", vi === 0 ? "font-semibold text-white" : "text-white/70")}>{v}</p>
                                {unit && valueCols === 1 && <p className="text-[10px] text-white/45">{unit}</p>}
                            </div>
                        ))}
                    </li>
                ))}
            </ol>
        </div>
    );
}

/** Deterministic colored initial — stands in for per-platform brand icons. */
export function InitialBadge({ label }: { label: string }) {
    let hash = 0;
    for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
    return (
        <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: `hsl(${hash} 45% 38%)` }}
            aria-hidden
        >
            {label.charAt(0).toUpperCase()}
        </span>
    );
}
