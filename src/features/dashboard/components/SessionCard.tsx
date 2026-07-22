"use client";

import type { PlexSession } from "@/lib/plex";
import { avatarSrc } from "@/lib/avatar";
import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronUp } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import {
    getPlayerIcon,
    DetailBadge,
    HoverReveal,
    formatCodec,
    formatVideoRes,
    formatAudioChannels
} from "@/features/history/components/HistoryHelpers";
import {
    stateColor,
} from "../utils/sessionUtils";
import { SessionElapsedTime, SessionProgressBar } from "./SessionProgress";
import { useSessionActions } from "../hooks/useSessionActions";

// Tap-opened info bars slide back down on their own — toast-style timing:
// long enough to read, short enough to not feel stuck.
const FOOTER_AUTO_COLLAPSE_MS = 6000;

const SessionCardInner = ({ session, serverColor, isLimitExceeded }: { session: PlexSession; serverColor?: string; isLimitExceeded?: boolean }) => {
    const { t } = useLanguage();
    const { stopStream, isTerminating } = useSessionActions();

    const barColor = serverColor || "#f59e0b";
    const isTranscoding = session.decision?.toLowerCase() === "transcode";
    const isTV = /^(S\d+|\d+x\d+)/.test(session.subtitle || "") || /^S\d+ E\d+$/.test(session.subtitle || "");

    // Stop Stream State
    const [showStopConfirm, setShowStopConfirm] = useState(false);

    // Footer bar overlay: collapsed by default so the full poster/details
    // show. Desktop reveals it on hover via pure CSS (Tailwind v4 gates
    // hover: behind @media (hover: hover)); this state is the touch-only
    // tap toggle. The card's flow height never changes, so the grid can't
    // reflow either way.
    const [footerOpen, setFooterOpen] = useState(false);

    useEffect(() => {
        if (!footerOpen) return;
        const timer = setTimeout(() => setFooterOpen(false), FOOTER_AUTO_COLLAPSE_MS);
        return () => clearTimeout(timer);
    }, [footerOpen]);

    const handleCardTap = (event: React.MouseEvent<HTMLDivElement>) => {
        // Hover-capable devices expand on hover — a click must not latch the
        // bar. Clicks on real controls (avatar link, stop button) keep their
        // own behavior.
        if (!window.matchMedia("(hover: none)").matches) return;
        if ((event.target as HTMLElement).closest("a,button")) return;
        setFooterOpen((prev) => !prev);
    };

    const handleStopClick = async () => {
        const idToUse = session.sessionId || session.sessionKey;
        if (idToUse) {
            await stopStream(idToUse, session.serverId, () => setShowStopConfirm(false));
        }
    };

    const bitrate = session.quality || (session.bandwidth ? `${Math.round(session.bandwidth / 1000 * 10) / 10} Mbps` : null);

    return (
        <div
            onClick={handleCardTap}
            className={`group glass-panel rounded-2xl overflow-hidden flex flex-col h-full transform transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-black/50 relative ${isLimitExceeded ? "ring-2 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]" : ""}`}
        >

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
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 text-center animate-in fade-in duration-200">
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
                            onClick={handleStopClick}
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

            {/* Top Section: Poster + Info — sized to include the footer
                overlay's space so the card matches its pre-overlay height */}
            <div className="flex flex-row h-[17.75rem] sm:h-[19.75rem] w-full relative">
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
                {/* Inner panels: solid translucency instead of backdrop-blur — stacked
                    backdrop-filters inside every card were the iOS WebKit lag driver,
                    and against the dark card surface the blur contribution is invisible. */}
                <div className="flex-1 min-w-0 p-3 flex flex-col bg-gradient-to-b from-white/5 to-transparent relative z-10 overflow-hidden">

                    <div className={`flex flex-col gap-2 overflow-y-auto no-scrollbar h-full pr-1 transition-[padding] duration-300 group-hover:pb-16 group-focus-within:pb-16 ${footerOpen ? "pb-16" : "pb-1"}`}>

                        {/* Detail Badge Component */}
                        {(() => {


                            return (
                                <>
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

                                    {/* Location — Plex Relay is bandwidth-capped by Plex, so flag it loudly */}
                                    <div className="flex justify-between items-center gap-2 pt-1">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider shrink-0">{t("session.location")}</span>
                                        <div className="flex items-center gap-1">
                                            {session.relayed && (
                                                <DetailBadge variant="warning">{t("session.relay")}</DetailBadge>
                                            )}
                                            <DetailBadge className="text-white/60">
                                                {session.location ? `${session.location.toUpperCase()}: ${session.ip}` : session.ip}
                                            </DetailBadge>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Slim progress line at the card's bottom edge — only visible
                while the footer overlay (which carries the main bar) is away */}
            <SessionProgressBar
                viewOffset={session.viewOffset}
                duration={session.duration}
                state={session.state}
                color={barColor}
                className={`absolute inset-x-0 bottom-0 z-10 h-1 transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0 ${footerOpen ? "opacity-0" : "opacity-100"}`}
            />

            {/* Hint that more info slides up on hover/tap */}
            <ChevronUp
                className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 z-10 w-4 h-4 text-white/30 pointer-events-none transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0 ${footerOpen ? "opacity-0" : "opacity-100"}`}
            />

            {/* Bottom overlay: progress bar + footer slide up on hover/focus
                (desktop) or tap (touch); at rest they sit below the card edge
                (root overflow-hidden clips them) */}
            <div className={`absolute inset-x-0 bottom-0 z-20 transition-transform duration-300 group-hover:translate-y-0 group-focus-within:translate-y-0 ${footerOpen ? "translate-y-0" : "translate-y-full"}`}>

            {/* Progress Bar */}
            <SessionProgressBar
                viewOffset={session.viewOffset}
                duration={session.duration}
                state={session.state}
                color={barColor}
                className="relative z-20 h-1 group-hover:h-1.5 transition-all"
            />

            {/* Bottom Footer Info */}
            <div className="bg-black/75 p-3 sm:px-4 sm:py-3 flex items-center justify-between border-t border-white/5">
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
                            <SessionElapsedTime viewOffset={session.viewOffset} duration={session.duration} state={session.state} />
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
                                src={avatarSrc(session.userThumb, session.user)}
                                alt={session.user}
                                loading="lazy"
                                className="h-full w-full object-cover"
                            />
                        </div>

                        {/* Username (Shown on Hover) */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-end opacity-0 scale-50 group-hover/user:opacity-100 group-hover/user:scale-100 origin-right transition-all duration-300 z-50">
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-lg whitespace-nowrap shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-slate-900/80">
                                {session.user}
                            </span>
                        </div>
                    </Link>
                </div>
            </div>
            </div>
        </div>
    );
};

// Memo with a serialized-session comparator: the 5s SWR poll rebuilds every
// object identity, so a reference compare would re-render (and on iOS WebKit
// re-rasterize the glass layers of) every card even when nothing changed.
// Sessions are small plain-JSON API objects with stable field order, so
// stringify is a robust cheap deep-equal here.
export const SessionCard = memo(SessionCardInner, (prev, next) =>
    prev.serverColor === next.serverColor &&
    prev.isLimitExceeded === next.isLimitExceeded &&
    JSON.stringify(prev.session) === JSON.stringify(next.session),
);
