"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

const CONFIRM_WORD = "RESTORE";

/** Typed-confirmation danger modal: replacing the database is irreversible in place. */
export function ConfirmRestoreModal({
    fileName,
    onConfirm,
    onCancel,
}: {
    fileName: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const [typed, setTyped] = useState("");
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl border border-rose-500/20 bg-slate-900 p-8 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Restore from backup?</h2>
                </div>
                <div className="space-y-2 text-sm text-white/60">
                    <p>
                        This replaces ALL current data with <span className="font-mono text-white/80">{fileName}</span> and restarts Plexmo.
                    </p>
                    <p>A copy of the current database is kept next to it as a pre-restore backup.</p>
                </div>
                <div className="mt-6">
                    <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">
                        Type {CONFIRM_WORD} to confirm
                    </label>
                    <input
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        autoFocus
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 font-mono text-white focus:border-rose-500 focus:outline-none"
                    />
                </div>
                <div className="mt-6 flex gap-4">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={typed !== CONFIRM_WORD}
                        className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Restore
                    </button>
                </div>
            </div>
        </div>
    );
}
