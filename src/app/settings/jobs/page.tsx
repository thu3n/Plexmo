"use client";

import useSWR from "swr";
import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import { useLanguage } from "@/components/LanguageContext";
import { HistoryRepairPanel } from "@/features/settings/components/HistoryRepairPanel";
import { RefreshCw, CheckCircle, XCircle, History, Activity, ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import clsx from "clsx";
import { useState } from "react";

type JobRecord = {
    id: string;
    type: string;
    status: string;
    progress: number;
    message: string | null;
    updatedAt: string;
};

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    return response.json();
};

export default function JobsSettingsPage() {
    const { t } = useLanguage();
    const { data, mutate, isLoading } = useSWR<{ jobs: JobRecord[] }>("/api/jobs", fetchJson, { refreshInterval: 2000 });
    const [currentPage, setCurrentPage] = useState(1);

    const ITEMS_PER_PAGE = 10;
    const totalPages = Math.ceil((data?.jobs?.length || 0) / ITEMS_PER_PAGE);
    const paginatedJobs = data?.jobs?.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleRunLinkHistory = async () => {
        if (!confirm("This will process unlinked history items. Continue?")) return;
        try {
            const res = await fetch("/api/admin/link-history", { method: "POST" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            mutate();
            alert("Job started");
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            alert(`Failed to start job: ${message}`);
        }
    };

    return (
        <div className="space-y-12">
            <SettingsSection
                title={t("settings.jobs")}
                description="Maintenance tools and background task history."
            >
                {/* Maintenance Tools */}
                <div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-white/5 rounded-lg">
                            <Wrench className="w-5 h-5 text-white/70" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Maintenance Tools</h3>
                    </div>
                    <HistoryRepairPanel />
                    <button
                        onClick={handleRunLinkHistory}
                        className="mt-4 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg transition-colors border border-white/5"
                    >
                        Link unlinked history
                    </button>
                </div>

                <hr className="my-12 border-white/5" />

                {/* History Section */}
                <div>
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
