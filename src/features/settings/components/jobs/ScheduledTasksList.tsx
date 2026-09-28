"use client";

import { CalendarClock, Play, RefreshCw } from "lucide-react";
import { SkeletonRows } from "@/components/Skeleton";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ScheduledTask } from "@/lib/scheduled-tasks";

const formatWhen = (iso: string | null, dateOnly: boolean): string => {
    if (!iso) return "—";
    // Same YYYY-MM-DD HH:mm convention as the job history below.
    return dateOnly ? formatDate(iso) : formatDateTime(iso);
};

export function ScheduledTasksList({
    tasks,
    isLoading,
    hasError,
    triggering,
    runningJobTypes,
    onRun,
}: {
    tasks: ScheduledTask[] | undefined;
    isLoading: boolean;
    hasError: boolean;
    triggering: string | null;
    /** jobs.type values with a pending/running row — their Run button is disabled. */
    runningJobTypes: ReadonlySet<string>;
    onRun: (task: ScheduledTask) => void;
}) {
    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-white/5 rounded-lg">
                    <CalendarClock className="w-5 h-5 text-white/70" />
                </div>
                <h3 className="text-lg font-bold text-white">Scheduled Tasks</h3>
            </div>

            <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
                {isLoading ? (
                    <div className="p-4">
                        <SkeletonRows count={4} />
                    </div>
                ) : hasError || !tasks ? (
                    <p className="p-6 text-sm text-rose-400">Failed to load the task schedule.</p>
                ) : (
                    <ul className="divide-y divide-white/5">
                        {tasks.map((task) => {
                            const isRunning = task.jobType !== null && runningJobTypes.has(task.jobType);
                            const isTriggering = triggering === task.id;
                            return (
                                <li key={task.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h4 className="font-medium text-white text-sm">{task.name}</h4>
                                            <span className="text-[11px] font-medium text-white/50 bg-white/5 px-2 py-0.5 rounded">
                                                {task.cadence}
                                            </span>
                                            {isRunning && (
                                                <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                                                    <RefreshCw className="w-3 h-3 animate-spin" /> Running
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-white/50">{task.description}</p>
                                    </div>
                                    <dl className="grid grid-cols-2 gap-x-6 text-xs sm:w-72 shrink-0">
                                        <div className="space-y-1">
                                            <dt className="text-white/40">Last run</dt>
                                            <dd className="text-white/80 font-mono tracking-tight">{formatWhen(task.lastRunAt, task.lastRunDateOnly)}</dd>
                                        </div>
                                        <div className="space-y-1">
                                            <dt className="text-white/40">Next run</dt>
                                            <dd className="text-white/80 font-mono tracking-tight">{formatWhen(task.nextRunAt, false)}</dd>
                                        </div>
                                    </dl>
                                    <div className="sm:w-28 shrink-0 flex sm:justify-end">
                                        {task.runEndpoint && (
                                            <button
                                                type="button"
                                                onClick={() => onRun(task)}
                                                disabled={isRunning || isTriggering}
                                                aria-label={`Run ${task.name} now`}
                                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {isTriggering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                                Run now
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
