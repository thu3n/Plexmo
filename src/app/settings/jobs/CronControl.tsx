import { Clock, CalendarCheck } from "lucide-react";
import clsx from "clsx";
import { formatCron } from "./utils"; // Use our custom formatter

interface CronControlProps {
    enabled: boolean;
    cronExpression: string;
    onEnabledChange: (enabled: boolean) => void;
    onCronChange: (cron: string) => void;
    defaultCron?: string;
}

export function CronControl({
    enabled,
    cronExpression,
    onEnabledChange,
    onCronChange,
    defaultCron = "0 3 * * *"
}: CronControlProps) {
    const isValid = (() => {
        return formatCron(cronExpression) !== "Invalid Schedule";
    })();

    return (
        <div className="mt-6 pt-5 border-t border-white/5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-white/90 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        Automation
                    </span>
                    <span className="text-xs text-white/50">Run this job automatically on a schedule</span>
                </div>

                <div className="flex items-center gap-3">
                    <span className={clsx("text-xs font-medium transition-colors", enabled ? "text-emerald-400" : "text-white/30")}>
                        {enabled ? "Enabled" : "Disabled"}
                    </span>
                    <button
                        onClick={() => onEnabledChange(!enabled)}
                        className={clsx(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
                            enabled ? "bg-emerald-500" : "bg-white/10"
                        )}
                    >
                        <span
                            className={clsx(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                                enabled ? "translate-x-6" : "translate-x-1"
                            )}
                        />
                    </button>
                </div>
            </div>

            {enabled && (
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <CalendarCheck className="w-8 h-8 text-white/10" />
                        <div className="flex-1 min-w-0">
                            <label className="text-[10px] font-bold text-white/30 mb-1 block uppercase tracking-widest">Cron Expression</label>
                            <input
                                type="text"
                                value={cronExpression}
                                onChange={(e) => onCronChange(e.target.value)}
                                className={clsx(
                                    "w-full bg-transparent border-none p-0 text-base font-mono focus:ring-0 focus:outline-none transition-colors",
                                    isValid ? "text-white" : "text-rose-400"
                                )}
                                placeholder="* * * * *"
                            />
                        </div>
                    </div>
                    <div className="mt-3 text-xs border-t border-white/5 pt-3 flex items-center gap-2">
                        <div className={clsx("w-1.5 h-1.5 rounded-full shadow-lg", isValid ? "bg-emerald-500 shadow-emerald-500/50" : "bg-rose-500 shadow-rose-500/50")} />
                        <span className={clsx("font-medium", isValid ? "text-emerald-400" : "text-rose-400")}>
                            {isValid ? formatCron(cronExpression) : "Invalid cron expression"}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
