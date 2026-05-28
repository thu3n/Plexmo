import type { RuleInstance } from "@/features/rules/types";

// --- Schedule Helper Functions ---
// Pure time-window logic used by the scheduled_access enforcement path.

/**
 * Check if current time falls within a time window
 * Handles overnight windows (e.g., 22:00 - 07:00)
 */
export function isTimeInWindow(current: string, start: string, end: string): boolean {
    // Handle overnight windows (end < start means it crosses midnight)
    if (end < start) {
        return current >= start || current < end;
    }
    return current >= start && current < end;
}

/**
 * Check if user should be blocked based on schedule settings
 */
export function isUserBlockedBySchedule(
    now: Date,
    schedule: NonNullable<RuleInstance['settings']['schedule']>
): boolean {
    const currentDay = now.getDay(); // 0-6 (Sunday-Saturday)
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    for (const window of schedule.timeWindows) {
        // Check if current day is in the window's allowed days
        if (!window.days.includes(currentDay)) continue;

        const isInWindow = isTimeInWindow(currentTime, window.startTime, window.endTime);

        // If type is 'block' and we're in a blocked window, user is blocked
        if (schedule.type === 'block' && isInWindow) return true;

        // If type is 'allow' and we're in an allowed window, user is NOT blocked
        if (schedule.type === 'allow' && isInWindow) return false;
    }

    // If type is 'allow' and we didn't match any window, user is blocked
    // If type is 'block' and we didn't match any window, user is NOT blocked
    return schedule.type === 'allow';
}
