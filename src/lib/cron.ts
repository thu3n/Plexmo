import { getDashboardSnapshot } from "@/lib/plex";
import { syncHistory, flushStaleSessions } from "@/lib/history";
import { db } from "@/lib/db";
import { runRetentionSweepIfDue } from "@/lib/retention";
import { prewarmStatsCacheIfDue } from "@/lib/stats/stats-prewarm";
import { setServerSnapshot, markServerFailure } from "@/lib/dashboard-cache";
import { sendSessionStartNotification, sendSessionStopNotification } from "./discord";
import type { ServerRow } from "@/lib/db-types";
import type { PlexSession } from "@/lib/plex";
import { recordConcurrent } from "@/lib/stats/concurrent";

/** Sessions with no heartbeat for this long are flushed to history (server offline / listener gap). */
const STALE_SESSION_MS = 2 * 60 * 60 * 1000;

// Single-flight guard: cron ticks, WebSocket kicks and manual triggers all
// funnel through runCronJob. Overlapping runs would race per-server syncs and
// rule enforcement, so concurrent callers coalesce into one trailing rerun.
let cronRunning = false;
let rerunRequested = false;

export async function runCronJob(): Promise<{ success: boolean; results?: unknown[] }> {
    if (cronRunning) {
        rerunRequested = true;
        return { success: true, results: [] };
    }
    cronRunning = true;
    try {
        let result = await runCronJobOnce();
        while (rerunRequested) {
            rerunRequested = false;
            result = await runCronJobOnce();
        }
        return result;
    } finally {
        cronRunning = false;
    }
}

async function runCronJobOnce() {
    try {
        const servers = db.prepare<[], ServerRow>("SELECT * FROM servers WHERE archivedAt IS NULL").all();

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
            .flatMap(r => (r as PromiseFulfilledResult<{ sessions?: PlexSession[] }>).value.sessions || []);

        // Track concurrent streams: per-scope snapshots + persistent peaks.
        try {
            recordConcurrent(combinedSessions);
        } catch (e) {
            console.error("Failed to record concurrent snapshots:", e);
        }

        // Always run rule checks to ensure closed sessions are processed/cleaned up
        // even if no active sessions exist (e.g. to close open rule events)
        const { checkAndLogViolations } = await import("./rules");
        await checkAndLogViolations(combinedSessions);

        // Flush "stuck" sessions (no heartbeat for > STALE_SESSION_MS) into
        // history with stopTime = lastSeen. Their watch time is real — a
        // silent delete would lose it and inflate nothing but confusion.
        try {
            const flushed = flushStaleSessions(Date.now() - STALE_SESSION_MS);
            if (flushed.length > 0) {
                console.log(`[Cron] Flushed ${flushed.length} stale session(s) to history.`);
            }
        } catch (e) {
            console.error("[Cron] Failed to flush stale sessions:", e);
        }

        // --- Daily Retention Sweep ---
        // Self-gated to run at most once per local day; cheap no-op otherwise.
        try {
            runRetentionSweepIfDue();
        } catch (e) {
            console.error("[Cron] Retention sweep failed:", e);
        }

        // --- Stats Cache Prewarm ---
        // Self-gated (5 min); keeps the default statistics view permanently warm.
        try {
            await prewarmStatsCacheIfDue();
        } catch (e) {
            console.error("[Cron] Stats prewarm failed:", e);
        }

        // --- Media canonicalization backfill ---
        // Chunked and resumable: links GUID-carrying history rows (imports,
        // migrated data) to canonical media_items. No-op once caught up.
        try {
            const { runMediaBackfillBatch } = await import("./media/backfill-job");
            runMediaBackfillBatch();
        } catch (e) {
            console.error("[Cron] Media backfill failed:", e);
        }

        // --- Legacy duplicate-show merge ---
        // Episode-guid-keyed show items (pre-v2 import bug) fragment series
        // stats and break posters. Provable merges only; 24h resweep gate.
        try {
            const { runShowDedup } = await import("./media/dedup-shows");
            runShowDedup();
        } catch (e) {
            console.error("[Cron] Show dedup failed:", e);
        }

        // --- Episode title/show-link repair ---
        // Heals canonical episodes frozen with generic titles ("Episode #3.1")
        // or missing show links using the linked history rows' meta snapshots.
        // Resumable; sleeps 24h after each full sweep.
        try {
            const { runEpisodeRepairBatch } = await import("./media/repair-episode-titles");
            runEpisodeRepairBatch();
        } catch (e) {
            console.error("[Cron] Episode repair failed:", e);
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
