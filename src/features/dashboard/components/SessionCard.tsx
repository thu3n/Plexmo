"use client";

import type { PlexSession } from "@/lib/plex";
import { avatarSrc } from "@/lib/avatar";
import { memo, useState } from "react";
import Link from "next/link";
import { getPlayerIcon } from "@/features/history/components/HistoryHelpers";
import { stateColor } from "../utils/sessionUtils";
import { SessionElapsedTime, SessionProgressBar } from "./SessionProgress";
import { SessionDetailGrid } from "./SessionDetailGrid";
import { useSessionActions } from "../hooks/useSessionActions";

const SessionCardInner = ({ session, serverColor, isLimitExceeded }: { session: PlexSession; serverColor?: string; isLimitExceeded?: boolean }) => {
    const { stopStream, isTerminating } = useSessionActions();

    const barColor = serverColor || "#f59e0b";
    const isTV = /^(S\d+|\d+x\d+)/.test(session.subtitle || "") || /^S\d+ E\d+$/.test(session.subtitle || "");

    // Stop Stream State
    const [showStopConfirm, setShowStopConfirm] = useState(false);

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

            {/* Poster band: the poster doubles as a dimmed backdrop (plain opacity,
                no blur — stacked filters were the iOS WebKit lag driver) and sits
                whole on top, so it is never cropped regardless of card width */}
            <div className="relative flex items-end gap-3.5 p-3.5 min-h-[168px] overflow-hidden">
                {posterSrc && (
                    <div className="absolute inset-0 opacity-40" aria-hidden="true">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={posterSrc} alt="" className="h-full w-full object-cover scale-110" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/55 to-slate-950/85" aria-hidden="true" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 to-transparent to-70%" aria-hidden="true" />

                <div className="relative z-10 w-[92px] aspect-[2/3] shrink-0 overflow-hidden rounded-xl bg-slate-900 shadow-[0_10px_24px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                    {posterSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={posterSrc} alt={session.title} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/images/Plexmo_icon.png" alt="No Poster" className="h-10 w-10 object-contain opacity-20 grayscale" />
                        </div>
                    )}
                    <div className="absolute top-1.5 left-1.5">
                        {session.player && getPlayerIcon(session.player, session.platform, "w-5 h-5 rounded-md shadow-lg")}
                    </div>
                </div>

                <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-base font-bold leading-tight text-white group-hover:text-amber-400 transition-colors">
                        {session.title}
                    </span>
                    <span className="truncate text-[11px] font-medium text-white/50">
                        {isTV ? session.subtitle : session.year}
                    </span>
                    <Link
                        href={`/settings/users/${encodeURIComponent(session.user)}?from=dashboard`}
                        className="mt-1 flex min-w-0 items-center gap-2 self-start rounded-full pr-2 hover:bg-white/5 transition-colors"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={avatarSrc(session.userThumb, session.user)}
                            alt=""
                            loading="lazy"
                            className="h-[22px] w-[22px] shrink-0 rounded-full object-cover ring-2 ring-white/10"
                        />
                        <span className="truncate text-xs text-white/60">{session.user}</span>
                    </Link>
                </div>
            </div>

            {/* Progress */}
            <div className="flex flex-col gap-1.5 px-3 pb-2.5">
                <SessionProgressBar
                    viewOffset={session.viewOffset}
                    duration={session.duration}
                    state={session.state}
                    color={barColor}
                    className="relative h-1 rounded-full"
                />
                <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                    <span className={`${stateColor(session.state)} shrink-0`}>
                        {session.state === "paused" ? (
                            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                        ) : (
                            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        )}
                    </span>
                    <SessionElapsedTime viewOffset={session.viewOffset} duration={session.duration} state={session.state} />
                </div>
            </div>

            <SessionDetailGrid session={session} />
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
