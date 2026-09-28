"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import { useLanguage } from "@/components/LanguageContext";
import type { PublicServer } from "@/lib/servers";
import { useServers } from "../../hooks/useServers";
import { useServerHealth } from "../../hooks/useServerHealth";
import { ServerSettingsCard } from "./ServerSettingsCard";
import { ServerModal } from "./ServerModal";

const GRID = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 min-[1800px]:grid-cols-4";
const SKELETON_COUNT = 3;

type ModalState = { open: false } | { open: true; server: PublicServer | null };

export function ServersTab() {
    const { t } = useLanguage();
    const { servers, error, isLoading, refresh, removeServer, setDisabled } = useServers();
    const health = useServerHealth(servers.length > 0);
    const [modal, setModal] = useState<ModalState>({ open: false });

    const onSaved = () => {
        setModal({ open: false });
        void refresh();
        void health.refresh();
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection title={t("settings.servers")} description="Connect and manage your Plex Media Servers.">
                {error && !servers.length ? (
                    <div role="alert" className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
                        Could not load servers: {error.message}{" "}
                        <button type="button" onClick={() => void refresh()} className="font-bold underline">
                            Retry
                        </button>
                    </div>
                ) : isLoading ? (
                    <div className={GRID} aria-busy="true">
                        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                            <div key={i} className="h-48 animate-pulse rounded-3xl bg-white/5 border border-white/5" />
                        ))}
                    </div>
                ) : (
                    <div className={GRID}>
                        {servers.map((server) => (
                            <ServerSettingsCard
                                key={server.id}
                                server={server}
                                health={health.healthFor(server.id)}
                                healthLoading={health.isLoading}
                                healthError={Boolean(health.error)}
                                onEdit={() => setModal({ open: true, server })}
                                onToggleDisabled={async () => {
                                    await setDisabled(server, !server.disabled);
                                    void health.refresh();
                                }}
                                onRemove={() => void removeServer(server)}
                            />
                        ))}

                        <button
                            type="button"
                            onClick={() => setModal({ open: true, server: null })}
                            className="group relative flex flex-col items-center justify-center min-h-[200px] rounded-3xl border border-dashed border-white/10 bg-white/5 transition-all hover:bg-white/10 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                            <div className="p-4 rounded-full bg-amber-500/10 text-amber-500 mb-4 group-hover:scale-110 transition-transform">
                                <Plus className="w-8 h-8" aria-hidden />
                            </div>
                            <span className="font-bold text-white group-hover:text-amber-400 transition-colors">
                                {t("settings.addServer")}
                            </span>
                        </button>
                    </div>
                )}
            </SettingsSection>

            {modal.open && (
                <ServerModal
                    // Remount per target so the form state never leaks between servers.
                    key={modal.server?.id ?? "new"}
                    server={modal.server}
                    onClose={() => setModal({ open: false })}
                    onSaved={onSaved}
                />
            )}
        </div>
    );
}
