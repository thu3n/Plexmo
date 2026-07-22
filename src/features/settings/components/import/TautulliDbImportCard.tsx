"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { FileArchive, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";

type DbInfo = {
    rowCount: number;
    hasServerColumn: boolean;
    servers: { id: number; name: string; identifier: string | null }[];
    suggestedMapping: Record<string, string>;
};

type Job = { id: string; status: string; progress: number; message?: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Import/re-enrich history straight from a tautulli.db file. The complete
 * path: the API can't deliver codecs/resolutions in bulk, and rows already
 * imported via the API get UPDATED with the full data instead of skipped.
 */
export default function TautulliDbImportCard() {
    const [path, setPath] = useState("/app/config/import/Tautulli/tautulli.db");
    const [info, setInfo] = useState<DbInfo | null>(null);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [job, setJob] = useState<Job | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const { data: serversData } = useSWR<{ servers: { id: string; name: string }[] }>("/api/servers", fetcher);
    const plexmoServers = serversData?.servers ?? [];

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

    const check = async () => {
        setBusy(true); setError(null); setInfo(null); setJob(null);
        try {
            const res = await fetch("/api/settings/import/tautulli/db", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path, checkOnly: true }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Check failed");
            setInfo(data);
            setMapping(data.hasServerColumn ? data.suggestedMapping : { "0": plexmoServers[0]?.id ?? "ignore" });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Check failed");
        } finally {
            setBusy(false);
        }
    };

    const start = async () => {
        setBusy(true); setError(null);
        try {
            const res = await fetch("/api/settings/import/tautulli/db", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path, serverMapping: mapping }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Import failed to start");
            setJob({ id: data.jobId, status: "running", progress: 0 });
            pollRef.current = setInterval(async () => {
                const jobRes = await fetch(`/api/jobs/${data.jobId}`);
                if (!jobRes.ok) return;
                const j = (await jobRes.json()).job as Job;
                setJob(j);
                if (j.status === "completed" || j.status === "failed") {
                    if (pollRef.current) clearInterval(pollRef.current);
                }
            }, 2000);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Import failed to start");
        } finally {
            setBusy(false);
        }
    };

    const sources = info?.hasServerColumn
        ? info.servers.map((s) => ({ key: String(s.id), label: s.name }))
        : info ? [{ key: "0", label: "All history (single-server database)" }] : [];

    return (
        <SettingsCard>
            <div className="mb-4">
                <h3 className="font-bold text-white/90">Import from Tautulli database file</h3>
                <p className="mt-1 text-sm text-white/50">
                    Complete import: reads codecs, resolutions and stream decisions straight from tautulli.db.
                    Rows already imported via the API are upgraded in place.
                </p>
            </div>
            <div className="space-y-4">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="/app/config/import/Tautulli/tautulli.db"
                        className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90 placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                    />
                    <button
                        onClick={check}
                        disabled={busy || !path}
                        className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/20 disabled:opacity-40"
                    >
                        {busy && !info ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                    </button>
                </div>
                <p className="text-xs text-white/40">
                    The file must be readable inside the container (e.g. under <code>/app/config/import/</code>).
                    Copy a checkpointed snapshot - not a live file mid-write.
                </p>

                {error && (
                    <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                        <XCircle className="h-4 w-4 shrink-0" /> {error}
                    </div>
                )}

                {info && !job && (
                    <div className="space-y-3 rounded-xl border border-white/5 bg-white/5 p-4">
                        <p className="text-sm text-white/70">
                            <FileArchive className="mr-1 inline h-4 w-4" />
                            {info.rowCount.toLocaleString()} history rows
                            {info.hasServerColumn ? ` across ${info.servers.length} source servers` : " (single-server database)"}
                        </p>
                        {sources.map((source) => (
                            <div key={source.key} className="flex items-center justify-between gap-3">
                                <span className="text-sm text-white/80">{source.label}</span>
                                <select
                                    value={mapping[source.key] ?? "ignore"}
                                    onChange={(e) => setMapping((m) => ({ ...m, [source.key]: e.target.value }))}
                                    className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white/90"
                                >
                                    <option value="ignore">Ignore</option>
                                    {plexmoServers.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                        <button
                            onClick={start}
                            disabled={busy || Object.values(mapping).every((v) => v === "ignore")}
                            className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-40"
                        >
                            Start import
                        </button>
                    </div>
                )}

                {job && (
                    <div className="space-y-2 rounded-xl border border-white/5 bg-white/5 p-4">
                        <div className="flex items-center gap-2 text-sm text-white/80">
                            {job.status === "completed" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : job.status === "failed" ? (
                                <XCircle className="h-4 w-4 text-rose-400" />
                            ) : (
                                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                            )}
                            {job.message || job.status}
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/10">
                            <div
                                className="h-full rounded-full bg-amber-400 transition-all"
                                style={{ width: `${job.progress}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </SettingsCard>
    );
}
