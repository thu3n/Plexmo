import clsx from "clsx";
import { NOTIFICATION_EVENTS, type NotificationEventId } from "../lib/events";
import { EVENT_ICONS } from "./eventIcons";

/** Event checkboxes rendered from the shared event definitions. */
export function EventPicker({
    selected,
    onToggle,
}: {
    selected: readonly NotificationEventId[];
    onToggle: (event: NotificationEventId) => void;
}) {
    return (
        <fieldset className="space-y-3 pt-2">
            <legend className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-3">Events</legend>
            <div className="grid gap-2 sm:grid-cols-2">
                {NOTIFICATION_EVENTS.map((event) => {
                    const isOn = selected.includes(event.id);
                    const Icon = EVENT_ICONS[event.id];
                    return (
                        <label
                            key={event.id}
                            className={clsx(
                                "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer focus-within:ring-2 focus-within:ring-amber-500",
                                isOn ? "bg-amber-500/10 border-amber-500 text-white" : "bg-white/5 border-transparent text-white/50 hover:bg-white/10"
                            )}
                        >
                            <input type="checkbox" className="sr-only" checked={isOn} onChange={() => onToggle(event.id)} />
                            <span className={clsx("p-1.5 rounded-lg shrink-0", isOn ? "bg-amber-500 text-slate-900" : "bg-white/10")}>
                                <Icon className="w-4 h-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                                <span className="block font-bold text-sm">{event.label}</span>
                                <span className="block text-xs opacity-70">{event.description}</span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}
