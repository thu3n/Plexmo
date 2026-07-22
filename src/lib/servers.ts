import { randomUUID } from "node:crypto";
import { db } from "./db";
import { Logger } from "./logger";
import type { ServerRow } from "./db-types";

/** Public alias for the raw `servers` row shape. */
export type DbServer = ServerRow;

export type PublicServer = {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: string;
  updatedAt: string;
  hasToken: boolean;
  maskedToken: string | null;
  color: string | null;
  archived?: boolean;
  status?: "ok" | "unreachable";
  statusMessage?: string;
};

export type ServerInput = {
  name?: string;
  baseUrl: string;
  token: string;
  color?: string;
};

export type ServerUpdateInput = {
  name?: string;
  baseUrl?: string;
  token?: string;
  color?: string;
};

const sanitizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const toPublicServer = (server: DbServer): PublicServer => ({
  id: server.id,
  name: server.name,
  baseUrl: server.baseUrl,
  createdAt: server.createdAt,
  updatedAt: server.updatedAt,
  hasToken: Boolean(server.token),
  maskedToken: server.token ? `${server.token.slice(0, 4)}…${server.token.slice(-2)}` : null,
  color: server.color || null,
  archived: Boolean(server.archivedAt),
});

const countServers = db.prepare<[], { count: number }>(
  "SELECT COUNT(*) as count FROM servers WHERE archivedAt IS NULL"
);
const listStmt = db.prepare<[], DbServer>(
  "SELECT * FROM servers WHERE archivedAt IS NULL ORDER BY datetime(createdAt) ASC"
);
const listArchivedStmt = db.prepare<[], DbServer>(
  "SELECT * FROM servers WHERE archivedAt IS NOT NULL ORDER BY datetime(createdAt) ASC"
);
// Deliberately unfiltered: archived servers keep serving credentials for
// thumbnails and history rendering.
const getByIdStmt = db.prepare<[string], DbServer | undefined>("SELECT * FROM servers WHERE id = ?");
const getByMachineIdStmt = db.prepare<[string], DbServer | undefined>(
  "SELECT * FROM servers WHERE machineIdentifier = ?"
);
const insertStmt = db.prepare<DbServer>(
  `INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt, color, machineIdentifier, ownerAccountId, archivedAt)
   VALUES (@id, @name, @baseUrl, @token, @createdAt, @updatedAt, @color, @machineIdentifier, @ownerAccountId, @archivedAt)`
);
const updateStmt = db.prepare<DbServer>(
  "UPDATE servers SET name=@name, baseUrl=@baseUrl, token=@token, updatedAt=@updatedAt, color=@color WHERE id=@id"
);
const reviveStmt = db.prepare(
  `UPDATE servers SET name=@name, baseUrl=@baseUrl, token=@token, updatedAt=@updatedAt, color=@color, archivedAt=NULL
   WHERE id=@id`
);
const archiveStmt = db.prepare("UPDATE servers SET archivedAt = ?, updatedAt = ? WHERE id = ?");

/**
 * Fetch the Plex machineIdentifier for a server config. Best-effort: returns
 * null when the server is unreachable — the async backfill retries later.
 */
export const fetchMachineIdentifier = async (config: {
  baseUrl: string;
  token: string;
}): Promise<string | null> => {
  try {
    const { plexFetch } = await import("./plex");
    const result = (await plexFetch("/identity", {}, {
      baseUrl: config.baseUrl,
      token: config.token,
    })) as { MediaContainer?: { machineIdentifier?: string } };
    return result.MediaContainer?.machineIdentifier || null;
  } catch (e) {
    Logger.error("[Servers] Could not fetch /identity:", e instanceof Error ? e.message : e);
    return null;
  }
};

export const ensureDefaultServer = async () => {
  const { count } = countServers.get() ?? { count: 0 };
  if (count > 0) return null;

  const baseUrl = process.env.PLEX_BASE_URL;
  const token = process.env.PLEX_TOKEN;
  if (!baseUrl || !token) return null;

  const now = new Date().toISOString();
  const server: DbServer = {
    id: randomUUID(),
    name: "Standard Plex",
    baseUrl: sanitizeBaseUrl(baseUrl),
    token,
    createdAt: now,
    updatedAt: now,
    color: null,
    machineIdentifier: null,
    ownerAccountId: null,
    archivedAt: null,
  };

  insertStmt.run(server);
  return server;
};

export const listServers = async (): Promise<PublicServer[]> => {
  await ensureDefaultServer();
  const rows = listStmt.all();
  return rows.map(toPublicServer);
};

