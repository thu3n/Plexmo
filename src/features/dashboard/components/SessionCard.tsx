"use client";

import type { PlexSession } from "@/lib/plex";
import { avatarSrc } from "@/lib/avatar";
import { memo, useState } from "react";
import Link from "next/link";
import { getPlayerIcon } from "@/features/history/components/HistoryHelpers";
import { stateColor } from "../utils/sessionUtils";
import { SessionElapsedTime, SessionProgressBar } from "./SessionProgress";
import { SessionDetailRows } from "./SessionDetailRows";
import { useSessionActions } from "../hooks/useSessionActions";

const SessionCardInner = ({ session, serverColor, isLimitExceeded }: { session: PlexSession; serverColor?: string; isLimitExceeded?: boolean }) => {
    const { stopStream, isTerminating } = useSessionActions();

    const barColor = serverColor || "#f59e0b";
    const isTV = /^(S\d+|\d+x\d+)/.test(session.subtitle || "") || /^S\d+ E\d+$/.test(session.subtitle || "");

    // Stop Stream State
    const [showStopConfirm, setShowStopConfirm] = useState(false);

    // Touch has no hover: a tap toggles the reveal hover gives on desktop
    // (the stop button). Row marquees handle their own taps.
    const [revealed, setRevealed] = useState(false);

    const handleCardTap = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!window.matchMedia("(hover: none)").matches) return;
        if ((event.target as HTMLElement).closest("a,button")) return;
        setRevealed((prev) => !prev);
    };

    const handleStopClick = async () => {
        const idToUse = session.sessionId || session.sessionKey;
        if (idToUse) {
            await stopStream(idToUse, session.serverId, () => setShowStopConfirm(false));
        }
    };

    const posterSrc = session.thumb
        ? `/api/image?path=${encodeURIComponent(session.thumb)}&serverId=${session.serverId || ""}`
        : null;

    return (
        <div
            onClick={handleCardTap}
            data-reveal={revealed}
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
                className="absolute top-2 right-2 z-40 bg-black/60 hover:bg-rose-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 group-data-[reveal=true]:opacity-100 transition-all duration-300 backdrop-blur-sm shadow-xl translate-y-2 group-hover:translate-y-0 group-data-[reveal=true]:translate-y-0"
                title="Stop Stream"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                </svg>
            </button>

            {/* Poster + details side by side. The poster column is exactly 2:3 of
                the row height, so object-cover never has anything to crop */}
            <div className="flex h-[246px] w-full">
                <div className="relative w-[164px] shrink-0 overflow-hidden border-r border-white/5 bg-slate-900">
                    {posterSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={posterSrc} alt={session.title} className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/images/Plexmo_icon.png" alt="No Poster" className="h-16 w-16 object-contain opacity-20 grayscale" />
                        </div>
                    )}
                    <div className="absolute top-2 left-2 shadow-lg" title={session.player}>
                        {session.player && getPlayerIcon(session.player, session.platform, "w-6 h-6 rounded-md shadow-lg")}
                    </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden bg-gradient-to-b from-white/5 to-transparent px-3 py-2.5">
                    <div className="flex flex-col gap-0.5 border-b border-white/5 pb-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-bold leading-tight text-white group-hover:text-amber-400 transition-colors">
                                {session.title}
                            </span>
                            <Link
                                href={`/settings/users/${encodeURIComponent(session.user)}?from=dashboard`}
                                title={session.user}
                                className="shrink-0 rounded-full ring-2 ring-white/10 hover:ring-amber-400/60 transition-shadow"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={avatarSrc(session.userThumb, session.user)}
                                    alt={session.user}
                                    loading="lazy"
                                    className="h-6 w-6 rounded-full object-cover"
                                />
                            </Link>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-white/50">
                            <span className="truncate">{isTV ? session.subtitle : session.year} · {session.user}</span>
                            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                                <span className={stateColor(session.state)}>
                                    {session.state === "paused" ? (
                                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                                    ) : (
                                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                    )}
                                </span>
                                <SessionElapsedTime viewOffset={session.viewOffset} duration={session.duration} state={session.state} />
                            </span>
                        </div>
                    </div>

                    <SessionDetailRows session={session} />
                </div>
            </div>

            <SessionProgressBar
                viewOffset={session.viewOffset}
                duration={session.duration}
                state={session.state}
                color={barColor}
                className="relative h-1"
            />
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
