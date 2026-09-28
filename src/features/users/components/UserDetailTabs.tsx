"use client";

import { useRef, type KeyboardEvent } from "react";

export type UserDetailTab = "stats" | "rules";

const TABS: { key: UserDetailTab; label: string }[] = [
    { key: "stats", label: "Statistics" },
    { key: "rules", label: "Rules" },
];

export const tabId = (key: UserDetailTab) => `user-tab-${key}`;
export const panelId = (key: UserDetailTab) => `user-panel-${key}`;

type Props = { active: UserDetailTab; onChange: (tab: UserDetailTab) => void };

/** WAI-ARIA tabs: roving tabindex, arrow/Home/End keys move and activate. */
export function UserDetailTabs({ active, onChange }: Props) {
    const refs = useRef<Record<UserDetailTab, HTMLButtonElement | null>>({ stats: null, rules: null });

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const index = TABS.findIndex((t) => t.key === active);
        let next = index;
        if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
        else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = TABS.length - 1;
        else return;
        e.preventDefault();
        const key = TABS[next].key;
        onChange(key);
        refs.current[key]?.focus();
    };

    return (
        <div role="tablist" aria-label="User sections" onKeyDown={onKeyDown} className="flex items-center gap-4 mb-8 border-b border-white/10">
            {TABS.map(({ key, label }) => {
                const selected = key === active;
                return (
                    <button
                        key={key}
                        ref={(el) => {
                            refs.current[key] = el;
                        }}
                        type="button"
                        role="tab"
                        id={tabId(key)}
                        aria-selected={selected}
                        aria-controls={panelId(key)}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(key)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${selected ? "border-amber-500 text-white" : "border-transparent text-white/50 hover:text-white/80"}`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
