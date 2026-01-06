
import type { HistoryEntry } from "@/lib/history";
import type { PlexSession } from "@/lib/plex";
import React from "react";

import { formatDateTime, formatTime } from "@/lib/format";
// Helpers duplicated/moved from HistoryList for consistency

export const decodeHtmlEntities = (str?: string): string => {
    if (!str) return "";

    // Basic entities
    let decoded = str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        // Swedish Characters
        .replace(/&aring;/g, "å")
        .replace(/&Aring;/g, "Å")
        .replace(/&auml;/g, "ä")
        .replace(/&Auml;/g, "Ä")
        .replace(/&ouml;/g, "ö")
        .replace(/&Ouml;/g, "Ö")
        // Numeric Entities (Decimal)
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
        // Numeric Entities (Hex)
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    // Sometimes double encoding happens (e.g. &amp;#228;)
    if (decoded.includes("&#")) {
        decoded = decoded
            .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
            .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }

    return decoded;
};

export const formatAudioChannels = (channels?: string | number) => {
    if (!channels) return "";
    const c = String(channels);
    if (c === "2") return "2.0";
    if (c === "6") return "5.1";
    if (c === "8") return "7.1";
    return c;
};

export const formatCodec = (codec?: string) => {
    if (!codec) return "";
    const c = codec.toLowerCase();
    if (c === "h264") return "H.264";
    if (c === "h265" || c === "hevc") return "H.265";
    if (c === "aac") return "AAC";
    if (c === "ac3") return "AC3";
    if (c === "eac3" || c === "aac3") return "EAC3";
    if (c === "dca" || c === "dts") return "DTS";
    if (c === "truehd") return "TrueHD";
    return codec.toUpperCase();
};

export const formatVideoRes = (height?: string | number) => {
    if (!height) return "";
    return String(height).toLowerCase().match(/[pi]$/) ? String(height) : `${height}p`;
};

export const getPlayerIcon = (player: string | undefined, platform: string | undefined, className: string = "w-5 h-5") => {
    const p = (player || platform || "").toLowerCase();
    const platformMap: Record<string, string> = {
        "android": "android", "ios": "ios", "apple": "ios", "iphone": "ios", "ipad": "ios",
        "tvos": "atv", "chrome": "chrome", "firefox": "firefox", "edge": "msedge",
        "safari": "safari", "lg": "lg", "webos": "lg", "samsung": "samsung", "tizen": "samsung",
        "roku": "roku", "playstation": "playstation", "ps4": "playstation", "ps5": "playstation",
        "xbox": "xbox", "wiiu": "wiiu", "kodi": "kodi", "plexamp": "plexamp", "linux": "linux",
        "macos": "macos", "osx": "macos", "windows": "windows", "opera": "opera", "ie": "ie",
        "dlna": "dlna", "chromecast": "chromecast", "alexa": "alexa", "tivo": "tivo"
    };

    const platformColors: Record<string, string> = {
        "alexa": "#00caff", "android": "#3ddc84", "atv": "#a2aaad", "chrome": "#db4437",
        "chromecast": "#4285f4", "default": "#e5a00d", "dlna": "#4ba32f", "firefox": "#ff7139",
        "gtv": "#008bcf", "ie": "#18bcef", "ios": "#a2aaad", "kodi": "#30aada", "lg": "#990033",
        "linux": "#0099cc", "macos": "#a2aaad", "msedge": "#0078d7", "opera": "#fa1e4e",
        "playstation": "#003087", "plex": "#e5a00d", "plexamp": "#e5a00d", "roku": "#673293",
        "safari": "#00d3f9", "samsung": "#034ea2", "synclounge": "#151924", "tivo": "#00a7e1",
        "wiiu": "#03a9f4", "windows": "#0078d7", "wp": "#68217a", "xbmc": "#3b4872", "xbox": "#107c10"
    };

    let icon = "plex";
    let color = "#e5a00d";
    for (const [key, value] of Object.entries(platformMap)) {
        if (p.includes(key)) {
            icon = value;
            if (platformColors[icon]) color = platformColors[icon];
            break;
        }
    }

    return (
        <div className={`flex items-center justify-center rounded-sm shadow-sm ${className}`} style={{ backgroundColor: color, minWidth: '20px', minHeight: '20px' }}>
            <img src={`/images/platforms/${icon}.svg`} alt={player || "Player"} className="w-[70%] h-[70%] object-contain" onError={(e) => { e.currentTarget.src = "/images/platforms/plex.svg"; }} />
        </div>
    );
};

export const HoverReveal = ({ current, original, isDirect }: { current: React.ReactNode, original: React.ReactNode, isDirect: boolean }) => {
    if (isDirect) {
        return <>{original}</>;
    }
    return (
        <div className="group/reveal relative cursor-help inline-block">
            <div className="group-hover/reveal:hidden">
                {current}
            </div>
            <div className="hidden group-hover/reveal:block">
                {original}
            </div>
        </div>
    );
};

export type BadgeVariant = 'default' | 'success' | 'warning';

export const DetailBadge = ({ children, variant = 'default', className = "" }: { children: React.ReactNode, variant?: BadgeVariant, className?: string }) => {
    const variants = {
        default: "bg-white/10 border-white/5 text-white/90 hover:bg-white/20",
        success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20",
        warning: "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
    };

    return (
        <div className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] font-medium transition-colors ${variants[variant]} ${className}`}>
            {children}
        </div>
    );
};

export const getSplitDisplayTitle = (entry: HistoryEntry, details: PlexSession | null, locale: string) => {
    if (!details) return { mainTitle: decodeHtmlEntities(entry.title), subTitle: "" };

    let mainTitle = decodeHtmlEntities(entry.title);
    let subTitle = "";
    const isTV = !!details.grandparentTitle;

    if (isTV) {
        mainTitle = decodeHtmlEntities(details.grandparentTitle!);

        let parentIndex = details.parentIndex;
        let index = details.index;

        // Try to parse SxxExx if missing properties
        if ((!parentIndex || !index) && details.subtitle) {
            const match = details.subtitle.match(/S(\d+)\s+E(\d+)/i) || details.subtitle.match(/(\d+)x(\d+)/);
            if (match) {
                parentIndex = parseInt(match[1], 10);
                index = parseInt(match[2], 10);
            }
        }

        if (parentIndex !== undefined && index !== undefined) {
            const isSv = locale.startsWith('sv');
            const seasonStr = isSv ? "Säsong" : "Season";
            const episodeStr = isSv ? "Episod" : "Episode";
            const episodeTitle = decodeHtmlEntities(details.originalTitle || details.title);
            subTitle = `${seasonStr} ${parentIndex} ${episodeStr} ${index} - ${episodeTitle}`;
        } else {
            subTitle = decodeHtmlEntities(details.title || "");
        }
    } else {
        // Movie
        // For movies, we might want to show Year as subtitle if available, similar to Dashboard
        subTitle = details.year || "";
        mainTitle = decodeHtmlEntities(details.title || mainTitle); // Ensure main title is decoded from details if available
    }

    return { mainTitle, subTitle, isTV };
};

// Standardized Date Format: YYYY-MM-DD HH:MM
export { formatDateTime, formatTime };

// Hook for live pause timer
export const useLivePause = (entry: HistoryEntry) => {
    const isActive = !entry.stopTime;
    const details = entry.meta_json ? (JSON.parse(entry.meta_json) as PlexSession) : null;
    const isPaused = details?.state === "paused";
    const initialPausedCounter = entry.pausedCounter || 0;
    return initialPausedCounter;
}
