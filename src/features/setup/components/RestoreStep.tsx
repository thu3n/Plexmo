"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { ArchiveRestore, ArrowLeft, Loader2 } from "lucide-react";
import { useBackupRestore } from "@/features/backup/hooks/useBackupRestore";

/**
 * First-run alternative path: restore a Plexmo backup zip onto a fresh
 * instance instead of setting up from scratch. Sessionless upload is allowed
 * by the restore route while zero servers exist.
 */
export function RestoreStep({ onBack }: { onBack: () => void }) {
    const { phase, error, uploadRestore, reset } = useBackupRestore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <motion.div
            key="step-restore"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md"
        >
            <div className="glass-panel rounded-2xl p-8 text-center backdrop-blur-xl">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30">
                    <ArchiveRestore className="h-8 w-8" />
                </div>
                <h2 className="mb-2 text-2xl font-semibold text-white">Restore from a backup</h2>
                <p className="mb-8 text-sm text-slate-400">
                    Upload a Plexmo backup zip to bring all servers, history and settings over to this instance. Plexmo restarts to apply it.
                </p>

                {phase === "restarting" ? (
                    <div className="flex items-center justify-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                        Restoring - Plexmo is restarting...
                    </div>
                ) : (
                    <>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={phase === "uploading"}
                            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4 font-bold text-white shadow-xl shadow-indigo-900/20 transition-all hover:scale-[1.01] disabled:opacity-60"
                        >
                            {phase === "uploading" ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin" /> Uploading...
                                </span>
                            ) : (
                                "Choose backup zip"
                            )}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".zip"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) uploadRestore(file);
                            }}
                        />
                        {error && (
                            <p className="mt-4 text-sm text-rose-400">
                                {error}{" "}
                                <button onClick={reset} className="underline hover:text-rose-300">
                                    Try again
                                </button>
                            </p>
                        )}
                        <button
                            onClick={onBack}
                            className="mt-6 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" /> Back to setup
                        </button>
                    </>
                )}
            </div>
        </motion.div>
    );
}
