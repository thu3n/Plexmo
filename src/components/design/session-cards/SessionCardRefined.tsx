"use client";

import type { PlexSession } from "@/lib/plex";
import { useEffect, useState } from "react";

const stateColor = (state: string) => {
    const s = state?.toLowerCase() || "";
    if (s === "playing") return "text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]";
    if (s === "paused") return "text-amber-400";
    if (s === "buffering") return "text-cyan-400 animate-pulse";
    return "text-slate-400";
};

const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${minutes}:${pad(seconds)}`;
};

// Compact Badge for Tech Specs
const TechBadge = ({ label, value, original, isTranscode }: { label?: string, value: string | React.ReactNode, original?: string | React.ReactNode, isTranscode?: boolean }) => {
    if (!value) return null;

    return (
        <div className={`group/badge relative flex items-center gap-1.5 px-2 py-1.5 rounded-md border backdrop-blur-sm transition-all text-[10px] font-medium shrink-0 ${isTranscode ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'}`}>
            {label && <span className="text-[9px] uppercase tracking-wider opacity-50 font-bold">{label}</span>}
            <span className="truncate max-w-[80px]">{value}</span>

            {/* Tooltip for Original */}
            {isTranscode && original && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/badge:opacity-100 transition-all pointer-events-none transform translate-y-2 group-hover/badge:translate-y-0 z-50">
                    <div className="bg-neutral-900/95 border border-white/10 text-white/80 px-2 py-1.5 rounded shadow-xl whitespace-nowrap">
                        <div className="text-[8px] uppercase tracking-widest text-white/30 mb-0.5">Original</div>
                        <div className="text-[10px] font-mono text-emerald-400">{original}</div>
                    </div>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-neutral-900/95"></div>
                </div>
            )}
        </div>
    );
};

