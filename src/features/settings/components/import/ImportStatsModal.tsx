import { createPortal } from "react-dom";
import { XCircle } from "lucide-react";
import type { Job } from "./types";

interface ImportStatsModalProps {
    currentJob: Job;
    onClose: () => void;
}

/**
 * Import statistics modal, rendered into document.body via a portal to avoid the
 * stacking-context/overflow issues of the nested settings card. Parses the
 * imported/skipped counts out of the job's completion message.
 */
export default function ImportStatsModal({ currentJob, onClose }: ImportStatsModalProps) {
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                    <h3 className="text-xl font-bold text-white">Import Statistics</h3>
                    <button
                        onClick={onClose}
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
                        onClick={onClose}
                        className="w-full py-2 bg-white/10 hover:bg-white/15 text-white font-medium rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
