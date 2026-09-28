import clsx from "clsx";

/** Accessible on/off switch: a real button with role="switch" and aria-checked. */
export function Switch({
    checked,
    onChange,
    label,
    id,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    id?: string;
}) {
    return (
        <button
            id={id}
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
        >
            <span className={clsx("w-10 h-6 rounded-full transition-colors relative shrink-0", checked ? "bg-emerald-500" : "bg-white/10")}>
                <span
                    className={clsx(
                        "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                        checked ? "translate-x-4" : "translate-x-0"
                    )}
                />
            </span>
            <span className="text-sm font-bold text-white">{label}</span>
        </button>
    );
}
