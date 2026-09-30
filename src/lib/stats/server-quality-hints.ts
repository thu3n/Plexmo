/**
 * Pure label + hint text for transcode reasons. Kept apart from the SQL so the
 * wording rules are unit-testable without a database.
 */

export const TRANSCODE_REASONS = [
    "subtitle",
    "bandwidth",
    "video_resolution",
    "video_codec",
    "audio",
    "unknown",
] as const;

export type TranscodeReasonKey = (typeof TRANSCODE_REASONS)[number];

export const REASON_LABELS: Record<TranscodeReasonKey, string> = {
    subtitle: "Subtitle burn-in",
    bandwidth: "Bandwidth / quality limit",
    video_resolution: "Video resolution",
    video_codec: "Video codec",
    audio: "Audio codec",
    unknown: "Unknown / not recorded",
};

const IMAGE_SUBTITLE_CODECS = new Set(["pgs", "hdmv_pgs_subtitle", "vobsub", "dvd_subtitle", "dvdsub", "dvb_subtitle"]);
const STYLED_SUBTITLE_CODECS = new Set(["ass", "ssa"]);
const MODERN_VIDEO_CODECS = new Set(["hevc", "h265", "av1", "vp9"]);
const LEGACY_VIDEO_CODECS = new Set(["mpeg2video", "mpeg2", "vc1", "wmv3", "mpeg4", "msmpeg4v3", "divx", "xvid"]);
const LOSSLESS_AUDIO_CODECS = new Set(["truehd", "dts", "dca", "dts-hd", "dtshd", "mlp", "pcm"]);
const DOLBY_AUDIO_CODECS = new Set(["eac3", "ac3"]);

const CODEC_DISPLAY: Record<string, string> = {
    hdmv_pgs_subtitle: "PGS",
    dvd_subtitle: "VobSub",
    dvdsub: "VobSub",
    dvb_subtitle: "DVB",
    dca: "DTS",
    truehd: "TrueHD",
    eac3: "E-AC3",
    mpeg2video: "MPEG-2",
    h265: "HEVC",
};

/** Plex/ffmpeg codec id -> short human label ("hdmv_pgs_subtitle" -> "PGS"). */
export const formatCodec = (codec: string): string => CODEC_DISPLAY[codec.toLowerCase()] ?? codec.toUpperCase();

const PERCENT = 100;

export type HintInput = {
    reason: TranscodeReasonKey;
    /** Most common detail for the reason: a codec id, "4k → 1080p", or null. */
    topDetail: string | null;
    /** Delivered / source bitrate for bandwidth-limited streams (0..1). */
    bitrateRatio: number | null;
};

const subtitleHint = (codec: string | null): string => {
    if (codec && IMAGE_SUBTITLE_CODECS.has(codec)) {
        return `Most subtitle transcodes are ${formatCodec(codec)} (image-based) → prefer SRT text subtitles.`;
    }
    if (codec && STYLED_SUBTITLE_CODECS.has(codec)) {
        return `Styled ${formatCodec(codec)} subtitles get burned in on many clients → prefer SRT, or enable styled subtitles in the client.`;
    }
    return "Burned-in subtitles force a full video transcode → prefer SRT text subtitles.";
};

const videoCodecHint = (codec: string | null): string => {
    if (codec && MODERN_VIDEO_CODECS.has(codec)) {
        return `Clients can't decode ${formatCodec(codec)} → enable ${formatCodec(codec)} in the client, or keep an H.264 version.`;
    }
    if (codec && LEGACY_VIDEO_CODECS.has(codec)) {
        return `Legacy ${formatCodec(codec)} sources → re-encode to H.264 for direct play everywhere.`;
    }
    if (codec === "h264") {
        return "H.264 files still transcode (10-bit, high profile/level) → check client direct-play settings or re-encode.";
    }
    return "Clients reject the source video codec → check which devices trigger it below.";
};

const audioHint = (codec: string | null): string => {
    if (codec && LOSSLESS_AUDIO_CODECS.has(codec)) {
        return `${formatCodec(codec)} audio the client can't decode → enable audio passthrough or add an AC3/AAC track.`;
    }
    if (codec && DOLBY_AUDIO_CODECS.has(codec)) {
        return `Clients lack ${formatCodec(codec)} decoding → enable passthrough or add an AAC track.`;
    }
    return "Audio track isn't supported by the client → add a compatible AAC/AC3 track.";
};

const resolutionHint = (detail: string | null): string =>
    detail?.toLowerCase().startsWith("4k")
        ? "Most downscales come from 4K sources → keep a 1080p version for remote and weaker clients."
        : "Clients ask for a lower resolution → raise the client's quality setting if bandwidth allows.";

const bandwidthHint = (ratio: number | null): string => {
    const delivered = ratio !== null ? ` at ~${Math.round(ratio * PERCENT)}% of source bitrate` : " below source bitrate";
    return `Remote streams are delivered${delivered} → raise remote quality in the Plex client or check the server's upload.`;
};

export const reasonHint = ({ reason, topDetail, bitrateRatio }: HintInput): string => {
    switch (reason) {
        case "subtitle":
            return subtitleHint(topDetail);
        case "bandwidth":
            return bandwidthHint(bitrateRatio);
        case "video_resolution":
            return resolutionHint(topDetail);
        case "video_codec":
            return videoCodecHint(topDetail);
        case "audio":
            return audioHint(topDetail);
        case "unknown":
            return "Played before Plexmo recorded subtitle and source details — new plays are classified fully.";
    }
};

/** Display form of a reason's top detail (codec ids get human labels, resolutions stay). */
export const formatDetail = (reason: TranscodeReasonKey, detail: string | null): string | null => {
    if (!detail) return null;
    return reason === "video_resolution" ? detail : formatCodec(detail);
};
