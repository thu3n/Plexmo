import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, HelpCircle } from "lucide-react";
import ImportStatsModal from "./ImportStatsModal";
import type { ImportStep, ImportStatus, Job } from "./types";

interface ImportProgressStepProps {
    step: ImportStep;
    status: ImportStatus | null;
    currentJob: Job | null;
    onReset: () => void;
}

/**
 * Steps 3-4 of the import wizard: live progress while importing, and the
 * completion summary with a statistics breakdown dialog.
 */
export default function ImportProgressStep({
    step,
    status,
    currentJob,
    onReset,
}: ImportProgressStepProps) {
    const [showDetails, setShowDetails] = useState(false);
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
                                    type="button"
                                    onClick={() => setShowDetails(true)}
                                    className="text-amber-500 hover:text-amber-400 transition-colors p-1"
                                    title="View Statistics Details"
                                    aria-label="View import statistics"
                                >
                                    <HelpCircle className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden relative">
                            <div
                                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300 ease-out"
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

            {currentJob && (
                <ImportStatsModal currentJob={currentJob} isOpen={showDetails} onClose={() => setShowDetails(false)} />
            )}
        </div>
    );
}
