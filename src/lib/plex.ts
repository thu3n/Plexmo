import { XMLParser } from "fast-xml-parser";
import { getSetting } from "./settings";

const VIDEO_QUALITY_PROFILES: Record<number, string> = {
  20000: "20 Mbps 1080p",
  12000: "12 Mbps 1080p",
  10000: "10 Mbps 1080p",
  8000: "8 Mbps 1080p",
  4000: "4 Mbps 720p",
  3000: "3 Mbps 720p",
  2000: "2 Mbps 720p",
  1500: "1.5 Mbps 480p",
  720: "0.7 Mbps 328p",
  320: "0.3 Mbps 240p",
  208: "0.2 Mbps 160p",
  96: "0.096 Mbps",
  64: "0.064 Mbps",
};

const AUDIO_QUALITY_PROFILES: Record<number, string> = {
  512: "512 kbps",
  320: "320 kbps",
  256: "256 kbps",
  192: "192 kbps",
  128: "128 kbps",
  96: "96 kbps",
};

const VIDEO_RESOLUTION_OVERRIDES: Record<string, string> = {
  "1080": "1080p",
  "720": "720p",
  "576": "576p",
  "480": "480p",
  "sd": "SD",
};

type RawPart = {
  decision?: string;
  Stream?: RawStream | RawStream[];
  [key: string]: unknown;
};

type RawMedia = {
  Part?: RawPart | RawPart[];
  videoResolution?: string;
  height?: string | number;
  bitrate?: string | number;
  [key: string]: unknown;
};

type RawVideo = {
  Media?: RawMedia | RawMedia[];
  TranscodeSession?: {
    videoDecision?: string;
    audioDecision?: string;
    subtitleDecision?: string;
    container?: string;
    videoCodec?: string;
    audioCodec?: string;
    height?: string | number;
    audioChannels?: string | number;
    transcodeHwRequested?: string | number;
    transcodeHwDecoding?: string;
    transcodeHwEncoding?: string;
    transcodeHwDecodingTitle?: string;
    transcodeHwEncodingTitle?: string;
    throttled?: string | number;
    speed?: string | number;
    progress?: string | number;
    [key: string]: unknown;
  };
  Session?: { bandwidth?: string | number; location?: string; id?: string };
  Player?: { platform?: string; product?: string; title?: string; state?: string; address?: string; remotePublicAddress?: string; local?: string | number; relayed?: string | number; secure?: string | number };
  User?: { title?: string; thumb?: string; id?: string; username?: string };
  ratingKey?: string;
  key?: string;
  summary?: string;
  tagline?: string;
  grandparentTitle?: string;
  parentTitle?: string;
  title?: string;
  duration?: string | number;
  viewOffset?: string | number;
  thumb?: string;
  parentThumb?: string; // Season poster
  grandparentThumb?: string; // Series poster
  parentIndex?: string | number; // Season number
  index?: string | number; // Episode number
  live?: string; // "1" if live TV
  [key: string]: unknown;
};

type RawStream = {
  id?: string;
  streamType?: string | number; // 1=Video, 2=Audio, 3=Subtitle
  selected?: string | number;
  decision?: string;
  codec?: string;
  displayTitle?: string;
  title?: string;
  bitrate?: string | number;
  height?: string | number;
  width?: string | number;
  channels?: string | number;
  audioChannelLayout?: string;
  [key: string]: unknown;
};

type RawDirectory = {
  key?: string;
  title?: string;
  type?: string;
  agent?: string;
  location?: string;
  childCount?: string | number;
  leafCount?: string | number;
  refreshing?: string | number;
  [key: string]: unknown;
};

type RawSessionsResponse = {
  MediaContainer?: {
    size?: string | number;
    friendlyName?: string;
    Video?: RawVideo | RawVideo[];
  };
};

type RawLibrariesResponse = {
  MediaContainer?: {
    Directory?: RawDirectory | RawDirectory[];
  };
};

export type PlexServerConfig = {
  id?: string;
  name?: string;
  baseUrl: string;
  token: string;
};

