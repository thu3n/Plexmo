import { db } from "../db";
import { plexFetch, toArray } from "../plex/plex-client";
import type { PlexMediaContainer, PlexServerConfig } from "../plex/plex-types";

/**
 * Per-episode inventory for show sections. Feeds exact unique-episode counts:
 * within one section every row is unique; across servers episodes dedupe on
 * the top-level guid (plex://episode/… is globally stable across servers).
 */

/** Rows per page — sections can hold 30k+ episodes; lower if slow-WAN servers time out. */
const EPISODE_PAGE_SIZE = 2000;
/** Plex metadata type id for episode leaf listings on /library/sections/{key}/all. */
const PLEX_TYPE_EPISODE = 4;

type EpisodeRow = { ratingKey: string; guid: string | null };

const insertEpisode = db.prepare(`
  INSERT INTO library_episodes (serverId, ratingKey, sectionKey, guid)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(serverId, ratingKey) DO UPDATE SET
    sectionKey = excluded.sectionKey,
    guid = excluded.guid
`);

const deleteSectionEpisodes = db.prepare(`
  DELETE FROM library_episodes WHERE serverId = ? AND sectionKey = ?
`);

// Fetch-all-then-swap: the section's rows are only replaced once every page
// arrived, so a mid-flight network failure leaves the previous inventory intact.
const replaceSectionEpisodes = db.transaction(
  (serverId: string, sectionKey: string, episodes: EpisodeRow[]) => {
    deleteSectionEpisodes.run(serverId, sectionKey);
    for (const episode of episodes) {
      insertEpisode.run(serverId, episode.ratingKey, sectionKey, episode.guid);
    }
  }
);

/** Enumerate every episode of a show section (paginated) into library_episodes. */
export const syncSectionEpisodes = async (
  server: PlexServerConfig & { id: string },
  sectionKey: string
): Promise<number> => {
  const episodes: EpisodeRow[] = [];
  let start = 0;

  for (;;) {
    const xml = (await plexFetch(
      `/library/sections/${sectionKey}/all`,
      {
        type: PLEX_TYPE_EPISODE,
        "X-Plex-Container-Start": start,
        "X-Plex-Container-Size": EPISODE_PAGE_SIZE,
      },
      server
    )) as PlexMediaContainer;

    const container = xml.MediaContainer ?? {};
    const page = toArray(container.Video).filter((v) => v.ratingKey);
    for (const video of page) {
      episodes.push({
        ratingKey: String(video.ratingKey),
        guid: typeof video.guid === "string" ? video.guid : null,
      });
    }

    // Empty page is the hard stop (guards against a lying totalSize).
    if (page.length === 0) break;
    const totalSize = Number(container.totalSize ?? container.size ?? 0);
    start += page.length;
    if (start >= totalSize) break;
  }

  replaceSectionEpisodes(server.id, sectionKey, episodes);
  return episodes.length;
};
