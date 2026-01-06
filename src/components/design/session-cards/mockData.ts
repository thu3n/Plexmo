import { PlexSession } from "@/lib/plex";

export const mockSession: PlexSession = {
    id: "mock-session-1",
    title: "Inception",
    originalTitle: "Inception",
    grandparentTitle: undefined,
    parentTitle: undefined,
    year: "2010",
    subtitle: "A thief who steals corporate secrets through the use of dream-sharing technology...",
    // summary: "Cobb, a skilled thief...", // Removed: Not in PlexSession type
    user: "admin",
    userThumb: "https://github.com/shadcn.png",
    platform: "Apple TV",
    device: "Living Room Apple TV",
    state: "playing",
    bandwidth: 25000,
    decision: "transcode",
    quality: "1080p (20 Mbps)",
    location: "wan",
    progressPercent: 65,
    duration: 8880000, // 2h 28m
    viewOffset: 5772000, // ~1h 36m
    resolution: "4k",
    thumb: "/images/mock_poster.jpg", // Refined with user-provided placeholder
    serverName: "Main Server",
    serverId: "server-1",
    player: "Plex for Apple TV",
    container: "mkv",
    ip: "192.168.1.50",

    // Transcode Details
    videoDecision: "transcode",
    audioDecision: "transcode",
    subtitleDecision: "burn",

    isOriginalQuality: false,

    // Codecs
    originalContainer: "mkv",
    transcodeContainer: "mpegts",

    originalVideoCodec: "hevc",
    transcodeVideoCodec: "h264",

    originalAudioCodec: "truehd",
    transcodeAudioCodec: "aac",

    originalAudioChannels: "7.1",
    transcodeAudioChannels: "5.1",

    originalSubtitleCodec: "pgs",
    transcodeSubtitleCodec: "ass",

    originalHeight: "2160",
    transcodeHeight: "1080",

    qualityProfile: "20 Mbps 1080p",

    throttled: true,
    transcodeSpeed: 3.5,
    transcodeHwRequested: true,
    transcodeHwDecoding: "nvidia",
    transcodeHwEncoding: "nvidia",
};
