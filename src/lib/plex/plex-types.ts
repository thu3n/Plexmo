// All exported Plex domain types plus the quality-profile lookup maps used by
// session parsing. Extracted from the original src/lib/plex.ts (refactor #4).

export const VIDEO_QUALITY_PROFILES: Record<number, string> = {
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

export const AUDIO_QUALITY_PROFILES: Record<number, string> = {
  512: "512 kbps",
  320: "320 kbps",
  256: "256 kbps",
  192: "192 kbps",
  128: "128 kbps",
  96: "96 kbps",
};

export const VIDEO_RESOLUTION_OVERRIDES: Record<string, string> = {
  "1080": "1080p",
  "720": "720p",
  "576": "576p",
  "480": "480p",
  "sd": "SD",
};

export interface PlexStream {
  id?: string;
  streamType?: string | number;
  selected?: string | number | boolean;
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
}

export interface PlexPart {
  id?: string;
  decision?: string;
  Stream?: PlexStream | PlexStream[];
  selected?: boolean | string;
  [key: string]: unknown;
}

export interface PlexMedia {
  id?: string;
  Part?: PlexPart | PlexPart[];
  videoResolution?: string;
  height?: string | number;
  bitrate?: string | number;
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: string | number;
  selected?: boolean;
  [key: string]: unknown;
}

export interface PlexMetadata {
  ratingKey?: string;
  key?: string;
  guid?: string;
  type?: string;
  title?: string;
  originalTitle?: string;
  grandparentTitle?: string;
  parentTitle?: string;
  summary?: string;
  tagline?: string;
  thumb?: string;
  parentThumb?: string;
  grandparentThumb?: string;
  parentIndex?: string | number;
  index?: string | number;
  year?: string | number;
  duration?: string | number;
  viewOffset?: string | number;
  live?: string;
  Media?: PlexMedia | PlexMedia[];
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
    throttled?: string | number;
    speed?: string | number;
    progress?: string | number;
    [key: string]: unknown;
  };
  Session?: { bandwidth?: string | number; location?: string; id?: string };
  Player?: { platform?: string; product?: string; title?: string; state?: string; address?: string; remotePublicAddress?: string; local?: string | number; relayed?: string | number; secure?: string | number };
  User?: { title?: string; thumb?: string; id?: string; username?: string };
  Guid?: { id: string }[];
  Directory?: PlexMetadata[];
  Video?: PlexMetadata[];
  Track?: PlexMetadata[];
  [key: string]: unknown;
}

export interface PlexMediaContainer<T = PlexMetadata> {
  MediaContainer: {
    size?: string | number;
    totalSize?: string | number; // Total matching items on paginated responses
    friendlyName?: string; // Server Name
    Directory?: T | T[];
    Video?: T | T[];
    Track?: T | T[];
    User?: PlexUserRaw | PlexUserRaw[];
    [key: string]: unknown;
  };
}

export interface PlexUserRaw {
  id: string;
  title?: string;
  username?: string;
  email: string;
  thumb: string;
  filterAll: string;
  filterMovies: string;
  filterMusic: string;
  filterPhotos: string;
  filterTelevision: string;
  [key: string]: unknown;
}

// Legacy alias for compatibility with existing code during refactor
export type RawVideo = PlexMetadata;
export type RawSessionsResponse = PlexMediaContainer<PlexMetadata>;

export type PlexServerConfig = {
  id?: string;
  name?: string;
  baseUrl: string;
  token: string;
};

export type PlexSession = {
  /** Globally unique stream id: `${serverId}:${sessionKey}`. NOT a media id. */
  id: string;
  /** Plex per-stream key, unique per server while the stream lives. */
  sessionKey?: string;
  /** Plex Session.id — required by /status/sessions/terminate. */
  sessionId?: string;
  /** Plex metadata type: movie | episode | track | clip | ... */
  type?: string;
  /** Canonical plex:// guid of the played item. */
  guid?: string;
  /** For episodes: the show's plex:// guid. */
  grandparentGuid?: string;
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
  /** Stream video bitrate in kbps (exact — `quality` is the rounded label). */
  bitrateKbps?: number;
  location?: string;
  /** Player is on the server's local network. */
  local?: boolean;
  /** Stream goes via Plex Relay — capped by Plex (operationally important). */
  relayed?: boolean;
  /** Connection is encrypted. */
  secure?: boolean;
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


export type SessionSummary = {
  active: number;
  directPlay: number;
  /** Container remux (decision "copy") — cheap but not free, so counted apart. */
  directStream: number;
  transcoding: number;
  paused: number;
  bandwidth: number;
  serverName?: string;
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
