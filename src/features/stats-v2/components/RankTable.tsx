"use client";

import type { ReactNode } from "react";
import { SkeletonRows } from "@/components/Skeleton";
import { EmptyRow } from "./Panel";

export type RankRow = { key: string; icon?: ReactNode; label: string; cells: string[] };

/** Rank · label · numeric columns — the users / platforms / devices tables. */
export function RankTable({
    columns,
    rows,
    ranked = true,
    dense = false,
}: {
    columns: string[];
    rows: RankRow[] | undefined;
    ranked?: boolean;
    dense?: boolean;
}) {
    if (!rows) return <SkeletonRows count={6} rowClassName="h-5 rounded" />;
    if (rows.length === 0) return <EmptyRow />;

    const text = dense ? "text-[9px]" : "text-[10px]";
    return (
        <table className={`w-full ${text} text-white`}>
            <thead>
                <tr className="text-white/60">
                    {ranked && <th className="w-5 pb-1.5 text-left font-normal" />}
                    {columns.map((col, i) => (
                        <th key={col} className={`pb-1.5 font-normal ${i === 0 ? "text-left" : "text-right"}`}>{col}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) => (
                    <tr key={row.key}>
                        {ranked && <td className="py-[3px] text-white/80">{i + 1}</td>}
                        <td className="max-w-0 py-[3px]">
                            <span className="flex items-center gap-2">
                                {row.icon}
                                <span className="truncate">{row.label}</span>
                            </span>
                        </td>
                        {row.cells.map((cell, ci) => (
                            <td key={ci} className="whitespace-nowrap py-[3px] pl-3 text-right tabular-nums">{cell}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/** Deterministic colored initial — stands in for per-platform brand icons. */
export function InitialBadge({ label }: { label: string }) {
    let hash = 0;
    for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
    return (
        <span
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[7px] font-bold text-white"
            style={{ backgroundColor: `hsl(${hash} 55% 45%)` }}
            aria-hidden
        >
            {label.charAt(0).toUpperCase()}
        </span>
    );
}
