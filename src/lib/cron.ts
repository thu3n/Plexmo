import { getDashboardSnapshot } from "@/lib/plex";
import { syncHistory } from "@/lib/history";
import { db } from "@/lib/db";
import { runRetentionSweepIfDue } from "@/lib/retention";
import { setServerSnapshot, markServerFailure } from "@/lib/dashboard-cache";
import { sendSessionStartNotification, sendSessionStopNotification } from "./discord";
import type { ServerRow, ConcurrentSnapshotRow, ActiveSessionRow } from "@/lib/db-types";

export async function runCronJob() {
    try {
        const servers = db.prepare<[], ServerRow>("SELECT * FROM servers").all();

        const results = await Promise.allSettled(
            servers.map(async (server) => {
                try {
                    const snapshot = await getDashboardSnapshot(server);
                    setServerSnapshot(server.id, snapshot);
                    const { newSessions, endedSessions } = syncHistory(server, snapshot.sessions);

                    // Send Notifications (Fire and forget to not block sync)
                    if (newSessions.length > 0) {
                        newSessions.forEach(s => sendSessionStartNotification(s).catch(e => console.error("Failed to send start notification", e)));
                    }
                    if (endedSessions.length > 0) {
                        endedSessions.forEach(s => sendSessionStopNotification(s).catch(e => console.error("Failed to send stop notification", e)));
                    }

                    return { server: server.name, status: "ok", sessions: snapshot.sessions };
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    markServerFailure(server.id, message);
                    console.error(`Failed to sync server ${server.name}:`, err);
                    return { server: server.name, status: "error", error: String(err) };
                }
            })
        );

        const combinedSessions = results
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => (r as PromiseFulfilledResult<any>).value.sessions || []);

        // Track Most Concurrent Streams (History)
        try {
            const currentCount = combinedSessions.length;
            if (currentCount > 0) {
                // Check last snapshot to avoid duplicates
                const lastSnapshot = db.prepare<[], Pick<ConcurrentSnapshotRow, "count" | "sessions">>("SELECT count, sessions FROM concurrent_snapshots ORDER BY timestamp DESC LIMIT 1").get();

                let shouldLog = true;
                if (lastSnapshot) {
                    const lastSessions = JSON.parse(lastSnapshot.sessions);
                    // Simple check: if count differs, log.
                    if (lastSnapshot.count === currentCount) {
                        // Deep check: map session IDs to see if they are the same
                        const currentIds = combinedSessions.map((s: any) => s.id).sort().join(',');
                        const lastIds = lastSessions.map((s: any) => s.id).sort().join(',');

                        if (currentIds === lastIds) {
                            shouldLog = false;
                        }
                    }
                }

                if (shouldLog) {
                    db.prepare("INSERT INTO concurrent_snapshots (count, sessions, timestamp) VALUES (?, ?, ?)")
                        .run(currentCount, JSON.stringify(combinedSessions), Date.now());
                }
            }
        } catch (e) {
            console.error("Failed to update statistics:", e);
        }



        // Always run rule checks to ensure closed sessions are processed/cleaned up
        // even if no active sessions exist (e.g. to close open rule events)
        const { checkAndLogViolations } = await import("./rules");
        await checkAndLogViolations(combinedSessions);

        // EXTRA SAFETY: Clean up "stuck" sessions from active_sessions
        // If a session hasn't been seen in > 2 hours, remove it.
        // This prevents the "infinite duration" bug.
        try {
            const stuckCutoff = Date.now() - (2 * 60 * 60 * 1000); // 2 hours
            const stuckSessions = db.prepare<[number], ActiveSessionRow>("SELECT * FROM active_sessions WHERE lastSeen < ?").all(stuckCutoff);

            if (stuckSessions.length > 0) {
                // console.log(`[Cron] Found ${stuckSessions.length} stuck sessions. Cleaning up...`);
                const cleanParams = stuckSessions.map(s => s.sessionId);
                const deleteStmt = db.prepare(`DELETE FROM active_sessions WHERE sessionId IN (${cleanParams.map(() => '?').join(',')})`);
                deleteStmt.run(...cleanParams);
            }
        } catch (e) {
            console.error("[Cron] Failed to clean stuck sessions:", e);
        }

        // --- Daily Retention Sweep ---
        // Self-gated to run at most once per local day; cheap no-op otherwise.
        try {
            runRetentionSweepIfDue();
        } catch (e) {
            console.error("[Cron] Retention sweep failed:", e);
        }


        return {
            success: true,
            results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason)
        };

    } catch (error) {
        console.error("Cron sync failed:", error);
        throw error;
    }
}
