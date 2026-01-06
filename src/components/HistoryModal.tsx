"use client";

import type { HistoryEntry } from "@/lib/history";
import type { PlexSession } from "@/lib/plex";
import { useEffect, useState } from "react";
import { formatAudioChannels, formatCodec, formatVideoRes, getPlayerIcon, getSplitDisplayTitle, DetailBadge, HoverReveal, formatDateTime } from "./HistoryHelpers";
import { X } from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "./LanguageContext";
import Link from "next/link";

export function HistoryModal({ entry, onClose, onOpenStats }: {
    entry: HistoryEntry;
    onClose: () => void;
    onOpenStats?: (config: { title: string; seriesTitle?: string; year?: string; originalTitle?: string }) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useLanguage();
    const locale = 'en-US';

    // Trigger animation on mount
    useEffect(() => {
        setIsOpen(true);
        // Lock body scroll
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "auto";
        };
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        setTimeout(onClose, 300); // Wait for animation
    };

    const details = entry.meta_json ? (JSON.parse(entry.meta_json) as PlexSession) : null;
    const { mainTitle, subTitle, isTV } = getSplitDisplayTitle(entry, details, locale);

    const isTranscode = details?.decision === "transcode";

    // Format Times
    const startTimeResult = formatDateTime(entry.startTime);

    const progressPercent = details?.duration
        ? Math.min(100, Math.round(((entry.duration * 1000) / details.duration) * 100))
        : 0;

    const bitrate = details?.quality || (details?.bandwidth ? `${Math.round(details.bandwidth / 1000 * 10) / 10} Mbps` : null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={handleClose}
            />

            {/* Modal Container */}
            <div
                className={clsx(
                    "relative w-full max-w-2xl max-h-[85dvh] overflow-visible bg-transparent transition-all duration-300 transform",
                    isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button - Floated outside on desktop, inside on mobile */}
                <button
                    onClick={handleClose}
                    className="absolute -top-12 right-0 hidden sm:block z-50 p-2 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors backdrop-blur-md border border-white/5"
                    title="Close"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="group glass-panel rounded-3xl overflow-hidden flex flex-col w-full shadow-2xl border border-white/10 bg-[#0f1119] max-h-full relative">

                    {/* Mobile Close Button (Inside) */}
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 z-50 sm:hidden p-2 rounded-full bg-black/60 text-white/90 hover:bg-black/80 transition-colors backdrop-blur-md border border-white/10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Top Section: Poster + Info (Similar to SessionCard but expanded) */}
                    <div className="flex flex-col sm:flex-row flex-1 min-h-0 w-full relative">

                        {/* Poster - Left Side */}
                        <div className="relative w-full sm:w-[40%] shrink-0 overflow-hidden border-b sm:border-b-0 sm:border-r border-white/5 h-48 sm:h-auto min-h-[200px] bg-black/20 z-0">
                            {details?.thumb ? (
                                <>
                                    <img
                                        src={`/api/image?path=${encodeURIComponent(details.thumb)}&serverId=${details.serverId || ""}`}
                                        alt={mainTitle}
                                        onError={(e) => {
                                            e.currentTarget.style.border = "5px solid red";
                                            console.error("Image load failed", e.currentTarget.src);
                                        }}
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />
                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                                </>
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-slate-900">
                                    <img
                                        src="/images/Plexmo_icon.png"
                                        alt="No Poster"
                                        className="h-24 w-24 object-contain opacity-20 grayscale"
                                    />
                                </div>
                            )}

                            {/* Platform Icon */}
                            <div className="absolute top-4 left-4 shadow-xl z-10 pointer-events-none">
                                {getPlayerIcon(details?.player, details?.platform, "w-8 h-8 rounded-lg shadow-lg")}
                            </div>
                        </div>

                        {/* Metadata - Right Side */}
                        <div className="flex-1 min-w-0 flex flex-col bg-gradient-to-b from-white/5 to-transparent backdrop-blur-xl relative z-10 overflow-hidden">

                            <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
                                <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-1">{mainTitle}</h3>
                                {subTitle && (
                                    <div className="flex items-center gap-2 mb-4">
                                        <img
                                            src={isTV ? "/images/libraries/show.svg" : "/images/libraries/movie.svg"}
                                            alt={isTV ? "Series" : "Movie"}
                                            className="w-4 h-4 opacity-70"
                                        />
                                        <p className="text-base sm:text-lg font-medium text-amber-500">{subTitle}</p>
                                    </div>
                                )}

                                <div className="space-y-3 sm:space-y-4"> {/* Increased spacing for modal readability */}

                                    {/* Detail Badge Component List - Directly mimicking SessionCard structure */}

                                    {/* Server */}
                                    <div className="flex justify-between items-center gap-4">
                                        <span className="text-xs text-white/30 font-bold uppercase tracking-wider shrink-0 w-16 sm:w-auto truncate">{t("session.server")}</span>
                                        <div className="h-px flex-1 bg-white/5 mx-2"></div>
                                        <DetailBadge className="max-w-[50%] truncate">{entry.serverName || "Unknown"}</DetailBadge>
                                    </div>

                                    {/* Player */}
                                    <div className="flex justify-between items-center gap-4">
                                        <span className="text-xs text-white/30 font-bold uppercase tracking-wider shrink-0 w-16 sm:w-auto truncate">{t("session.player")}</span>
                                        <div className="h-px flex-1 bg-white/5 mx-2"></div>
                                        <DetailBadge className="max-w-[50%] truncate">{details?.player || entry.platform || "Unknown"}</DetailBadge>
                                    </div>

                                    {/* Stream Decision */}
                                    {details && (
                                        <div className="flex justify-between items-center gap-4">
                                            <span className="text-xs text-white/30 font-bold uppercase tracking-wider shrink-0 w-16 sm:w-auto truncate">{t("session.stream")}</span>
                                            <div className="h-px flex-1 bg-white/5 mx-2"></div>
                                            <HoverReveal
                                                isDirect={!isTranscode && details.decision !== "direct stream"}
                                                current={
                                                    details.decision === "direct stream" ? <DetailBadge variant="warning">Direct Stream</DetailBadge> :
                                                        <DetailBadge variant="warning">
                                                            {t("session.transcode")}
                                                        </DetailBadge>
                                                }
                                                original={<DetailBadge variant="success">{t("session.directPlay")}</DetailBadge>}
                                            />
                                        </div>
                                    )}

                                    {/* Quality */}
                                    {details && (
                                        <div className="flex justify-between items-center gap-4">
                                            <span className="text-xs text-white/30 font-bold uppercase tracking-wider shrink-0 w-16 sm:w-auto truncate">{t("session.quality")}</span>
                                            <div className="h-px flex-1 bg-white/5 mx-2"></div>
                                            <DetailBadge variant={details.isOriginalQuality || !details.qualityProfile || details.qualityProfile === "Original" ? "success" : "warning"} className="min-w-0 max-w-[60%]">
                                                <div className="truncate text-ellipsis overflow-hidden whitespace-nowrap">
                                                    <span>
                                                        {details.isOriginalQuality ? "Original" : (details.qualityProfile || "Original")}
                                                    </span>
                                                    {bitrate && <span className="text-white/40 ml-1">({bitrate})</span>}
                                                </div>
                                            </DetailBadge>
                                        </div>
                                    )}

                                    {/* Container */}
                                    {details && (
                                        <div className="flex justify-between items-center gap-4">
                                            <span className="text-xs text-white/30 font-bold uppercase tracking-wider shrink-0 w-16 sm:w-auto truncate">{t("session.container")}</span>
                                            <div className="h-px flex-1 bg-white/5 mx-2"></div>
                                            <HoverReveal
                                                isDirect={!details.transcodeContainer || details.decision === "direct play"}
                                                current={<DetailBadge variant="warning" className="max-w-[120px] truncate">{details.transcodeContainer?.toUpperCase() || ""}</DetailBadge>}
                                                original={<DetailBadge variant="success" className="max-w-[120px] truncate">{details.originalContainer?.toUpperCase() || "MKV"}</DetailBadge>}
                                            />
                                        </div>
                                    )}

                                    {/* Video */}
                                    {details && (
                                        <div className="flex justify-between items-center gap-4">
                                            <span className="text-xs text-white/30 font-bold uppercase tracking-wider shrink-0 w-16 sm:w-auto truncate">VIDEO</span>
                                            <div className="h-px flex-1 bg-white/5 mx-2"></div>
                                            <div className="min-w-0 flex justify-end">
                                                <HoverReveal
                                                    isDirect={details.videoDecision === "direct play" || details.videoDecision === "direct stream"}
                                                    current={
                                                        <DetailBadge variant="warning" className="w-full">
                                                            <div className="truncate max-w-[150px] sm:max-w-[200px]">
                                                                {formatCodec(details.transcodeVideoCodec)} {details.transcodeHwEncoding && "(HW)"} {formatVideoRes(details.transcodeHeight)}
                                                            </div>
                                                        </DetailBadge>
                                                    }
                                                    original={
                                                        <DetailBadge variant={details.videoDecision === "direct stream" ? "warning" : "success"} className="w-full">
                                                            <div className="truncate max-w-[150px] sm:max-w-[200px]">
                                                                {formatCodec(details.originalVideoCodec)} {formatVideoRes(details.originalHeight || details.resolution)}
                                                            </div>
                                                        </DetailBadge>
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Audio */}
                                    {details && (
                                        <div className="flex justify-between items-center gap-4">
                                            <span className="text-xs text-white/30 font-bold uppercase tracking-wider shrink-0 w-16 sm:w-auto truncate">AUDIO</span>
                                            <div className="h-px flex-1 bg-white/5 mx-2"></div>
                                            <div className="min-w-0 flex justify-end">
                                                <HoverReveal
                                                    isDirect={details.audioDecision === "direct play" || details.audioDecision === "direct stream"}
                                                    current={
                                                        <DetailBadge variant="warning" className="w-full">
                                                            <div className="truncate max-w-[150px] sm:max-w-[200px]">
                                                                {formatCodec(details.transcodeAudioCodec)} {details.transcodeAudioChannels === "2" ? "2.0" : formatAudioChannels(details.transcodeAudioChannels)}
                                                            </div>
                                                        </DetailBadge>
                                                    }
                                                    original={
                                                        <DetailBadge variant={details.audioDecision === "direct stream" ? "warning" : "success"} className="w-full">
                                                            <div className="truncate max-w-[150px] sm:max-w-[200px]">
                                                                {formatCodec(details.originalAudioCodec)} {formatAudioChannels(details.originalAudioChannels)}
                                                            </div>
                                                        </DetailBadge>
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Subtitle */}
                                    {details && (
                                        <div className="flex justify-between items-center gap-4">
                                            <span className="text-xs text-white/30 font-bold uppercase tracking-wider shrink-0 w-16 sm:w-auto truncate">SUB</span>
                                            <div className="h-px flex-1 bg-white/5 mx-2"></div>
                                            {(!details.originalSubtitleCodec && !details.transcodeSubtitleCodec) ? <span className="text-white/30 text-xs">-</span> :
                                                <div className="min-w-0 flex justify-end">
                                                    <HoverReveal
                                                        isDirect={details.subtitleDecision !== "transcode" && details.subtitleDecision !== "burn"}
                                                        current={
                                                            <DetailBadge variant="warning" className="w-full">
                                                                <div className="truncate max-w-[150px] sm:max-w-[200px]">
                                                                    {(details.transcodeSubtitleCodec || details.subtitleDecision || "").toUpperCase()}
                                                                </div>
                                                            </DetailBadge>
                                                        }
                                                        original={
                                                            <DetailBadge variant={details.subtitleDecision === "burn" ? "warning" : "success"} className="w-full">
                                                                <div className="truncate max-w-[150px] sm:max-w-[200px]">
                                                                    {(details.originalSubtitleCodec || "Unknown").toUpperCase()}
                                                                </div>
                                                            </DetailBadge>
                                                        }
                                                    />
                                                </div>
                                            }
                                        </div>
                                    )}

                                    {/* Location */}
                                    {details && (
                                        <div className="flex justify-between items-center gap-4 pt-2">
                                            <span className="text-xs text-white/30 font-bold uppercase tracking-wider shrink-0 w-16 sm:w-auto truncate">{t("session.location")}</span>
                                            <div className="h-px flex-1 bg-white/5 mx-2"></div>
                                            <DetailBadge className="text-white/60 max-w-[60%] truncate">
                                                {details.location ? `${details.location.toUpperCase()}: ${details.ip}` : (details.ip || "Unknown")}
                                            </DetailBadge>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-2 w-full bg-black/40 border-t border-b border-white/5">
                        <div
                            className="absolute top-0 left-0 h-full transition-all duration-1000 ease-linear shadow-[0_0_15px_currentColor]"
                            style={{
                                width: `${progressPercent}%`,
                                backgroundColor: progressPercent >= 90 ? '#10b981' : '#f59e0b',
                                color: progressPercent >= 90 ? '#10b981' : '#f59e0b'
                            }}
                        />
                    </div>

                    {/* Bottom Footer Info */}
                    <div className="bg-black/40 p-4 sm:p-5 flex items-center justify-between border-t border-white/5 backdrop-blur-md">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-mono text-white/50">{startTimeResult}</span>
                                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/40 uppercase font-bold tracking-wider" title="Active Playback Time">
                                    {Math.round((entry.duration - (entry.pausedCounter || 0)) / 60)} min
                                </span>
                                {(entry.pausedCounter || 0) > 0 && (
                                    <span className="text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-400 uppercase font-bold tracking-wider" title="Paused Time">
                                        {Math.round((entry.pausedCounter || 0) / 60)} min paused
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* User Avatar - Premium Style */}
                        <div className="pl-4 shrink-0">
                            <Link
                                href={`/settings/users/${encodeURIComponent(entry.user)}?from=history`}
                                onClick={() => onClose()} // Close modal when navigating
                                className="group/user relative flex items-center justify-center"
                            >
                                <div className="h-10 w-10 rounded-full ring-2 ring-white/10 overflow-hidden shadow-lg transition-transform hover:scale-105 hover:ring-amber-500/50">
                                    <img
                                        src={details?.userThumb || `https://ui-avatars.com/api/?name=${entry.user}&background=random&color=fff&size=64`}
                                        alt={entry.user}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                {/* Tooltipish Name */}
                                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 -translate-x-2 group-hover/user:opacity-100 group-hover/user:translate-x-0 transition-all duration-300 pointer-events-none">
                                    <span className="text-xs font-bold text-amber-400 bg-black/80 border border-amber-500/20 px-2 py-1 rounded-lg backdrop-blur-md whitespace-nowrap shadow-xl">
                                        {entry.user}
                                    </span>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
