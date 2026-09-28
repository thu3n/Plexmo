import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import { CheckCircle2, Search } from "lucide-react";
import type { RuleUserAssignment } from "@/features/rules/types";

/** Rendered options cap; the rest are summarised as "N more" to keep the DOM light. */
export const MAX_VISIBLE_OPTIONS = 50;

interface UserComboboxProps {
    users?: RuleUserAssignment[];
    selected: RuleUserAssignment | null;
    onSelect: (user: RuleUserAssignment) => void;
    onClear: () => void;
}

/** ARIA 1.2 combobox: typing filters, Arrow keys move, Enter selects, Escape closes. */
export default function UserCombobox({ users, selected, onSelect, onClear }: UserComboboxProps) {
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const listboxId = useId();
    const optionId = (i: number) => `${listboxId}-opt-${i}`;

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? (users ?? []).filter((u) => u.username.toLowerCase().includes(q)) : [];
    }, [users, query]);
    const visible = matches.slice(0, MAX_VISIBLE_OPTIONS);
    const hiddenCount = matches.length - visible.length;
    const open = !!query.trim() && !selected;

    // Keep the keyboard-highlighted option visible inside the scrolling listbox.
    useEffect(() => {
        if (open) document.getElementById(`${listboxId}-opt-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
    }, [open, activeIndex, listboxId]);

    const choose = (user: RuleUserAssignment) => {
        setQuery("");
        setActiveIndex(0);
        onSelect(user);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (!open) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, visible.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && visible[activeIndex]) {
            e.preventDefault();
            choose(visible[activeIndex]);
        } else if (e.key === "Escape") {
            setQuery("");
        }
    };

    return (
        <div className="relative max-w-md">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" aria-hidden />
                <input
                    role="combobox"
                    aria-label="Search user to debug"
                    aria-expanded={open}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={open && visible[activeIndex] ? optionId(activeIndex) : undefined}
                    value={selected ? selected.username : query}
                    onChange={(e) => {
                        if (selected) onClear();
                        setQuery(e.target.value);
                        setActiveIndex(0);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="Search user to debug..."
                    className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-16 py-3 text-white focus:border-amber-500 focus:outline-none placeholder:text-white/20"
                />
                {selected && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery("");
                            onClear();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 hover:text-white"
                    >
                        Clear
                    </button>
                )}
            </div>

            {open && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <ul id={listboxId} role="listbox" aria-label="Users" className="max-h-72 overflow-y-auto custom-scrollbar">
                        {visible.map((u, i) => (
                            <li
                                key={u.userId}
                                id={optionId(i)}
                                role="option"
                                aria-selected={i === activeIndex}
                                // mousedown so the input keeps focus through the selection
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    choose(u);
                                }}
                                onMouseEnter={() => setActiveIndex(i)}
                                className={clsx(
                                    "px-4 py-3 cursor-pointer flex items-center justify-between",
                                    i === activeIndex && "bg-white/5"
                                )}
                            >
                                <div className="min-w-0">
                                    <div className={clsx("font-medium truncate", i === activeIndex ? "text-amber-500" : "text-white")}>{u.username}</div>
                                    <div className="text-xs text-white/40 truncate">{u.serverNames}</div>
                                </div>
                                <CheckCircle2 className={clsx("w-4 h-4 shrink-0", i === activeIndex ? "text-amber-500" : "text-transparent")} aria-hidden />
                            </li>
                        ))}
                    </ul>
                    {matches.length === 0 && <div className="p-4 text-center text-white/40 text-sm">No users found</div>}
                    {hiddenCount > 0 && (
                        <div className="px-4 py-2 text-xs text-white/40 border-t border-white/5">
                            {hiddenCount} more — keep typing to narrow the list
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
