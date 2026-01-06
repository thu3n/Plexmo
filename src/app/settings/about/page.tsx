"use client";

import { useState, useEffect } from "react";
import { SettingsSection, SettingsCard } from "../components/SettingsComponents";
import { useLanguage } from "@/components/LanguageContext";
import { Github, ExternalLink, Package, Calendar, Code } from "lucide-react";

interface VersionInfo {
    version: string;
    name: string;
    repository: {
        type: string;
        url: string;
    };
    buildDate: string;
}

export default function AboutPage() {
    const { t } = useLanguage();
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchVersion() {
            try {
                const response = await fetch("/api/version");
                const data = await response.json();
                setVersionInfo(data);
            } catch (error) {
                console.error("Failed to fetch version info:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchVersion();
    }, []);

    const repoUrl = versionInfo?.repository?.url?.replace('.git', '') || 'https://github.com/thu3n/plexmo';
    const releasesUrl = `${repoUrl}/releases`;
    const currentVersionUrl = `${repoUrl}/releases/tag/v${versionInfo?.version}`;

    return (
        <div className="space-y-8">
            <SettingsSection
                title="About Plexmo"
                description="Application version and project information"
            >
                <div className="grid gap-6">
                    {/* Version Card */}
                    <SettingsCard>
                        <div className="space-y-6">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-white">Version Information</h3>
                                    <p className="text-sm text-white/50 max-w-xl leading-relaxed">
                                        Current version and build details for this Plexmo instance
                                    </p>
                                </div>
                                <Package className="w-8 h-8 text-amber-500/50" />
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Current Version */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-white/50 text-sm">
                                        <Code className="w-4 h-4" />
                                        <span>Current Version</span>
                                    </div>
                                    {loading ? (
                                        <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
                                    ) : (
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-4xl font-bold text-white tracking-tight">
                                                v{versionInfo?.version}
                                            </span>
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
                                    )}
                                </div>

                                {/* Build Date */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-white/50 text-sm">
                                        <Calendar className="w-4 h-4" />
                                        <span>Instance Started</span>
                                    </div>
                                    {loading ? (
                                        <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
                                    ) : (
                                        <div className="text-lg font-medium text-white/80">
                                            {versionInfo?.buildDate ? new Date(versionInfo.buildDate).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            }) : 'Unknown'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quick Links */}
                            <div className="pt-4 border-t border-white/5 flex flex-wrap gap-3">
                                <a
                                    href={releasesUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/30 text-white/80 hover:text-white text-sm font-medium transition-all flex items-center gap-2"
                                >
                                    <Github className="w-4 h-4" />
                                    All Releases
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                                <a
                                    href={repoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/30 text-white/80 hover:text-white text-sm font-medium transition-all flex items-center gap-2"
                                >
                                    <Github className="w-4 h-4" />
                                    GitHub Repository
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </div>
                    </SettingsCard>

                    {/* Project Info Card */}
                    <SettingsCard>
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-white">Project Information</h3>
                                    <p className="text-sm text-white/50 max-w-xl leading-relaxed">
                                        Plexmo is a free and open source monitoring and analytics dashboard for your Plex ecosystem
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-4 text-sm">
                                <div className="flex items-center justify-between py-2 border-b border-white/5">
                                    <span className="text-white/50">License</span>
                                    <span className="text-white font-medium">MIT License</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-white/5">
                                    <span className="text-white/50">Tech Stack</span>
                                    <span className="text-white font-medium">Next.js 16 · TypeScript · Tailwind CSS 4</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-white/5">
                                    <span className="text-white/50">Database</span>
                                    <span className="text-white font-medium">Prisma · SQLite</span>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-white/50">Development Philosophy</span>
                                    <span className="text-white font-medium flex items-center gap-2">
                                        <span className="text-purple-400">✨</span>
                                        Vibe Coded
                                    </span>
                                </div>
                            </div>

                            <div className="pt-4 text-xs text-white/30 italic">
                                This project is developed independently and is not affiliated with Plex Inc.
                            </div>
                        </div>
                    </SettingsCard>
                </div>
            </SettingsSection>
        </div>
    );
}
