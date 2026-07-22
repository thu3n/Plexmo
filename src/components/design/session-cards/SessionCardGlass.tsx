"use client";

import { PlexSession } from "@/lib/plex";
import { useState, useEffect } from "react";

// Helper functions (duplicated for speed)
const formatTimeStr = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${minutes}:${pad(seconds)}`;
};

const GlassHoverReveal = ({ current, original, isDirect }: { current: React.ReactNode, original: React.ReactNode, isDirect: boolean }) => {
    if (isDirect) {
        return <span className="text-white/90 drop-shadow-md">{original}</span>;
    }
    return (
        <div className="group/reveal relative inline-block cursor-help max-w-full">
            <span className="block border-b border-dashed border-white/30 pb-0.5 text-white/90 font-semibold truncate hover:text-white hover:border-white transition-all drop-shadow-md">
                {current}
            </span>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/reveal:opacity-100 transition-all duration-300 bg-white/10 backdrop-blur-2xl px-4 py-3 rounded-xl z-50 whitespace-nowrap min-w-[160px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/20 text-xs text-white transform translate-y-2 group-hover/reveal:translate-y-0 text-center">
                <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">ORIGINAL SOURCE</div>
                <div className="font-bold tracking-wide text-amber-300 drop-shadow-sm text-sm">{original}</div>
            </div>
        </div>
    );
};

export const SessionCardGlass = ({ session }: { session: PlexSession }) => {
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
        <div className="group h-full rounded-3xl overflow-hidden relative shadow-2xl transition-transform duration-500 hover:scale-[1.02] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] font-sans">

            {/* Background Image (Full Sized) */}
            <div className="absolute inset-0 z-0">
                <img
                    src={`/api/image?path=${encodeURIComponent(session.thumb || "")}&serverId=${session.serverId || ""}`}
                    className="w-full h-full object-cover transform transition-transform duration-[2s] group-hover:scale-110"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
            </div>

            {/* Glass Container */}
            <div className="absolute inset-x-2 bottom-2 top-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm flex flex-col p-4 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] overflow-hidden group-hover:backdrop-blur-md transition-all duration-500 z-10">

                {/* Floating Badge */}
                <div className="absolute top-0 right-0 p-3">
                    <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest shadow-lg backdrop-blur-xl border border-white/10 flex items-center gap-1.5 ${isTranscoding ? 'bg-amber-500/80 text-white' : 'bg-emerald-500/80 text-white'}`}>
                        {isTranscoding ? (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                TRANSCODING
                            </>
                        ) : 'DIRECT PLAY'}
                    </div>
                </div>

                {/* User Bubble */}
                <div className="flex items-center gap-3 mb-auto">
                    <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-white/30 to-white/10 shadow-lg backdrop-blur-md">
                        <img
                            src={session.userThumb || `https://ui-avatars.com/api/?name=${session.user}`}
                            alt={session.user}
                            className="w-full h-full rounded-full object-cover"
                        />
                    </div>
                    <div>
                        <div className="text-white font-bold text-sm leading-none shadow-black drop-shadow-md">{session.user}</div>
                        <div className="text-white/60 text-[10px] font-semibold tracking-wide uppercase mt-0.5">{session.player}</div>
                    </div>
                </div>

                {/* Content Info */}
                <div className="mb-4 space-y-1">
                    <h3 className="text-xl font-black text-white leading-tight drop-shadow-xl line-clamp-2">
                        {session.grandparentTitle ? (
                            <span className="flex flex-col">
                                <span className="text-white/70 text-sm font-bold uppercase tracking-wide mb-0.5">{session.grandparentTitle}</span>
                                <span>{session.title}</span>
                            </span>
                        ) : session.title}
                    </h3>

                    {/* Progress */}
                    <div className="pt-2">
                        <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden backdrop-blur-sm shadow-inner">
                            <div
                                className="h-full bg-gradient-to-r from-white to-white/80 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] relative overflow-hidden"
                                style={{ width: `${progressPercent}%` }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-1/2 animate-[shimmer_2s_infinite] skew-x-12" />
                            </div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-white/50 mt-1.5 tracking-wider">
                            <span>{formatTimeStr(currentOffset)}</span>
                            <span>{formatTimeStr(session.duration)}</span>
                        </div>
                    </div>
                </div>

                {/* Glass Footer Details */}
                <div className="bg-black/20 -mx-4 -mb-4 p-4 backdrop-blur-xl border-t border-white/10 grid grid-cols-2 gap-y-3 gap-x-2 text-[10px] transition-all duration-300 translate-y-full group-hover:translate-y-0 opacity-0 group-hover:opacity-100 absolute bottom-0 w-[calc(100%+2rem)]">
                    {/* Video */}
                    <div className="flex flex-col">
                        <span className="text-white/40 font-bold uppercase tracking-wider mb-0.5">Stream</span>
                        <GlassHoverReveal
                            isDirect={!isTranscoding && session.videoDecision !== "transcode"}
                            current={<span>{session.transcodeVideoCodec?.toUpperCase()} {session.transcodeHeight}p</span>}
                            original={<span>{session.originalVideoCodec?.toUpperCase()} {session.originalHeight}p</span>}
                        />
                    </div>

                    {/* Bitrate */}
                    <div className="flex flex-col text-right">
                        <span className="text-white/40 font-bold uppercase tracking-wider mb-0.5">Bitrate</span>
                        <span className="text-white font-semibold">{Math.round((session.bandwidth || 0) / 1000)} Mbps</span>
                    </div>

                    {/* Audio */}
                    <div className="flex flex-col col-span-2 border-t border-white/5 pt-2 mt-1">
                        <div className="flex justify-between items-center">
                            <span className="text-white/40 font-bold uppercase tracking-wider">Audio</span>
                            <GlassHoverReveal
                                isDirect={!isTranscoding && session.audioDecision !== "transcode"}
                                current={<span className="flex items-center gap-1.5">{session.transcodeAudioCodec?.toUpperCase()} <span className="bg-white/10 px-1 rounded text-white/70">{session.transcodeAudioChannels}</span></span>}
                                original={<span>{session.originalAudioCodec?.toUpperCase()} {session.originalAudioChannels}</span>}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
