import React from "react";
import { getPlayerIconInfo } from "@/lib/platform-icons";

export const stateColor = (state: string) => {
    const s = state?.toLowerCase() || "";
    if (s === "playing") return "text-emerald-400";
    if (s === "paused") return "text-amber-400";
    if (s === "buffering") return "text-cyan-400 animate-pulse";
    return "text-slate-400";
};

export const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${minutes}:${pad(seconds)}`;
};

export const formatCodec = (codec?: string) => {
    if (!codec) return "";
    const c = codec.toLowerCase();
    const map: Record<string, string> = {
        "h264": "H.264",
        "h265": "H.265",
        "hevc": "H.265",
        "aac": "AAC",
        "ac3": "AC3",
        "eac3": "EAC3",
        "dca": "DTS",
        "dts": "DTS",
        "truehd": "TrueHD",
        "mpeg2video": "MPEG2",
        "mpeg4": "MPEG4"
    };
    return map[c] || codec.toUpperCase();
};

export const formatVideoRes = (height?: string | number) => {
    if (!height) return "";
    return String(height).toLowerCase().match(/[pi]$/) ? String(height) : `${height}p`;
};

export const formatAudioChannels = (channels?: string | number) => {
    if (!channels) return "";
    const c = String(channels);
    if (c === "2") return "2.0";
    if (c === "6") return "5.1";
    if (c === "8") return "7.1";
    return c;
};

export const getPlayerIcon = (player: string | undefined, platform: string | undefined, className: string = "w-5 h-5") => {
    const { icon, color } = getPlayerIconInfo(player, platform);

    return (
        <div
            className={`flex items-center justify-center rounded-sm bg-black/20 backdrop-blur-sm p-0.5 ${className}`}
            style={{ backgroundColor: `${color}20`, boxShadow: `0 0 10px ${color}40` }}
            title={player || platform}
        >
            <img
                src={`/images/platforms/${icon}.svg`}
                alt={player || "Player"}
                className="w-full h-full object-contain"
                onError={(e) => { e.currentTarget.src = "/images/platforms/plex.svg"; }}
            />
        </div>
    );
};
