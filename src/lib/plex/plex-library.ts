import { getSetting } from "../settings";
import { Logger } from "../logger";
import { plexFetch, toArray, decodePlexString } from "./plex-client";
import { fetchSessions } from "./plex-sessions";
import type { PlexServerConfig, PlexMediaContainer, PlexMetadata } from "./plex-types";

export const fetchItemMetadata = async (
  ratingKey: string,
  server?: PlexServerConfig
): Promise<PlexMetadata | null> => {
  try {
    const xml = (await plexFetch(`/library/metadata/${ratingKey}`, {}, server)) as PlexMediaContainer;
    const container = xml.MediaContainer ?? {};
    const video = toArray(container.Video)[0] || toArray(container.Directory)[0] || toArray(container.Track)[0]; // Track for music

    if (video) {
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

export const getDashboardSnapshot = async (server?: PlexServerConfig) => {
  const sessions = await fetchSessions(server);

  return {
    sessions: sessions.sessions,
    summary: sessions.summary,
    updatedAt: new Date().toISOString(),
    appName: getSetting("APP_NAME"),
  };
};
