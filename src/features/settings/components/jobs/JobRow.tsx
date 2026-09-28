"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import { CheckCircle, ChevronDown, RefreshCw, XCircle } from "lucide-react";
import { formatDateTime as formatWhen } from "@/lib/format";
import { formatJobType, isActiveJob, type JobRecord } from "@/features/settings/lib/jobs-view";


const summaryOf = (job: JobRecord) =>
    job.message || (isActiveJob(job) ? `Running task... ${job.progress}%` : "No details available");

/** One job; the header toggles a panel with the full, untruncated message. */
export function JobRow({ job }: { job: JobRecord }) {
    const [isOpen, setIsOpen] = useState(false);
    const panelId = useId();
    const active = isActiveJob(job);

    return (
        <li>
            <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="group w-full text-left flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors focus-visible:outline-none focus-visible:bg-white/[0.04]"
            >
                <div
                    className={clsx(
                        "p-2.5 rounded-xl flex-shrink-0 transition-colors",
                        job.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20"
                            : job.status === "failed"
                                ? "bg-rose-500/10 text-rose-500 group-hover:bg-rose-500/20"
                                : "bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20"
                    )}
                >
                    {job.status === "completed" ? (
                        <CheckCircle className="w-5 h-5" />
                    ) : job.status === "failed" ? (
                        <XCircle className="w-5 h-5" />
                    ) : (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                    )}
                    <span className="sr-only">{job.status}</span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-white text-sm">{formatJobType(job.type)}</h4>
                        <span className="text-xs text-white/30 font-mono tracking-tight bg-white/5 px-2 py-0.5 rounded ml-2 whitespace-nowrap">
                            {formatWhen(job.updatedAt)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-white/50 truncate pr-4">{summaryOf(job)}</p>
                        {active && (
                            <div className="h-1 w-20 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                                <div className="h-full bg-amber-500" style={{ width: `${job.progress}%` }} />
                            </div>
                        )}
                    </div>
                </div>
                <ChevronDown
                    aria-hidden
                    className={clsx("w-4 h-4 text-white/30 shrink-0 transition-transform", isOpen && "rotate-180")}
                />
            </button>

            {isOpen && (
                <div id={panelId} className="px-4 pb-4 pl-[4.5rem] space-y-2 text-xs">
                    <p className="text-white/70 whitespace-pre-wrap break-words">{summaryOf(job)}</p>
                    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-white/40">
                        <div>
                            <dt className="inline">Started: </dt>
                            <dd className="inline text-white/60">{formatWhen(job.createdAt)}</dd>
                        </div>
                        <div>
                            <dt className="inline">Updated: </dt>
                            <dd className="inline text-white/60">{formatWhen(job.updatedAt)}</dd>
                        </div>
                        <div>
                            <dt className="inline">Progress: </dt>
                            <dd className="inline text-white/60">{job.progress}%</dd>
                        </div>
                    </dl>
                </div>
            )}
        </li>
    );
}
