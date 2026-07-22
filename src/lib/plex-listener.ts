
import WebSocket from 'ws';
import { runCronJob } from './cron';
import { getServerById, DbServer } from './servers';
import { resolveServer } from './plex';
import { Logger } from './logger';

// Singleton connection registry. The map slot is reserved when the socket is
// CREATED (not on 'open') so two overlapping connect calls can't open two
// sockets for the same server.
const activeConnections: Map<string, WebSocket> = new Map();
const reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
const reconnectDelays: Map<string, number> = new Map();

let lastSyncTime = 0;
let isSyncing = false;
const SYNC_COOLDOWN_MS = 2000; // 2 seconds throttle
const RECONNECT_BASE_MS = 10_000;
const RECONNECT_MAX_MS = 5 * 60_000;

export async function startPlexListener() {
    Logger.info('[PlexListener] Initializing...');

    try {
        const { db } = await import('./db');
        const servers = db.prepare("SELECT * FROM servers WHERE archivedAt IS NULL").all() as DbServer[];

        if (servers.length === 0) {
            Logger.info('[PlexListener] No servers configured.');
            return;
        }

        for (const server of servers) {
            connectToServer(server);
        }

    } catch (error) {
        Logger.error('[PlexListener] Failed to start:', error);
    }
}

export function connectToServer(server: DbServer) {
    if (server.archivedAt) return;
    if (activeConnections.has(server.id)) {
        return; // Already connected or connecting
    }

    // A fresh explicit connect supersedes any pending reconnect timer.
    const pending = reconnectTimers.get(server.id);
    if (pending) {
        clearTimeout(pending);
        reconnectTimers.delete(server.id);
    }

    const { baseUrl, token } = resolveServer(server);

    // Construct WS URL: http -> ws, https -> wss
    let wsUrl = baseUrl.replace(/^http/, 'ws');
    wsUrl = `${wsUrl}/:/websockets/notifications?X-Plex-Token=${token}`;

    Logger.info(`[PlexListener] Connecting to ${server.name} (${baseUrl})...`);

    try {
        const ws = new WebSocket(wsUrl);
        activeConnections.set(server.id, ws);

        ws.on('open', () => {
            Logger.info(`[PlexListener] Connected to ${server.name}`);
            reconnectDelays.delete(server.id);
        });

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());

                // We look for specific notification types indicating stream activity
                // "playing" type usually contains PlaySessionStateNotification
                if (message.NotificationContainer && message.NotificationContainer.type === 'playing') {
                    const notifications = message.NotificationContainer.PlaySessionStateNotification || [];
                    // If we have notifications, it means state changed.
                    // To be safe, trigger rule check.
                    if (notifications.length > 0) {
                        const now = Date.now();
                        if (now - lastSyncTime > SYNC_COOLDOWN_MS && !isSyncing) {
                            lastSyncTime = now;
                            isSyncing = true;
                            // runCronJob is async, don't block
                            runCronJob().finally(() => {
                                isSyncing = false;
                            });
                        }
                    }
                }
            } catch {
                // Ignore parse errors
            }
        });

        ws.on('error', (err) => {
            Logger.error(`[PlexListener] Error on ${server.name}:`, err.message);
        });

        ws.on('close', () => {
            // Only clear the slot if this socket still owns it (a manual
            // disconnect may already have replaced/removed it).
            if (activeConnections.get(server.id) === ws) {
                activeConnections.delete(server.id);
            }
            scheduleReconnect(server.id, server.name);
        });

    } catch (error) {
        activeConnections.delete(server.id);
        Logger.error(`[PlexListener] Connection failed for ${server.name}:`, error);
    }
}

/** Close the socket and cancel reconnects — called when a server is archived/removed. */
export function disconnectFromServer(serverId: string) {
    const timer = reconnectTimers.get(serverId);
    if (timer) {
        clearTimeout(timer);
        reconnectTimers.delete(serverId);
    }
    reconnectDelays.delete(serverId);

    const ws = activeConnections.get(serverId);
    if (ws) {
        activeConnections.delete(serverId);
        try {
            // Prevent the close handler from scheduling a reconnect.
            ws.removeAllListeners('close');
            ws.close();
        } catch (e) {
            Logger.error(`[PlexListener] Failed to close socket for ${serverId}:`, e);
        }
        Logger.info(`[PlexListener] Disconnected from server ${serverId}.`);
    }
}

function scheduleReconnect(serverId: string, serverName: string) {
    if (reconnectTimers.has(serverId)) return;

    const delay = reconnectDelays.get(serverId) ?? RECONNECT_BASE_MS;
    reconnectDelays.set(serverId, Math.min(delay * 2, RECONNECT_MAX_MS));

    Logger.info(`[PlexListener] Disconnected from ${serverName}. Reconnecting in ${Math.round(delay / 1000)}s...`);

    const timer = setTimeout(async () => {
        reconnectTimers.delete(serverId);
        try {
            // Check if server still exists and get fresh details (e.g. new token)
            const freshServer = await getServerById(serverId);
            if (freshServer && !freshServer.archivedAt) {
                connectToServer(freshServer);
            } else {
                Logger.info(`[PlexListener] Server ${serverName} (${serverId}) has been removed. Stopping reconnection.`);
            }
        } catch (e) {
            Logger.error(`[PlexListener] Error checking server status for ${serverName}:`, e);
        }
    }, delay);
    reconnectTimers.set(serverId, timer);
}
