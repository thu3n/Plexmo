"use client";

import { ArrowUpCircle, CheckCircle2, Clock, Code, ExternalLink, Github, HelpCircle, Package } from "lucide-react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { Skeleton } from "@/components/Skeleton";
import type { UpdateStatus } from "@/lib/update-check";

export interface VersionInfo {
    version: string;
    name: string;
    repository: { type: string; url: string };
    startedAt: string;
    update: UpdateStatus;
}

const FALLBACK_REPO_URL = "https://github.com/thu3n/plexmo";

const formatLocalDateTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });

const linkClass =
    "px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/30 text-white/80 hover:text-white text-sm font-medium transition-all flex items-center gap-2";

function UpdateBadge({ update }: { update: UpdateStatus }) {
    if (update.status === "available") {
        return (
            <a
                href={update.latest.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
                <ArrowUpCircle className="w-4 h-4 shrink-0" />
                Update available: v{update.latest.version} — release notes
                <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
        );
    }
    if (update.status === "current") {
        return (
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Up to date
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/50">
            <HelpCircle className="w-4 h-4 shrink-0" />
            Could not check for updates
        </span>
    );
}

export function VersionCard({ info, isLoading }: { info: VersionInfo | undefined; isLoading: boolean }) {
    const repoUrl = info?.repository?.url?.replace(/\.git$/, "") || FALLBACK_REPO_URL;
    const currentVersionUrl = `${repoUrl}/releases/tag/v${info?.version}`;

    return (
        <SettingsCard>
            <div className="space-y-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white">Version Information</h3>
                        <p className="text-sm text-white/50 max-w-xl leading-relaxed">
                            Current version and runtime details for this Plexmo instance
                        </p>
                    </div>
                    <Package className="w-8 h-8 text-amber-500/50" />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-white/50 text-sm">
                            <Code className="w-4 h-4" />
                            <span>Current Version</span>
                        </div>
                        {isLoading ? (
                            <Skeleton className="h-12" />
                        ) : info ? (
                            <div className="flex items-baseline gap-3">
                                <span className="text-4xl font-bold text-white tracking-tight">v{info.version}</span>
                                <a
                                    href={currentVersionUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-amber-500 hover:text-amber-400 transition-colors text-sm font-medium flex items-center gap-1"
                                >
                                    Release Notes
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        ) : (
                            <div className="text-lg font-medium text-white/50">Unknown</div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-white/50 text-sm">
                            <Clock className="w-4 h-4" />
                            <span>Running Since</span>
                        </div>
                        {isLoading ? (
                            <Skeleton className="h-12" />
                        ) : (
                            <div className="text-lg font-medium text-white/80">
                                {info?.startedAt ? formatLocalDateTime(info.startedAt) : "Unknown"}
                            </div>
                        )}
                    </div>
                </div>

                {isLoading ? <Skeleton className="h-10 w-56 rounded-xl" /> : info?.update && <UpdateBadge update={info.update} />}

                <div className="pt-4 border-t border-white/5 flex flex-wrap gap-3">
                    <a href={`${repoUrl}/releases`} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        <Github className="w-4 h-4" />
                        All Releases
                        <ExternalLink className="w-3 h-3" />
                    </a>
                    <a href={repoUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        <Github className="w-4 h-4" />
                        GitHub Repository
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </div>
        </SettingsCard>
    );
}
