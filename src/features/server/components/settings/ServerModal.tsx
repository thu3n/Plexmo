"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import { Modal } from "@/components/ui/Modal";
import { useLanguage } from "@/components/LanguageContext";
import type { PublicServer } from "@/lib/servers";
import { useServerForm } from "../../hooks/useServerForm";
import { usePlexDiscovery } from "../../hooks/usePlexDiscovery";
import type { DiscoveredConnection } from "../../lib/discovered-connections";
import { PlexDiscoveryPanel } from "./PlexDiscoveryPanel";
import { ServerTokenField } from "./ServerTokenField";
import { ServerColorPicker } from "./ServerColorPicker";

const INPUT = "w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none";
const LABEL = "block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider";
const TAB = "flex-1 py-2 rounded-lg text-sm font-bold transition-all";

export function ServerModal({
    server,
    onClose,
    onSaved,
}: {
    server: PublicServer | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t } = useLanguage();
    const ids = useId();
    const form = useServerForm(server, onSaved);
    const [mode, setMode] = useState<"auto" | "manual">(server ? "manual" : "auto");
    const [selectedId, setSelectedId] = useState("");

    const choose = (conn: DiscoveredConnection) => {
        setSelectedId(conn.id);
        form.applyDiscovered(conn);
    };
    const discovery = usePlexDiscovery((connections) => {
        // One server on the account: preselect its best connection.
        const servers = new Set(connections.map((c) => c.resourceId));
        const best = connections.find((c) => c.isBest);
        if (servers.size === 1 && best) choose(best);
    });

    const showForm = mode === "manual" || Boolean(server) || (discovery.signedIn && discovery.status === "ready" && discovery.connections.length > 0);
    const { values } = form;

    return (
        <Modal isOpen onClose={onClose} title={server ? t("common.edit") : t("settings.addServer")} size="lg" dismissible={!form.isSubmitting}>
            {!server && (
                <div className="flex bg-black/40 p-1 rounded-xl mb-6" role="group" aria-label="How to add the server">
                    <button type="button" aria-pressed={mode === "auto"} onClick={() => setMode("auto")} className={clsx(TAB, mode === "auto" ? "bg-amber-500 text-slate-900" : "text-white/50 hover:text-white")}>Plex Account</button>
                    <button type="button" aria-pressed={mode === "manual"} onClick={() => setMode("manual")} className={clsx(TAB, mode === "manual" ? "bg-amber-500 text-slate-900" : "text-white/50 hover:text-white")}>Manual</button>
                </div>
            )}

            {mode === "auto" && !server && (
                <PlexDiscoveryPanel
                    status={discovery.status}
                    error={discovery.error}
                    connections={discovery.connections}
                    selectedId={selectedId}
                    onSignIn={() => void discovery.signIn()}
                    onRetry={() => void (discovery.signedIn ? discovery.retryResources() : discovery.signIn())}
                    onReset={discovery.reset}
                    onSelect={choose}
                />
            )}

            {showForm && (
                <form onSubmit={form.submit} className="space-y-4">
                    <div>
                        <label htmlFor={`${ids}-name`} className={LABEL}>Name</label>
                        <input id={`${ids}-name`} value={values.name} onChange={(e) => form.setField("name", e.target.value)} className={INPUT} required />
                    </div>
                    <div>
                        <label htmlFor={`${ids}-url`} className={LABEL}>URL</label>
                        <input id={`${ids}-url`} value={values.baseUrl} onChange={(e) => form.setField("baseUrl", e.target.value)} placeholder="http://192.168.1.10:32400" inputMode="url" autoComplete="off" className={INPUT} required />
                    </div>
                    <ServerTokenField
                        id={`${ids}-token`}
                        value={values.token}
                        onChange={(v) => form.setField("token", v)}
                        canReveal={Boolean(server)}
                        showToken={form.showToken}
                        onToggleShow={() => void form.toggleShowToken()}
                        justCopied={form.justCopied}
                        onCopy={() => void form.copyToken()}
                    />
                    <ServerColorPicker value={values.color} serverId={server?.id} onChange={(c) => form.setField("color", c)} />

                    <div className="flex items-center justify-between gap-4 pt-4">
                        <button type="button" onClick={() => void form.testConnection()} disabled={form.isTesting || !values.baseUrl} className="shrink-0 text-sm font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-50">
                            {form.isTesting ? "Testing..." : "Test Connection"}
                        </button>
                        <span role="status" className={clsx("text-sm font-bold text-right min-w-0 break-words", form.testResult?.success ? "text-emerald-400" : "text-rose-400")}>
                            {form.testResult?.message}
                        </span>
                    </div>

                    <button type="submit" disabled={form.isSubmitting} className="w-full py-4 rounded-xl bg-amber-500 font-bold text-slate-900 hover:bg-amber-400 transition disabled:opacity-50 mt-4 shadow-lg shadow-amber-500/20">
                        {form.isSubmitting ? "Saving..." : "Save Server"}
                    </button>
                </form>
            )}
        </Modal>
    );
}
