"use client";

import { useState } from "react";
import { repairHistoryBatch } from "@/features/history/actions/repair-history";
import { Play, RotateCcw, AlertCircle, CheckCircle } from "lucide-react";

export function HistoryRepairPanel() {
    const [isRunning, setIsRunning] = useState(false);
    const [stats, setStats] = useState({
        scanned: 0,
        repaired: 0,
        failed: 0,
        notFound: 0,
        skipped: 0
    });
    const [lastStatus, setLastStatus] = useState<string>("Ready to start.");

    const runRepairLoop = async () => {
        setIsRunning(true);
        setLastStatus("Starting repair process...");

        // Reset stats if starting fresh? Or keep cumulative?
        // Let's reset for a new run.
        setStats({ scanned: 0, repaired: 0, failed: 0, notFound: 0, skipped: 0 });

        let keepGoing = true;

        while (keepGoing) {
            try {
                const result = await repairHistoryBatch(50);

                // Update stats
                setStats(prev => ({
                    scanned: prev.scanned + result.processed,
                    repaired: prev.repaired + result.repaired,
                    failed: prev.failed + result.failed,
                    notFound: prev.notFound + result.notFound,
                    skipped: prev.skipped + result.skipped
                }));

                if (result.processed === 0) {
                    keepGoing = false;
                    setLastStatus("Completed: No more items needing repair.");
                } else {
                    setLastStatus(`Processing... Repaired ${result.repaired} items in this batch.`);
                    // Small delay to let UI breathe
                    await new Promise(r => setTimeout(r, 100));
                }
            } catch (err) {
                console.error("Repair batch failed:", err);
                setLastStatus("Error: Batch failed. Stopping.");
                keepGoing = false;
            }
        }

        setIsRunning(false);
    };

    return (
        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium text-white">History Repair & Enrichment</h3>
                    <p className="text-sm text-white/50">
                        Scans history entries missing metadata (IMDB/TMDB IDs) and fetches them from your Plex Server.
                    </p>
                </div>

                <button
                    onClick={runRepairLoop}
                    disabled={isRunning}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                        ${isRunning
                            ? "bg-zinc-800 text-white/50 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"}
                    `}
                >
                    {isRunning ? (
                        <>
                            <RotateCcw className="w-4 h-4 animate-spin" />
                            Running...
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4" />
                            Start Repair
                        </>
                    )}
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-xs text-white/40 uppercase font-bold tracking-wider mb-1">Scanned</div>
                    <div className="text-2xl font-mono text-white">{stats.scanned}</div>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-xs text-emerald-500/70 uppercase font-bold tracking-wider mb-1">Repaired</div>
                    <div className="text-2xl font-mono text-emerald-400">{stats.repaired}</div>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-xs text-amber-500/70 uppercase font-bold tracking-wider mb-1">Not Found (404)</div>
                    <div className="text-2xl font-mono text-amber-400">{stats.notFound}</div>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-xs text-rose-500/70 uppercase font-bold tracking-wider mb-1">Failed</div>
                    <div className="text-2xl font-mono text-rose-400">{stats.failed}</div>
                </div>
            </div>

            {/* Status Bar */}
            <div className="flex items-center gap-2 text-xs font-mono bg-black/20 p-2 rounded-lg text-white/60">
                <div className={`w-2 h-2 rounded-full ${isRunning ? "bg-indigo-500 animate-pulse" : "bg-white/20"}`} />
                {lastStatus}
            </div>
        </div>
    );
}
