"use client";

import { PlexSession } from "@/lib/plex";
import { useState, useEffect } from "react";

// Helper functions
const formatTimeStr = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${minutes}:${pad(seconds)}`;
};

const DataRow = ({ label, value, sub, highlight = false }: { label: string, value: string | React.ReactNode, sub?: string, highlight?: boolean }) => (
    <div className="flex justify-between items-start text-[10px] sm:text-[11px] border-b border-white/5 pb-1">
        <span className="text-white/40 font-mono uppercase tracking-wider pt-0.5">{label}</span>
        <div className="flex flex-col items-end text-right">
            <span className={`font-medium ${highlight ? 'text-amber-400' : 'text-white/90'}`}>{value}</span>
            {sub && <span className="text-[9px] text-white/40 font-mono">{sub}</span>}
        </div>
    </div>
);

export const SessionCardData = ({ session }: { session: PlexSession }) => {
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
        <div className="group h-full bg-[#0a0a0a] rounded-lg overflow-hidden border border-white/10 hover:border-amber-500/50 transition-all shadow-xl font-mono text-xs flex flex-col relative before:absolute before:inset-0 before:bg-[url('/grid-pattern.svg')] before:opacity-5 before:pointer-events-none">

            {/* Header Status Bar */}
            <div className="bg-white/5 border-b border-white/10 px-3 py-2 flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${session.state === 'playing' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="text-white/60 uppercase font-bold tracking-widest text-[9px]">{session.state}</span>
                </div>
                <div className="font-mono text-amber-500 font-bold text-[10px]">
                    {isTranscoding ? 'TRANSCODING' : 'DIRECT STREAM'}
                </div>
            </div>

            {/* Main Content Split */}
            <div className="flex-1 flex flex-row overflow-hidden">
                {/* Visual Side (Narrower) */}
                <div className="w-[80px] sm:w-[100px] shrink-0 relative bg-black/50 border-r border-white/5">
                    <div className="absolute inset-0">
                        <img
                            src={`/api/image?path=${encodeURIComponent(session.thumb || "")}&serverId=${session.serverId || ""}`}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent opacity-80" />
                    </div>

                    {/* User Avatar Overlay */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded border border-white/20 p-0.5 bg-black/50 backdrop-blur-sm shadow-lg z-20 tooltip" title={session.user}>
                        <img
                            src={session.userThumb || `https://ui-avatars.com/api/?name=${session.user}`}
                            alt={session.user}
                            className="w-full h-full object-cover rounded-[2px]"
                        />
                    </div>
                </div>

                {/* Data Grid Side */}
                <div className="flex-1 p-3 flex flex-col gap-2 z-10 overflow-y-auto custom-scrollbar">
                    <div className="mb-2">
                        <h3 className="text-white font-bold leading-tight truncate text-sm" title={session.title}>{session.title}</h3>
                        <div className="text-white/40 text-[10px] truncate">{session.grandparentTitle || session.year}</div>
                    </div>

                    {/* Data Table */}
                    <div className="space-y-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <DataRow label="Container" value={isTranscoding ? session.transcodeContainer : session.originalContainer} highlight={isTranscoding && !!session.transcodeContainer} />

                        <DataRow
                            label="Video"
                            value={`${session.transcodeVideoCodec || session.originalVideoCodec} (${session.transcodeHeight || session.originalHeight}p)`}
                            sub={isTranscoding ? `Orig: ${session.originalVideoCodec} (${session.originalHeight}p)` : undefined}
                            highlight={isTranscoding}
                        />

                        <DataRow
                            label="Audio"
                            value={`${session.transcodeAudioCodec || session.originalAudioCodec} ${session.transcodeAudioChannels || session.originalAudioChannels}ch`}
                            sub={isTranscoding ? `Orig: ${session.originalAudioCodec} ${session.originalAudioChannels}ch` : undefined}
                            highlight={isTranscoding}
                        />

                        <DataRow label="Bitrate" value={`${Math.round((session.bandwidth || 0) / 1000)} Mbps`} />
                    </div>
                </div>
            </div>

            {/* Technical Footer */}
            <div className="bg-black border-t border-white/10 px-3 py-1.5 flex justify-between items-center text-[9px] text-white/30 font-mono">
                <span>{session.location?.toUpperCase()} — {session.ip}</span>
                <span>{formatTimeStr(currentOffset)}</span>
            </div>

            {/* Progress Bar Line */}
            <div className="relative h-0.5 w-full bg-white/5">
                <div
                    className="absolute top-0 left-0 h-full bg-amber-500 shadow-[0_0_8px_currentColor]"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
        </div>
    );
};
