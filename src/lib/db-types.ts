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
}

export interface ActivityHistoryRow {
  id: string;
  serverId: string;
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
}

export interface ActiveSessionRow {
  sessionId: string;
  serverId: string;
  userId: string | null;
  user: string;
  title: string;
  subtitle: string | null;
  ratingKey: string;
  startTime: number;
  lastSeen: number;
  state: string | null;
  platform: string | null;
  device: string | null;
  meta_json: string | null;
  pausedCounter: number;
  pausedSince: number | null;
}

export interface LibraryRow {
  key: string;
  title: string;
  type: string | null;
  agent: string | null;
  count: number;
  refreshing: number;
  serverId: string;
  serverName: string | null;
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

export interface LibraryItemRow {
  ratingKey: string;
  libraryKey: string;
  serverId: string;
  title: string;
  year: number | null;
  thumb: string | null;
  type: string | null;
  addedAt: string | null;
  updatedAt: string;
  meta_json: string | null;
}

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
}

export interface ExternalMetadataRow {
  id: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  updated_at: string | null;
}

export interface StreakCacheRow {
  username: string;
  userId: string | null;
  currentStreak: number;
  longestStreak: number;
  updatedAt: number;
}

export interface UserActivitySummaryRow {
  userId: string;
  username: string | null;
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
