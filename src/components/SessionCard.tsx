"use client";

import type { PlexSession } from "@/lib/plex";
import { useEffect, useState, MouseEvent } from "react";
import Link from "next/link";
import { useLanguage } from "./LanguageContext";
import { DetailBadge, HoverReveal } from "./HistoryHelpers";

const stateColor = (state: string) => {
    const s = state?.toLowerCase() || "";
    if (s === "playing") return "text-emerald-400";
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

const formatCodec = (codec?: string) => {
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

const formatVideoRes = (height?: string | number) => {
    if (!height) return "";
    return String(height).toLowerCase().match(/[pi]$/) ? String(height) : `${height}p`;
};

const formatAudioChannels = (channels?: string | number) => {
    if (!channels) return "";
    const c = String(channels);
    if (c === "2") return "2.0";
    if (c === "6") return "5.1";
    if (c === "8") return "7.1";
    return c;
};

const getPlayerIcon = (player: string | undefined, platform: string | undefined, className: string = "w-5 h-5") => {
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



export const SessionCard = ({ session, serverColor, isLimitExceeded }: { session: PlexSession; serverColor?: string; isLimitExceeded?: boolean }) => {
    const { t } = useLanguage();
    const barColor = serverColor || "#f59e0b";
    const isTranscoding = session.decision?.toLowerCase() === "transcode";
    const isTV = /^(S\d+|\d+x\d+)/.test(session.subtitle || "") || /^S\d+ E\d+$/.test(session.subtitle || "");

    // Live Timer
    const [currentOffset, setCurrentOffset] = useState(session.viewOffset);

    // Stop Stream State
    const [showStopConfirm, setShowStopConfirm] = useState(false);
    const [isTerminating, setIsTerminating] = useState(false);

    useEffect(() => { setCurrentOffset(session.viewOffset); }, [session.viewOffset]);

    useEffect(() => {
        if (session.state !== "playing") return;
        const interval = setInterval(() => {
            setCurrentOffset((prev) => Math.min(prev + 1000, session.duration));
        }, 1000);
        return () => clearInterval(interval);
    }, [session.state, session.duration]);

    const handleStopStream = async () => {
        const idToUse = session.sessionId || session.sessionKey;

        if (!idToUse) {
            alert("Unable to stop stream: Session ID missing. Please refresh the page.");
            console.error("Missing sessionId/sessionKey:", session);
            return;
        }

        setIsTerminating(true);
        try {
            const res = await fetch("/api/session/terminate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: idToUse,
                    serverId: session.serverId,
                    reason: "Stopped by Admin"
                })
            });

            if (!res.ok) throw new Error("Failed to stop stream");

            // Optionally we could trigger a refresh here, but SWR will catch it eventually.
            // For now, let's just close the modal. The user will see it disappear on next poll.
            setShowStopConfirm(false);

        } catch (error) {
            console.error("Stop stream error:", error);
            alert("Failed to stop stream");
            setIsTerminating(false);
        }
    };

    const progressPercent = session.duration > 0 ? Math.min(100, (currentOffset / session.duration) * 100) : 0;
    const bitrate = session.quality || (session.bandwidth ? `${Math.round(session.bandwidth / 1000 * 10) / 10} Mbps` : null);

    return (
        <div className={`group glass-panel rounded-2xl overflow-hidden flex flex-col h-full transform transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-black/50 relative ${isLimitExceeded ? "ring-2 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]" : ""}`}>

            {/* Warning Badge for Rule Violation */}
            {isLimitExceeded && (
                <div className="absolute top-0 left-0 z-50 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg shadow-lg flex items-center gap-1 animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                    </svg>
                    LIMIT EXCEEDED
                </div>
            )}

            {/* Stop Stream Confirmation Overlay */}
            {showStopConfirm && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center animate-in fade-in duration-200">
                    <div className="h-12 w-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-1">Stop Stream?</h3>
                    <p className="text-white/50 text-xs mb-6 px-4">
                        Are you sure you want to kick <strong>{session.user}</strong>?
                    </p>
                    <div className="flex gap-2 w-full">
                        <button
                            onClick={() => setShowStopConfirm(false)}
                            className="flex-1 py-2 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleStopStream}
                            disabled={isTerminating}
                            className="flex-1 py-2 rounded-lg bg-rose-500 text-white font-bold text-sm hover:bg-rose-600 transition-colors disabled:opacity-50"
                        >
                            {isTerminating ? "Stopping..." : "Confirm"}
                        </button>
                    </div>
                </div>
            )}

            {/* Stop Button (Hover Reveal) */}
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowStopConfirm(true);
                }}
                className="absolute top-2 right-2 z-40 bg-black/60 hover:bg-rose-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm shadow-xl translate-y-2 group-hover:translate-y-0"
                title="Stop Stream"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                </svg>
            </button>

            {/* Top Section: Poster + Info */}
            <div className="flex flex-row h-56 sm:h-64 w-full relative">
                {/* Poster - Left Side */}
                <div className="relative w-[38%] shrink-0 overflow-hidden border-r border-white/5">
                    {session.thumb ? (
                        <div className="absolute inset-0">
                            <img
                                src={`/api/image?path=${encodeURIComponent(session.thumb)}&serverId=${session.serverId || ""}`}
                                alt={session.title}
                                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                            />
                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        </div>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-900">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/images/Plexmo_icon.png"
                                alt="No Poster"
                                className="h-16 w-16 object-contain opacity-20 grayscale"
                            />
                        </div>
                    )}

                    {/* Platform Icon - Moved to Poster to save space and fix overlap */}
                    <div className="absolute top-2 left-2 shadow-lg">
                        {session.player && getPlayerIcon(session.player, session.platform, "w-6 h-6 rounded-md shadow-lg")}
                    </div>
                </div>

                {/* Metadata - Right Side */}
                <div className="flex-1 min-w-0 p-3 flex flex-col bg-gradient-to-b from-white/5 to-transparent backdrop-blur-md relative z-10 overflow-hidden">

                    <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar h-full pr-1">

                        {/* Detail Badge Component */}
                        {(() => {


                            return (
                                <>
                                    {/* Server */}
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider shrink-0">{t("session.server")}</span>
                                        <DetailBadge>{session.serverName}</DetailBadge>
                                    </div>

                                    {/* Player */}
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider shrink-0">{t("session.player")}</span>
                                        <DetailBadge>{session.player}</DetailBadge>
                                    </div>

                                    {/* Stream Decision */}
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider shrink-0">{t("session.stream")}</span>
                                        <HoverReveal
                                            isDirect={!isTranscoding && session.decision !== "direct stream"}
                                            current={
                                                session.decision === "direct stream" ? <DetailBadge variant="warning">Direct Stream</DetailBadge> :
                                                    <DetailBadge variant="warning">
                                                        {t("session.transcode")}
                                                    </DetailBadge>
                                            }
                                            original={<DetailBadge variant="success">{t("session.directPlay")}</DetailBadge>}
                                        />
                                    </div>

                                    {/* Quality */}
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider shrink-0">{t("session.quality")}</span>
                                        <DetailBadge variant={session.isOriginalQuality || !session.qualityProfile || session.qualityProfile === "Original" ? "success" : "warning"} className="min-w-0 max-w-full">
                                            <div className="truncate text-ellipsis overflow-hidden whitespace-nowrap">
                                                <span>
                                                    {session.isOriginalQuality ? "Original" : (session.qualityProfile || "Original")}
                                                </span>
                                                {bitrate && <span className="text-white/40 ml-1">({bitrate})</span>}
                                            </div>
                                        </DetailBadge>
                                    </div>

                                    {/* Container */}
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider shrink-0">{t("session.container")}</span>
                                        <HoverReveal
                                            isDirect={!session.transcodeContainer || session.decision === "direct play"}
                                            current={<DetailBadge variant="warning">{session.transcodeContainer?.toUpperCase() || ""}</DetailBadge>}
                                            original={<DetailBadge variant="success">{session.originalContainer?.toUpperCase() || "MKV"}</DetailBadge>}
                                        />
                                    </div>

                                    {/* Video */}
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider shrink-0">VIDEO</span>
                                        <HoverReveal
                                            isDirect={session.videoDecision === "direct play" || session.videoDecision === "direct stream"}
                                            current={
                                                <DetailBadge variant="warning">
                                                    {formatCodec(session.transcodeVideoCodec)} {session.transcodeHwEncoding && "(HW)"} {formatVideoRes(session.transcodeHeight)}
                                                </DetailBadge>
                                            }
                                            original={
                                                <DetailBadge variant={session.videoDecision === "direct stream" ? "warning" : "success"}>
                                                    {formatCodec(session.originalVideoCodec)} {formatVideoRes(session.originalHeight || session.resolution)}
                                                </DetailBadge>
                                            }
                                        />
                                    </div>

                                    {/* Audio */}
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider shrink-0">AUDIO</span>
                                        <HoverReveal
                                            isDirect={session.audioDecision === "direct play" || session.audioDecision === "direct stream"}
                                            current={
                                                <DetailBadge variant="warning">
                                                    {formatCodec(session.transcodeAudioCodec)} {session.transcodeAudioChannels === "2" ? "2.0" : formatAudioChannels(session.transcodeAudioChannels)}
                                                </DetailBadge>
                                            }
                                            original={
                                                <DetailBadge variant={session.audioDecision === "direct stream" ? "warning" : "success"}>
                                                    {formatCodec(session.originalAudioCodec)} {formatAudioChannels(session.originalAudioChannels)}
                                                </DetailBadge>
                                            }
                                        />
                                    </div>

                                    {/* Subtitle */}
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider shrink-0">SUB</span>
                                        {(!session.originalSubtitleCodec && !session.transcodeSubtitleCodec) ? <span className="text-white/30">-</span> :
                                            <HoverReveal
                                                isDirect={session.subtitleDecision !== "transcode" && session.subtitleDecision !== "burn"}
                                                current={
                                                    <DetailBadge variant="warning">
                                                        {(session.transcodeSubtitleCodec || session.subtitleDecision || "").toUpperCase()}
                                                    </DetailBadge>
                                                }
                                                original={
                                                    <DetailBadge variant={session.subtitleDecision === "burn" ? "warning" : "success"}>
                                                        {(session.originalSubtitleCodec || "Unknown").toUpperCase()}
                                                    </DetailBadge>
                                                }
                                            />
                                        }
                                    </div>

                                    {/* Location */}
                                    <div className="flex justify-between items-center gap-2 pt-1">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider shrink-0">{t("session.location")}</span>
                                        <DetailBadge className="text-white/60">
                                            {session.location ? `${session.location.toUpperCase()}: ${session.ip}` : session.ip}
                                        </DetailBadge>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="relative z-20 h-1 w-full bg-white/5 group-hover:h-1.5 transition-all">
                <div
                    className="absolute top-0 left-0 h-full transition-all duration-1000 ease-linear shadow-[0_0_10px_currentColor]"
                    style={{ width: `${progressPercent}%`, backgroundColor: barColor, color: barColor }}
                />
            </div>

            {/* Bottom Footer Info */}
            <div className="bg-black/40 p-3 sm:px-4 sm:py-3 flex items-center justify-between border-t border-white/5">
                <div className="flex items-center gap-3 overflow-hidden">
                    {/* Play State Icon */}
                    <div className={`${stateColor(session.state)} shrink-0`}>
                        {session.state === 'paused' ? (
                            <svg className="h-4 w-4 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                        ) : (
                            <svg className="h-4 w-4 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        )}
                    </div>

                    <div className="flex flex-col overflow-hidden">
                        <span className="text-xs sm:text-sm font-bold text-white truncate leading-tight pointer-events-none group-hover:text-amber-400 transition-colors">
                            {session.title}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-white/50 font-medium whitespace-nowrap">
                            {isTV ? <span className="truncate">{session.subtitle}</span> : <span>{session.year}</span>}
                            <span className="opacity-30">•</span>
                            <span className="font-mono opacity-80">{formatTime(currentOffset)} / {formatTime(session.duration)}</span>
                        </div>
                    </div>
                </div>

                {/* User Avatar */}
                <div className="pl-2 shrink-0">
                    <Link
                        href={`/settings/users/${encodeURIComponent(session.user)}?from=dashboard`}
                        className="group/user relative flex items-center justify-center"
                    >
                        {/* Avatar Image (Hidden on Hover) */}
                        <div className="h-8 w-8 rounded-full ring-2 ring-white/10 overflow-hidden group-hover/user:ring-white/0 group-hover/user:scale-0 group-hover/user:opacity-0 transition-all duration-300 shadow-lg shrink-0">
                            <img
                                src={session.userThumb || `https://ui-avatars.com/api/?name=${session.user}&background=random&color=fff&size=64`}
                                alt={session.user}
                                className="h-full w-full object-cover"
                            />
                        </div>

                        {/* Username (Shown on Hover) */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-end opacity-0 scale-50 group-hover/user:opacity-100 group-hover/user:scale-100 origin-right transition-all duration-300 z-50">
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-lg backdrop-blur-md whitespace-nowrap shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-slate-900/80">
                                {session.user}
                            </span>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
};
