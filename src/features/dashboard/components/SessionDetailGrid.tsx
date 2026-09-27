"use client";

import type { ReactNode } from "react";
import type { PlexSession } from "@/lib/plex";
import { useLanguage } from "@/components/LanguageContext";
import {
    DetailBadge,
    formatCodec,
    formatVideoRes,
    formatAudioChannels,
} from "@/features/history/components/HistoryHelpers";

/**
 * Source → delivered. Shows both sides at once instead of the old hover swap,
 * so an admin can read what is being transcoded without pointing at it.
 */
const TranscodeChain = ({ isDirect, original, current }: { isDirect: boolean; original: ReactNode; current: ReactNode }) => {
    if (isDirect) return <>{original}</>;
    return (
        <div className="flex flex-wrap items-center gap-1 min-w-0">
            <span className="opacity-50">{original}</span>
            <span className="text-[10px] text-white/30" aria-hidden="true">→</span>
            {current}
        </div>
    );
};

const Cell = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex flex-col gap-1 min-w-0">
        <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider">{label}</span>
        <div className="flex flex-wrap items-center gap-1 min-w-0">{children}</div>
    </div>
);

export const SessionDetailGrid = ({ session }: { session: PlexSession }) => {
    const { t } = useLanguage();
    const decision = session.decision?.toLowerCase();
    const bitrate = session.quality || (session.bandwidth ? `${Math.round(session.bandwidth / 1000 * 10) / 10} Mbps` : null);
    const isOriginalQuality = session.isOriginalQuality || !session.qualityProfile || session.qualityProfile === "Original";
    const hasSubtitle = Boolean(session.originalSubtitleCodec || session.transcodeSubtitleCodec);

    return (
        <div className="flex-1 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-x-3.5 gap-y-2.5 p-3 border-t border-white/5 bg-white/[0.015]">
            <Cell label={t("session.player")}>
                <DetailBadge className="min-w-0 max-w-full"><span className="truncate">{session.player}</span></DetailBadge>
            </Cell>

            <Cell label={t("session.stream")}>
                {decision === "transcode" ? (
                    <DetailBadge variant="warning">{t("session.transcode")}</DetailBadge>
                ) : decision === "direct stream" ? (
                    <DetailBadge variant="warning">Direct Stream</DetailBadge>
                ) : (
                    <DetailBadge variant="success">{t("session.directPlay")}</DetailBadge>
                )}
            </Cell>

            <Cell label={t("session.quality")}>
                <DetailBadge variant={isOriginalQuality ? "success" : "warning"} className="min-w-0 max-w-full">
                    <span className="truncate">
                        {session.isOriginalQuality ? "Original" : (session.qualityProfile || "Original")}
                        {bitrate && <span className="text-white/40 ml-1">({bitrate})</span>}
                    </span>
                </DetailBadge>
            </Cell>

            <Cell label={t("session.container")}>
                <TranscodeChain
                    isDirect={!session.transcodeContainer || session.decision === "direct play"}
                    original={<DetailBadge variant="success">{session.originalContainer?.toUpperCase() || "MKV"}</DetailBadge>}
                    current={<DetailBadge variant="warning">{session.transcodeContainer?.toUpperCase() || ""}</DetailBadge>}
                />
            </Cell>

            <Cell label="Video">
                <TranscodeChain
                    isDirect={session.videoDecision === "direct play" || session.videoDecision === "direct stream"}
                    original={
                        <DetailBadge variant={session.videoDecision === "direct stream" ? "warning" : "success"}>
                            {formatCodec(session.originalVideoCodec)} {formatVideoRes(session.originalHeight || session.resolution)}
                        </DetailBadge>
                    }
                    current={
                        <DetailBadge variant="warning">
                            {formatCodec(session.transcodeVideoCodec)} {session.transcodeHwEncoding && "(HW)"} {formatVideoRes(session.transcodeHeight)}
                        </DetailBadge>
                    }
                />
            </Cell>

            <Cell label="Audio">
                <TranscodeChain
                    isDirect={session.audioDecision === "direct play" || session.audioDecision === "direct stream"}
                    original={
                        <DetailBadge variant={session.audioDecision === "direct stream" ? "warning" : "success"}>
                            {formatCodec(session.originalAudioCodec)} {formatAudioChannels(session.originalAudioChannels)}
                        </DetailBadge>
                    }
                    current={
                        <DetailBadge variant="warning">
                            {formatCodec(session.transcodeAudioCodec)} {session.transcodeAudioChannels === "2" ? "2.0" : formatAudioChannels(session.transcodeAudioChannels)}
                        </DetailBadge>
                    }
                />
            </Cell>

            <Cell label="Sub">
                {!hasSubtitle ? (
                    <span className="text-white/30">-</span>
                ) : (
                    <TranscodeChain
                        isDirect={session.subtitleDecision !== "transcode" && session.subtitleDecision !== "burn"}
                        original={
                            <DetailBadge variant={session.subtitleDecision === "burn" ? "warning" : "success"}>
                                {(session.originalSubtitleCodec || "Unknown").toUpperCase()}
                            </DetailBadge>
                        }
                        current={
                            <DetailBadge variant="warning">
                                {(session.transcodeSubtitleCodec || session.subtitleDecision || "").toUpperCase()}
                            </DetailBadge>
                        }
                    />
                )}
            </Cell>

            {/* Plex Relay is bandwidth-capped by Plex, so flag it loudly */}
            <Cell label={t("session.location")}>
                {session.relayed && <DetailBadge variant="warning">{t("session.relay")}</DetailBadge>}
                <DetailBadge className="text-white/60 min-w-0 max-w-full">
                    <span className="truncate">{session.location ? `${session.location.toUpperCase()}: ${session.ip}` : session.ip}</span>
                </DetailBadge>
            </Cell>
        </div>
    );
};
