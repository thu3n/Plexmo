import type { PlexSession } from "@/lib/plex/plex-types";

/**
 * Derives pause / resume / transcode notifications from successive session
 * snapshots. Everything is edge-triggered against the previous snapshot, so a
 * session that stays paused (or keeps transcoding) across many 60s polls fires
 * exactly once.
 */

/** A second pause within this window of the last notified pause is not announced (nor is its resume). */
export const PAUSE_NOTIFY_COOLDOWN_MS = 5 * 60_000;

const STATE_PLAYING = "playing";
const STATE_PAUSED = "paused";
const DECISION_TRANSCODE = "transcode";

export type SessionEventType = "pause" | "resume" | "transcode";

export interface DetectedSessionEvent {
    type: SessionEventType;
    session: PlexSession;
}

interface TrackedSession {
    /** Last playing/paused state; buffering and other transient states are ignored. */
    state: string;
    transcodeNotified: boolean;
    /** True while an announced pause awaits its resume. */
    pauseAnnounced: boolean;
    lastPauseAnnouncedAt: number | null;
}

const isTranscoding = (session: PlexSession): boolean => session.videoDecision === DECISION_TRANSCODE;

const isStableState = (state: string): boolean => state === STATE_PLAYING || state === STATE_PAUSED;

export class SessionEventTracker {
    private readonly servers = new Map<string, Map<string, TrackedSession>>();

    /**
     * Feed one server's full session list for a poll. `newSessionIds` are the
     * sessions history sync just created; any other unseen session was already
     * running (e.g. Plexmo restarted) and is recorded silently so it does not
     * replay a pause or transcode that already happened.
     */
    observe(
        serverId: string,
        sessions: PlexSession[],
        newSessionIds: ReadonlySet<string>,
        now: number
    ): DetectedSessionEvent[] {
        const previous = this.servers.get(serverId) ?? new Map<string, TrackedSession>();
        const next = new Map<string, TrackedSession>();
        const events: DetectedSessionEvent[] = [];

        for (const session of sessions) {
            const prev = previous.get(session.id);
            const tracked = prev
                ? this.advance(prev, session, now, events)
                : this.seed(session, newSessionIds.has(session.id), events);
            next.set(session.id, tracked);
        }

        // Sessions absent from this poll have ended; dropping them bounds memory.
        this.servers.set(serverId, next);
        return events;
    }

    /** Forget a server entirely (removed/archived). */
    forget(serverId: string): void {
        this.servers.delete(serverId);
    }

    private seed(session: PlexSession, isNew: boolean, events: DetectedSessionEvent[]): TrackedSession {
        const transcoding = isTranscoding(session);
        if (isNew && transcoding) events.push({ type: "transcode", session });
        return {
            state: isStableState(session.state) ? session.state : STATE_PLAYING,
            transcodeNotified: transcoding,
            pauseAnnounced: false,
            lastPauseAnnouncedAt: null,
        };
    }

    private advance(
        prev: TrackedSession,
        session: PlexSession,
        now: number,
        events: DetectedSessionEvent[]
    ): TrackedSession {
        const tracked = { ...prev };

        if (isStableState(session.state) && session.state !== prev.state) {
            if (session.state === STATE_PAUSED) {
                const coolingDown =
                    prev.lastPauseAnnouncedAt !== null && now - prev.lastPauseAnnouncedAt < PAUSE_NOTIFY_COOLDOWN_MS;
                if (!coolingDown) {
                    events.push({ type: "pause", session });
                    tracked.lastPauseAnnouncedAt = now;
                }
                tracked.pauseAnnounced = !coolingDown;
            } else if (prev.pauseAnnounced) {
                // Only resume what we announced, so a suppressed pause never yields an orphan resume.
                events.push({ type: "resume", session });
                tracked.pauseAnnounced = false;
            }
            tracked.state = session.state;
        }

        if (!prev.transcodeNotified && isTranscoding(session)) {
            events.push({ type: "transcode", session });
            tracked.transcodeNotified = true;
        }

        return tracked;
    }
}
