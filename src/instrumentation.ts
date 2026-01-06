
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
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
        }
    }
}
