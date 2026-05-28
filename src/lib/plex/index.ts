// Barrel for the Plex client module. Preserves the historical `@/lib/plex`
// import path after the file was split into focused submodules (types / client /
// sessions / library / users). Public export names are unchanged.

export type {
  PlexStream,
  PlexPart,
  PlexMedia,
  PlexMetadata,
  PlexMediaContainer,
  PlexUserRaw,
  PlexServerConfig,
  PlexSession,
  SessionSummary,
  PlexUser,
} from "./plex-types";

export {
  resolveServer,
  normalizePlexUrl,
  plexFetch,
  decodePlexString,
} from "./plex-client";

export { fetchSessions } from "./plex-sessions";

export {
  fetchItemMetadata,
  fetchMetadataChildren,
  getDashboardSnapshot,
} from "./plex-library";

export { fetchPlexUsers, terminateSession } from "./plex-users";
