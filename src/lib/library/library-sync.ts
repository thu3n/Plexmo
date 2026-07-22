import { db } from "../db";
import { Logger } from "../logger";
import { listInternalServers } from "../servers";
import { resolveMediaId, enrichMediaItemGuids, parseGuidList } from "../history/media-resolve";
import { plexFetch, toArray, decodePlexString } from "../plex/plex-client";
import type { PlexMediaContainer, PlexMetadata, PlexServerConfig } from "../plex/plex-types";
import { syncSectionEpisodes } from "./episode-sync";

/** Library types we inventory. Music/photo sections are skipped for now. */
const SYNCED_SECTION_TYPES = new Set(["movie", "show"]);

type SectionInfo = { key: string; title: string; type: string };

const upsertSection = db.prepare(`
  INSERT INTO library_sections (serverId, sectionKey, title, type, itemCount, updatedAt)
  VALUES (@serverId, @sectionKey, @title, @type, @itemCount, @updatedAt)
  ON CONFLICT(serverId, sectionKey) DO UPDATE SET
    title = excluded.title,
    type = excluded.type,
    itemCount = excluded.itemCount,
    updatedAt = excluded.updatedAt
`);

const upsertItem = db.prepare(`
  INSERT INTO library_items (
    serverId, ratingKey, sectionKey, mediaId, type, title, year, addedAt, fileSize, duration, thumb, syncedAt
  ) VALUES (
    @serverId, @ratingKey, @sectionKey, @mediaId,
    @type, @title, @year, @addedAt, @fileSize, @duration, @thumb, @syncedAt
  )
  ON CONFLICT(serverId, ratingKey) DO UPDATE SET
    sectionKey = excluded.sectionKey,
    mediaId = COALESCE(excluded.mediaId, library_items.mediaId),
    type = excluded.type,
    title = excluded.title,
    year = excluded.year,
    addedAt = excluded.addedAt,
    fileSize = excluded.fileSize,
    duration = excluded.duration,
    thumb = excluded.thumb,
    syncedAt = excluded.syncedAt
`);

const deleteVanished = db.prepare(`
  DELETE FROM library_items WHERE serverId = ? AND sectionKey = ? AND syncedAt < ?
`);

const deleteVanishedSections = db.prepare(`
  DELETE FROM library_sections
  WHERE serverId = ? AND sectionKey NOT IN (SELECT DISTINCT sectionKey FROM library_items WHERE serverId = ?)
`);

const deleteOrphanedEpisodes = db.prepare(`
  DELETE FROM library_episodes
  WHERE serverId = ? AND sectionKey NOT IN (SELECT sectionKey FROM library_sections WHERE serverId = ?)
`);

const fetchSections = async (server: PlexServerConfig): Promise<SectionInfo[]> => {
  const xml = (await plexFetch("/library/sections", {}, server)) as PlexMediaContainer;
  return toArray(xml.MediaContainer?.Directory).map((d) => ({
    key: String(d.key ?? ""),
    title: decodePlexString(d.title) || "Unknown",
    type: String(d.type ?? ""),
  }));
};

const firstPartSize = (item: PlexMetadata): number | null => {
  const media = toArray(item.Media)[0];
  const part = toArray(media?.Part)[0] as { size?: string | number } | undefined;
  const size = Number(part?.size);
  return Number.isFinite(size) && size > 0 ? size : null;
};

