import { Logger } from "../logger";
import { parser, plexFetch, resolveServer, toArray, decodePlexString } from "./plex-client";
import type { PlexServerConfig, PlexMediaContainer, PlexUserRaw, PlexUser } from "./plex-types";

export const fetchPlexUsers = async (
  server: PlexServerConfig,
): Promise<PlexUser[]> => {
  const { baseUrl, token } = resolveServer(server);

  const parseUsers = (xml: PlexMediaContainer<PlexUserRaw>): PlexUser[] => {
    const container = xml.MediaContainer ?? {};
    const users = toArray(container.User);
    return users.map((u) => ({
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
      Logger.error("Failed to fetch owner info:", e);
    }

    // 1. Try Local Server
    try {
      const xml = (await plexFetch("/users", {}, server)) as PlexMediaContainer<PlexUserRaw>;
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
    const xml = parser.parse(text) as PlexMediaContainer<PlexUserRaw>;
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
    Logger.error(`Failed to fetch users for ${server?.name}:`, error);
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
    Logger.error("Failed to terminate session:", error);
    throw error;
  }
};
