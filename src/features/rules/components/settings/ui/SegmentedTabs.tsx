import { useId, useRef, type KeyboardEvent } from "react";
import clsx from "clsx";

export interface SegmentedTab<T extends string> {
    value: T;
    label: string;
    /** Shows a red dot, e.g. when the tab holds a validation error. */
    hasError?: boolean;
}

interface SegmentedTabsProps<T extends string> {
    tabs: SegmentedTab<T>[];
    value: T;
    onChange: (value: T) => void;
    label: string;
    className?: string;
    tabClassName?: string;
    /** Prefix for tab/panel ids; panels use `${idBase}-panel-${value}`. */
    idBase?: string;
}

export const tabPanelId = (idBase: string, value: string) => `${idBase}-panel-${value}`;
export const tabId = (idBase: string, value: string) => `${idBase}-tab-${value}`;

/**
 * ARIA tablist with roving tabindex and Arrow/Home/End navigation, styled as
 * the pill switcher the settings pages already use.
 */
export default function SegmentedTabs<T extends string>({
    tabs,
    value,
    onChange,
    label,
    className,
    tabClassName = "px-4 py-2",
    idBase,
}: SegmentedTabsProps<T>) {
    const generated = useId();
    const base = idBase ?? generated;
    const refs = useRef<(HTMLButtonElement | null)[]>([]);

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const current = tabs.findIndex((t) => t.value === value);
        let next = current;
        if (e.key === "ArrowRight") next = (current + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        else return;
        e.preventDefault();
        onChange(tabs[next].value);
        refs.current[next]?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label={label}
            onKeyDown={onKeyDown}
            className={clsx("flex items-center gap-1 bg-black/40 p-1 rounded-xl", className)}
        >
            {tabs.map((tab, i) => {
                const selected = tab.value === value;
                return (
                    <button
                        key={tab.value}
                        ref={(el) => {
                            refs.current[i] = el;
                        }}
                        type="button"
                        role="tab"
                        id={tabId(base, tab.value)}
                        aria-selected={selected}
                        aria-controls={tabPanelId(base, tab.value)}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(tab.value)}
                        className={clsx(
                            "relative text-sm font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
                            tabClassName,
                            selected ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60 hover:bg-white/5"
                        )}
                    >
                        {tab.label}
                        {tab.hasError && (
                            <>
                                <span aria-hidden className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span className="sr-only"> (has errors)</span>
                            </>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
