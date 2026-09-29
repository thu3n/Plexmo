"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { LINK_CLASS, PANEL_CLASS } from "../lib/theme";

export { PANEL_CLASS };

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
        <section id={id} className={clsx(PANEL_CLASS, "scroll-mt-24 p-5", className)}>
            {(title || action) && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    {title && <h2 className="whitespace-nowrap text-base font-semibold text-white/90">{title}</h2>}
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
            className={`inline-flex items-center gap-1 text-xs font-medium ${LINK_CLASS}`}
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
            className={`inline-flex items-center gap-1 text-xs font-medium ${LINK_CLASS}`}
        >
            {expanded ? "Show less" : "View all"}
            <ArrowRight className={clsx("h-3 w-3 transition-transform", expanded && "-rotate-90")} />
        </button>
    );
}

/** Ranked-list row counts: the design's default, and the API maximum when expanded. */
export const DEFAULT_LIST_LIMIT = 10;
export const EXPANDED_LIMIT = 25;

export type TabOption<T extends string> = { key: T; label: string };

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
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-white/5 bg-white/5 p-0.5">
            {options.map((opt) => (
                <button
                    key={opt.key}
                    type="button"
                    onClick={() => onChange(opt.key)}
                    className={clsx(
                        "whitespace-nowrap rounded-full font-medium transition-colors",
                        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
                        opt.key === value
                            ? "bg-white text-black"
                            : "text-white/60 hover:text-white",
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

export function EmptyRow({ text = "No data for this period" }: { text?: string }) {
    return <p className="py-6 text-center text-sm text-white/40">{text}</p>;
}