export const listAllServers = async (): Promise<PublicServer[]> => {
  const servers = await listServers();

  // Archived servers still own history — surface them with their real names.
  const archived = listArchivedStmt.all().map(toPublicServer);

  const knownIds = new Set([...servers, ...archived].map((s) => s.id));

  // Pre-v2 hard-deleted servers may have left orphaned serverIds in history.
  const historyServerIds = db
    .prepare<[], { serverId: string }>("SELECT DISTINCT serverId FROM activity_history")
    .all();

  const orphans: PublicServer[] = historyServerIds
    .map((row) => row.serverId)
    .filter((id) => id && !knownIds.has(id))
    .map((id) => ({
      id,
      name: `Unknown Server (${id})`,
      baseUrl: "",
      createdAt: "",
      updatedAt: "",
      hasToken: false,
      maskedToken: null,
      color: "#6b7280", // Gray color for orphans
    }));

  return [...servers, ...archived, ...orphans];
};

export const listInternalServers = async (): Promise<DbServer[]> => {
  await ensureDefaultServer();
  return listStmt.all();
};

export const getServerForDashboard = async (id?: string): Promise<DbServer | null> => {
  await ensureDefaultServer();

  if (id) {
    const server = getByIdStmt.get(id);
    if (server) return server;
  }

  const first = listStmt.get();
  return first ?? null;
};

export const getServerById = async (id: string): Promise<DbServer | undefined> => {
  await ensureDefaultServer();
  return getByIdStmt.get(id);
};

/**
 * Returns the raw (unmasked) token for a server, or null if the server/token
 * is missing. Deliberately exposed so the settings UI can reveal/copy the full
 * token — keep this gated behind the authenticated route only.
 */
export const getServerToken = async (id: string): Promise<string | null> => {
  const server = getByIdStmt.get(id);
  return server?.token || null;
};

/** Number of configured (non-archived) servers. Used to detect first-run/setup state. */
export const getServerCount = (): number => {
  return countServers.get()?.count ?? 0;
};

/** Cache the server owner's plex.tv account id (normally lazily backfilled at login). */
export const setServerOwner = (id: string, ownerAccountId: string): void => {
  db.prepare("UPDATE servers SET ownerAccountId = ? WHERE id = ?").run(ownerAccountId, id);
};

/**
 * Add a server. The Plex machineIdentifier is the natural key: re-adding a
 * previously removed (archived) server revives its old row — and thereby all
 * of its history, users and rule scopes — instead of minting a new id.
 * Adding the same physical server twice is rejected.
 */
export const createServer = async (input: ServerInput): Promise<PublicServer> => {
  const now = new Date().toISOString();
  const baseUrl = sanitizeBaseUrl(input.baseUrl);
  const name = input.name?.trim() || baseUrl.replace(/^https?:\/\//, "");

  const machineIdentifier = await fetchMachineIdentifier({ baseUrl, token: input.token });

  if (machineIdentifier) {
    const existing = getByMachineIdStmt.get(machineIdentifier);
    if (existing) {
      if (!existing.archivedAt) {
        throw new Error(`Den här Plex-servern är redan tillagd som "${existing.name}".`);
      }
      reviveStmt.run({
        id: existing.id,
        name,
        baseUrl,
        token: input.token,
        updatedAt: now,
        color: input.color || existing.color,
      });
      Logger.info(`[Servers] Revived archived server ${existing.id} (${name}).`);
      return toPublicServer({ ...existing, name, baseUrl, token: input.token, updatedAt: now, archivedAt: null });
    }
  }

  const server: DbServer = {
    id: randomUUID(),
    name,
    baseUrl,
    token: input.token,
    createdAt: now,
    updatedAt: now,
    color: input.color || null,
    machineIdentifier,
    ownerAccountId: null,
    archivedAt: null,
  };

  insertStmt.run(server);
  return toPublicServer(server);
};

export const updateServer = async (
  id: string,
  input: ServerUpdateInput,
): Promise<PublicServer> => {
  const existing = getByIdStmt.get(id);
  if (!existing) {
    throw new Error("Servern kunde inte hittas.");
  }

  const now = new Date().toISOString();
  const updated: DbServer = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    baseUrl: input.baseUrl !== undefined ? sanitizeBaseUrl(input.baseUrl) : existing.baseUrl,
    token: input.token !== undefined ? input.token : existing.token,
    updatedAt: now,
    color: input.color !== undefined ? input.color : existing.color,
  };

  updateStmt.run(updated);
  return toPublicServer(updated);
};

/**
 * Soft-delete: the row (and every serverId reference in history, users, rules
 * and media sources) stays intact so a later re-add revives it. Use
 * purgeServerData (src/lib/server-purge.ts) for the destructive variant.
 */
export const deleteServer = async (id: string) => {
  const now = new Date().toISOString();
  archiveStmt.run(now, now, id);
};
