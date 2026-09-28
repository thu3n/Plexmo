import { Modal } from "@/components/ui/Modal";
import { parseImportStats } from "./import-stats";
import type { Job } from "./types";

interface ImportStatsModalProps {
    currentJob: Job;
    isOpen: boolean;
    onClose: () => void;
}

/** Breakdown of a finished Tautulli API import, parsed from the job's completion message. */
export default function ImportStatsModal({ currentJob, isOpen, onClose }: ImportStatsModalProps) {
    const { imported, skipped, failed, fixed } = parseImportStats(currentJob.message);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Statistics" size="xl">
            <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-emerald-400">Success</div>
                        <div className="text-2xl font-bold text-white">{imported}</div>
                    </div>
                    <ul className="text-xs text-emerald-200/60 list-disc list-inside space-y-1">
                        <li>Items successfully imported into Plexmo&apos;s database.</li>
                    </ul>
                </div>

                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-rose-400">Skipped</div>
                        <div className="text-2xl font-bold text-white">{skipped}</div>
                    </div>
                    <ul className="text-xs text-rose-200/60 list-disc list-inside space-y-1">
                        <li>Items were ignored because they already exist in your history.</li>
                        <li>
                            &quot;Incomplete data&quot; refers to sessions that have <strong>no stop time</strong>, usually because they are
                            currently active (ongoing) streams.
                        </li>
                    </ul>
                </div>

                {failed > 0 && (
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

            <button
                type="button"
                onClick={onClose}
                className="mt-6 w-full py-2 bg-white/10 hover:bg-white/15 text-white font-medium rounded-lg transition-colors"
            >
                Close
            </button>
        </Modal>
    );
}
