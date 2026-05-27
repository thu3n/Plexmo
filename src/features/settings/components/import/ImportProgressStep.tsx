import { CheckCircle2, XCircle, Loader2, HelpCircle } from "lucide-react";
import type { ImportStep, ImportStatus, Job } from "./types";

interface ImportProgressStepProps {
    step: ImportStep;
    status: ImportStatus | null;
    currentJob: Job | null;
    showDetails: boolean;
    setShowDetails: (show: boolean) => void;
    onReset: () => void;
}

/**
 * Steps 3-4 of the import wizard: live progress while importing, and the
 * completion summary. The richer stats modal here is the original inline copy;
 * the page also renders a portal-based ImportStatsModal that visually shadows it
 * (see note in page.tsx). Kept as-is to avoid behavior change.
 */
export default function ImportProgressStep({
    step,
    status,
    currentJob,
    showDetails,
    setShowDetails,
    onReset,
}: ImportProgressStepProps) {
    return (
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
                    onClick={onReset}
                    className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
                >
                    Start New Import
                </button>
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
    );
}
