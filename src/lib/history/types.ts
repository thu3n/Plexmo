export type HistoryEntry = {
  id: string;
  serverId: string;
  /** Canonical account id (user_identities.accountId). */
  userId?: string;
  user: string;
  title: string;
  subtitle?: string;
  ratingKey: string;
  startTime: number;
  stopTime: number;
  duration: number;
  platform?: string;
  device?: string;
  ip?: string;
  serverName?: string;
  meta_json?: string;
  /** Current library art for the linked canonical media — beats the frozen
   *  meta_json thumb, whose ratingKey Plex may have reassigned since. */
  freshThumb?: string | null;
  pausedCounter: number;
  thumb?: string;
  parentThumb?: string;
  plex_guid?: string;
  imdb_id?: string;
  tmdb_id?: string;
  tvdb_id?: string;
  mediaId?: number;
  importSource?: string;
  importRef?: string;
  // Queryable fact columns (migration v5) — derived from meta_json at write
  // time by session-facts.ts; NULL means unknown, not zero.
  transcode_decision?: string | null;
  video_decision?: string | null;
  audio_decision?: string | null;
  video_resolution?: string | null;
  stream_video_resolution?: string | null;
  bitrate?: number | null;
  bandwidth?: number | null;
  location?: string | null;
  relayed?: number | null;
  view_offset_ms?: number | null;
  percent_complete?: number | null;
  watched?: number | null;
  play_duration?: number | null;
};

export type HistoryParams = {
  page?: number;
  pageSize?: number;
  serverId?: string;
  userId?: string;
  search?: string;
  /** Authorization scope: when set, only these servers' rows are visible. */
  allowedServerIds?: string[];
};

export type HistoryResult = {
  data: HistoryEntry[];
  totalActionCount: number; // Total count of stored history matching filters
  activeSessions: HistoryEntry[];
};
