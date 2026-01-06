"use strict";
"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SettingsSection, SettingsCard } from "../components/SettingsComponents";
import { UploadCloud, Database, AlertTriangle, CheckCircle2, XCircle, Download, Server, ArrowRight, Loader2, HelpCircle } from "lucide-react";
import clsx from "clsx";

interface PlexmoServer {
    id: string;
    name: string;
    baseUrl: string;
    identifier?: string;
}

interface TautulliServerInfo {
    id: string;
    name: string;
    identifier?: string;
    type: 'standard' | 'fork';
    param: string | number;
}

interface Job {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    message?: string;
    itemsProcessed: number;
    totalItems: number;
}

export default function ImportSettingsPage() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [status, setStatus] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);



    // API Import State
    const [step, setStep] = useState<'connect' | 'source_select' | 'mapping' | 'importing' | 'completed'>('connect');
    const [apiUrl, setApiUrl] = useState("");
    const [apiKey, setApiKey] = useState("");

    // Server Mapping Data
    const [sourceServers, setSourceServers] = useState<TautulliServerInfo[]>([]);
    const [tautulliServer, setTautulliServer] = useState<TautulliServerInfo | null>(null);
    const [plexmoServers, setPlexmoServers] = useState<PlexmoServer[]>([]);
    const [targetServerId, setTargetServerId] = useState<string>("");
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

    // --- Export Handler ---
    const handleExport = async () => {
        try {
            const response = await fetch("/api/settings/export");
            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `plexmo-backup-${new Date().toISOString().slice(0, 10)}.db`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export error:", error);
            alert("Failed to export database");
        }
    };



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

    const selectSourceServer = (tServer: TautulliServerInfo, pServers: PlexmoServer[] = plexmoServers) => {
        setTautulliServer(tServer);

        // Attempt Auto-match
        const tIdentifier = tServer.identifier;
        const tName = tServer.name;

        const match = pServers.find((p: any) =>
            (tIdentifier && p.identifier === tIdentifier) || (p.name && tName && p.name.toLowerCase() === tName.toLowerCase())
        );

        if (match) {
            setTargetServerId(match.id);
        } else if (pServers.length > 0) {
            setTargetServerId(pServers[0].id);
        }

        setStep('mapping');
    };

    // Step 2: Start Import Job
    const handleStartImport = async () => {
        setIsProcessing(true);
        setStatus(null);

        try {
            // Build Mapping
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

                        {/* Export Section */}
                        <SettingsCard>
                            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
                                <div className="flex gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                                        <Download className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Export Backup</h3>
                                        <p className="text-sm text-white/50 mt-1">Download a full backup of your Plexmo database.</p>
                                    </div>
                                </div>
                                <button onClick={handleExport} className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 whitespace-nowrap">
                                    <Download className="w-4 h-4" /> Download Database
                                </button>
                            </div>
                        </SettingsCard>

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
                                                <div className="animate-in fade-in slide-in-from-right-4 space-y-6">
                                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="h-10 w-10 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-500 font-bold shrink-0">
                                                                <Server className="w-6 h-6" />
                                                            </div>
                                                            <div>
                                                                <h3 className="font-bold text-white text-lg">Server Mapping</h3>
                                                                <p className="text-white/50 text-sm">Review how your Tautulli servers map to Plexmo.</p>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3">
                                                            {sourceServers.map((tServer, idx) => {
                                                                const tId = tServer.param.toString();
                                                                const isIgnored = ignoredServers.has(tId);
                                                                const currentTarget = manualMapping[tId] || "";

                                                                return (
                                                                    <div key={idx} className={clsx("flex flex-col sm:flex-row sm:items-center justify-between bg-black/30 p-3 rounded-lg border transition-all gap-4", isIgnored ? "border-white/5 opacity-50" : "border-white/5")}>
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/70">
                                                                                {tServer.name ? tServer.name.substring(0, 1) : "?"}
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-sm font-bold text-white">{tServer.name || "Unknown Server"}</div>
                                                                                <div className="text-xs text-white/40 font-mono">ID: {tServer.identifier === 'default' ? 'Default' : tServer.param}</div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-3 w-full sm:w-auto">
                                                                            <ArrowRight className="w-4 h-4 text-white/20 hidden sm:block" />

                                                                            <select
                                                                                className={clsx(
                                                                                    "bg-black/30 border text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50 w-full sm:w-48 transition-colors",
                                                                                    currentTarget ? "border-emerald-500/30 text-emerald-100" : "border-white/10 text-white/50"
                                                                                )}
                                                                                value={isIgnored ? "ignore" : (currentTarget || "")}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value;
                                                                                    if (val === 'ignore') {
                                                                                        if (!isIgnored) toggleIgnore(tId);
                                                                                    } else {
                                                                                        if (isIgnored) toggleIgnore(tId);
                                                                                        setManualMapping(prev => ({ ...prev, [tId]: val }));
                                                                                    }
                                                                                }}
                                                                                disabled={isIgnored && false}
                                                                            >
                                                                                <option value="" disabled>Select Target Server...</option>
                                                                                {plexmoServers.map(ps => (
                                                                                    <option key={ps.id} value={ps.id}>{ps.name}</option>
                                                                                ))}
                                                                                <option value="ignore" className="text-rose-400">Do Not Import (Ignore)</option>
                                                                            </select>

                                                                            <button
                                                                                onClick={() => toggleIgnore(tId)}
                                                                                className={clsx(
                                                                                    "p-2 rounded-lg transition-colors ml-2 shrink-0",
                                                                                    isIgnored ? "bg-white/10 text-white hover:bg-white/20" : "hover:bg-white/10 text-white/50 hover:text-white"
                                                                                )}
                                                                                title={isIgnored ? "Include Server" : "Ignore Server"}
                                                                            >
                                                                                {isIgnored ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Validation Message */}
                                                    {sourceServers.filter(s => !ignoredServers.has(s.param.toString())).some(s => !manualMapping[s.param.toString()]) ? (
                                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3 items-start">
                                                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                                            <div className="text-sm text-amber-200">
                                                                <strong>Unmapped Servers</strong>
                                                                <p className="opacity-80 mt-1 mb-2">Some active servers are not mapped to a Plexmo server. Please select a target server for them or ignore them.</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex gap-3 items-center">
                                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                                            <div className="text-sm text-emerald-200">
                                                                <strong>All Servers Mapped!</strong>
                                                                <p className="opacity-80 text-xs mt-1">Ready to import history from {sourceServers.length - ignoredServers.size} servers.</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={resetApiImport}
                                                            className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={handleStartImport}
                                                            className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                                                        >
                                                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                                                            Start Import
                                                        </button>
                                                    </div>
                                                </div>
                                            )}


                                            {(step === 'importing' || step === 'completed') && (
                                                <div className="animate-in fade-in slide-in-from-right-4 space-y-6">
                                                    <div className="bg-black/30 border border-white/10 rounded-xl p-6 text-center">
                                                        {step === 'completed' && status?.success ? (
                                                            <div className="mb-4 flex justify-center"><div className="h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500"><CheckCircle2 className="w-8 h-8" /></div></div>
                                                        ) : step === 'completed' && !status?.success ? (
                                                            <div className="mb-4 flex justify-center"><div className="h-16 w-16 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-500"><XCircle className="w-8 h-8" /></div></div>
                                                        ) : (
                                                            <div className="mb-4 flex justify-center"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>
                                                        )}

                                                        <h3 className="text-xl font-bold text-white mb-2">
                                                            {step === 'completed'
                                                                ? (status?.success ? "Import Complete!" : "Import Failed")
                                                                : "Importing History..."
                                                            }
                                                        </h3>

                                                        {currentJob && (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <p className="text-white/60 text-sm">{currentJob.message}</p>
                                                                    {step === 'completed' && (
                                                                        <button
                                                                            onClick={() => setShowDetails(true)}
                                                                            className="text-amber-500 hover:text-amber-400 transition-colors p-1"
                                                                            title="View Statistics Details"
                                                                        >
                                                                            <HelpCircle className="w-5 h-5" />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* Progress Bar */}
                                                                <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden relative">
                                                                    <div
                                                                        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-600 to-amber-400 Transition-all duration-300 ease-out"
                                                                        style={{ width: `${currentJob.progress}%` }}
                                                                    />
                                                                </div>
                                                                <div className="flex justify-between text-xs text-white/50 font-mono">
                                                                    <span>{currentJob.itemsProcessed} / {currentJob.totalItems || '?'} items</span>
                                                                    <span>{currentJob.progress}%</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {step === 'completed' && (
                                                        <button
                                                            onClick={resetApiImport}
                                                            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
                                                        >
                                                            Start New Import
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Details Modal */}
                                            {showDetails && currentJob && (
                                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                                                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                                                            <h3 className="text-xl font-bold text-white">Import Statistics</h3>
                                                            <button
                                                                onClick={() => setShowDetails(false)}
                                                                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                                            >
                                                                <XCircle className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                                                            {(() => {
                                                                // Parse stats from message
                                                                const msg = currentJob.message || "";
                                                                const imported = (msg.match(/Imported:\s*(\d+)/) || [])[1] || "0";
                                                                const skipped = (msg.match(/Skipped:\s*(\d+)/) || [])[1] || "0";
                                                                const failed = (msg.match(/Failed:\s*(\d+)/) || [])[1] || "0";
                                                                const fixed = (msg.match(/Fixed:\s*(\d+)/) || [])[1] || "0";

                                                                return (
                                                                    <div className="space-y-4">
                                                                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <div className="text-sm font-bold text-emerald-400">Success</div>
                                                                                <div className="text-2xl font-bold text-white">{imported}</div>
                                                                            </div>
                                                                            <ul className="text-xs text-emerald-200/60 list-disc list-inside space-y-1">
                                                                                <li>Items successfully imported into Plexmo's database.</li>
                                                                            </ul>
                                                                        </div>

                                                                        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <div className="text-sm font-bold text-rose-400">Skipped</div>
                                                                                <div className="text-2xl font-bold text-white">{skipped}</div>
                                                                            </div>
                                                                            <ul className="text-xs text-rose-200/60 list-disc list-inside space-y-1">
                                                                                <li>Items were ignored because they already exist in your history.</li>
                                                                                <li>"Incomplete data" refers to sessions that have <strong>no stop time</strong>, usually because they are currently active (ongoing) streams.</li>
                                                                            </ul>
                                                                        </div>

                                                                        {/* Failed Section */}
                                                                        {parseInt(failed || "0") > 0 && (
                                                                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                                                                                <div className="flex items-center justify-between mb-2">
                                                                                    <div className="text-sm font-bold text-red-400">Failed / Unprocessed</div>
                                                                                    <div className="text-2xl font-bold text-white">{failed}</div>
                                                                                </div>
                                                                                <ul className="text-xs text-red-200/60 list-disc list-inside space-y-1">
                                                                                    <li><strong>Likely Connection Issues:</strong> These items could not be retrieved from Tautulli.</li>
                                                                                    <li>This happens if a server is offline, the API times out, or the import job is interrupted.</li>
                                                                                    <li>Please try running the import again to retry these items.</li>
                                                                                </ul>
                                                                            </div>
                                                                        )}

                                                                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <div className="text-sm font-bold text-amber-400">Capped Sessions (&gt;24h)</div>
                                                                                <div className="text-2xl font-bold text-white">{fixed}</div>
                                                                            </div>
                                                                            <ul className="text-xs text-amber-200/60 list-disc list-inside space-y-1">
                                                                                <li>Some historical sessions had unrealistic durations (e.g. 500 hours) due to glitches in the source data.</li>
                                                                                <li>Historical durations are calculated as <code>Stopped - Started</code>, which includes <strong>paused time</strong>.</li>
                                                                                <li>A 10-hour duration is perfectly valid (e.g. paused overnight), so we only filter extreme outliers.</li>
                                                                                <li>We use a <strong>24-hour limit</strong> to catch only the obvious errors without affecting valid long viewing sessions.</li>
                                                                            </ul>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="p-4 border-t border-white/10 bg-white/5 rounded-b-2xl">
                                                            <button
                                                                onClick={() => setShowDetails(false)}
                                                                className="w-full py-2 bg-white/10 hover:bg-white/15 text-white font-medium rounded-lg transition-colors"
                                                            >
                                                                Close
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
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

            {/* Details Modal - Moved to Portal to avoid all stacking context/overflow issues */}
            {showDetails && currentJob && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                            <h3 className="text-xl font-bold text-white">Import Statistics</h3>
                            <button
                                onClick={() => setShowDetails(false)}
                                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                            {(() => {
                                // Parse stats from message
                                const msg = currentJob.message || "";
                                const imported = (msg.match(/Imported:\s*(\d+)/) || [])[1] || "0";
                                const skipped = (msg.match(/Skipped:\s*(\d+)/) || [])[1] || "0";

                                return (
                                    <div className="space-y-4">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-sm font-bold text-emerald-400">Success</div>
                                                <div className="text-2xl font-bold text-white">{imported}</div>
                                            </div>
                                            <ul className="text-xs text-emerald-200/60 list-disc list-inside space-y-1">
                                                <li>Items successfully imported into Plexmo's database.</li>
                                            </ul>
                                        </div>

                                        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-sm font-bold text-rose-400">Skipped</div>
                                                <div className="text-2xl font-bold text-white">{skipped}</div>
                                            </div>
                                            <ul className="text-xs text-rose-200/60 list-disc list-inside space-y-1">
                                                <li>Items were ignored because they already exist in your history.</li>
                                                <li>"Incomplete data" refers to sessions that have <strong>no stop time</strong> (usually currently active streams that plexmo already have) .</li>
                                                <li>Sessions with unrealistic durations (&gt;24 hours) were also skipped to prevent statistics errors.</li>
                                            </ul>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="p-4 border-t border-white/10 bg-white/5 rounded-b-2xl">
                            <button
                                onClick={() => setShowDetails(false)}
                                className="w-full py-2 bg-white/10 hover:bg-white/15 text-white font-medium rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div >
    );
}
