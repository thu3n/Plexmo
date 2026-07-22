import clsx from "clsx";
import { UploadCloud, AlertTriangle, CheckCircle2, XCircle, Server, ArrowRight, Loader2 } from "lucide-react";
import type { PlexmoServer, TautulliServerInfo } from "./types";

interface ServerMappingStepProps {
    sourceServers: TautulliServerInfo[];
    plexmoServers: PlexmoServer[];
    manualMapping: Record<string, string>;
    ignoredServers: Set<string>;
    isProcessing: boolean;
    toggleIgnore: (serverId: string) => void;
    setManualMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    onCancel: () => void;
    onStartImport: () => void;
}

/**
 * Step 2 of the Tautulli import wizard: review/edit how each Tautulli source
 * server maps to a Plexmo server (or is ignored), then start the import.
 */
export default function ServerMappingStep({
    sourceServers,
    plexmoServers,
    manualMapping,
    ignoredServers,
    isProcessing,
    toggleIgnore,
    setManualMapping,
    onCancel,
    onStartImport,
}: ServerMappingStepProps) {
    return (
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
                    onClick={onCancel}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
                >
                    Cancel
                </button>
                <button
                    onClick={onStartImport}
                    className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                    Start Import
                </button>
            </div>
        </div>
    );
}
