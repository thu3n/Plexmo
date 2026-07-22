/**
 * In-memory fixed-window attempt limiter for the public invite endpoints.
 * There is no rate-limiting infrastructure in the app; Plexmo runs as a
 * single Node process, so a module-level map is an honest fit. Bounded so a
 * spray of spoofed keys cannot grow memory unbounded.
 */

const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_TRACKED_KEYS = 1000;

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export const allowInviteAttempt = (key: string, now = Date.now()): boolean => {
    const current = windows.get(key);
    if (!current || current.resetAt <= now) {
        if (windows.size >= MAX_TRACKED_KEYS && !windows.has(key)) {
            // Drop expired windows first; if the map is still full, fail open —
            // an attacker filling the table must not lock out legit invitees.
            for (const [k, w] of windows) {
                if (w.resetAt <= now) windows.delete(k);
            }
            if (windows.size >= MAX_TRACKED_KEYS) return true;
        }
        windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return true;
    }
    current.count += 1;
    return current.count <= MAX_ATTEMPTS;
};

/** Test hook. */
export const resetInviteThrottle = (): void => {
    windows.clear();
};

/** Best-available client key: first XFF hop, else a shared bucket. */
export const throttleKeyFromRequest = (request: Request): string =>
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
