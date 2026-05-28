import { getSetting } from "../settings";
import { Logger } from "../logger";
import { plexFetch, resolveServer, toArray, decodePlexString } from "./plex-client";
import { fetchSessions } from "./plex-sessions";
import type { PlexServerConfig, PlexMediaContainer, PlexMetadata, LibrarySection } from "./plex-types";

export const fetchItemMetadata = async (
  ratingKey: string,
  server?: PlexServerConfig
): Promise<PlexMetadata | null> => {
  try {
    const xml = (await plexFetch(`/library/metadata/${ratingKey}`, {}, server)) as PlexMediaContainer;
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

    return video ?? null;
  } catch (e) {
    Logger.error(`Failed to fetch metadata for ${ratingKey}`, e);
    return null;
  }
};

export const fetchMetadataChildren = async (
  ratingKey: string,
  server?: PlexServerConfig
): Promise<PlexMetadata[]> => {
  try {
    const xml = (await plexFetch(`/library/metadata/${ratingKey}/children`, {}, server)) as PlexMediaContainer;
    const container = xml.MediaContainer ?? {};
    // Children can be Directory (Seasons) or Video (Episodes)
    const children = toArray(container.Directory).concat(toArray(container.Video));

    return children.map((item) => ({
      ...item,
      title: decodePlexString(item.title),
      summary: decodePlexString(item.summary),
      parentTitle: decodePlexString(item.parentTitle),
      grandparentTitle: decodePlexString(item.grandparentTitle),
    }));
  } catch (e) {
    Logger.error(`Failed to fetch children for ${ratingKey}`, e);
    return [];
  }
};

export const fetchLibraries = async (
  server?: PlexServerConfig,
): Promise<LibrarySection[]> => {
  // Now proxies to the database-backed sync function
  const { syncLibraries, getLibraries } = await import("../libraries");

  if (server) {
    try {
      // Try to sync fresh data
      return await syncLibraries(server);
    } catch (e) {
      Logger.warn(`[Plex] Failed to sync libraries for ${server.name}, falling back to DB.`);
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
  const { getLibraries } = await import("../libraries");

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
