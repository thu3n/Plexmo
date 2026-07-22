/**
 * Raw database row shapes — the single source of truth for what better-sqlite3
 * returns from each table.
 *
 * These mirror the columns defined in the v1 `baseline_schema` migration
 * (see src/lib/migrations.ts) exactly: SQLite INTEGER -> number, TEXT -> string,
 * and any column without NOT NULL is `| null`.
 *
 * IMPORTANT: these are *storage* shapes, not domain shapes. A column stored as
 * TEXT-holding-JSON is typed `string` here (e.g. discord_webhooks.events), and
 * a 0/1 flag is typed `number` (e.g. enabled, isAdmin). The richer domain types
 * (DiscordWebhook with events: string[], etc.) live in their feature/lib files
 * and are produced by mapping over these rows. Type the query result with the
 * Row, then map to the domain type.
 *
 * SELECT projections, JOINs, and aggregates do NOT use these — those rows are
 * not full table rows, so they get small local types at the query site.
 */

export interface ServerRow {
  id: string;
  name: string;
  baseUrl: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  color: string | null;
  /** Plex machineIdentifier — the stable natural key for a physical server. NULL until the async backfill has fetched /identity. */
  machineIdentifier: string | null;
  /** plex.tv account id of the server owner (cached to avoid network calls at login). */
  ownerAccountId: string | null;
  /** Soft-delete marker. Archived servers keep their data and revive on re-add. */
  archivedAt: string | null;
}

export interface ActivityHistoryRow {
  id: string;
  serverId: string;
  /** Canonical account id (user_identities.accountId). Post-v2 this is never NULL in practice — real plex.tv id or synthetic "legacy:<name>". */
  userId: string | null;
  user: string;
  title: string;
  subtitle: string | null;
  ratingKey: string;
  startTime: number;
  stopTime: number;
  duration: number;
  platform: string | null;
  device: string | null;
  ip: string | null;
  meta_json: string | null;
  pausedCounter: number;
  plex_guid: string | null;
  imdb_id: string | null;
  tmdb_id: string | null;
  tvdb_id: string | null;
  repair_status: string | null;
  player: string | null;
  mediaId: number | null;
  importSource: string | null;
  importRef: string | null;
}

export interface ActiveSessionRow {
  serverId: string;
  /** Plex per-stream key — PK together with serverId. NOT the media ratingKey. */
  sessionKey: string;
  /** Plex Session.id, required by /status/sessions/terminate. */
  plexSessionId: string | null;
  userId: string | null;
  user: string;
  title: string;
  subtitle: string | null;
  ratingKey: string;
  mediaId: number | null;
  startTime: number;
  lastSeen: number;
  state: string | null;
  platform: string | null;
  device: string | null;
  ip: string | null;
  meta_json: string | null;
  pausedCounter: number;
  pausedSince: number | null;
  plex_guid: string | null;
  imdb_id: string | null;
  tmdb_id: string | null;
  tvdb_id: string | null;
}

export interface UserIdentityRow {
  accountId: string;
  username: string;
  title: string;
  email: string | null;
  thumb: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServerUserRow {
  serverId: string;
  accountId: string;
  username: string | null;
  title: string | null;
  thumb: string | null;
  isAdmin: number;
  importedAt: string;
}

export interface MediaItemRow {
  id: number;
  type: string;
  plex_guid: string | null;
  imdb_id: string | null;
  tmdb_id: string | null;
  tvdb_id: string | null;
  title: string;
  year: number | null;
  showMediaId: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaSourceRow {
  serverId: string;
  ratingKey: string;
  mediaId: number;
  updatedAt: string;
}

export interface JobRow {
  id: string;
  type: string;
  targetId: string | null;
  status: string;
  progress: number;
  message: string | null;
  itemsProcessed: number;
  totalItems: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Legacy joined shape kept for API compatibility: one row per
 * (identity, server membership), produced by joining user_identities with
 * server_users. The v1 `users` table it used to mirror was dropped in
 * migration v2.
 */
export interface UserRow {
  id: string;
  title: string;
  username: string;
  email: string | null;
  thumb: string | null;
  serverId: string;
  importedAt: string;
  isAdmin: number;
}

export interface SettingRow {
  key: string;
  value: string;
}

export interface AllowedUserRow {
  id: string;
  email: string;
  username: string | null;
  createdAt: string;
  removeAfterLogin: number;
  expiresAt: string | null;
  /** JSON array of serverIds this entry is scoped to; NULL = all servers. */
  serverIds: string | null;
}

export interface RuleRow {
  key: string;
  value: string;
  isActive: number;
}

export interface UserRuleRow {
  userId: string;
  ruleKey: string;
}

export interface ServerRuleRow {
  serverId: string;
  ruleKey: string;
}

export interface RuleEventRow {
  id: number;
  ruleKey: string;
  userId: string;
  triggeredAt: string;
  endedAt: string | null;
  details: string | null;
  /** Set for server-scoped violations; NULL for global/cross-server events. */
  serverId: string | null;
}

export interface DiscordWebhookRow {
  id: string;
  name: string;
  url: string;
  events: string;
  enabled: number;
  createdAt: string;
}

export interface RuleInstanceRow {
  id: string;
  type: string;
  name: string;
  enabled: number;
  settings: string;
  discordWebhookId: string | null;
  discordWebhookIds: string | null;
  createdAt: string;
}

export interface ConcurrentSnapshotRow {
  id: number;
  count: number;
  sessions: string;
  timestamp: number;
  /** NULL = cross-server aggregate row; set = per-server row (written since v13). */
  serverId: string | null;
}

export interface StreamPeakRow {
  /** 'global' or a servers.id. */
  scope: string;
  count: number;
  /** Epoch ms when this peak count was first reached. */
  timestamp: number;
  updatedAt: number;
}

export interface InviteLinkRow {
  id: string;
  /** sha256 hex of the raw link secret — the secret itself is never stored. */
  tokenHash: string;
  type: "onboarding" | "access";
  label: string | null;
  createdByAccountId: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedByAccountId: string | null;
  /** JSON array for access-type server scoping; NULL = all servers. */
  serverIds: string | null;
}

export interface ExternalMetadataRow {
  id: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  updated_at: string | null;
}

export interface StreakCacheRow {
  accountId: string;
  currentStreak: number;
  longestStreak: number;
  updatedAt: number;
}

export interface UserActivitySummaryRow {
  accountId: string;
  serverId: string;
  total_count: number;
  total_duration: number;
  last_played_at: number | null;
  updated_at: number;
}

export interface SchemaMigrationRow {
  version: number;
  name: string;
  applied_at: string;
}

/** Shared projection shapes for common ad-hoc SELECTs. */
export interface CountRow {
  count: number;
}

export interface IdRow {
  id: string;
}