export const SessionCardRefined = ({ session }: { session: PlexSession }) => {
    const isTranscoding = session.decision === "transcode";

    const [currentOffset, setCurrentOffset] = useState(session.viewOffset);
    useEffect(() => { setCurrentOffset(session.viewOffset); }, [session.viewOffset]);

    useEffect(() => {
        if (session.state !== "playing") return;
        const interval = setInterval(() => {
            setCurrentOffset((prev) => Math.min(prev + 1000, session.duration));
        }, 1000);
        return () => clearInterval(interval);
    }, [session.state, session.duration]);

    const progressPercent = session.duration > 0 ? Math.min(100, (currentOffset / session.duration) * 100) : 0;
    const bitrate = session.quality || (session.bandwidth ? `${Math.round(session.bandwidth / 1000 * 10) / 10} Mbps` : null);

    return (
        <div className="group h-full bg-[#0f0f0f] rounded-2xl overflow-hidden border border-white/5 shadow-2xl flex flex-col hover:border-white/10 transition-all duration-500 hover:scale-[1.01]">

            {/* Top Section: Split Layout (Original Style) */}
            <div className="flex flex-row h-56 sm:h-64 w-full relative">

                {/* Poster - Left Side (38% width) */}
                <div className="relative w-[38%] shrink-0 overflow-hidden border-r border-white/5 bg-black">
                    <img
                        src={session.thumb?.startsWith('/') ? session.thumb : `/api/image?path=${encodeURIComponent(session.thumb || "")}&serverId=${session.serverId || ""}`}
                        alt={session.title}
                        className="h-full w-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                        onError={(e) => { e.currentTarget.src = "/poster_placeholder.jpg"; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {/* Platform Icon */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                        <div className="bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 shadow-lg inline-block">
                            <span className="text-[9px] font-bold text-white/80 uppercase tracking-wider block px-1">
                                {session.platform || "Plex"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Details - Right Side */}
                <div className="flex-1 min-w-0 p-4 flex flex-col bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] relative z-10">

                    {/* Header Info */}
                    <div className="mb-4">
                        <div className="flex justify-between items-start text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1">
                            <span className="truncate pr-2">{session.serverName}</span>
                            <span className="truncate text-right">{session.player}</span>
                        </div>

                        {/* Stream Decision Badge (Prominent) */}
                        <div className="inline-flex items-center gap-2 mb-2 px-2 py-0.5 rounded bg-white/5 border border-white/5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isTranscoding ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isTranscoding ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {isTranscoding ? 'Transcode' : 'Direct Stream'}
                            </span>
                            {isTranscoding && bitrate && <span className="text-[10px] text-white/30 font-mono border-l border-white/10 pl-2">{bitrate}</span>}
                        </div>
                    </div>

                    {/* Tech Badges Area (Replacing List) */}
                    <div className="flex-1 overflow-y-auto content-start">
                        <div className="flex flex-wrap gap-2 content-start">
                            <TechBadge
                                label="VID"
                                value={`${session.transcodeVideoCodec || session.originalVideoCodec} · ${session.transcodeHeight || session.originalHeight}p`}
                                original={`${session.originalVideoCodec} · ${session.originalHeight}p`}
                                isTranscode={isTranscoding}
                            />

                            <TechBadge
                                label="AUD"
                                value={`${session.transcodeAudioCodec || session.originalAudioCodec} · ${session.transcodeAudioChannels || session.originalAudioChannels}`}
                                original={`${session.originalAudioCodec} · ${session.originalAudioChannels}`}
                                isTranscode={!isTranscoding && session.audioDecision === "transcode"}
                            />

                            {session.transcodeContainer && (
                                <TechBadge
                                    label="CON"
                                    value={session.transcodeContainer?.toUpperCase()}
                                    original={session.originalContainer?.toUpperCase()}
                                    isTranscode={true}
                                />
                            )}

                            {session.subtitleDecision && session.subtitleDecision !== 'none' && (
                                <TechBadge
                                    label="SUB"
                                    value={session.subtitleDecision === 'burn' ? 'Burn' : 'Transcode'}
                                    original={session.originalSubtitleCodec}
                                    isTranscode={true}
                                />
                            )}
                        </div>
                    </div>

                    {/* Location Footer */}
                    <div className="mt-auto pt-3 border-t border-white/5 flex justify-between items-center text-[10px] text-white/30 font-mono">
                        <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${session.location === 'lan' ? 'bg-emerald-500/50' : 'bg-amber-500/50'}`} />
                            {session.location?.toUpperCase()}
                        </div>
                        <span>{session.ip}</span>
                    </div>

                </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-1 w-full bg-white/5 group-hover:h-1.5 transition-all">
                <div
                    className="absolute top-0 left-0 h-full transition-all duration-1000 ease-linear shadow-[0_0_15px_currentColor]"
                    style={{ width: `${progressPercent}%`, backgroundColor: session.state === 'playing' ? '#10b981' : '#f59e0b', color: session.state === 'playing' ? '#10b981' : '#f59e0b' }}
                />
            </div>

            {/* Footer Info (Standard) */}
            <div className="bg-[#151515] p-3 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`${stateColor(session.state)} shrink-0`}>
                        {session.state === 'paused' ? (
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                        ) : (
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        )}
                    </div>
                    <div className="overflow-hidden">
                        <div className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                            {session.title}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-white/50">
                            <span className="truncate">{session.grandparentTitle ? `S${session.parentIndex} E${session.index}` : session.year}</span>
                            <span className="opacity-30">•</span>
                            <span className="font-mono opacity-70">{formatTime(currentOffset)} / {formatTime(session.duration)}</span>
                        </div>
                    </div>
                </div>

                {/* User */}
                <div className="pl-2 shrink-0">
                    <div className="w-8 h-8 rounded-full ring-2 ring-white/10 overflow-hidden p-0.5 bg-black">
                        <img
                            src={session.userThumb || `https://ui-avatars.com/api/?name=${session.user}`}
                            alt={session.user}
                            className="w-full h-full rounded-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                            title={session.user}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
