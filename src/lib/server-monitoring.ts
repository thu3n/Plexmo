import { getServerById } from "./servers";
import { connectToServer, disconnectFromServer } from "./plex-listener";
import { backfillServerIdentities } from "./server-identity-backfill";
import { deleteServerSnapshot } from "./dashboard-cache";
import { syncHistory } from "./history";
import { runCronJob } from "./cron";
import { Logger } from "./logger";

/**
 * Re-applies the runtime monitoring state (WebSocket, dashboard cache, cron)
 * after a server row changed — URL/token edits as well as pause/resume.
 *
 * Pausing also closes the server's in-flight sessions into history: once the
 * cron stops polling it, nothing else would ever end those active_sessions
 * rows, and they would sit on the dashboard/rules as "playing" forever.
 */
export async function refreshServerMonitoring(serverId: string): Promise<void> {
    disconnectFromServer(serverId);
    deleteServerSnapshot(serverId);

    const server = await getServerById(serverId);
    if (!server || server.archivedAt) return;

    if (server.disabledAt) {
        const { endedSessions } = syncHistory(server, []);
        Logger.info(
            `[Servers] Monitoring paused for ${server.name}; closed ${endedSessions.length} active session(s).`
        );
        return;
    }

    connectToServer(server);
    backfillServerIdentities().catch((err) => Logger.error("Post-update identity backfill failed:", err));
    runCronJob().catch((err) => Logger.error("Post-update cron kick failed:", err));
}
