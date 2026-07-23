
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Resolve the JWT signing secret BEFORE any request is served —
        // env override, else persisted in the config volume so sessions
        // survive restarts and image upgrades.
        const { ensureJwtSecret } = await import('@/lib/jwt-secret');
        ensureJwtSecret();

        // Only run on the server side
        const { runCronJob } = await import('@/lib/cron');

        // Prevent multiple intervals in dev mode with global variable
        const globalAny: any = global;
        if (!globalAny.__plexmo_cron_interval) {
            // 1. Initial Sync
            runCronJob().catch(console.error);

            // Set up interval for subsequent syncs (every 60 seconds)
            globalAny.__plexmo_cron_interval = setInterval(() => {
                runCronJob().catch(console.error);
            }, 60000);

            // 2. Start WebSocket Listener (Real-time)
            const { startPlexListener } = await import('@/lib/plex-listener');
            startPlexListener().catch(e => console.error("Failed to start listener:", e));

            // 3. Backfill server natural keys (machineIdentifier/owner) — the
            // schema migration is synchronous and cannot do network I/O.
            const { backfillServerIdentities } = await import('@/lib/server-identity-backfill');
            backfillServerIdentities().catch(e => console.error("Server identity backfill failed:", e));

            // 4. Library inventory sync — cheap enough to run at startup, then
            // every 6 hours (library churn is slow compared to sessions).
            // Tracked runs record jobs-table rows (Settings → Jobs).
            const LIBRARY_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
            const { syncAllLibraries } = await import('@/lib/library/library-sync');
            const { startTrackedLibrarySync } = await import('@/lib/library/sync-job');
            startTrackedLibrarySync("all libraries", syncAllLibraries);
            globalAny.__plexmo_library_interval = setInterval(() => {
                startTrackedLibrarySync("all libraries", syncAllLibraries);
            }, LIBRARY_SYNC_INTERVAL_MS);
        }
    }
}
