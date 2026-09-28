import { useId, useState, type ReactNode } from "react";
import clsx from "clsx";

interface ScopePillProps {
    icon: ReactNode;
    count: number;
    /** Accessible name for the pill, e.g. "3 servers". */
    label: string;
    title: string;
    children: ReactNode;
}

/**
 * Count pill with a details tooltip. The trigger is a real button so the
 * tooltip opens on keyboard focus and on tap (touch has no hover), and closes
 * on blur or Escape.
 */
export default function ScopePill({ icon, count, label, title, children }: ScopePillProps) {
    const [open, setOpen] = useState(false);
    const tooltipId = useId();

    return (
        <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            <button
                type="button"
                aria-label={label}
                aria-expanded={open}
                aria-describedby={open ? tooltipId : undefined}
                onClick={() => setOpen((v) => !v)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={(e) => {
                    if (e.key === "Escape") setOpen(false);
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 text-white/50 border border-white/5 cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
                {icon}
                <span className="text-[10px] font-bold">{count}</span>
            </button>
            <div
                id={tooltipId}
                role="tooltip"
                className={clsx(
                    "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-slate-900 border border-white/10 shadow-xl rounded-lg p-3 z-50 pointer-events-none transition-opacity duration-200",
                    open ? "opacity-100" : "opacity-0 invisible"
                )}
            >
                <div className="text-[10px] font-bold text-white mb-1 uppercase tracking-wider">{title}</div>
                {children}
                <div aria-hidden className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
            </div>
        </div>
    );
}
