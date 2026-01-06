import { getDashboardSnapshot } from "@/lib/plex";
import { syncHistory } from "@/lib/history";
import { db } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/settings";
import { sendSessionStartNotification, sendSessionStopNotification } from "./discord";
// import parser from "cron-parser"; // Removed for dynamic import

export async function runCronJob() {
    try {
        // Get all servers
        const servers = db.prepare("SELECT * FROM servers").all() as any[];

        // Dynamic Import for Cron Parser to avoid Turbopack/Next.js bundling issues
        const cronParserModule = await import("cron-parser");

        // Deep resolution: check module, module.default, and module.default.default
        // Deep resolution: check module, module.default, and module.default.default
        const mod = cronParserModule as any;
        let parseExpression =
            mod.parseExpression ||
            mod.default?.parseExpression ||
            mod.default?.default?.parseExpression;

        // Fallback for cron-parser v5+ which uses CronExpressionParser.parse
        if (!parseExpression) {
            const Parser = mod.CronExpressionParser || mod.default?.CronExpressionParser;
            if (Parser && typeof Parser.parse === 'function') {
                parseExpression = Parser.parse.bind(Parser);
            }
        }

        if (!parseExpression) {
            console.error("[Cron] CRITICAL: Could not resolve parseExpression. Please check cron-parser version compatibility.", {
                keys: Object.keys(mod),
                hasDefault: !!mod.default
            });
        }

        if (!servers.length) {
            // Proceed anyway for scheduled jobs checking? 
            // If no servers, sync will fail gracefully inside sync function.
        }

        const results = await Promise.allSettled(
            servers.map(async (server) => {
                try {
                    const snapshot = await getDashboardSnapshot(server);
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
                const lastSnapshot = db.prepare("SELECT count, sessions FROM concurrent_snapshots ORDER BY timestamp DESC LIMIT 1").get() as any;

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
            const stuckSessions = db.prepare("SELECT * FROM active_sessions WHERE lastSeen < ?").all(stuckCutoff) as any[];

            if (stuckSessions.length > 0) {
                // console.log(`[Cron] Found ${stuckSessions.length} stuck sessions. Cleaning up...`);
                const cleanParams = stuckSessions.map(s => s.sessionId);
                const deleteStmt = db.prepare(`DELETE FROM active_sessions WHERE sessionId IN (${cleanParams.map(() => '?').join(',')})`);
                deleteStmt.run(...cleanParams);
            }
        } catch (e) {
            console.error("[Cron] Failed to clean stuck sessions:", e);
        }

        // --- Scheduled Jobs ---
        try {
            // Default to TRUE (enabled) if not explicitly set to "false"
            const syncEnabled = getSetting("job_sync_content_enabled") !== "false";
            // Use new key for cron, fallback to default 3 AM Daily
            const syncSchedule = getSetting("job_sync_content_cron") || "0 3 * * *";

            // Resolve parser function robustly
            // const parseExpression = (parser as any).parseExpression || (parser as any).default?.parseExpression; // Moved to top

            if (syncEnabled) {
                if (!parseExpression) throw new Error("Could not resolve cron-parser parseExpression");
                const interval = parseExpression(syncSchedule);
                // Get the last scheduled runtime relative to NOW
                const prevRunDate = interval.prev().toDate();

                const lastRunTimestamp = getSetting("job_sync_content_last_run");
                const lastRunDate = lastRunTimestamp ? new Date(parseInt(lastRunTimestamp)) : new Date(0);

                // If the scheduled time (prev) is Newer than the last actual run time
                // AND it is reasonably recent (e.g. within last 5 minutes) to avoid running immediate catch-up for very old misses if app was off?
                // Actually, if app was off, we usually DO want to catch up once. 
                // But simplified: if (prev > lastRun) -> Run.

                // Safety: To prevent re-running same job if cron resolution is coarse or fast calls:
                // We ensure prevRunDate is strictly greater than lastRunDate
                if (prevRunDate.getTime() > lastRunDate.getTime()) {

                    console.log(`[Cron] Triggering Scheduled Global Content Sync (Schedule: ${syncSchedule}, Last Run: ${lastRunDate.toISOString()}, Target: ${prevRunDate.toISOString()})`);

                    // Update last run to NOW (or to the schedule time? NOW is safer to avoid loops if clock skew)
                    setSetting("job_sync_content_last_run", Date.now().toString());

                    // Start Job
                    const { createJob, getRunningJobForTarget } = await import("@/lib/jobs");
                    const { syncAllLibrariesContent } = await import("@/lib/libraries");

                    if (!getRunningJobForTarget('sync_all_content', 'global')) {
                        const job = createJob('sync_all_content', 'global');
                        syncAllLibrariesContent(job.id).catch(err => {
                            console.error("[Cron] Scheduled global content sync failed:", err);
                        });
                    } else {
                        console.log("[Cron] Job already running.");
                    }
                }
            }
        } catch (e) {
            console.error("[Cron] Failed to process scheduled global sync:", e);
        }

        // --- Scheduled Job: Library List Sync ---
        try {
            // Default to TRUE
            const syncLibsEnabled = getSetting("job_sync_libraries_enabled") !== "false";
            // Default 4 AM Daily
            const syncLibsSchedule = getSetting("job_sync_libraries_cron") || "0 4 * * *";

            if (syncLibsEnabled) {
                if (!parseExpression) throw new Error("Could not resolve cron-parser parseExpression");
                const interval = parseExpression(syncLibsSchedule);
                const prevRunDate = interval.prev().toDate();

                const lastRunTimestamp = getSetting("job_sync_libraries_last_run");
                const lastRunDate = lastRunTimestamp ? new Date(parseInt(lastRunTimestamp)) : new Date(0);

                if (prevRunDate.getTime() > lastRunDate.getTime()) {
                    console.log(`[Cron] Triggering Scheduled Library List Sync (Schedule: ${syncLibsSchedule}, Last Run: ${lastRunDate.toISOString()})`);

                    setSetting("job_sync_libraries_last_run", Date.now().toString());

                    const { createJob, getRunningJobForTarget } = await import("@/lib/jobs");
                    const { syncAllLibraryLists } = await import("@/lib/libraries");

                    if (!getRunningJobForTarget('sync_all_library_lists', 'global')) {
                        const job = createJob('sync_all_library_lists', 'global');
                        syncAllLibraryLists(job.id).catch(err => {
                            console.error("[Cron] Scheduled library list sync failed:", err);
                        });
                    } else {
                        console.log("[Cron] Library list sync already running.");
                    }
                }
            }
        } catch (e) {
            console.error("[Cron] Failed to process scheduled library sync:", e);
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
