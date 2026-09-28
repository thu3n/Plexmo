"use client";

import clsx from "clsx";
import { ArrowRight, CheckCircle2, Database, Loader2, XCircle } from "lucide-react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { useTautulliApiImport } from "@/features/settings/hooks/useTautulliApiImport";
import ServerMappingStep from "./ServerMappingStep";
import ImportProgressStep from "./ImportProgressStep";

const inputClass =
    "w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors";

/** Tautulli API import wizard card plus its connect-step status banner (a grid sibling). */
export default function TautulliApiImportCard() {
    const wizard = useTautulliApiImport();
    const { step, status, isProcessing } = wizard;

    return (
        <>
            <SettingsCard>
                <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                    <div className="flex gap-4">
                        <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                            <Database className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 w-full">
                            <h3 className="text-lg font-bold text-white">Tautulli Import</h3>
                            <p className="text-sm text-white/50 mt-1 mb-6">Import history directly from your Tautulli instance via API.</p>

                            <div className="space-y-6">
                                {step === "connect" && (
                                    <form onSubmit={wizard.handleConnect} className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                        <div className="space-y-4">
                                            <div>
                                                <label htmlFor="tautulli-url" className="block text-xs font-bold text-white/70 uppercase mb-1.5">Tautulli URL</label>
                                                <input id="tautulli-url" type="url" required placeholder="http://192.168.1.50:8181" value={wizard.apiUrl} onChange={(e) => wizard.setApiUrl(e.target.value)} className={inputClass} />
                                            </div>
                                            <div>
                                                <label htmlFor="tautulli-key" className="block text-xs font-bold text-white/70 uppercase mb-1.5">API Key</label>
                                                <input id="tautulli-key" type="text" required autoComplete="off" placeholder="Enter your Tautulli API Key" value={wizard.apiKey} onChange={(e) => wizard.setApiKey(e.target.value)} className={clsx(inputClass, "font-mono")} />
                                            </div>
                                        </div>
                                        <button type="submit" disabled={isProcessing} className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 mt-2">
                                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                                            {isProcessing ? "Connecting..." : "Connect"}
                                        </button>
                                    </form>
                                )}

                                {step === "source_select" && (
                                    <ServerMappingStep
                                        sourceServers={wizard.sourceServers}
                                        plexmoServers={wizard.plexmoServers}
                                        manualMapping={wizard.manualMapping}
                                        ignoredServers={wizard.ignoredServers}
                                        isProcessing={isProcessing}
                                        toggleIgnore={wizard.toggleIgnore}
                                        setManualMapping={wizard.setManualMapping}
                                        onCancel={wizard.reset}
                                        onStartImport={wizard.handleStartImport}
                                    />
                                )}

                                {(step === "importing" || step === "completed") && (
                                    <ImportProgressStep step={step} status={status} currentJob={wizard.currentJob} onReset={wizard.reset} />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </SettingsCard>

            {/* The later steps render their own status; this covers connect-step errors. */}
            {status && step === "connect" && (
                <div
                    role={status.success ? "status" : "alert"}
                    className={clsx(
                        "p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 2xl:col-span-2",
                        status.success ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    )}
                >
                    {status.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
                    <div className="min-w-0 break-words">
                        <h4 className="font-bold text-sm">{status.success ? "Success" : "Error"}</h4>
                        <p className="text-sm opacity-80 mt-1">{status.message || status.error}</p>
                    </div>
                </div>
            )}
        </>
    );
}
