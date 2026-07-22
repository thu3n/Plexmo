"use client";

import { useRef, useState } from "react";
import { Download, Loader2, RotateCcw, Upload } from "lucide-react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { useBackupRestore } from "../hooks/useBackupRestore";
import { ConfirmRestoreModal } from "./ConfirmRestoreModal";

/** Settings → Import: full backup download + same-instance restore with restart handling. */
export function BackupRestoreCard() {
    const { phase, error, downloadBackup, uploadRestore, reset } = useBackupRestore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const handleDownload = async () => {
        setDownloadError(null);
        try {
            await downloadBackup();
        } catch {
            setDownloadError("Failed to export backup");
        }
    };

    const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) setPendingFile(file);
    };

    return (
        <SettingsCard>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
                    <div className="flex gap-4">
                        <div className="h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                            <Download className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Backup &amp; Restore</h3>
                            <p className="text-sm text-white/50 mt-1">
                                Download a complete backup (database + session secret), or restore one - here or on a brand-new instance.
                            </p>
                            <p className="text-xs text-amber-400/80 mt-2">
                                The backup contains your Plex tokens and API key in plain text - store it safely.
                            </p>
                        </div>
                    </div>
                </div>

                {phase === "restarting" ? (
                    <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                        Restoring - Plexmo is restarting. This page reloads automatically when it is back.
                    </div>
                ) : (
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={handleDownload}
                            className="flex-1 px-6 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                        >
                            <Download className="w-4 h-4" /> Download backup
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={phase === "uploading"}
                            className="flex-1 px-6 py-2.5 rounded-lg bg-white/5 border border-rose-500/30 hover:bg-rose-500/10 text-rose-300 font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {phase === "uploading" ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Upload className="w-4 h-4" />
                            )}
                            Restore from backup...
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".zip"
                            onChange={handleFilePicked}
                            className="hidden"
                        />
                    </div>
                )}

                {(error || downloadError) && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
                        <span className="min-w-0 break-words">{error || downloadError}</span>
                        {error && (
                            <button onClick={reset} className="shrink-0 text-white/50 hover:text-white" aria-label="Dismiss">
                                <RotateCcw className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {pendingFile && (
                <ConfirmRestoreModal
                    fileName={pendingFile.name}
                    onCancel={() => setPendingFile(null)}
                    onConfirm={() => {
                        const file = pendingFile;
                        setPendingFile(null);
                        if (file) uploadRestore(file);
                    }}
                />
            )}
        </SettingsCard>
    );
}
