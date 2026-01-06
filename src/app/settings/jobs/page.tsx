"use client";

import useSWR from "swr";
import { SettingsSection, SettingsCard } from "../components/SettingsComponents";
import { CronControl } from "./CronControl";
import { useLanguage } from "@/components/LanguageContext";
// Add ChevronLeft, ChevronRight
import { RefreshCw, Globe, List, CheckCircle, XCircle, Play, History, Activity, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import clsx from "clsx";
import { useState, useMemo } from "react";
import cronstrue from "cronstrue";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    return response.json();
};

export default function JobsSettingsPage() {
    const { t } = useLanguage();
    const { data, mutate, isLoading } = useSWR<{ jobs: any[] }>("/api/jobs", fetchJson, { refreshInterval: 2000 });
    const { data: settings, mutate: mutateSettings } = useSWR<Record<string, string>>("/api/settings", fetchJson);
    const [currentPage, setCurrentPage] = useState(1);

    const activeGlobalSync = data?.jobs?.find(j => j.type === 'sync_all_content' && ['running', 'pending'].includes(j.status));
    const activeListSync = data?.jobs?.find(j => j.type === 'sync_all_library_lists' && ['running', 'pending'].includes(j.status));

    const ITEMS_PER_PAGE = 10;
    const totalPages = Math.ceil((data?.jobs?.length || 0) / ITEMS_PER_PAGE);
    const paginatedJobs = data?.jobs?.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleJob = async (type: string) => {
        if (type === 'sync_all_content' && !confirm("This will scan ALL content. Continue?")) return;
        try {
            await fetch("/api/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type }),
            });
            mutate();
        } catch { alert("Failed to start job"); }
    };

    const handleSaveSetting = async (key: string, value: string) => {
        try {
            await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value }),
            });
            mutateSettings();
        } catch { alert("Failed to save setting"); }
    };

    const syncEnabled = settings?.["job_sync_content_enabled"] !== "false";
    const syncTime = settings?.["job_sync_content_cron"] || "0 3 * * *";

    const syncLibsEnabled = settings?.["job_sync_libraries_enabled"] !== "false";
    const syncLibsTime = settings?.["job_sync_libraries_cron"] || "0 4 * * *";

    return (
        <div className="space-y-12">
            <SettingsSection
                title={t("settings.jobs")}
                description="Manage background tasks and synchronization schedules."
            >
                <div className="bg-zinc-900/30 border border-white/5 rounded-2xl overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-4 px-6 py-4 bg-white/5 border-b border-white/5 text-xs font-bold text-white/40 uppercase tracking-wider">
                        <div>Job Name</div>
                        <div>Schedule</div>
                        <div>Status</div>
                        <div className="text-right">Actions</div>
                    </div>

                    {/* Job Rows */}
                    <div className="divide-y divide-white/5">
                        <JobRow
                            title="Global Content Sync"
                            description="Synchronizes all movies and TV shows from connected servers into the local database."
                            type="PROCESS"
                            color="emerald"
                            cron={syncTime}
                            enabled={syncEnabled}
                            activeJob={activeGlobalSync}
                            onStart={() => handleJob('sync_all_content')}
                            onEnabledChange={(v: boolean) => handleSaveSetting("job_sync_content_enabled", String(v))}
                            onCronChange={(v: string) => handleSaveSetting("job_sync_content_cron", v)}
                            defaultCron="0 3 * * *"
                        />
                        <JobRow
                            title="Sync Library Lists"
                            description="Refreshes the list of libraries available on your servers. Does not sync content."
                            type="PROCESS"
                            color="amber"
                            cron={syncLibsTime}
                            enabled={syncLibsEnabled}
                            activeJob={activeListSync}
                            onStart={() => handleJob('sync_all_library_lists')}
                            onEnabledChange={(v: boolean) => handleSaveSetting("job_sync_libraries_enabled", String(v))}
                            onCronChange={(v: string) => handleSaveSetting("job_sync_libraries_cron", v)}
                            defaultCron="0 4 * * *"
                        />
                    </div>
                </div>

                {/* History Section */}
                <div className="mt-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-white/5 rounded-lg">
                            <History className="w-5 h-5 text-white/70" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Execution History</h3>
                    </div>

                    <div className="bg-zinc-900/30 rounded-2xl border border-white/5 overflow-hidden">
                        {isLoading ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />)}
                            </div>
                        ) : data?.jobs.length === 0 ? (
                            <div className="py-16 flex flex-col items-center justify-center text-center">
                                <Activity className="w-12 h-12 text-white/10 mb-4" />
                                <p className="text-white/40 font-medium">No job history recorded</p>
                            </div>
                        ) : (
                            <>
                                <div className="divide-y divide-white/5">
                                    {paginatedJobs?.map(job => (
                                        <div key={job.id} className="group flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors">
                                            <div className={clsx(
                                                "p-2.5 rounded-xl flex-shrink-0 transition-colors",
                                                job.status === 'completed' ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20" :
                                                    job.status === 'failed' ? "bg-rose-500/10 text-rose-500 group-hover:bg-rose-500/20" :
                                                        "bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20"
                                            )}>
                                                {job.status === 'completed' ? <CheckCircle className="w-5 h-5" /> :
                                                    job.status === 'failed' ? <XCircle className="w-5 h-5" /> :
                                                        <RefreshCw className="w-5 h-5 animate-spin" />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h4 className="font-medium text-white capitalize text-sm">
                                                        {job.type.replace(/_/g, ' ')}
                                                    </h4>
                                                    <span className="text-xs text-white/30 font-mono tracking-tight bg-white/5 px-2 py-0.5 rounded ml-2">
                                                        {formatDateTime(job.updatedAt)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs text-white/50 truncate pr-4">
                                                        {job.message || (job.status === 'running' ? `Running task... ${job.progress}%` : "No details available")}
                                                    </p>
                                                    {job.status === 'running' && (
                                                        <div className="h-1 w-20 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                                                            <div className="h-full bg-amber-500" style={{ width: `${job.progress}%` }} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4 text-white" />
                                        </button>

                                        <span className="text-xs font-medium text-white/50">
                                            Page <span className="text-white">{currentPage}</span> of {totalPages}
                                        </span>

                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
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
            </SettingsSection>
        </div>
    );
}

import { formatCron } from "./utils";

// ... existing imports

// ...

function JobRow({
    title,
    description,
    type,
    color,
    cron,
    enabled,
    activeJob,
    onStart,
    onEnabledChange,
    onCronChange,
    defaultCron
}: any) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    // Get next run time (approximate, for display)
    const nextRun = useMemo(() => {
        return formatCron(cron);
    }, [cron]);


    return (
        <div className="group bg-transparent hover:bg-white/[0.02] transition-colors relative">
            {/* Main Row */}
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-4 px-6 py-4 items-center">

                {/* Job Name */}
                <div className="font-medium text-sm text-white flex items-center gap-2">
                    <span>{title}</span>
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className={clsx(
                            "p-1 rounded-full transition-all",
                            showInfo ? "bg-white/10 text-white" : "text-white/20 hover:text-white/60 hover:bg-white/5"
                        )}
                    >
                        <Info className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Schedule */}
                <div className="text-sm text-white/60 truncate">
                    {enabled ? nextRun : <span className="text-white/20">Disabled</span>}
                </div>

                {/* Status */}
                <div>
                    {activeJob ? (
                        <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-zinc-800", color === 'emerald' ? "text-emerald-400" : "text-amber-400")}>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Running
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-zinc-800 text-white/40 text-[10px] font-bold uppercase tracking-wider">
                            Idle
                        </span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={clsx(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                            isExpanded ? "bg-amber-500 text-black border-amber-500 hover:bg-amber-400" : "bg-transparent text-amber-500 border-amber-500/20 hover:bg-amber-500/10"
                        )}
                    >
                        {isExpanded ? "Close" : "Edit"}
                    </button>

                    <button
                        onClick={onStart}
                        disabled={!!activeJob}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg transition-colors border border-white/5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play className="w-3 h-3" />
                        <span>Run</span>
                    </button>
                </div>
            </div>

            {/* Information Section */}
            {showInfo && (
                <div className="px-6 pb-4 -mt-2">
                    <div className="text-xs text-white/50 pl-2 border-l-2 border-white/10">
                        {description}
                    </div>
                </div>
            )}

            {/* Expanded Edit Section */}
            <div className={clsx(
                "grid transition-[grid-template-rows] duration-300 ease-out",
                isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}>
                <div className="overflow-hidden bg-black/20">
                    <div className="px-6 py-4 border-t border-white/5 mx-6 mb-4 rounded-xl relative">
                        <CronControl
                            enabled={enabled}
                            cronExpression={cron}
                            onEnabledChange={onEnabledChange}
                            onCronChange={onCronChange}
                            defaultCron={defaultCron}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
