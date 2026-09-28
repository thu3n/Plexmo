import clsx from "clsx";

interface RuleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** Accessible name; required because the switch has no visible text of its own. */
    label: string;
    /** Track colour when on, e.g. "bg-amber-500". */
    activeClassName?: string;
    size?: "sm" | "md";
    disabled?: boolean;
}

const SIZES = {
    sm: { track: "w-9 h-5", thumb: "w-4 h-4 top-0.5 left-0.5", on: "translate-x-4" },
    md: { track: "w-10 h-6", thumb: "w-4 h-4 top-1 left-1", on: "translate-x-4" },
} as const;

/**
 * Keyboard-operable on/off switch (role="switch"). Replaces the rules UI's
 * `<input className="hidden">` toggles, which could not be focused or
 * announced by screen readers.
 */
export default function RuleSwitch({
    checked,
    onChange,
    label,
    activeClassName = "bg-amber-500",
    size = "md",
    disabled,
}: RuleSwitchProps) {
    const s = SIZES[size];
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={clsx(
                "relative shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-50",
                s.track,
                checked ? activeClassName : "bg-white/10"
            )}
        >
            <span
                aria-hidden
                className={clsx(
                    "absolute bg-white rounded-full shadow-sm transition-transform",
                    s.thumb,
                    checked ? s.on : "translate-x-0"
                )}
            />
        </button>
    );
}
