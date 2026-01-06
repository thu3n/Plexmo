"use client";

import { PlexSession } from "@/lib/plex";
import { useState, useEffect } from "react";

const formatTimeStr = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${minutes}:${pad(seconds)}`;
};

const CinematicHoverReveal = ({ current, original, isDirect }: { current: React.ReactNode, original: React.ReactNode, isDirect: boolean }) => {
    return (
        <div className="group/reveal relative inline-flex items-center gap-1 cursor-help">
            <span className={`text-xs font-semibold tracking-wider ${isDirect ? 'text-white/80' : 'text-amber-400'}`}>
                {current}
            </span>

            {!isDirect && (
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/reveal:opacity-100 transition-all duration-300 transform translate-y-2 group-hover/reveal:translate-y-0 z-50">
                    <div className="bg-black/90 backdrop-blur-xl border border-white/10 px-3 py-2 rounded shadow-2xl">
                        <div className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Source</div>
                        <div className="whitespace-nowrap text-emerald-400 font-bold text-xs">{original}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const SessionCardCinematic = ({ session }: { session: PlexSession }) => {
    const [currentOffset, setCurrentOffset] = useState(session.viewOffset);

    // Initial load animation state
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

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
        <div className="group h-full rounded-md overflow-hidden relative shadow-2xl bg-black font-sans group hover:shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-all duration-500">

            {/* Cinematic Background Poster */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <img
                    src={`/api/image?path=${encodeURIComponent(session.thumb || "")}&serverId=${session.serverId || ""}`}
                    className="w-full h-full object-cover transition-transform duration-[3s] ease-out group-hover:scale-110 opacity-60 group-hover:opacity-40"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                {/* Vignette & Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent opacity-60" />
            </div>

            {/* Content Container */}
            <div className="absolute inset-0 flex flex-col z-10 p-5">

                {/* Top Bar: User & Status */}
                <div className="flex justify-between items-start opacity-0 translate-y-[-10px] group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75">
                    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full pl-1 pr-3 py-1 border border-white/5">
                        <img
                            src={session.userThumb || `https://ui-avatars.com/api/?name=${session.user}`}
                            alt={session.user}
                            className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="text-xs font-bold text-white tracking-wide">{session.user}</span>
                    </div>

                    {isTranscoding && (
                        <div className="px-2 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-500 text-[9px] font-black uppercase tracking-widest rounded animate-pulse">
                            Transcoding
                        </div>
                    )}
                </div>

                {/* Main Title Area (Center/Bottom) */}
                <div className="mt-auto mb-2 transform transition-transform duration-500 group-hover:-translate-y-2">
                    <div className={`text-[10px] uppercase tracking-[0.2em] text-white/60 font-medium mb-1 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        {session.grandparentTitle || session.year}
                    </div>
                    <h2 className={`text-2xl sm:text-3xl font-black text-white leading-none uppercase tracking-tight mb-2 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        {session.title}
                    </h2>
                    <div className="h-0.5 w-12 bg-emerald-500 mb-4 group-hover:w-full transition-all duration-700 ease-out opactiy-80" />

                    {/* Hidden Details that slide up */}
                    <div className="space-y-2 h-0 opacity-0 group-hover:h-auto group-hover:opacity-100 overflow-hidden transition-all duration-500">
                        <div className="flex justify-between items-center border-t border-white/10 pt-2 text-white/80">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-white/30 uppercase tracking-widest">Video</span>
                                <CinematicHoverReveal
                                    isDirect={!isTranscoding && session.videoDecision !== "transcode"}
                                    current={<span>{session.transcodeVideoCodec?.toUpperCase()} {session.transcodeHeight}p</span>}
                                    original={<span>{session.originalVideoCodec?.toUpperCase()} {session.originalHeight}p</span>}
                                />
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[9px] text-white/30 uppercase tracking-widest">Audio</span>
                                <CinematicHoverReveal
                                    isDirect={!isTranscoding && session.audioDecision !== "transcode"}
                                    current={<span>{session.transcodeAudioCodec?.toUpperCase()} {session.transcodeAudioChannels}</span>}
                                    original={<span>{session.originalAudioCodec?.toUpperCase()} {session.originalAudioChannels}</span>}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Progress Line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                <div
                    className="h-full bg-emerald-500 shadow-[0_0_15px_currentColor]"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Time Tooltip on Progress Line (Only visible on hover) */}
            <div className="absolute bottom-1 right-2 text-[9px] font-mono text-white/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {formatTimeStr(currentOffset)} / {formatTimeStr(session.duration)}
            </div>

        </div>
    );
};
