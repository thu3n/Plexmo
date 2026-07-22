"use client";

import { PlexSession } from "@/lib/plex";
// import { formatTime } from "@/components/SessionCard"; // Removed to fix lint
import { useState, useEffect } from "react";

// Helper functions (copied to avoid export issues for now)
const formatTimeStr = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${minutes}:${pad(seconds)}`;
};

const HoverReveal = ({ current, original, isDirect }: { current: React.ReactNode, original: React.ReactNode, isDirect: boolean }) => {
    if (isDirect) {
        return <span className="text-emerald-500/90 font-medium">{original}</span>;
    }
    return (
        <div className="group/reveal relative inline-block cursor-help max-w-full">
            <span className="block border-b border-dotted border-amber-500/40 pb-0.5 text-amber-500/90 font-medium transition-colors duration-200 truncate hover:text-amber-400 hover:border-amber-400">
                {current}
            </span>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/reveal:opacity-100 transition-all duration-200 bg-neutral-900/95 px-3 py-2 rounded-lg z-50 whitespace-nowrap min-w-[140px] shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-white/5 text-[11px] font-sans tracking-wide text-neutral-300 transform translate-y-1 group-hover/reveal:translate-y-0 backdrop-blur-xl">
                <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold mb-1">Original Source</div>
                <div className="text-emerald-400 font-medium">{original}</div>
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-neutral-900/95"></div>
            </div>
        </div>
    );
};

export const SessionCardMinimal = ({ session }: { session: PlexSession }) => {
    // Live Timer
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
    const isTranscoding = session.decision === "transcode";

    return (
        <div className="group h-full bg-neutral-950/80 rounded-2xl overflow-hidden border border-white/5 hover:border-white/10 transition-all duration-500 hover:shadow-[0_0_40px_rgba(0,0,0,0.4)] flex flex-col relative font-sans">

            {/* Background blurred poster (Low opacity) */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none">
                <img
                    src={`/api/image?path=${encodeURIComponent(session.thumb || "")}&serverId=${session.serverId || ""}`}
                    className="w-full h-full object-cover blur-2xl scale-125"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-5 flex flex-col z-10">
                {/* Top Row: User & State */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden ring-2 ring-neutral-900/50 group-hover:ring-white/10 transition-all">
                                <img
                                    src={session.userThumb || `https://ui-avatars.com/api/?name=${session.user}`}
                                    alt={session.user}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-neutral-950 flex items-center justify-center ${session.state === 'playing' ? 'bg-emerald-500' : session.state === 'paused' ? 'bg-amber-500' : 'bg-neutral-500'}`}>
                                {session.state === 'playing' && <div className="w-1 h-1 bg-white rounded-full animate-pulse" />}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-neutral-200">{session.user}</div>
                            <div className="text-[10px] text-neutral-500 font-medium tracking-wide uppercase">{session.player} • {session.location === 'lan' ? 'Local' : 'Remote'}</div>
                        </div>
                    </div>

                    {/* Quality Badge */}
                    <div className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider border backdrop-blur-md ${isTranscoding ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                        {isTranscoding ? 'TRANSCODE' : 'DIRECT STOREAM'}
                    </div>
                </div>

                {/* Title Section */}
                <div className="mt-auto mb-4">
                    <h3 className="text-lg font-bold text-white leading-tight mb-1 line-clamp-1 group-hover:text-sky-400 transition-colors duration-300">
                        {session.grandparentTitle ? (
                            <span>{session.grandparentTitle} <span className="text-neutral-500 font-normal">S{session.parentIndex} E{session.index}</span></span>
                        ) : session.title}
                    </h3>
                    <div className="text-sm text-neutral-400 line-clamp-1">
                        {session.grandparentTitle ? session.title : session.year}
                    </div>
                </div>

                {/* Progress Bar (Minimal) */}
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-medium text-neutral-500">
                        <span>{formatTimeStr(currentOffset)}</span>
                        <span>{formatTimeStr(session.duration)}</span>
                    </div>
                    <div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-sky-500 rounded-full transition-all duration-1000 ease-linear"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Details (Expandable/Hover) */}
            <div className="bg-neutral-900/50 border-t border-white/5 p-4 text-[11px] grid grid-cols-2 gap-y-2 gap-x-4 backdrop-blur-sm z-10 transition-all duration-300">
                {/* Video */}
                <div className="space-y-0.5">
                    <div className="text-neutral-600 font-bold text-[9px] uppercase tracking-wider">Video</div>
                    <HoverReveal
                        isDirect={!isTranscoding}
                        current={<span>{session.transcodeVideoCodec?.toUpperCase()} {session.transcodeHeight}p</span>}
                        original={<span>{session.originalVideoCodec?.toUpperCase()} {session.originalHeight}p</span>}
                    />
                </div>

                {/* Audio */}
                <div className="space-y-0.5 text-right">
                    <div className="text-neutral-600 font-bold text-[9px] uppercase tracking-wider">Audio</div>
                    <HoverReveal
                        isDirect={!isTranscoding && session.audioDecision !== "transcode"}
                        current={<span>{session.transcodeAudioCodec?.toUpperCase()} {session.transcodeAudioChannels}ch</span>}
                        original={<span>{session.originalAudioCodec?.toUpperCase()} {session.originalAudioChannels}ch</span>}
                    />
                </div>

                {/* Bandwidth */}
                <div className="space-y-0.5">
                    <div className="text-neutral-600 font-bold text-[9px] uppercase tracking-wider">Bitrate</div>
                    <div className="text-neutral-400">
                        {Math.round((session.bandwidth || 0) / 1000)} Mbps
                    </div>
                </div>

                {/* Subtitle */}
                <div className="space-y-0.5 text-right">
                    <div className="text-neutral-600 font-bold text-[9px] uppercase tracking-wider">Subtitles</div>
                    <div className="text-neutral-400 truncate max-w-[100px] ml-auto">
                        {session.subtitleDecision === 'burn' ? 'Burn' : session.subtitleDecision === 'transcode' ? 'Transcode' : 'Direct'}
                    </div>
                </div>
            </div>
        </div>
    );
};
