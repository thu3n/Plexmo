"use client";

import { useRef, useState } from "react";

export type RestorePhase = "idle" | "uploading" | "restarting" | "error";

const RESTART_POLL_MS = 2000;
/** Give up waiting for the restart after 5 minutes (dev servers never come back on their own). */
const RESTART_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Shared backup/restore client logic for the Settings card and the setup
 * "Restore from backup" step. After a successful upload the server exits;
 * we poll /api/setup/status (public, middleware-exempt) until the process is
 * back, then hard-navigate to /login so the middleware re-evaluates state.
 */
export function useBackupRestore() {
    const [phase, setPhase] = useState<RestorePhase>("idle");
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const downloadBackup = async () => {
        const response = await fetch("/api/settings/export");
        if (!response.ok) throw new Error("Export failed");
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `plexmo-backup-${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const waitForRestart = () => {
        const startedAt = Date.now();
        let sawDown = false;
        pollRef.current = setInterval(async () => {
            if (Date.now() - startedAt > RESTART_TIMEOUT_MS) {
                if (pollRef.current) clearInterval(pollRef.current);
                setError(
                    "The app did not come back on its own. If you run without Docker, restart the process manually, then reload this page."
                );
                setPhase("error");
                return;
            }
            try {
                const res = await fetch("/api/setup/status", { cache: "no-store" });
                if (res.ok) {
                    // Only navigate once we've seen the app go DOWN first —
                    // otherwise we'd react to the old process pre-exit.
                    if (sawDown) {
                        if (pollRef.current) clearInterval(pollRef.current);
                        window.location.href = "/login";
                    }
                } else {
                    sawDown = true;
                }
            } catch {
                sawDown = true;
            }
        }, RESTART_POLL_MS);
    };

    const uploadRestore = async (file: File) => {
        setPhase("uploading");
        setError(null);
        try {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/settings/import/plexmo", { method: "POST", body: form });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || "Restore upload failed");
            setPhase("restarting");
            waitForRestart();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Restore upload failed");
            setPhase("error");
        }
    };

    const reset = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        setPhase("idle");
        setError(null);
    };

    return { phase, error, downloadBackup, uploadRestore, reset };
}
