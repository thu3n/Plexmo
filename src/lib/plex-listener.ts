
import WebSocket from 'ws';
import { runCronJob } from './cron';
import { listInternalServers, getServerById } from './servers';
import { getSetting } from './settings';
import { resolveServer } from './plex';

// Singleton to track active connections
// Singleton to track active connections
const activeConnections: Map<string, WebSocket> = new Map();
let lastSyncTime = 0;
let isSyncing = false;
const SYNC_COOLDOWN_MS = 2000; // 2 seconds throttle


export async function startPlexListener() {
    console.log('[PlexListener] Initializing...');

    try {
        // 1. Get all configured servers
        // We can use the DB directly or a helper.
        // Let's use the DB helper via import to avoid circular dep issues if possible.
        // Re-importing inside function to ensure DB is ready?
        const { db } = await import('./db');
        const servers = db.prepare("SELECT * FROM servers").all() as any[];

        if (servers.length === 0) {
            console.log('[PlexListener] No servers configured.');
            return;
        }

        // 2. Connect to each server
        for (const server of servers) {
            connectToServer(server);
        }

    } catch (error) {
        console.error('[PlexListener] Failed to start:', error);
    }
}

function connectToServer(server: any) {
    if (activeConnections.has(server.id)) {
        return; // Already connected
    }

    const { baseUrl, token } = resolveServer(server);

    // Construct WS URL
    // Replace http/https with ws/wss
    let wsUrl = baseUrl.replace(/^http/, 'ws');
    wsUrl = `${wsUrl}/:/websockets/notifications?X-Plex-Token=${token}`;

    console.log(`[PlexListener] Connecting to ${server.name} (${baseUrl})...`);

    try {
        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log(`[PlexListener] Connected to ${server.name}`);
            activeConnections.set(server.id, ws);
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
            } catch (e) {
                // Ignore parse errors
            }
        });

        ws.on('error', (err) => {
            console.error(`[PlexListener] Error on ${server.name}:`, err.message);
        });

        ws.on('close', () => {
            console.log(`[PlexListener] Disconnected from ${server.name}. Reconnecting in 10s...`);
            activeConnections.delete(server.id);
            setTimeout(async () => {
                try {
                    // Check if server still exists and get fresh details (e.g. new token)
                    const freshServer = await getServerById(server.id);
                    if (freshServer) {
                        connectToServer(freshServer);
                    } else {
                        console.log(`[PlexListener] Server ${server.name} (${server.id}) has been removed. Stopping reconnection.`);
                    }
                } catch (e) {
                    console.error(`[PlexListener] Error checking server status for ${server.name}:`, e);
                    // Optionally retry check later? For now, we assume if DB check fails, we stop or let the user restart.
                    // But to be robust, maybe we should try reconnecting anyway if it was just a DB error?
                    // Given the user issue is "Zombie Server", stopping is safer than retrying blindly.
                }
            }, 10000);
        });

    } catch (error) {
        console.error(`[PlexListener] Connection failed for ${server.name}:`, error);
    }
}
