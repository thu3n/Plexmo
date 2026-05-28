import { plexFetch, toArray, resolveServer, decodePlexString } from "./plex-client";
import { fetchItemMetadata } from "./plex-library";
import { VIDEO_QUALITY_PROFILES } from "./plex-types";
import type {
  PlexServerConfig,
  PlexSession,
  SessionSummary,
  PlexMetadata,
  RawVideo,
  RawSessionsResponse,
} from "./plex-types";

const formatTitle = (video: RawVideo) => {
  if (video.grandparentTitle) {
    const episode = video.title ? ` • ${decodePlexString(video.title)}` : "";
    const season = video.parentTitle ? ` — ${decodePlexString(video.parentTitle)}` : "";
    return `${decodePlexString(video.grandparentTitle)}${season}${episode}`;
  }

  return decodePlexString(video.title) || "Unknown title";
};

export const fetchSessions = async (
  server?: PlexServerConfig,
): Promise<{
  sessions: PlexSession[];
  summary: SessionSummary;
}> => {
  const xml = (await plexFetch("/status/sessions", {}, server)) as RawSessionsResponse;
  const container = xml.MediaContainer ?? {};
  const videos = toArray(container.Video);

  let directPlay = 0;
  let transcoding = 0;
  let paused = 0;
  let bandwidth = 0;

  // Resolve server config to build full image URLs
  const { baseUrl, token } = resolveServer(server);

  if (videos.length > 0) {
    // console.log("[DEBUG] Raw Video Object Sample:", JSON.stringify(videos[0], null, 2));
  }

  // Fetch metadata for all sessions in parallel to avoid waterfalls
  // We need metadata to get the TRUE original file details (container, codecs, etc.)
  // because /status/sessions often reports the temporary transcode target as the source.
  const metadataMap = new Map<string, PlexMetadata>();
  await Promise.all(
    videos.map(async (video) => {
      const key = video.ratingKey;
      if (key) {
        const meta = await fetchItemMetadata(key, server);
        if (meta) {
          metadataMap.set(key, meta);
        }
      }
    })
  );

  const sessions = videos.map((video): PlexSession => {
    const transcode = video.TranscodeSession ?? {};
    const session = video.Session ?? {};
    const player = video.Player ?? {};

    // Use full metadata if available, otherwise fallback to session data
    // Use full metadata if available, otherwise fallback to session data
    const metadata = metadataMap.get(video.ratingKey as string) || video;

    // 1. Identify Session Streams (What is actually playing/transcoding)
    const sessionMedia = toArray(video.Media).find((m) => m.selected) || toArray(video.Media)[0];
    const sessionPart = toArray(sessionMedia?.Part).find((p) => p.selected) || toArray(sessionMedia?.Part)[0];

    const sessionVideoStream = toArray(sessionPart?.Stream).find((s) => s.streamType === "1");
    const sessionAudioStream =
      toArray(sessionPart?.Stream).find((s) => s.streamType === "2" && (s.selected === "1" || s.selected === true)) ||
      toArray(sessionPart?.Stream).find((s) => s.streamType === "2");
    const sessionSubtitleStream =
      toArray(sessionPart?.Stream).find((s) => s.streamType === "3" && (s.selected === "1" || s.selected === true));

    // 2. Identify Original Streams (Source file details from Metadata)
    // We try to match by ID first (most accurate), then fallback to streamType/Index types.
    const metaMedias = toArray(metadata.Media);
    // Find the media that matches the session media ID if possible, or just the main one
    const originalMedia = metaMedias.find((m) => m.id === sessionMedia?.id) || metaMedias.find((m) => m.selected) || metaMedias[0];
    const originalPart = toArray(originalMedia?.Part).find((p) => p.id === sessionPart?.id) || toArray(originalMedia?.Part).find((p) => p.selected) || toArray(originalMedia?.Part)[0];

    const metaStreams = toArray(originalPart?.Stream);

    // MATCHING LOGIC: Match Session Stream ID -> Metadata Stream ID
    const originalVideoStream = sessionVideoStream ? (metaStreams.find((s) => s.id === sessionVideoStream.id) || metaStreams.find((s) => s.streamType === "1")) : undefined;
    const originalAudioStream = sessionAudioStream ? (metaStreams.find((s) => s.id === sessionAudioStream.id) || metaStreams.find((s) => s.streamType === "2" && s.selected)) : undefined;
    const originalSubtitleStream = sessionSubtitleStream ? (metaStreams.find((s) => s.id === sessionSubtitleStream.id) || metaStreams.find((s) => s.streamType === "3" && s.selected)) : undefined;

    // 3. Determine Decisions (Tautulli Logic)
    const normalize = (d?: string) => {
      if (!d) return "direct play";
      const lower = d.toLowerCase();
      return lower === "copy" ? "direct stream" : lower;
    };

    let videoDecision = normalize(sessionVideoStream?.decision);
    let audioDecision = normalize(sessionAudioStream?.decision);
    let subtitleDecision = normalize(sessionSubtitleStream?.decision);

    // Live TV Override
    const isLive = String(video.live) === "1";
    const hasTranscodeSession = !!video.TranscodeSession;

    if (isLive && hasTranscodeSession) {
      if (transcode.videoDecision) videoDecision = normalize(transcode.videoDecision);
      if (transcode.audioDecision) audioDecision = normalize(transcode.audioDecision);
      if (transcode.subtitleDecision) subtitleDecision = normalize(transcode.subtitleDecision);
    }

    // Global Decision
    let finalDecision = "direct play";
    if (videoDecision === "transcode" || audioDecision === "transcode") {
      finalDecision = "transcode";
    } else if (videoDecision === "direct stream" || audioDecision === "direct stream") {
      finalDecision = "direct stream";
    }

    // Counters
    if (finalDecision === "transcode") transcoding += 1;
    else directPlay += 1;

    if ((player.state as string | undefined)?.toLowerCase() === "paused") paused += 1;

    const sessionBandwidth = Number(session.bandwidth ?? 0);
    bandwidth += Number.isFinite(sessionBandwidth) ? sessionBandwidth : 0;

    const duration = Number(video.duration ?? 0);
    const viewOffset = Number(video.viewOffset ?? 0);
    const progressPercent = duration > 0 ? Math.min(100, Math.round((viewOffset / duration) * 100)) : null;

    // Resolution & Quality
    // For resolution: Tautulli uses the stream height from session if available
    const resolution =
      (sessionVideoStream && sessionVideoStream.height)
        ? `${sessionVideoStream.height}p`
        : (sessionMedia.videoResolution || (sessionMedia.height ? `${sessionMedia.height}p` : undefined));

    const quality = sessionMedia.bitrate
      ? `${Math.round(Number(sessionMedia.bitrate) / 1000 * 10) / 10} Mbps`
      : undefined;

    const isTV = !!video.grandparentTitle;

    const throttled = String(transcode.throttled) === "1";
    const transcodeSpeed = transcode.speed ? Number(transcode.speed) : undefined;
    const transcodeHwRequested = String(transcode.transcodeHwRequested) === "1";
    const transcodeHwDecoding = transcode.transcodeHwDecoding;
    const transcodeHwEncoding = transcode.transcodeHwEncoding;
    // Helper to standardize resolution
    const getStandardResolution = (h: string | number | undefined, strRes?: string) => {
      // Trust explicit labels like "720", "1080", "4k" from Plex
      if (strRes) {
        const s = String(strRes).toLowerCase();
        if (s === "720" || s === "720p") return "720p";
        if (s === "1080" || s === "1080p") return "1080p";
        if (s === "4k") return "4k";
        if (s === "576" || s === "576p") return "576p";
        if (s === "480" || s === "480p") return "480p";
        if (s === "sd") return "SD";
      }

      if (!h) return "";
      const height = Number(h);
      if (height >= 2000) return "4k";
      if (height > 1000) return "1080p";
      if (height >= 700) return "720p";
      if (height >= 480) return "480p";
      return "SD";
    };

    // Quality Profile Calculation
    // Tautulli logic: compare stream bitrate vs source bitrate
    let qualityProfile = "Original";
    // Tautulli calculates this for everything based on stream bitrate
    const streamBitrate = sessionVideoStream?.bitrate ? Number(sessionVideoStream.bitrate) : (sessionMedia.bitrate ? Number(sessionMedia.bitrate) : 0);

    if (streamBitrate > 0) {
      const validProfiles = Object.keys(VIDEO_QUALITY_PROFILES)
        .map(Number)
        .filter(b => b >= streamBitrate);

      if (validProfiles.length > 0) {
        const bestBitrate = Math.min(...validProfiles);
        qualityProfile = VIDEO_QUALITY_PROFILES[bestBitrate];
      } else {
        const allProfiles = Object.keys(VIDEO_QUALITY_PROFILES).map(Number).sort((a, b) => b - a);
        if (allProfiles.length > 0) qualityProfile = VIDEO_QUALITY_PROFILES[allProfiles[0]];
      }
    }

    const transcodeContainer = transcode.container || "";
    // If transcoding, use the session container as the 'transcode container' if not explicit?
    // Usually TranscodeSession has it.

    const resolutionLabel = originalMedia?.videoResolution;
    const normalizedOriginalHeight = getStandardResolution(originalVideoStream?.height || originalMedia?.height, resolutionLabel);

    // Transcode Resolution Fallback:
    // If TranscodeSession doesn't have height (common), use sessionMedia (which represents the target)
    const transcodeResLabel = sessionMedia?.videoResolution;
    const normalizedTranscodeHeight = getStandardResolution(transcode.height || sessionMedia?.height, transcodeResLabel);

    // FIX: Prioritize Season Poster (parentThumb) -> Series Poster (grandparentThumb) -> Episode Thumb (thumb)
    // Users prefer avoid episode "spoilers" or random frames.
    const thumbKey = isTV
      ? (video.parentThumb || video.grandparentThumb || video.thumb)
      : video.thumb;

    const thumbUrl = thumbKey || undefined;

    return {
      id: video.ratingKey || video.key || crypto.randomUUID(),
      sessionKey: (video.sessionKey as string) || (video.Session as any)?.id || undefined,
      sessionId: video.Session?.id as string | undefined,
      title: formatTitle({ ...video, title: decodePlexString(video.title) }),
      grandparentTitle: decodePlexString(video.grandparentTitle),
      parentTitle: decodePlexString(video.parentTitle),
      originalTitle: decodePlexString(video.title),
      subtitle: isTV && video.parentIndex && video.index ? `S${video.parentIndex} E${video.index}` : (decodePlexString(video.summary) || decodePlexString(video.tagline)),
      user: decodePlexString(video.User?.title) || "Okänd användare",
      userId: video.User?.id,
      username: decodePlexString(video.User?.username),
      userThumb: video.User?.thumb,
      platform: player.platform || player.product || undefined,
      device: player.title || undefined,
      state: player.state || "unknown",
      bandwidth: sessionBandwidth,
      decision: finalDecision,
      quality,
      location: session.location || undefined,
      progressPercent,
      duration,
      viewOffset,
      resolution,
      thumb: thumbUrl,
      serverName: server?.name || container.friendlyName,
      serverId: server?.id,
      year: video.year as string | undefined,
      player: player.product || player.platform || player.title || "Unknown Player",

      // Detailed container info
      // Container: for Direct Play, it's the original container. For Transcode, it's the target container.
      container: (finalDecision === "transcode" ? transcodeContainer : originalMedia?.container) || (sessionMedia.container as string) || undefined,

      ip: player.remotePublicAddress || player.address || undefined,

      videoDecision,
      audioDecision,
      subtitleDecision,

      isOriginalQuality: videoDecision === "direct play" || videoDecision === "direct stream",

      // Codecs & Containers
      originalContainer: (originalMedia?.container as string) || undefined,

      // Source Codecs (From Metadata Stream)
      originalVideoCodec: (originalVideoStream?.codec as string) || (originalMedia?.videoCodec as string) || undefined,
      // Target Video Codec (From Session Stream or Transcode Info)
      transcodeVideoCodec: (transcode.videoCodec as string) || (sessionVideoStream?.codec as string) || undefined,

      // Source Audio
      originalAudioCodec: (originalAudioStream?.codec as string) || (originalMedia?.audioCodec as string) || undefined,
      // Target Audio
      transcodeAudioCodec: (transcode.audioCodec as string) || (sessionAudioStream?.codec as string) || undefined,

      originalAudioChannels: (originalAudioStream?.channels as string) || (originalMedia?.audioChannels as string) || undefined,
      transcodeAudioChannels: (transcode.audioChannels as string) || undefined,

      transcodeContainer,

      // Subtitles
      // Source Subtitle (From Metadata Stream found by ID)
      originalSubtitleCodec: (originalSubtitleStream?.codec as string) || undefined,
      transcodeSubtitleCodec: (transcode.subtitleCodec as string) || (sessionSubtitleStream?.codec as string) || undefined,

      originalHeight: normalizedOriginalHeight || (originalVideoStream?.height as string) || (originalMedia?.height as string) || undefined,
      transcodeHeight: normalizedTranscodeHeight || (transcode.height as string) || undefined,

      qualityProfile,
      throttled,
      transcodeSpeed,
      transcodeHwDecoding,
      transcodeHwEncoding,
      parentIndex: video.parentIndex,
      index: video.index,
      parentThumb: video.parentThumb,
      grandparentThumb: video.grandparentThumb,
      Guid: (metadata.Guid && Array.isArray(metadata.Guid)) ? metadata.Guid : (metadata.Guid ? [metadata.Guid] : []),
    };
  });

  if (sessions.length > 0) {
    // console.log("[DEBUG] Mapped Session Sample:", JSON.stringify(sessions[0], null, 2));
  }

  return {
    sessions,
    summary: {
      active: videos.length,
      directPlay,
      transcoding,
      paused,
      bandwidth,
      serverName: server?.name || container.friendlyName,
    },
  };
};
