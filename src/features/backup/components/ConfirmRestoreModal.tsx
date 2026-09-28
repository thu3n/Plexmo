"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

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
        <Modal
            isOpen
            onClose={onCancel}
            size="md"
            // Trailing `!` (Tailwind v4 important) so the danger border beats the shell's default.
            className="border-rose-500/20!"
            title={
                <span className="flex items-center gap-3 text-xl">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                        <AlertTriangle className="h-5 w-5" />
                    </span>
                    Restore from backup?
                </span>
            }
        >
            <div className="space-y-2 text-sm text-white/60">
                <p>
                    This replaces ALL current data with <span className="font-mono text-white/80">{fileName}</span> and restarts Plexmo.
                </p>
                <p>A copy of the current database is kept next to it as a pre-restore backup.</p>
            </div>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (typed === CONFIRM_WORD) onConfirm();
                }}
            >
                <div className="mt-6">
                    <label htmlFor="restore-confirm" className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">
                        Type {CONFIRM_WORD} to confirm
                    </label>
                    <input
                        id="restore-confirm"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        autoFocus
                        autoComplete="off"
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 font-mono text-white focus:border-rose-500 focus:outline-none"
                    />
                </div>
                <div className="mt-6 flex gap-4">
                    <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={typed !== CONFIRM_WORD}
                        className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Restore
                    </button>
                </div>
            </form>
        </Modal>
    );
}
