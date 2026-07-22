import { db } from "../db";

/**
 * Read queries behind GET /api/libraries. Split from the route so the SQL is
 * unit-testable against a fixture DB; the route keeps auth/scope/error handling.
 */

const RECENTLY_ADDED_LIMIT = 10;

export type LibrarySectionRow = {
  serverId: string;
  serverName: string | null;
  sectionKey: string;
  title: string;
  type: string;
  itemCount: number | null;
  updatedAt: string | null;
  episodeCount: number;
};

export type UniqueTitlesRow = { type: string; uniqueCount: number; totalCopies: number };

export type UniqueEpisodesRow = { uniqueCount: number; totalCopies: number };

export type RecentlyAddedRow = {
  serverId: string;
  serverName: string | null;
  ratingKey: string;
  title: string;
  year: number | null;
  type: string;
  addedAt: number;
  thumb: string | null;
};

export type LibrariesData = {
  sections: LibrarySectionRow[];
  uniqueTitles: UniqueTitlesRow[];
  uniqueEpisodes: UniqueEpisodesRow;
  recentlyAdded: RecentlyAddedRow[];
};

const scopeFilter = (column: string, allowedServerIds?: string[]) =>
  allowedServerIds && allowedServerIds.length > 0
    ? { sql: ` AND ${column} IN (${allowedServerIds.map(() => "?").join(",")})`, args: allowedServerIds }
    : { sql: "", args: [] as string[] };

export const getLibrariesData = (allowedServerIds?: string[]): LibrariesData => {
  const scope = scopeFilter("ls.serverId", allowedServerIds);
  const itemScope = scopeFilter("li.serverId", allowedServerIds);
  const episodeScope = scopeFilter("serverId", allowedServerIds);

  // Per-server sections. Within one section every episode row is unique by
  // construction, so the correlated COUNT(*) IS the section's episode count.
  const sections = db
    .prepare(
      `
      SELECT ls.serverId, s.name as serverName, ls.sectionKey, ls.title, ls.type,
             ls.itemCount, ls.updatedAt,
             (SELECT COUNT(*) FROM library_episodes le
              WHERE le.serverId = ls.serverId AND le.sectionKey = ls.sectionKey) as episodeCount
      FROM library_sections ls
      LEFT JOIN servers s ON ls.serverId = s.id
      WHERE 1=1${scope.sql}
      ORDER BY s.name, ls.title
    `
    )
    .all(...scope.args) as LibrarySectionRow[];

  // Cross-server unique titles per type — the only honest aggregate:
  // counted on canonical mediaId (per-server fallback key when unlinked).
  const uniqueTitles = db
    .prepare(
      `
      SELECT li.type,
             COUNT(DISTINCT COALESCE(li.mediaId, li.serverId || ':' || li.ratingKey)) as uniqueCount,
             COUNT(*) as totalCopies
      FROM library_items li
      WHERE li.type IN ('movie', 'show')${itemScope.sql}
      GROUP BY li.type
    `
    )
    .all(...itemScope.args) as UniqueTitlesRow[];

  // Episodes dedupe on the top-level guid (stable across servers); NULL guids
  // fall back to per-server keys — same accepted rule as uniqueTitles.
  const uniqueEpisodes = db
    .prepare(
      `
      SELECT COUNT(DISTINCT COALESCE(guid, serverId || ':' || ratingKey)) as uniqueCount,
             COUNT(*) as totalCopies
      FROM library_episodes
      WHERE 1=1${episodeScope.sql}
    `
    )
    .get(...episodeScope.args) as UniqueEpisodesRow;

  // One row per canonical title — the same movie on three servers appears
  // once. Single MAX() aggregate: SQLite's bare-column semantics guarantee all
  // bare columns (incl. the joined serverName) come from the row holding the
  // max addedAt, i.e. the newest copy wins.
  const recentlyAdded = db
    .prepare(
      `
      SELECT li.serverId, s.name as serverName, li.ratingKey, li.title, li.year,
             li.type, MAX(li.addedAt) as addedAt, li.thumb
      FROM library_items li
      LEFT JOIN servers s ON li.serverId = s.id
      WHERE li.addedAt IS NOT NULL${itemScope.sql}
      GROUP BY COALESCE(li.mediaId, li.serverId || ':' || li.ratingKey)
      ORDER BY addedAt DESC
      LIMIT ?
    `
    )
    .all(...itemScope.args, RECENTLY_ADDED_LIMIT) as RecentlyAddedRow[];

  return { sections, uniqueTitles, uniqueEpisodes, recentlyAdded };
};
