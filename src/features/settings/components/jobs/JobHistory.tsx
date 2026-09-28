"use client";

import { useState } from "react";
import clsx from "clsx";
import { Activity, ChevronLeft, ChevronRight, History } from "lucide-react";
import { SkeletonRows } from "@/components/Skeleton";
import { JobRow } from "./JobRow";
import {
    ALL_JOB_TYPES,
    filterJobs,
    formatJobType,
    JOB_STATUS_FILTERS,
    jobTypesOf,
    type JobRecord,
    type JobStatusFilter,
} from "@/features/settings/lib/jobs-view";

const ITEMS_PER_PAGE = 10;

export function JobHistory({ jobs, isLoading, hasError }: { jobs: JobRecord[] | undefined; isLoading: boolean; hasError: boolean }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [status, setStatus] = useState<JobStatusFilter>("all");
    const [type, setType] = useState<string>(ALL_JOB_TYPES);

    const allJobs = jobs ?? [];
    const filtered = filterJobs(allJobs, status, type);
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const page = Math.min(currentPage, totalPages);
    const pageJobs = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const types = jobTypesOf(allJobs);

    return (
        <div>
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="p-2 bg-white/5 rounded-lg">
                    <History className="w-5 h-5 text-white/70" />
                </div>
                <h3 className="text-lg font-bold text-white mr-auto">Execution History</h3>

                <div role="radiogroup" aria-label="Filter by status" className="flex items-center gap-1 rounded-full border border-white/5 bg-white/5 p-1">
                    {JOB_STATUS_FILTERS.map((f) => (
                        <button
                            key={f.value}
                            type="button"
                            role="radio"
                            aria-checked={status === f.value}
                            onClick={() => {
                                setStatus(f.value);
                                setCurrentPage(1);
                            }}
                            className={clsx(
                                "rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                                status === f.value ? "bg-amber-500 text-black" : "text-white/60 hover:text-white"
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <select
                    aria-label="Filter by job type"
                    value={type}
                    onChange={(e) => {
                        setType(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 focus:outline-none focus:border-amber-500/50"
                >
                    <option value={ALL_JOB_TYPES} className="bg-slate-900">All types</option>
                    {types.map((t) => (
                        <option key={t} value={t} className="bg-slate-900">
                            {formatJobType(t)}
                        </option>
                    ))}
                </select>
            </div>

            <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
                {isLoading ? (
                    <div className="p-4">
                        <SkeletonRows count={3} />
                    </div>
                ) : hasError ? (
                    <p className="p-6 text-sm text-rose-400">Failed to load job history.</p>
                ) : filtered.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center">
                        <Activity className="w-12 h-12 text-white/10 mb-4" />
                        <p className="text-white/40 font-medium">
                            {allJobs.length === 0 ? "No job history recorded" : "No jobs match these filters"}
                        </p>
                    </div>
                ) : (
                    <>
                        <ul className="divide-y divide-white/5">
                            {pageJobs.map((job) => (
                                <JobRow key={job.id} job={job} />
                            ))}
                        </ul>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    aria-label="Previous page"
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4 text-white" />
                                </button>
                                <span className="text-xs font-medium text-white/50">
                                    Page <span className="text-white">{page}</span> of {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                    aria-label="Next page"
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
