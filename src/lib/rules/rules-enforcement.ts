import { db } from "../db";
import { listInternalServers } from "../servers";
import { terminateSession, PlexSession, PlexServerConfig } from "../plex";
import { sendSessionTerminatedNotification } from "../discord";
import { Logger } from "../logger";
import { getRuleInstances } from "./rules-crud";
import {
    getRuleUsers,
    getRuleServers,
    logRuleEvent,
    closeRuleEvent,
    deleteRuleEvent,
    updateRuleEventDetails,
} from "./rules-assignments";
import { isUserBlockedBySchedule } from "./rules-schedule";


export const checkAndLogViolations = async (sessions: PlexSession[]) => {

    try {
        const instances = getRuleInstances();
        // Load servers once if needed
        const serverConfigMap: Map<string, PlexServerConfig> = new Map();


        // Cache server configs if enforcement is needed anywhere
        if (instances.some(i => i.enabled && i.settings.enforce)) {
            try {
                const internalServers = await listInternalServers();
                internalServers.forEach((s) => {
                    if (s.id) {
                        serverConfigMap.set(s.id, {
                            id: s.id,
                            name: s.name,
                            baseUrl: s.baseUrl,
                            token: s.token
                        });
                    }
                });
            } catch (e) {
                Logger.error("Failed to list internal servers for enforcement:", e);
            }
        }

        for (const instance of instances) {
            if (!instance.enabled) continue;

            const { limit, enforce, kill_all, message, exclude_same_ip } = instance.settings;

            // Get Scope
            const ruleUsers = getRuleUsers(instance.id);
            const ruleServers = getRuleServers(instance.id);
            const serverRuleMap = new Set(ruleServers.filter(s => s.enabled).map(s => s.serverId));

            const isGlobal = instance.global;

            if (ruleUsers.length === 0 && !isGlobal) continue;

            for (const user of ruleUsers) {
                const userSessions = sessions.filter(s => s.user === user.username);

                // --- Cleanup Logic for Kill Paused Streams ---
                // We run this before the 'continue' check to ensure that if a user stops streaming (userSessions=[]),
                // we still clean up their stale 'ONGOING' events.
                if (instance.type === "kill_paused_streams") {
                    const openEvents = db.prepare(`SELECT * FROM rule_events WHERE userId = ? AND ruleKey = ? AND endedAt IS NULL`).all(user.userId, instance.id) as { id: number; details: string }[];

                    for (const event of openEvents) {
                        try {
                            const d = JSON.parse(event.details);
                            const ratingKey = d.sessionId; // We stored session.id (RatingKey) here
                            const isEnforced = d.enforced === true;

                            if (!ratingKey) {
                                // Invalid log, delete it
                                deleteRuleEvent(event.id);
                                continue;
                            }

                            // 1. Check if session time limit was reached (Enforced)
                            if (isEnforced) {
                                // Check if session still exists
                                const currentSession = userSessions.find(s => s.id === ratingKey);
                                if (!currentSession) {
                                    // Session gone -> Close event (History)
                                    closeRuleEvent(event.id);
                                }
                                continue;
                            }

                            // 2. Not Enforced Check
                            // Check if session still exists
                            const currentSession = userSessions.find(s => s.id === ratingKey);

                            if (!currentSession) {
                                // Session gone but not enforced -> Invalid violation (Paused briefly then stopped)
                                // DELETE event (Don't keep history)
                                deleteRuleEvent(event.id);
                                continue;
                            }

                            // Check if session is still valid (still paused)
                            // We look up active_session using ratingKey because active_sessions PK is currently sessionId=RatingKey
                            const activeSession = db.prepare("SELECT pausedSince FROM active_sessions WHERE sessionId = ?").get(ratingKey) as { pausedSince: number } | undefined;

                            // If not paused in DB...
                            if (!activeSession?.pausedSince) {
                                // ...BUT if the session is currently paused in the LIVE API response,
                                // it means the DB sync might be lagging or failed to update.
                                // In this case, we TRUST the live session and DO NOT delete the event.
                                if (currentSession.state === 'paused') {
                                    // Keep event open, wait for next sync to fix DB
                                    continue;
                                }

                                // If DB says not paused AND live session is not paused (or activeSession missing), it's a Resume.
                                // DELETE event
                                deleteRuleEvent(event.id);
                                continue;
                            }
                        } catch (e) {
                            // On error parsing details, delete the event to be safe
                            Logger.error("Error parsing rule event details", e);
                            deleteRuleEvent(event.id);
                        }
                    }
                }
                // ---------------------------------------------

                const hasDirectRule = user.enabled;
                const hasServerRule = userSessions.some(s => s.serverId && serverRuleMap.has(s.serverId));

                if (!isGlobal && !hasDirectRule && !hasServerRule) continue;

                if (instance.type === "kill_paused_streams") {
                    for (const session of userSessions) {
                        const activeSession = db.prepare("SELECT pausedSince FROM active_sessions WHERE sessionId = ?").get(session.id) as { pausedSince: number } | undefined;

                        if (activeSession?.pausedSince) {
                            const pausedDurationMinutes = (Date.now() - activeSession.pausedSince) / 1000 / 60;
                            const isEnforceable = pausedDurationMinutes >= limit;

                            // Create violation details
                            // Note: enforced starts as false, only becomes true if we terminate
                            const violationDetailsObj = {
                                sessionId: session.id,
                                pausedDuration: Math.round(pausedDurationMinutes),
                                limit,
                                sessionTitle: session.title,
                                source: isGlobal ? 'global_rule' : (hasServerRule ? 'server_rule' : 'user_rule'),
                                instanceName: instance.name,
                                enforced: false
                            };

                            let openEvent = db.prepare(`
                                SELECT id, details FROM rule_events
                                WHERE userId = ? AND ruleKey = ? AND endedAt IS NULL AND details LIKE ?
                            `).get(user.userId, instance.id, `%${session.id}%`) as { id: number, details: string } | undefined;

                            if (!openEvent) {
                                logRuleEvent(user.userId, instance.id, JSON.stringify(violationDetailsObj));
                                // Fetch it back to have the ID if we need to update it immediately
                                openEvent = db.prepare(`
                                        SELECT id, details FROM rule_events
                                    WHERE userId = ? AND ruleKey = ? AND endedAt IS NULL AND details LIKE ?
                                `).get(user.userId, instance.id, `%${session.id}%`) as { id: number, details: string } | undefined;
                            } else {
                                // If event exists, check if ALREADY ENFORCED
                                try {
                                    const d = JSON.parse(openEvent.details);
                                    if (d.enforced) {
                                        // Already enforced, waiting for session to die.
                                        // DO NOT re-terminate.
                                        continue;
                                    }
                                } catch (e) { }
                            }

                            if (enforce && isEnforceable) {
                                // Variable substitution for custom messages
                                const substituteVariables = (template: string, minutes: number): string => {
                                    const result = template.replace(/\$time/g, `${minutes} minuter`);
                                    return result;
                                };

                                const terminationReason = message
                                    ? substituteVariables(message, limit)
                                    : `Stream paused for >${limit} minutes.`;

                                Logger.info(`[Enforcement] Rule "${instance.name}" terminating paused session ${session.id} for ${user.username}`);

                                const serverConfig = session.serverId ? serverConfigMap.get(session.serverId) : undefined;
                                if (serverConfig) {
                                    // FIX: Use the actual Plex session ID/Key, not the internal ratingKey (session.id)
                                    const actualSessionId = session.sessionId || session.sessionKey;


                                    if (actualSessionId) {
                                        try {
                                            await terminateSession(actualSessionId, serverConfig, terminationReason);

                                            // Mark event as enforced but DO NOT close it yet.
                                            // We keep it open so the next loop sees it as "already enforced" and skips interaction.
                                            // The cleanup loop (at the top) will close it once the session actually disappears.
                                            if (openEvent) {
                                                violationDetailsObj.enforced = true;
                                                updateRuleEventDetails(openEvent.id, JSON.stringify(violationDetailsObj));
                                                // closeRuleEvent(openEvent.id); // REMOVED: Let cleanup close it
                                            } else {
                                                // Should not happen as we create it above
                                            }

                                            const webhookIds = instance.discordWebhookIds || [];
                                            if (webhookIds.length === 0 && instance.discordWebhookId) webhookIds.push(instance.discordWebhookId);

                                            if (webhookIds.length > 0) {
                                                for (const wid of webhookIds) {
                                                    const webhook = db.prepare("SELECT url FROM discord_webhooks WHERE id = ?").get(wid) as { url: string } | undefined;
                                                    if (webhook) {
                                                        await sendSessionTerminatedNotification(session as PlexSession, `Rule "${instance.name}": ${terminationReason}`, webhook.url);
                                                    }
                                                }
                                            }
                                        } catch (err) {
                                            Logger.error(`[Enforcement] Failed to terminate session ${actualSessionId}`, err);
                                        }
                                    } else {
                                        Logger.error(`[Enforcement] Cannot terminate session ${session.id}: No valid sessionId or sessionKey found.`);
                                    }
                                }
                            }
                        }
                    }
                    continue;
                }

                // --- Scheduled Access Rule ---
                if (instance.type === "scheduled_access") {
                    const schedule = instance.settings.schedule;

                    // Skip if schedule not configured
                    if (!schedule || !schedule.timeWindows || schedule.timeWindows.length === 0) {
                        continue;
                    }

                    const now = new Date();
                    const isBlocked = isUserBlockedBySchedule(now, schedule);

                    if (isBlocked && userSessions.length > 0) {
                        let openEvent = db.prepare(`
                            SELECT id, details FROM rule_events
                            WHERE userId = ? AND ruleKey = ? AND endedAt IS NULL
                        `).get(user.userId, instance.id) as { id: number, details: string } | undefined;

                        if (!openEvent) {
                            logRuleEvent(user.userId, instance.id, JSON.stringify({
                                blockedTime: now.toISOString(),
                                reason: 'scheduled_access_block',
                                scheduleType: schedule.type,
                                source: isGlobal ? 'global_rule' : (hasServerRule ? 'server_rule' : 'user_rule'),
                                instanceName: instance.name,
                                activeSessions: userSessions.length,
                                enforced: false
                            }));
                            openEvent = db.prepare(`
                                SELECT id, details FROM rule_events
                                WHERE userId = ? AND ruleKey = ? AND endedAt IS NULL
                            `).get(user.userId, instance.id) as { id: number, details: string } | undefined;
                        } else {
                            // Check if already enforced
                            try {
                                const d = JSON.parse(openEvent.details);
                                if (d.enforced === true) continue;
                            } catch (e) { }
                        }

                        if (enforce) {
                            const terminationReason = message ||
                                (schedule.type === 'block'
                                    ? `Access blocked during scheduled hours. Try again later.`
                                    : `Access only allowed during scheduled hours.`);

                            Logger.info(`[Scheduled Access] Rule "${instance.name}" blocking ${user.username} (${userSessions.length} sessions)`);

                            // Terminate all active sessions for this user
                            let anyTerminated = false;
                            for (const session of userSessions) {
                                const serverId = session.serverId;
                                const sessionId = session.sessionId || session.sessionKey;
                                const serverConfig = serverId ? serverConfigMap.get(serverId) : undefined;

                                if (serverConfig && sessionId) {
                                    try {
                                        await terminateSession(sessionId, serverConfig, terminationReason);
                                        anyTerminated = true;

                                        const webhookIds = instance.discordWebhookIds || [];
                                        if (webhookIds.length === 0 && instance.discordWebhookId) webhookIds.push(instance.discordWebhookId);

                                        if (webhookIds.length > 0) {
                                            for (const wid of webhookIds) {
                                                const webhook = db.prepare("SELECT url FROM discord_webhooks WHERE id = ?").get(wid) as { url: string } | undefined;
                                                if (webhook) {
                                                    await sendSessionTerminatedNotification(session as PlexSession, `Rule "${instance.name}": ${terminationReason}`, webhook.url);
                                                }
                                            }
                                        }
                                    } catch (err) {
                                        Logger.error(`[Scheduled Access] Failed to terminate session ${sessionId}`, err);
                                    }
                                }
                            }

                            if (anyTerminated && openEvent) {
                                try {
                                    const d = JSON.parse(openEvent.details || "{}");
                                    d.enforced = true;
                                    updateRuleEventDetails(openEvent.id, JSON.stringify(d));
                                } catch (e) {
                                    Logger.error("Failed to update scheduled access event details", e);
                                }
                            }
                        }
                    } else if (!isBlocked) {
                        // Close any open events if user is no longer blocked
                        const openEvent = db.prepare(`
                            SELECT id FROM rule_events
                            WHERE userId = ? AND ruleKey = ? AND endedAt IS NULL
                        `).get(user.userId, instance.id) as { id: number } | undefined;

                        if (openEvent) {
                            closeRuleEvent(openEvent.id);
                        }
                    }

                    continue;
                }

                if (instance.type === "max_concurrent_streams") {

                    const count = userSessions.length;
                    const isViolating = count > limit;

                    let openEvent = db.prepare(`
                        SELECT id, details FROM rule_events
                        WHERE userId = ? AND ruleKey = ? AND endedAt IS NULL
                    `).get(user.userId, instance.id) as { id: number, details: string } | undefined;

                    let isExcluded = false;
                    if (isViolating && exclude_same_ip) {
                        const normalizeIp = (ip: string) => {
                            if (ip === '::1') return '127.0.0.1';
                            if (ip && ip.startsWith('::ffff:')) return ip.replace('::ffff:', '');
                            return ip;
                        };

                        const uniqueIps = new Set(
                            userSessions
                                .map(s => s.ip)
                                .filter(Boolean)
                                .map(ip => normalizeIp(ip as string))
                        );

                        if (uniqueIps.size <= limit) {
                            isExcluded = true;
                        }
                    }

                    const effectiveViolation = isViolating && !isExcluded;

                    if (effectiveViolation) {
                        if (!openEvent) {
                            logRuleEvent(user.userId, instance.id, JSON.stringify({
                                count,
                                limit,
                                activeSessions: count,
                                source: isGlobal ? 'global_rule' : (hasServerRule ? 'server_rule' : 'user_rule'),
                                instanceName: instance.name,
                                details: "",
                                enforced: false
                            }));
                            openEvent = db.prepare(`
                                SELECT id, details FROM rule_events
                                WHERE userId = ? AND ruleKey = ? AND endedAt IS NULL
                            `).get(user.userId, instance.id) as { id: number, details: string } | undefined;
                        } else {
                            // Check if already enforced
                            try {
                                const d = JSON.parse(openEvent.details);
                                if (d.enforced === true) continue;
                            } catch (e) { }
                        }

                        if (enforce) {
                            const terminationReason = message || "Stream Limit Exceeded";

                            let sessionsToKill = [];
                            if (kill_all) {
                                sessionsToKill = [...userSessions];
                            } else {
                                userSessions.sort((a, b) => {
                                    const keyA = parseInt(a.sessionKey || "0", 10);
                                    const keyB = parseInt(b.sessionKey || "0", 10);
                                    return keyA - keyB;
                                });

                                const killCount = count - limit;
                                sessionsToKill = userSessions.slice(-killCount);
                            }

                            let anyTerminated = false;
                            for (const s of sessionsToKill) {
                                const serverId = s.serverId;
                                const sessionId = s.sessionId || s.sessionKey;
                                const serverConfig = serverId ? serverConfigMap.get(serverId) : undefined;

                                if (serverConfig && sessionId) {
                                    console.log(`[Enforcement] Rule "${instance.name}" terminating ${sessionId} for ${user.username}`);
                                    try {
                                        await terminateSession(sessionId, serverConfig, terminationReason);
                                        anyTerminated = true;

                                        const webhookIds = instance.discordWebhookIds || [];
                                        if (webhookIds.length === 0 && instance.discordWebhookId) webhookIds.push(instance.discordWebhookId);

                                        if (webhookIds.length > 0) {
                                            for (const wid of webhookIds) {
                                                const webhook = db.prepare("SELECT url FROM discord_webhooks WHERE id = ?").get(wid) as { url: string } | undefined;
                                                if (webhook) {
                                                    await sendSessionTerminatedNotification(s as PlexSession, `Rule "${instance.name}": ${terminationReason}`, webhook.url);
                                                }
                                            }
                                        }
                                    } catch (err) {
                                        Logger.error(`[Enforcement] Failed to terminate session ${sessionId}`, err);
                                    }
                                }
                            }

                            if (anyTerminated && openEvent) {
                                try {
                                    const d = JSON.parse(openEvent.details || "{}");
                                    d.enforced = true;
                                    updateRuleEventDetails(openEvent.id, JSON.stringify(d));
                                } catch (e) {
                                    Logger.error("Failed to update max concurrent event details", e);
                                }
                            }
                        }
                    } else {
                        if (openEvent) {
                            closeRuleEvent(openEvent.id);
                        }
                    }
                }
            }


        }
    } catch (e) {
        Logger.error("Error checking rule violations:", e);
    }
};
