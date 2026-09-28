import type { ReactNode } from "react";
import clsx from "clsx";
import type { RuleInstance, RuleSchedule } from "@/features/rules/types";
import { RULE_TYPE } from "@/features/rules/constants";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_IN_WEEK = 7;
const WEEKDAY_COUNT = 5;
const WEEKEND = [0, 6];
const MAX_WINDOWS_SHOWN = 3;

const describeDays = (days: number[]): string => {
    if (days.length === DAYS_IN_WEEK) return "Daily";
    const hasWeekend = WEEKEND.some((d) => days.includes(d));
    if (days.length === WEEKDAY_COUNT && !hasWeekend) return "Weekdays";
    if (days.length === WEEKEND.length && WEEKEND.every((d) => days.includes(d))) return "Weekends";
    return days.map((d) => DAY_NAMES[d]).join(", ");
};

const ValueBadge = ({ className, children }: { className: string; children: ReactNode }) => (
    <div className="flex">
        <span className={clsx("text-[10px] font-bold px-1.5 py-1 rounded uppercase tracking-wider border", className)}>{children}</span>
    </div>
);

function ScheduleSummary({ schedule }: { schedule: RuleSchedule }) {
    const isAllow = schedule.type === "allow";
    return (
        <div className="flex items-start gap-2 mt-2">
            <span
                className={clsx(
                    "shrink-0 text-[10px] font-bold px-1.5 py-1 rounded uppercase tracking-wider h-fit mt-0.5 border",
                    isAllow ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                )}
            >
                {isAllow ? "Allow" : "Block"}
            </span>
            <div className="flex flex-col gap-1.5 w-full min-w-0">
                {schedule.timeWindows.slice(0, MAX_WINDOWS_SHOWN).map((window, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-white/70 bg-white/5 rounded-md px-2 py-1 border border-white/5">
                        <span className="font-mono font-bold text-indigo-300">
                            {window.startTime} - {window.endTime}
                        </span>
                        <span className="text-[10px] text-white/40 uppercase tracking-wide truncate ml-2">{describeDays(window.days)}</span>
                    </div>
                ))}
                {schedule.timeWindows.length > MAX_WINDOWS_SHOWN && (
                    <p className="text-[10px] text-white/30 italic text-right">+{schedule.timeWindows.length - MAX_WINDOWS_SHOWN} more</p>
                )}
            </div>
        </div>
    );
}

/** Type-specific summary shown under the rule name. */
export default function RuleCardDetails({ rule }: { rule: RuleInstance }) {
    const { limit, schedule } = rule.settings;
    if (rule.type === RULE_TYPE.MAX_CONCURRENT && limit > 0) {
        return (
            <ValueBadge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                {limit} {limit === 1 ? "Stream" : "Streams"}
            </ValueBadge>
        );
    }
    if (rule.type === RULE_TYPE.KILL_PAUSED && limit > 0) {
        return (
            <ValueBadge className="bg-rose-500/10 text-rose-400 border-rose-500/20">
                {limit} {limit === 1 ? "Minute" : "Minutes"}
            </ValueBadge>
        );
    }
    if (rule.type === RULE_TYPE.SCHEDULED && schedule) return <ScheduleSummary schedule={schedule} />;
    return null;
}