export type PlexSession = {
  id: string;
  sessionKey?: string;
  sessionId?: string;
  title: string;
  grandparentTitle?: string;
  parentTitle?: string;
  originalTitle?: string;
  subtitle?: string;
  parentIndex?: string | number;
  index?: string | number;
  user: string;
  userId?: string;
  username?: string;
  userThumb?: string;
  platform?: string;
  device?: string;
  state: string;
  bandwidth: number;
  decision?: string;
  quality?: string;
  location?: string;
  progressPercent: number | null;
  duration: number;
  viewOffset: number;
  resolution?: string;
  thumb?: string;
  serverName?: string;
  serverId?: string;
  ratingKey?: string;
  year?: string;
  player?: string;
  container?: string;
  ip?: string;
  videoDecision?: string;
  audioDecision?: string;
  subtitleDecision?: string;
  isOriginalQuality: boolean;
  originalContainer?: string;
  transcodeContainer?: string;
  originalVideoCodec?: string;
  transcodeVideoCodec?: string;
  originalAudioCodec?: string;
  transcodeAudioCodec?: string;
  originalAudioChannels?: string;
  transcodeAudioChannels?: string;
  originalHeight?: string;
  transcodeHeight?: string;
  qualityProfile?: string;
  throttled?: boolean;
  transcodeSpeed?: number;
  transcodeHwRequested?: boolean;
  transcodeHwDecoding?: string;
  transcodeHwEncoding?: string;
  originalSubtitleCodec?: string;
  transcodeSubtitleCodec?: string;
  parentThumb?: string;
  grandparentThumb?: string;
  Guid?: { id: string }[];
};

export type LibrarySection = {
  key: string;
  title: string;
  type?: string;
  agent?: string;
  count: number;
  refreshing: boolean;
  serverId?: string;
  serverName?: string;
};

export type SessionSummary = {
  active: number;
  directPlay: number;
  transcoding: number;
  paused: number;
  bandwidth: number;
  serverName?: string;
};



const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  processEntities: true,
  parseTagValue: true, // Needed to ensure values are processed
});

const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

export const resolveServer = (server?: PlexServerConfig): PlexServerConfig => {
  if (server?.baseUrl && server?.token) {
    return { ...server, baseUrl: server.baseUrl.replace(/\/$/, "") };
  }

  const baseUrl = process.env.PLEX_BASE_URL;
  const token = process.env.PLEX_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("Ingen Plex-server är konfigurerad. Lägg till en server i inställningar.");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    token,
    name: "Standard Plex",
  };
};

