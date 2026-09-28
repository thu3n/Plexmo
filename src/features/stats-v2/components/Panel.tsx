"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

/** Navy card surface shared by every v2 panel. */
export const PANEL_CLASS = "rounded-xl border border-[#1b2742] bg-[#0f1729] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]";

export function Panel({
    id,
    title,
    action,
    className,
    children,
}: {
    id?: string;
    title?: string;
    action?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section id={id} className={clsx(PANEL_CLASS, "scroll-mt-24 p-4", className)}>
            {(title || action) && (
                <div className="mb-3 flex items-center justify-between gap-2">
                    {title && <h2 className="text-[15px] font-semibold text-white">{title}</h2>}
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}

export function ViewAll({ href, label = "View all" }: { href: string; label?: string }) {
    return (
        <Link
            href={href}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5b8cff] hover:text-[#8aaeff]"
        >
            {label}
            <ArrowRight className="h-3 w-3" />
        </Link>
    );
}

/** In-place "View all" for ranked lists: expands to the API's max instead of navigating away. */
export function ExpandToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5b8cff] hover:text-[#8aaeff]"
        >
            {expanded ? "Show less" : "View all"}
            <ArrowRight className={clsx("h-3 w-3 transition-transform", expanded && "-rotate-90")} />
        </button>
    );
}

/** Ranked-list row counts: the design's default, and the API maximum when expanded. */
export const DEFAULT_LIST_LIMIT = 10;
export const EXPANDED_LIMIT = 25;

export type TabOption<T extends string> = { key: T; label: string; disabled?: boolean };

/** The small segmented control used in panel headers (Plays / Watch time / …). */
export function Tabs<T extends string>({
    options,
    value,
    onChange,
    size = "md",
}: {
    options: TabOption<T>[];
    value: T;
    onChange: (key: T) => void;
    size?: "sm" | "md";
}) {
    return (
        <div className="flex items-center gap-0.5 rounded-lg border border-[#1b2742] bg-[#0b1222] p-0.5">
            {options.map((opt) => (
                <button
                    key={opt.key}
                    type="button"
                    disabled={opt.disabled}
                    title={opt.disabled ? "Not available yet" : undefined}
                    onClick={() => onChange(opt.key)}
                    className={clsx(
                        "rounded-md font-medium transition-colors",
                        size === "sm" ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs",
                        opt.key === value
                            ? "bg-[#1f4fd1] text-white"
                            : "text-white/60 hover:text-white",
                        opt.disabled && "cursor-not-allowed opacity-40 hover:text-white/60",
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

export function EmptyRow({ text = "No data for this period" }: { text?: string }) {
    return <p className="py-6 text-center text-xs text-white/40">{text}</p>;
}
