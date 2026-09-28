"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/components/ui/Feedback";
import { fetchJsonOrThrow, requestJson } from "@/lib/swr-fetch";
import type { ImportStatus, ImportStep, Job, PlexmoServer, TautulliServerInfo } from "@/features/settings/components/import/types";

const JOB_POLL_MS = 1000;
const IGNORE_TARGET = "ignore";

type CheckResponse = { servers?: TautulliServerInfo[]; server?: TautulliServerInfo };

/** Pre-select the Plexmo server matching each Tautulli server by identifier, else by name. */
const autoMatch = (sources: TautulliServerInfo[], targets: PlexmoServer[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    for (const s of sources) {
        const match = targets.find(
            (p) => (s.identifier && p.identifier === s.identifier) || (p.name && s.name && p.name.toLowerCase() === s.name.toLowerCase())
        );
        if (match) mapping[s.param.toString()] = match.id;
    }
    return mapping;
};

/**
 * State machine for the Tautulli API import wizard:
 * connect → source_select (server mapping) → importing (job polling) → completed.
 */
export function useTautulliApiImport() {
    const [step, setStep] = useState<ImportStep>("connect");
    const [apiUrl, setApiUrl] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<ImportStatus | null>(null);
    const [sourceServers, setSourceServers] = useState<TautulliServerInfo[]>([]);
    const [plexmoServers, setPlexmoServers] = useState<PlexmoServer[]>([]);
    const [manualMapping, setManualMapping] = useState<Record<string, string>>({});
    const [ignoredServers, setIgnoredServers] = useState<Set<string>>(new Set());
    const [currentJob, setCurrentJob] = useState<Job | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = useCallback(() => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
    }, []);

    useEffect(() => stopPolling, [stopPolling]);

    const fail = (err: unknown, fallback: string) => setStatus({ success: false, error: errorMessage(err, fallback) });

    const toggleIgnore = (serverId: string) => {
        setIgnoredServers((prev) => {
            const next = new Set(prev);
            if (next.has(serverId)) next.delete(serverId);
            else next.add(serverId);
            return next;
        });
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        setStatus(null);
        try {
            const check = await requestJson<CheckResponse>("/api/settings/import/tautulli/check", {
                method: "POST",
                body: { url: apiUrl, apiKey },
            });
            const found = (check.servers ?? (check.server ? [check.server] : [])).filter(Boolean);
            if (found.length === 0) throw new Error("No Tautulli servers found.");

            const local = await fetchJsonOrThrow<{ servers?: PlexmoServer[] }>("/api/servers");
            const targets = local.servers ?? [];

            setSourceServers(found);
            setPlexmoServers(targets);
            setManualMapping(autoMatch(found, targets));
            setStep("source_select");
        } catch (err) {
            fail(err, "Failed to connect to Tautulli");
        } finally {
            setIsProcessing(false);
        }
    };

    const pollJob = (jobId: string) => {
        stopPolling();
        pollingRef.current = setInterval(async () => {
            try {
                const { job } = await fetchJsonOrThrow<{ job?: Job }>(`/api/jobs/${jobId}`);
                if (!job) return;
                setCurrentJob(job);
                if (job.status === "completed" || job.status === "failed") {
                    stopPolling();
                    setStep("completed");
                    setIsProcessing(false);
                    setStatus(
                        job.status === "completed"
                            ? { success: true, message: job.message || "Import Completed Successfully" }
                            : { success: false, error: job.message || "Import Job Failed" }
                    );
                }
            } catch (err) {
                // Transient (server busy importing); the next tick retries.
                console.error("Polling error", err);
            }
        }, JOB_POLL_MS);
    };

    const handleStartImport = async () => {
        setIsProcessing(true);
        setStatus(null);
        try {
            const mapping: Record<string, string> = {};
            for (const s of sourceServers) {
                const id = s.param.toString();
                const target = manualMapping[id];
                if (!ignoredServers.has(id) && target && target !== IGNORE_TARGET) mapping[id] = target;
            }
            if (Object.keys(mapping).length === 0) {
                throw new Error("No servers could be mapped. Please ensure at least one server matches.");
            }

            const { jobId } = await requestJson<{ jobId: string }>("/api/settings/import/tautulli/api", {
                method: "POST",
                body: { url: apiUrl, apiKey, serverMapping: mapping },
            });
            setStep("importing");
            pollJob(jobId);
        } catch (err) {
            fail(err, "Failed to start import");
            setIsProcessing(false);
        }
    };

    const reset = () => {
        stopPolling();
        setStep("connect");
        setStatus(null);
        setCurrentJob(null);
        setIsProcessing(false);
    };

    return {
        step,
        apiUrl,
        setApiUrl,
        apiKey,
        setApiKey,
        isProcessing,
        status,
        sourceServers,
        plexmoServers,
        manualMapping,
        setManualMapping,
        ignoredServers,
        toggleIgnore,
        currentJob,
        handleConnect,
        handleStartImport,
        reset,
    };
}
