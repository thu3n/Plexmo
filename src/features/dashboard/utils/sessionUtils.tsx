import React from "react";

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
    const p = (player || platform || "").toLowerCase();

    // Map keywords to icon filenames
    const platformMap: Record<string, string> = {
        "android": "android",
        "ios": "ios",
        "apple": "ios",
        "iphone": "ios",
        "ipad": "ios",
        "tvos": "atv",
        "chrome": "chrome",
        "firefox": "firefox",
        "edge": "msedge",
        "safari": "safari",
        "lg": "lg",
        "webos": "lg",
        "samsung": "samsung",
        "tizen": "samsung",
        "roku": "roku",
        "playstation": "playstation",
        "ps4": "playstation",
        "ps5": "playstation",
        "xbox": "xbox",
        "wiiu": "wiiu",
        "kodi": "kodi",
        "plexamp": "plexamp",
        "linux": "linux",
        "macos": "macos",
        "osx": "macos",
        "windows": "windows",
        "opera": "opera",
        "ie": "ie",
        "dlna": "dlna",
        "chromecast": "chromecast",
        "alexa": "alexa",
        "tivo": "tivo"
    };

    let icon = "plex"; // Default
    let color = "#e5a00d"; // Default color

    const platformColors: Record<string, string> = {
        "alexa": "#00caff", "android": "#3ddc84", "atv": "#a2aaad", "chrome": "#db4437",
        "chromecast": "#4285f4", "default": "#e5a00d", "dlna": "#4ba32f", "firefox": "#ff7139",
        "gtv": "#008bcf", "ie": "#18bcef", "ios": "#a2aaad", "kodi": "#30aada",
        "lg": "#990033", "linux": "#0099cc", "macos": "#a2aaad", "msedge": "#0078d7",
        "opera": "#fa1e4e", "playstation": "#003087", "plex": "#e5a00d", "plexamp": "#e5a00d",
        "roku": "#673293", "safari": "#00d3f9", "samsung": "#034ea2", "synclounge": "#151924",
        "tivo": "#00a7e1", "wiiu": "#03a9f4", "windows": "#0078d7", "wp": "#68217a",
        "xbmc": "#3b4872", "xbox": "#107c10"
    };

    for (const [key, value] of Object.entries(platformMap)) {
        if (p.includes(key)) {
            icon = value;
            if (platformColors[icon]) color = platformColors[icon];
            break;
        }
    }

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
