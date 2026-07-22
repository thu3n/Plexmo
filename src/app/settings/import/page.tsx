"use strict";
"use client";

import { useState, useEffect, useRef } from "react";
import { SettingsSection, SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { Database, CheckCircle2, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { BackupRestoreCard } from "@/features/backup/components/BackupRestoreCard";
import clsx from "clsx";
import ServerMappingStep from "@/features/settings/components/import/ServerMappingStep";
import ImportProgressStep from "@/features/settings/components/import/ImportProgressStep";
import ImportStatsModal from "@/features/settings/components/import/ImportStatsModal";
import TautulliDbImportCard from "@/features/settings/components/import/TautulliDbImportCard";
import type { PlexmoServer, TautulliServerInfo, Job, ImportStep, ImportStatus } from "@/features/settings/components/import/types";

export default function ImportSettingsPage() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [status, setStatus] = useState<ImportStatus | null>(null);

    // API Import State
    const [step, setStep] = useState<ImportStep>('connect');
    const [apiUrl, setApiUrl] = useState("");
    const [apiKey, setApiKey] = useState("");

    // Server Mapping Data
    const [sourceServers, setSourceServers] = useState<TautulliServerInfo[]>([]);
    const [, setTautulliServer] = useState<TautulliServerInfo | null>(null);
    const [plexmoServers, setPlexmoServers] = useState<PlexmoServer[]>([]);
    const [manualMapping, setManualMapping] = useState<Record<string, string>>({});

    // Ignored Servers
    const [ignoredServers, setIgnoredServers] = useState<Set<string>>(new Set());

    const toggleIgnore = (serverId: string) => {
        setIgnoredServers(prev => {
            const next = new Set(prev);
            if (next.has(serverId)) {
                next.delete(serverId);
            } else {
                next.add(serverId);
            }
            return next;
        });
    };

    // Job Progress
    const [currentJob, setCurrentJob] = useState<Job | null>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // --- Cleanup ---
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    // --- API Import Handlers ---

    // Step 1: Connect & Check
    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        setStatus(null);

        try {
            // 1. Check Tautulli
            const checkRes = await fetch("/api/settings/import/tautulli/check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: apiUrl, apiKey })
            });
            const checkData = await checkRes.json();
            if (!checkRes.ok) throw new Error(checkData.error || "Failed to connect to Tautulli");

            const foundServers = checkData.servers || [checkData.server]; // Fallback for old API if needed
            setSourceServers(foundServers);

            // 2. Fetch Local Servers
            const serversRes = await fetch("/api/servers");
            const serversData = await serversRes.json();
            if (!serversRes.ok) throw new Error(serversData.error || "Failed to fetch local servers");

            setPlexmoServers(serversData.servers || []);

            // Decision Logic
            // Always go to source_select (Bulk UI) for both single and multi-server
            if (foundServers.length > 0) {
                // Initialize Manual Mapping with Auto-matches
                const initialMapping: Record<string, string> = {};
                foundServers.forEach((s: TautulliServerInfo) => {
                    const match = (serversData.servers || []).find((p: PlexmoServer) =>
                        (s.identifier && p.identifier === s.identifier) ||
                        (p.name && s.name && p.name.toLowerCase() === s.name.toLowerCase())
                    );
                    if (match) {
                        initialMapping[s.param.toString()] = match.id;
                    }
                });
                setManualMapping(initialMapping);
                setStep('source_select');
            } else {
                throw new Error("No Tautulli servers found.");
            }

        } catch (err: any) {
            setStatus({ success: false, error: err.message });
        } finally {
            setIsProcessing(false);
        }
    };

    // Step 2: Start Import Job
    const handleStartImport = async () => {
        setIsProcessing(true);
        setStatus(null);

        try {
            // Build Mapping from state
            const mapping: { [key: string]: string } = {};

            sourceServers.forEach(s => {
                const sId = s.param.toString();
                // Skip ignored servers
                if (ignoredServers.has(sId)) return;

                const target = manualMapping[sId];
                if (target && target !== 'ignore') {
                    mapping[sId] = target;
                }
            });

            if (Object.keys(mapping).length === 0) {
                throw new Error("No servers could be mapped. Please ensure at least one server matches.");
            }

            const res = await fetch("/api/settings/import/tautulli/api", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: apiUrl, apiKey, serverMapping: mapping })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to start import");

            // Start Polling
            setStep('importing');
            startPolling(data.jobId);

        } catch (err: any) {
            setStatus({ success: false, error: err.message });
            setIsProcessing(false);
        }
    };

    const startPolling = (jobId: string) => {
        if (pollingRef.current) clearInterval(pollingRef.current);

        pollingRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/jobs/${jobId}`);
                const data = await res.json();

                if (data.job) {
                    setCurrentJob(data.job);
                    if (data.job.status === 'completed' || data.job.status === 'failed') {
                        clearInterval(pollingRef.current!);
                        setStep('completed');
                        setIsProcessing(false);
                        if (data.job.status === 'completed') {
                            setStatus({ success: true, message: data.job.message || "Import Completed Successfully" });
                        } else {
                            setStatus({ success: false, error: data.job.message || "Import Job Failed" });
                        }
                    }
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        }, 1000);
    };

    const resetApiImport = () => {
        setStep('connect');
        setStatus(null);
        setTautulliServer(null);
        setCurrentJob(null);
        if (pollingRef.current) clearInterval(pollingRef.current);
    }

    return (
        <div className="space-y-8 relative">

            <SettingsSection
                title="Data Management"
                description="Export your data for backup or import from other sources."
            >
                <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
                    <div className="space-y-6">

                        {/* Backup & Restore */}
                        <BackupRestoreCard />

                        {/* Import Section */}
                        <SettingsCard>
                            <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                                <div className="flex gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                                        <Database className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0 w-full">
                                        <h3 className="text-lg font-bold text-white">Tautulli Import</h3>
                                        <p className="text-sm text-white/50 mt-1 mb-6">Import history directly from your Tautulli instance via API.</p>

                                        {/* API Import UI - Multi Step */}
                                        <div className="space-y-6">
                                            {step === 'connect' && (
                                                <form onSubmit={handleConnect} className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-white/70 uppercase mb-1.5">Tautulli URL</label>
                                                            <input type="url" required placeholder="http://192.168.1.50:8181" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-white/70 uppercase mb-1.5">API Key</label>
                                                            <input type="text" required placeholder="Enter your Tautulli API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors font-mono" />
                                                        </div>
                                                    </div>
                                                    <button type="submit" disabled={isProcessing} className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 mt-2">
                                                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                                                        {isProcessing ? "Connecting..." : "Connect"}
                                                    </button>
                                                </form>
                                            )}

                                            {step === 'source_select' && (
                                                <ServerMappingStep
                                                    sourceServers={sourceServers}
                                                    plexmoServers={plexmoServers}
                                                    manualMapping={manualMapping}
                                                    ignoredServers={ignoredServers}
                                                    isProcessing={isProcessing}
                                                    toggleIgnore={toggleIgnore}
                                                    setManualMapping={setManualMapping}
                                                    onCancel={resetApiImport}
                                                    onStartImport={handleStartImport}
                                                />
                                            )}

                                            {(step === 'importing' || step === 'completed') && (
                                                <ImportProgressStep
                                                    step={step}
                                                    status={status}
                                                    currentJob={currentJob}
                                                    showDetails={showDetails}
                                                    setShowDetails={setShowDetails}
                                                    onReset={resetApiImport}
                                                />
                                            )}

                                        </div>
                                    </div>
                                </div>
                            </div>
                        </SettingsCard>

                        {/* Status Message (Only show for non-API flow or unexpected errors, API flow has its own UI) */}
                        {status && step === 'connect' && (
                            <div className={clsx(
                                "p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2",
                                status.success
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            )}>
                                {status.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
                                <div className="min-w-0 break-words">
                                    <h4 className="font-bold text-sm">{status.success ? "Success" : "Error"}</h4>
                                    <p className="text-sm opacity-80 mt-1">{status.message || status.error}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Sidebar / Info Column */}
                    <div></div>
                </div >
            </SettingsSection >

            <SettingsSection
                title="Tautulli Database File"
                description="Full-fidelity import directly from a tautulli.db file - including data the API can't deliver."
            >
                <TautulliDbImportCard />
            </SettingsSection>

            {/* Details Modal - Rendered to a portal to avoid all stacking context/overflow issues */}
            {showDetails && currentJob && (
                <ImportStatsModal currentJob={currentJob} onClose={() => setShowDetails(false)} />
            )}

        </div >
    );
}
