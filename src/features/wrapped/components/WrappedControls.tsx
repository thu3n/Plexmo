"use client";

import type { WrappedPerson } from "@/lib/stats/wrapped-people";

const SELECT_CLASS =
    "min-w-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 outline-none focus:border-amber-400/50 [&>option]:bg-slate-900";

/** Year picker for everyone; the person picker only renders for owners (API decides via canPickUser). */
export function WrappedControls({
    year,
    years,
    userId,
    people,
    onSelect,
}: {
    year: number;
    years: number[];
    userId: string;
    people: WrappedPerson[] | null;
    onSelect: (next: { user?: string; year?: number }) => void;
}) {
    // The requested year may have no plays yet (e.g. early January) — keep it selectable.
    const yearOptions = years.includes(year) ? years : [year, ...years].sort((a, b) => b - a);
    const peopleOptions = people && !people.some((p) => p.userId === userId)
        ? [{ userId, name: "Selected user", seconds: 0 }, ...people]
        : people;

    return (
        <div className="flex flex-wrap items-center justify-center gap-2">
            <label className="sr-only" htmlFor="wrapped-year">Year</label>
            <select
                id="wrapped-year"
                value={year}
                onChange={(e) => onSelect({ year: Number(e.target.value) })}
                className={SELECT_CLASS}
            >
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {peopleOptions && (
                <>
                    <label className="sr-only" htmlFor="wrapped-user">User</label>
                    <select
                        id="wrapped-user"
                        value={userId}
                        onChange={(e) => onSelect({ user: e.target.value })}
                        className={`${SELECT_CLASS} max-w-[60vw] sm:max-w-xs`}
                    >
                        {peopleOptions.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
                    </select>
                </>
            )}
        </div>
    );
}
