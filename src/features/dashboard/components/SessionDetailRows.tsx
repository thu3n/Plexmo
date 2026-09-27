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
import { OverflowMarquee } from "./OverflowMarquee";

/**
 * Source → delivered, both visible at once (replaces the old hover swap). The
 * source is plain dimmed text rather than a second badge to save width.
 */
const TranscodeChain = ({ isDirect, original, originalText, current }: { isDirect: boolean; original: ReactNode; originalText: string; current: ReactNode }) => {
    if (isDirect) return <>{original}</>;
    return (
        <>
            <span className="whitespace-nowrap text-[10px] text-white/35">{originalText} →</span>
            {current}
        </>
    );
};

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex min-h-[18px] items-center gap-2">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/30">{label}</span>
        <OverflowMarquee>{children}</OverflowMarquee>
    </div>
);

export const SessionDetailRows = ({ session }: { session: PlexSession }) => {
    const { t } = useLanguage();
    const decision = session.decision?.toLowerCase();
    const bitrate = session.quality || (session.bandwidth ? `${Math.round(session.bandwidth / 1000 * 10) / 10} Mbps` : null);
    const isOriginalQuality = session.isOriginalQuality || !session.qualityProfile || session.qualityProfile === "Original";
    const hasSubtitle = Boolean(session.originalSubtitleCodec || session.transcodeSubtitleCodec);

    const originalVideo = `${formatCodec(session.originalVideoCodec)} ${formatVideoRes(session.originalHeight || session.resolution)}`;
    const originalAudio = `${formatCodec(session.originalAudioCodec)} ${formatAudioChannels(session.originalAudioChannels)}`;
    const originalContainer = session.originalContainer?.toUpperCase() || "MKV";
    const originalSubtitle = (session.originalSubtitleCodec || "Unknown").toUpperCase();

    return (
        <div className="flex flex-col gap-[5px]">
            <Row label={t("session.stream")}>
                {decision === "transcode" ? (
                    <DetailBadge variant="warning">{t("session.transcode")}</DetailBadge>
                ) : decision === "direct stream" ? (
                    <DetailBadge variant="warning">Direct Stream</DetailBadge>
                ) : (
                    <DetailBadge variant="success">{t("session.directPlay")}</DetailBadge>
                )}
            </Row>

            <Row label={t("session.quality")}>
                <DetailBadge variant={isOriginalQuality ? "success" : "warning"}>
                    <span className="whitespace-nowrap">
                        {session.isOriginalQuality ? "Original" : (session.qualityProfile || "Original")}
                        {bitrate && <span className="text-white/40 ml-1">({bitrate})</span>}
                    </span>
                </DetailBadge>
            </Row>

            <Row label="Video">
                <TranscodeChain
                    isDirect={session.videoDecision === "direct play" || session.videoDecision === "direct stream"}
                    originalText={originalVideo}
                    original={<DetailBadge variant={session.videoDecision === "direct stream" ? "warning" : "success"}>{originalVideo}</DetailBadge>}
                    current={
                        <DetailBadge variant="warning">
                            {formatCodec(session.transcodeVideoCodec)} {session.transcodeHwEncoding && "(HW)"} {formatVideoRes(session.transcodeHeight)}
                        </DetailBadge>
                    }
                />
            </Row>

            <Row label="Audio">
                <TranscodeChain
                    isDirect={session.audioDecision === "direct play" || session.audioDecision === "direct stream"}
                    originalText={originalAudio}
                    original={<DetailBadge variant={session.audioDecision === "direct stream" ? "warning" : "success"}>{originalAudio}</DetailBadge>}
                    current={
                        <DetailBadge variant="warning">
                            {formatCodec(session.transcodeAudioCodec)} {session.transcodeAudioChannels === "2" ? "2.0" : formatAudioChannels(session.transcodeAudioChannels)}
                        </DetailBadge>
                    }
                />
            </Row>

            <Row label={t("session.container")}>
                <TranscodeChain
                    isDirect={!session.transcodeContainer || session.decision === "direct play"}
                    originalText={originalContainer}
                    original={<DetailBadge variant="success">{originalContainer}</DetailBadge>}
                    current={<DetailBadge variant="warning">{session.transcodeContainer?.toUpperCase() || ""}</DetailBadge>}
                />
            </Row>

            <Row label="Sub">
                {!hasSubtitle ? (
                    <span className="text-white/30">-</span>
                ) : (
                    <TranscodeChain
                        isDirect={session.subtitleDecision !== "transcode" && session.subtitleDecision !== "burn"}
                        originalText={originalSubtitle}
                        original={<DetailBadge variant={session.subtitleDecision === "burn" ? "warning" : "success"}>{originalSubtitle}</DetailBadge>}
                        current={
                            <DetailBadge variant="warning">
                                {(session.transcodeSubtitleCodec || session.subtitleDecision || "").toUpperCase()}
                            </DetailBadge>
                        }
                    />
                )}
            </Row>

            {/* Plex Relay is bandwidth-capped by Plex, so flag it loudly */}
            <Row label={t("session.location")}>
                {session.relayed && <DetailBadge variant="warning">{t("session.relay")}</DetailBadge>}
                <DetailBadge className="text-white/60">
                    <span className="whitespace-nowrap">{session.location ? `${session.location.toUpperCase()}: ${session.ip}` : session.ip}</span>
                </DetailBadge>
            </Row>
        </div>
    );
};
