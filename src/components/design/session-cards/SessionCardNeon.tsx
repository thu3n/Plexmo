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

const NeonHoverReveal = ({ current, original, isDirect }: { current: React.ReactNode, original: React.ReactNode, isDirect: boolean }) => {
    return (
        <div className="group/reveal relative inline-block cursor-help max-w-full">
            <span className={`block pb-0.5 font-bold tracking-widest uppercase text-[10px] transition-all duration-300 ${isDirect ? 'text-pink-500 drop-shadow-[0_0_5px_rgba(236,72,153,0.5)]' : 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)] border-b border-dashed border-cyan-400/50 hover:text-cyan-300'}`}>
                {current}
            </span>

            {!isDirect && (
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover/reveal:opacity-100 transition-all duration-200 z-50">
                    <div className="bg-black/95 border border-cyan-500/50 px-3 py-2 clip-path-polygon shadow-[0_0_20px_rgba(34,211,238,0.3)] min-w-[120px] text-center">
                        <div className="text-[8px] uppercase tracking-widest text-cyan-500/70 mb-1">Original Source</div>
                        <div className="text-white font-mono text-[10px] tracking-wide">{original}</div>
                    </div>
                    {/* Connecting Line */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-3 bg-cyan-500/50"></div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full translate-y-2.5 shadow-[0_0_5px_currentColor]"></div>
                </div>
            )}
        </div>
    );
};

export const SessionCardNeon = ({ session }: { session: PlexSession }) => {
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
        <div className="group h-full bg-black relative rounded-xl overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.8)] border border-pink-500/20 hover:border-pink-500/60 transition-all duration-300 font-sans">

            {/* Background elements */}
            <div className="absolute inset-0 bg-[#0b0b0f]">
                {/* Scanlines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_4px,3px_100%] pointer-events-none" />

                {/* Poster Glitch Effect */}
                <div className="absolute top-0 right-0 w-2/3 h-full opacity-20 mask-gradient-left">
                    <img
                        src={`/api/image?path=${encodeURIComponent(session.thumb || "")}&serverId=${session.serverId || ""}`}
                        className="w-full h-full object-cover grayscale mix-blend-screen"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                </div>
            </div>

            {/* Glowing Accent Lines */}
            <div className="absolute top-0 left-0 w-1 h-16 bg-pink-500 shadow-[0_0_10px_#ec4899]"></div>
            <div className="absolute top-0 left-0 w-16 h-1 bg-pink-500 shadow-[0_0_10px_#ec4899]"></div>
            <div className="absolute bottom-0 right-0 w-1 h-16 bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
            <div className="absolute bottom-0 right-0 w-16 h-1 bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>

            {/* Content Module */}
            <div className="relative z-10 h-full flex flex-col p-5">

                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-8 h-8 rounded bg-neutral-900 border border-pink-500/50 p-0.5">
                                <img
                                    src={session.userThumb || `https://ui-avatars.com/api/?name=${session.user}`}
                                    alt={session.user}
                                    className="w-full h-full object-cover grayscale"
                                />
                            </div>
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-pink-500 animate-pulse shadow-[0_0_5px_#ec4899]"></div>
                        </div>
                        <div className="text-pink-500 font-bold tracking-widest text-[10px] uppercase drop-shadow-[0_0_3px_rgba(236,72,153,0.5)]">
                            {session.user}
                        </div>
                    </div>

                    <div className={`text-[9px] font-black uppercase tracking-[0.2em] py-1 px-2 border ${isTranscoding ? 'border-cyan-400 text-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.3)]' : 'border-pink-500 text-pink-500 shadow-[0_0_5px_rgba(236,72,153,0.3)]'}`}>
                        {isTranscoding ? 'Transcode' : 'Direct Play'}
                    </div>
                </div>

                {/* Title */}
                <div className="mb-auto">
                    <h3 className="text-white font-black text-xl uppercase tracking-tighter leading-none mb-1 drop-shadow-[2px_2px_0px_rgba(236,72,153,0.5)] truncate">
                        {session.title}
                    </h3>
                    <div className="text-pink-500/60 font-mono text-[10px] uppercase tracking-wider">
                        {session.grandparentTitle || session.year} // <span className="text-cyan-400/60">{session.player}</span>
                    </div>
                </div>

                {/* Tech Specs Block */}
                <div className="bg-black/80 border border-white/5 p-3 backdrop-blur-sm relative overflow-hidden group-hover:border-cyan-500/30 transition-colors">
                    {/* Decorative grid */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none" />

                    <div className="relative z-10 grid grid-cols-2 gap-y-3 gap-x-2">
                        <div className="space-y-1">
                            <div className="text-[8px] text-white/30 uppercase tracking-widest">Resolution</div>
                            <NeonHoverReveal
                                isDirect={!isTranscoding}
                                current={<span>{session.transcodeHeight}p <span className="text-[8px] opacity-70">{session.transcodeVideoCodec?.toUpperCase()}</span></span>}
                                original={<span>{session.originalHeight}p <span className="opacity-70">{session.originalVideoCodec?.toUpperCase()}</span></span>}
                            />
                        </div>

                        <div className="space-y-1 text-right">
                            <div className="text-[8px] text-white/30 uppercase tracking-widest">Audio</div>
                            <NeonHoverReveal
                                isDirect={!isTranscoding && session.audioDecision !== "transcode"}
                                current={<span>{session.transcodeAudioCodec?.toUpperCase()} <span className="text-[8px] opacity-70">{session.transcodeAudioChannels}</span></span>}
                                original={<span>{session.originalAudioCodec?.toUpperCase()} <span className="opacity-70">{session.originalAudioChannels}</span></span>}
                            />
                        </div>
                    </div>
                </div>

                {/* Progress Bar (Cyberpunk style) */}
                <div className="mt-4 relative h-3 bg-neutral-900 border border-white/10 skew-x-[-20deg] overflow-hidden">
                    {/* Ticks */}
                    <div className="absolute inset-0 flex justify-between px-[1px]">
                        {[...Array(20)].map((_, i) => <div key={i} className="w-[1px] h-full bg-black/50" />)}
                    </div>

                    <div
                        className="h-full bg-pink-500 shadow-[0_0_10px_#ec4899] relative"
                        style={{ width: `${progressPercent}%` }}
                    >
                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-white animate-pulse" />
                    </div>
                </div>
                <div className="text-right mt-1 text-[9px] font-mono text-cyan-400">
                    {Math.round(progressPercent || 0)}%_COMPLETE
                </div>

            </div>
        </div>
    );
};