export const plexFetch = async (
  path: string,
  params: Record<string, string | number> = {},
  server?: PlexServerConfig,
) => {
  const { baseUrl, token } = resolveServer(server);
  const url = new URL(`${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`);

  url.searchParams.set("X-Plex-Token", token);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 3 seconds timeout

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/xml",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Plex request failed: ${response.status} ${response.statusText} - ${message}`);
    }

    return parser.parse(await response.text());
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Kunde inte ansluta till Plex på '${baseUrl}'. Tidsgränsen överskreds (3s). Kontrollera om servern är igång.`);
    }
    if (error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      const port = url.port || (url.protocol === 'https:' ? '443' : '80');
      if (port === '80' || port === '443') {
        throw new Error(`Kunde inte ansluta till Plex på '${baseUrl}'. Anslutning nekades på port ${port}. Glömde du att ange porten (t.ex. :32400)?`);
      }
      throw new Error(`Kunde inte ansluta till Plex på '${baseUrl}'. Kontrollera att servern är igång och nåbar.`);
    }
    throw error;
  }
};

export const decodePlexString = (str?: string): string => {
  if (!str) return "";

  // Basic entities
  let decoded = str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Swedish Characters
    .replace(/&aring;/g, "å")
    .replace(/&Aring;/g, "Å")
    .replace(/&auml;/g, "ä")
    .replace(/&Auml;/g, "Ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&Ouml;/g, "Ö")
    // Numeric Entities (Decimal)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    // Numeric Entities (Hex)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Sometimes double encoding happens (e.g. &amp;#228;)
  if (decoded.includes("&#")) {
    decoded = decoded
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  return decoded;
};

const formatTitle = (video: RawVideo) => {
  if (video.grandparentTitle) {
    const episode = video.title ? ` • ${decodePlexString(video.title)}` : "";
    const season = video.parentTitle ? ` — ${decodePlexString(video.parentTitle)}` : "";
    return `${decodePlexString(video.grandparentTitle)}${season}${episode}`;
  }

  return decodePlexString(video.title) || "Unknown title";
};

export const fetchItemMetadata = async (
  ratingKey: string,
  server?: PlexServerConfig
): Promise<any> => {
  try {
    const xml = (await plexFetch(`/library/metadata/${ratingKey}`, {}, server)) as any;
    const container = xml.MediaContainer ?? {};
    const video = toArray(container.Video)[0] || toArray(container.Directory)[0] || toArray(container.Track)[0]; // Track for music

    if (video) {
      // Decode common fields
      if (video.title) video.title = decodePlexString(video.title);
      if (video.originalTitle) video.originalTitle = decodePlexString(video.originalTitle);
      if (video.grandparentTitle) video.grandparentTitle = decodePlexString(video.grandparentTitle);
      if (video.parentTitle) video.parentTitle = decodePlexString(video.parentTitle);
      if (video.summary) video.summary = decodePlexString(video.summary);
      if (video.tagline) video.tagline = decodePlexString(video.tagline);
    }

    return video;
  } catch (e) {
    console.error(`Failed to fetch metadata for ${ratingKey}`, e);
    return null;
  }
};

export const fetchMetadataChildren = async (
  ratingKey: string,
  server?: PlexServerConfig
): Promise<any[]> => {
  try {
    const xml = (await plexFetch(`/library/metadata/${ratingKey}/children`, {}, server)) as any;
    const container = xml.MediaContainer ?? {};
    // Children can be Directory (Seasons) or Video (Episodes)
    const children = toArray(container.Directory).concat(toArray(container.Video));

    return children.map((item: any) => ({
      ...item,
      title: decodePlexString(item.title),
      summary: decodePlexString(item.summary),
      parentTitle: decodePlexString(item.parentTitle),
      grandparentTitle: decodePlexString(item.grandparentTitle),
    }));
  } catch (e) {
    console.error(`Failed to fetch children for ${ratingKey}`, e);
    return [];
  }
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
  const metadataMap = new Map<string, any>();
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
    const sessionMedia = toArray(video.Media).find((m: any) => m.selected) || toArray(video.Media)[0];
    const sessionPart = toArray(sessionMedia?.Part).find((p: any) => p.selected) || toArray(sessionMedia?.Part)[0];

    const sessionVideoStream = toArray(sessionPart?.Stream).find((s: any) => s.streamType === "1");
    const sessionAudioStream =
      toArray(sessionPart?.Stream).find((s: any) => s.streamType === "2" && (s.selected === "1" || s.selected === true)) ||
      toArray(sessionPart?.Stream).find((s: any) => s.streamType === "2");
    const sessionSubtitleStream =
      toArray(sessionPart?.Stream).find((s: any) => s.streamType === "3" && (s.selected === "1" || s.selected === true));

    // 2. Identify Original Streams (Source file details from Metadata)
    // We try to match by ID first (most accurate), then fallback to streamType/Index types.
    const metaMedias = toArray(metadata.Media);
    // Find the media that matches the session media ID if possible, or just the main one
    const originalMedia = metaMedias.find((m: any) => m.id === sessionMedia?.id) || metaMedias.find((m: any) => m.selected) || metaMedias[0];
    const originalPart = toArray(originalMedia?.Part).find((p: any) => p.id === sessionPart?.id) || toArray(originalMedia?.Part).find((p: any) => p.selected) || toArray(originalMedia?.Part)[0];

    const metaStreams = toArray(originalPart?.Stream);

    // MATCHING LOGIC: Match Session Stream ID -> Metadata Stream ID
    const originalVideoStream = sessionVideoStream ? (metaStreams.find((s: any) => s.id === sessionVideoStream.id) || metaStreams.find((s: any) => s.streamType === "1")) : undefined;
    const originalAudioStream = sessionAudioStream ? (metaStreams.find((s: any) => s.id === sessionAudioStream.id) || metaStreams.find((s: any) => s.streamType === "2" && s.selected)) : undefined;
    const originalSubtitleStream = sessionSubtitleStream ? (metaStreams.find((s: any) => s.id === sessionSubtitleStream.id) || metaStreams.find((s: any) => s.streamType === "3" && s.selected)) : undefined;

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

    let transcodeContainer = transcode.container || "";
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

export const fetchLibraries = async (
  server?: PlexServerConfig,
): Promise<LibrarySection[]> => {
  // Now proxies to the database-backed sync function
  const { syncLibraries, getLibraries } = await import("./libraries");

  if (server) {
    try {
      // Try to sync fresh data
      return await syncLibraries(server);
    } catch (e) {
      console.warn(`[Plex] Failed to sync libraries for ${server.name}, falling back to DB.`);
      // Fallback to DB
      return await getLibraries(server.id);
    }
  }

  // If no server specified (legacy usage?), return all from DB?
  // Or should we throw? The original fetched from "Default Server".
  // Let's replicate original behavior: resolve server -> sync.
  const { baseUrl, token } = resolveServer(server);
  const resolvedServer = { id: "default", name: "Standard Plex", baseUrl, token };
  return await syncLibraries(resolvedServer);
};

export const getDashboardSnapshot = async (server?: PlexServerConfig) => {
  const { syncLibraries, getLibraries } = await import("./libraries");

  // Parallel fetch: Sessions (Live) + Libraries (Sync & Persist)
  // We prefer fresh library data, but if it fails, we use cached.
  const sessionsPromise = fetchSessions(server);

  // FIX: Use cached libraries to avoid spamming logs on every dashboard poll.
  // Strict mode: Never sync automatically, only return what is in DB.
  const librariesPromise = server ? getLibraries(server.id) : Promise.resolve([]);

  const [sessions, libraries] = await Promise.all([
    sessionsPromise,
    librariesPromise,
  ]);

  return {
    sessions: sessions.sessions,
    summary: sessions.summary,
    libraries,
    updatedAt: new Date().toISOString(),
    appName: getSetting("APP_NAME"),
  };
};

export interface PlexUser {
  id: string;
  title: string;
  username: string;
  email: string;
  thumb: string;
  filterAll: string;
  filterMovies: string;
  filterMusic: string;
  filterPhotos: string;
  filterTelevision: string;
  serverName: string;
  serverId: string;
  isAdmin: boolean;
}

export const fetchPlexUsers = async (
  server: PlexServerConfig,
): Promise<PlexUser[]> => {
  const { baseUrl, token } = resolveServer(server);

  const parseUsers = (xml: any) => {
    const container = xml.MediaContainer ?? {};
    const users = toArray(container.User);
    return users.map((u: any) => ({
      id: u.id,
      title: decodePlexString(u.title),
      username: decodePlexString(u.username),
      email: u.email,
      thumb: u.thumb,
      filterAll: u.filterAll,
      filterMovies: u.filterMovies,
      filterMusic: u.filterMusic,
      filterPhotos: u.filterPhotos,
      filterTelevision: u.filterTelevision,
      serverName: server?.name || "Unknown",
      serverId: server?.id || "unknown", // Use the stable server ID
      isAdmin: false,
    }));
  };

  try {
    const allUsers: PlexUser[] = [];

    // 0. Fetch "Me" (The Admin/Owner)
    try {
      const meRes = await fetch(`https://plex.tv/users/account?X-Plex-Token=${token}`, {
        headers: { Accept: "application/xml" }
      });
      if (meRes.ok) {
        const meText = await meRes.text();
        const meXml = parser.parse(meText);
        const userTag = meXml.user || meXml.User;
        if (userTag) {
          allUsers.push({
            id: userTag.id,
            title: decodePlexString(userTag.title || userTag.username),
            username: decodePlexString(userTag.username),
            email: userTag.email,
            thumb: userTag.thumb,
            filterAll: "", // Admin sees all
            filterMovies: "",
            filterMusic: "",
            filterPhotos: "",
            filterTelevision: "",
            serverName: server?.name || "Unknown",
            serverId: server?.id || "unknown",
            isAdmin: true,
          });
        }
      }
    } catch (e) {
      console.error("Failed to fetch owner info:", e);
    }

    // 1. Try Local Server
    try {
      const xml = (await plexFetch("/users", {}, server)) as any;
      const users = parseUsers(xml);
      if (users.length > 0) {
        // Merge avoiding duplicates (in case owner is in the list, though unlikely for /users)
        const existingIds = new Set(allUsers.map(u => u.id));
        for (const u of users) {
          if (!existingIds.has(u.id)) {
            allUsers.push(u);
          }
        }
        return allUsers;
      }
    } catch (e) {
      // Ignore local error, try cloud
      // console.warn("Local user fetch failed, trying cloud...");
    }

    // 2. Try Plex.tv Cloud API (Fallback)
    const cloudUrl = `https://plex.tv/api/users?X-Plex-Token=${token}`;
    const res = await fetch(cloudUrl, { headers: { Accept: "application/xml" } });
    if (!res.ok) throw new Error(`Cloud fetch failed: ${res.status}`);

    const text = await res.text();
    const xml = parser.parse(text);
    const cloudUsers = parseUsers(xml);

    // Merge
    const existingIds = new Set(allUsers.map(u => u.id));
    for (const u of cloudUsers) {
      if (!existingIds.has(u.id)) {
        allUsers.push(u);
      }
    }

    return allUsers;

  } catch (error) {
    console.error(`Failed to fetch users for ${server?.name}:`, error);
    return [];
  }
};

export const terminateSession = async (
  sessionId: string,
  serverConfig: PlexServerConfig,
  reason: string = "Terminated by Admin"
) => {
  try {
    const { baseUrl, token } = resolveServer(serverConfig);
    const params = new URLSearchParams({
      sessionId,
      reason,
      "X-Plex-Token": token,
    });

    const url = `${baseUrl}/status/sessions/terminate?${params.toString()}`;


    const res = await fetch(url, { method: "GET" });

    // 404 means session is already terminated/not found - treat as success
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to terminate session: ${res.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("Failed to terminate session:", error);
    throw error;
  }
};