const syncSection = async (server: PlexServerConfig & { id: string }, section: SectionInfo, syncedAt: number) => {
  // includeGuids=1 adds each item's external ids (imdb/tmdb/tvdb) — used to
  // enrich canonical media_items so legacy history rows that only carry
  // show-level external ids can find their show.
  const xml = (await plexFetch(`/library/sections/${section.key}/all?includeGuids=1`, {}, server)) as PlexMediaContainer;
  const container = xml.MediaContainer ?? {};
  // Movies arrive as Video, shows as Directory.
  const items = [...toArray(container.Video), ...toArray(container.Directory)];

  const writeAll = db.transaction((rows: PlexMetadata[]) => {
    for (const item of rows) {
      if (!item.ratingKey) continue;
      const ratingKey = String(item.ratingKey);
      const type = item.type ?? section.type;
      const title = decodePlexString(item.title) || "Unknown";
      const year = item.year ? Number(item.year) : undefined;

      // Canonical link for the whole inventory, not just played titles —
      // sections/all carries each item's plex:// guid, so unique-title counts
      // are correct without waiting for playback. Legacy-agent guids
      // (non-plex://) resolve via the media_sources cache or stay NULL.
      const guids = parseGuidList(Array.isArray(item.Guid) ? item.Guid : item.Guid ? [item.Guid] : []);
      if (typeof item.guid === "string" && item.guid.startsWith("plex://")) {
        guids.plexGuid = item.guid;
      }
      const mediaId = resolveMediaId({
        serverId: server.id,
        ratingKey,
        type,
        title,
        year,
        guids,
      });
      // Items resolved via the media_sources cache keep their original guid
      // set — top up external ids so show lookups by tvdb/imdb work.
      if (mediaId !== null) enrichMediaItemGuids(mediaId, guids);

      upsertItem.run({
        serverId: server.id,
        ratingKey,
        sectionKey: section.key,
        mediaId,
        type,
        title,
        year: year ?? null,
        addedAt: item.addedAt ? Number(item.addedAt) * 1000 : null,
        fileSize: firstPartSize(item),
        duration: item.duration ? Number(item.duration) : null,
        thumb: typeof item.thumb === "string" ? item.thumb : null,
        syncedAt,
      });
    }
    upsertSection.run({
      serverId: server.id,
      sectionKey: section.key,
      title: section.title,
      type: section.type,
      itemCount: rows.filter((i) => i.ratingKey).length,
      updatedAt: new Date(syncedAt).toISOString(),
    });
    deleteVanished.run(server.id, section.key, syncedAt);
  });
  writeAll(items);

  return items.length;
};

/** Sync one server's movie/show libraries into library_sections/library_items. */
export const syncServerLibraries = async (server: PlexServerConfig & { id: string }) => {
  const syncedAt = Date.now();
  const sections = await fetchSections(server);
  let total = 0;

  for (const section of sections) {
    if (!SYNCED_SECTION_TYPES.has(section.type)) continue;
    try {
      total += await syncSection(server, section, syncedAt);
    } catch (e) {
      Logger.error(`[LibrarySync] ${server.name}/${section.title} failed:`, e);
      continue;
    }
    // Episode inventory is best-effort on top of a successful item sync — its
    // own catch so a leaf-listing failure never looks like an item-sync failure.
    if (section.type === "show") {
      try {
        const episodes = await syncSectionEpisodes(server, section.key);
        Logger.info(`[LibrarySync] ${server.name}/${section.title}: ${episodes} episodes`);
      } catch (e) {
        Logger.error(`[LibrarySync] ${server.name}/${section.title} episode listing failed:`, e);
      }
    }
  }

  deleteVanishedSections.run(server.id, server.id);
  // Episode rows from sections that no longer exist (removed or renumbered).
  deleteOrphanedEpisodes.run(server.id, server.id);
  Logger.info(`[LibrarySync] ${server.name}: ${total} items across ${sections.length} sections`);
  return total;
};

/** Sync all non-archived servers. Failures are per-server, never fatal. */
export const syncAllLibraries = async () => {
  const servers = await listInternalServers();
  const results = await Promise.allSettled(
    servers.map((server) =>
      syncServerLibraries({
        id: server.id,
        name: server.name,
        baseUrl: server.baseUrl,
        token: server.token,
      })
    )
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) Logger.error(`[LibrarySync] ${failed}/${servers.length} servers failed`);
};
