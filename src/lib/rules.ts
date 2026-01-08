import { db } from "./db";
import { listInternalServers } from "./servers";
import { terminateSession, PlexSession, PlexServerConfig } from "./plex";
import { sendSessionTerminatedNotification, sendDiscordNotification } from "./discord";

// --- Types ---

export interface RuleInstance {
    id: string;
    type: string;
    name: string;
    enabled: boolean;
    settings: {
        limit: number;
        enforce: boolean;
        kill_all: boolean;
        message: string;
        notify?: boolean;
        exclude_same_ip?: boolean;
        // Scheduled Access settings
        schedule?: {
            type: 'block' | 'allow';  // Block during these hours, or only allow during these hours
            timeWindows: Array<{
                startTime: string;    // "22:00" format (HH:mm)
                endTime: string;      // "07:00" format (HH:mm)
                days: number[];       // 0=Sunday, 1=Monday, ..., 6=Saturday
            }>;
            timezone?: string;        // Optional, defaults to server timezone
            graceMinutes?: number;    // Minutes of warning before enforcement (future feature)
        };
    };
    discordWebhookId: string | null; // Deprecated
    discordWebhookIds?: string[];
    createdAt: string;
    global?: boolean;
    userNames?: string[];
    serverNames?: string[];
}

// --- Migration ---

// Migration logic removed as per user request (no default rules).

// --- CRUD ---

export const getRuleInstances = (): RuleInstance[] => {
    try {
        const rows = db.prepare("SELECT * FROM rule_instances").all() as any[];
        return rows.map(r => {
            // Fetch assigned server names
            const servers = db.prepare(`
                SELECT s.name 
                FROM servers s
                JOIN server_rules sr ON s.id = sr.serverId
                WHERE sr.ruleKey = ?
            `).all(r.id) as { name: string }[];
            const serverNames = servers.map(s => s.name);
            const serverCount = servers.length;

            // Fetch assigned user names (limit 5 for preview)
            const users = db.prepare(`
                SELECT u.username 
                FROM users u
                JOIN user_rules ur ON u.id = ur.userId
                WHERE ur.ruleKey = ?
                LIMIT 5
            `).all(r.id) as { username: string }[];
            const userNames = users.map(u => u.username);

            // Get total user count
            const userCount = (db.prepare("SELECT COUNT(*) as count FROM user_rules WHERE ruleKey = ?").get(r.id) as any).count;

            const isGlobal = userCount === 0 && serverCount === 0;

            let ids = [];
            try {
                if (r.discordWebhookIds) {
                    ids = JSON.parse(r.discordWebhookIds);
                } else if (r.discordWebhookId) {
                    // Fallback for non-migrated runtime read
                    ids = [r.discordWebhookId];
                }
            } catch (e) { }

            return {
                ...r,
                enabled: r.enabled === 1,
                settings: JSON.parse(r.settings),
                discordWebhookIds: ids,
                discordWebhookId: null, // Ensure frontend doesn't rely on legacy field
                global: isGlobal,
                userCount,
                serverCount,
                userNames,
                serverNames
            };
        });
    } catch (error) {
        console.error("Failed to fetch rule instances:", error);
        return [];
    }
};

export const getRuleInstance = (id: string): RuleInstance | undefined => {
    try {
        const row = db.prepare("SELECT * FROM rule_instances WHERE id = ?").get(id) as any;
        if (!row) return undefined;

        const userCount = (db.prepare("SELECT COUNT(*) as count FROM user_rules WHERE ruleKey = ?").get(id) as any).count;
        const serverCount = (db.prepare("SELECT COUNT(*) as count FROM server_rules WHERE ruleKey = ?").get(id) as any).count;
        const isGlobal = userCount === 0 && serverCount === 0;

        let ids = [];
        try {
            if (row.discordWebhookIds) ids = JSON.parse(row.discordWebhookIds);
            else if (row.discordWebhookId) ids = [row.discordWebhookId];
        } catch (e) { }

        return {
            ...row,
            enabled: row.enabled === 1,
            settings: JSON.parse(row.settings),
            discordWebhookIds: ids,
            discordWebhookId: null, // Ensure frontend doesn't rely on legacy field
            global: isGlobal,
            userCount,
            serverCount
        };
    } catch (error) {
        console.error(`Failed to fetch rule instance ${id}:`, error);
        return undefined;
    }
};

export const createRuleInstance = (instance: Omit<RuleInstance, "createdAt">, assignments?: { userIds?: string[], serverIds?: string[] }) => {
    const createdAt = new Date().toISOString();
    try {
        db.transaction(() => {
            // We write to both for compatibility if needed, but prefer new column
            // Actually, let's just write to new column. 
            // Old column can be null.
            const webhookIds = JSON.stringify(instance.discordWebhookIds || []);

            db.prepare(`
                INSERT INTO rule_instances (id, type, name, enabled, settings, discordWebhookIds, createdAt)
                VALUES (@id, @type, @name, @enabled, @settings, @discordWebhookIds, @createdAt)
            `).run({
                ...instance,
                enabled: instance.enabled ? 1 : 0,
                settings: JSON.stringify(instance.settings),
                discordWebhookIds: webhookIds,
                createdAt
            });

            if (assignments?.userIds) {
                const stmt = db.prepare("INSERT INTO user_rules (userId, ruleKey) VALUES (?, ?)");
                for (const userId of assignments.userIds) {
                    stmt.run(userId, instance.id);
                }
            }

            if (assignments?.serverIds) {
                const stmt = db.prepare("INSERT INTO server_rules (serverId, ruleKey) VALUES (?, ?)");
                for (const serverId of assignments.serverIds) {
                    stmt.run(serverId, instance.id);
                }
            }
        })();
    } catch (error) {
        console.error("Failed to create rule instance:", error);
        throw error;
    }
};

export const updateRuleInstance = (instance: RuleInstance) => {
    try {
        const webhookIds = JSON.stringify(instance.discordWebhookIds || []);
        db.prepare(`
            UPDATE rule_instances 
            SET name = @name, enabled = @enabled, settings = @settings, discordWebhookIds = @discordWebhookIds
            WHERE id = @id
        `).run({
            ...instance,
            enabled: instance.enabled ? 1 : 0,
            settings: JSON.stringify(instance.settings),
            discordWebhookIds: webhookIds
        });
    } catch (error) {
        console.error("Failed to update rule instance:", error);
        throw error;
    }
};

export const deleteRuleInstance = (id: string) => {
    try {
        db.transaction(() => {
            db.prepare("DELETE FROM rule_instances WHERE id = ?").run(id);
            db.prepare("DELETE FROM user_rules WHERE ruleKey = ?").run(id);
            db.prepare("DELETE FROM server_rules WHERE ruleKey = ?").run(id);
        })();
    } catch (error) {
        console.error("Failed to delete rule instance:", error);
        throw error;
    }
};

// --- Assignments ---

export const getRuleUsers = (ruleId: string): { userId: string; username: string; email: string; serverNames: string; enabled: boolean }[] => {
    try {
        const users = db.prepare(`
            SELECT u.id, u.username, u.email, GROUP_CONCAT(s.name, ', ') as serverNames
            FROM users u
            LEFT JOIN servers s ON u.serverId = s.id
            GROUP BY u.id, u.username, u.email
        `).all() as { id: string, username: string, email: string, serverNames: string }[];

        const assignedUserIds = new Set(
            (db.prepare("SELECT userId FROM user_rules WHERE ruleKey = ?").all(ruleId) as { userId: string }[]).map(r => r.userId)
        );

        return users.map(u => ({
            userId: u.id,
            username: u.username,
            email: u.email,
            serverNames: u.serverNames || '',
            enabled: assignedUserIds.has(u.id)
        }));
    } catch (error) {
        console.error(`Failed to fetch users for rule ${ruleId}:`, error);
        return [];
    }
};

export const toggleUserRule = (userId: string, ruleId: string, enabled: boolean): void => {
    try {
        if (enabled) {
            db.prepare("INSERT OR IGNORE INTO user_rules (userId, ruleKey) VALUES (?, ?)").run(userId, ruleId);
        } else {
            db.prepare("DELETE FROM user_rules WHERE userId = ? AND ruleKey = ?").run(userId, ruleId);
        }
    } catch (error) {
        console.error(`Failed to toggle rule ${ruleId} for user ${userId}:`, error);
        throw error;
    }
};

export const getRuleServers = (ruleId: string): { serverId: string; name: string; enabled: boolean }[] => {
    try {
        const servers = db.prepare("SELECT id, name FROM servers").all() as { id: string, name: string }[];
        const assignedServerIds = new Set(
            (db.prepare("SELECT serverId FROM server_rules WHERE ruleKey = ?").all(ruleId) as { serverId: string }[]).map(r => r.serverId)
        );

        return servers.map(s => ({
            serverId: s.id,
            name: s.name,
            enabled: assignedServerIds.has(s.id)
        }));
    } catch (error) {
        console.error(`Failed to fetch servers for rule ${ruleId}:`, error);
        return [];
    }
};

export const toggleServerRule = (serverId: string, ruleId: string, enabled: boolean): void => {
    try {
        if (enabled) {
            db.prepare("INSERT OR IGNORE INTO server_rules (serverId, ruleKey) VALUES (?, ?)").run(serverId, ruleId);
        } else {
            db.prepare("DELETE FROM server_rules WHERE serverId = ? AND ruleKey = ?").run(serverId, ruleId);
        }
    } catch (error) {
        console.error(`Failed to toggle rule ${ruleId} for server ${serverId}:`, error);
        throw error;
    }
};

// --- Logging & Enforcement ---

export const logRuleEvent = (userId: string, ruleInstanceId: string, details: string) => {
    try {
        db.prepare("INSERT INTO rule_events (userId, ruleKey, triggeredAt, details) VALUES (?, ?, ?, ?)").run(
            userId,
            ruleInstanceId,
            new Date().toISOString(),
            details
        );
    } catch (error) {
        console.error("Failed to log rule event:", error);
    }
};


export const closeRuleEvent = (id: number) => {
    try {
        db.prepare("UPDATE rule_events SET endedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
    } catch (error) {
        console.error(`Failed to close rule event ${id}:`, error);
    }
};

export const deleteRuleEvent = (id: number) => {
    try {
        db.prepare("DELETE FROM rule_events WHERE id = ?").run(id);
    } catch (error) {
        console.error(`Failed to delete rule event ${id}:`, error);
    }
};

export const updateRuleEventDetails = (id: number, details: string) => {
    try {
        db.prepare("UPDATE rule_events SET details = ? WHERE id = ?").run(details, id);
    } catch (error) {
        console.error(`Failed to update rule event details ${id}:`, error);
    }
};

// --- Schedule Helper Functions ---

/**
 * Check if current time falls within a time window
 * Handles overnight windows (e.g., 22:00 - 07:00)
 */
function isTimeInWindow(current: string, start: string, end: string): boolean {
    // Handle overnight windows (end < start means it crosses midnight)
    if (end < start) {
        return current >= start || current < end;
    }
    return current >= start && current < end;
}

/**
 * Check if user should be blocked based on schedule settings
 */
function isUserBlockedBySchedule(
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


export const checkAndLogViolations = async (sessions: any[]) => {

    try {
        const instances = getRuleInstances();
        // Load servers once if needed
        let serverConfigMap: Map<string, PlexServerConfig> = new Map();

        // Cache server configs if enforcement is needed anywhere
        if (instances.some(i => i.enabled && i.settings.enforce)) {
            try {
                const internalServers = await listInternalServers();
                internalServers.forEach((s: any) => {
                    serverConfigMap.set(s.id, {
                        id: s.id,
                        name: s.name,
                        baseUrl: s.baseUrl,
                        token: s.token
                    });
                });
            } catch (e) {
                console.error("Failed to list internal servers for enforcement:", e);
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
                    const openEvents = db.prepare(`SELECT * FROM rule_events WHERE userId = ? AND ruleKey = ? AND endedAt IS NULL`).all(user.userId, instance.id) as any[];

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
                            const activeSession = db.prepare("SELECT pausedSince FROM active_sessions WHERE sessionId = ?").get(ratingKey) as any;

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
                            console.error("Error parsing rule event details", e);
                            deleteRuleEvent(event.id);
                        }
                    }
                }
                // ---------------------------------------------

                const hasDirectRule = user.enabled;
                const hasServerRule = userSessions.some(s => serverRuleMap.has(s.serverId));

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

                                console.log(`[Enforcement] Rule "${instance.name}" terminating paused session ${session.id} for ${user.username}`);

                                const serverConfig = serverConfigMap.get(session.serverId);
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
                                                    const webhook = db.prepare("SELECT url FROM discord_webhooks WHERE id = ?").get(wid) as any;
                                                    if (webhook) {
                                                        await sendSessionTerminatedNotification(session as PlexSession, `Rule "${instance.name}": ${terminationReason}`, webhook.url);
                                                    }
                                                }
                                            }
                                        } catch (err) {
                                            console.error(`[Enforcement] Failed to terminate session ${actualSessionId}`, err);
                                        }
                                    } else {
                                        console.error(`[Enforcement] Cannot terminate session ${session.id}: No valid sessionId or sessionKey found.`);
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

                            console.log(`[Scheduled Access] Rule "${instance.name}" blocking ${user.username} (${userSessions.length} sessions)`);

                            // Terminate all active sessions for this user
                            let anyTerminated = false;
                            for (const session of userSessions) {
                                const serverId = session.serverId;
                                const sessionId = session.sessionId || session.sessionKey;
                                const serverConfig = serverConfigMap.get(serverId);

                                if (serverConfig && sessionId) {
                                    try {
                                        await terminateSession(sessionId, serverConfig, terminationReason);
                                        anyTerminated = true;

                                        const webhookIds = instance.discordWebhookIds || [];
                                        if (webhookIds.length === 0 && instance.discordWebhookId) webhookIds.push(instance.discordWebhookId);

                                        if (webhookIds.length > 0) {
                                            for (const wid of webhookIds) {
                                                const webhook = db.prepare("SELECT url FROM discord_webhooks WHERE id = ?").get(wid) as any;
                                                if (webhook) {
                                                    await sendSessionTerminatedNotification(session as PlexSession, `Rule "${instance.name}": ${terminationReason}`, webhook.url);
                                                }
                                            }
                                        }
                                    } catch (err) {
                                        console.error(`[Scheduled Access] Failed to terminate session ${sessionId}`, err);
                                    }
                                }
                            }

                            if (anyTerminated && openEvent) {
                                try {
                                    const d = JSON.parse(openEvent.details || "{}");
                                    d.enforced = true;
                                    updateRuleEventDetails(openEvent.id, JSON.stringify(d));
                                } catch (e) {
                                    console.error("Failed to update scheduled access event details", e);
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
                                userSessions.sort((a: any, b: any) => {
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
                                const serverConfig = serverConfigMap.get(serverId);

                                if (serverConfig && sessionId) {
                                    console.log(`[Enforcement] Rule "${instance.name}" terminating ${sessionId} for ${user.username}`);
                                    try {
                                        await terminateSession(sessionId, serverConfig, terminationReason);
                                        anyTerminated = true;

                                        const webhookIds = instance.discordWebhookIds || [];
                                        if (webhookIds.length === 0 && instance.discordWebhookId) webhookIds.push(instance.discordWebhookId);

                                        if (webhookIds.length > 0) {
                                            for (const wid of webhookIds) {
                                                const webhook = db.prepare("SELECT url FROM discord_webhooks WHERE id = ?").get(wid) as any;
                                                if (webhook) {
                                                    await sendSessionTerminatedNotification(s as PlexSession, `Rule "${instance.name}": ${terminationReason}`, webhook.url);
                                                }
                                            }
                                        }
                                    } catch (err) {
                                        console.error(`[Enforcement] Failed to terminate session ${sessionId}`, err);
                                    }
                                }
                            }

                            if (anyTerminated && openEvent) {
                                try {
                                    const d = JSON.parse(openEvent.details || "{}");
                                    d.enforced = true;
                                    updateRuleEventDetails(openEvent.id, JSON.stringify(d));
                                } catch (e) {
                                    console.error("Failed to update max concurrent event details", e);
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
        console.error("Error checking rule violations:", e);
    }
};

export const getUserRuleHistory = (userId: string) => {
    try {
        const events = db.prepare(`
        SELECT re.*, ri.name as ruleName, ri.type as ruleType
        FROM rule_events re
        LEFT JOIN rule_instances ri ON re.ruleKey = ri.id
        WHERE re.userId = ?
        ORDER BY re.triggeredAt DESC
    `).all(userId) as any[];

        return events.map(e => {
            let details = {};
            try {
                details = JSON.parse(e.details);
            } catch (err) { }
            return {
                ...e,
                details
            };
        });
    } catch (error) {
        console.error(`Failed to get rule history for user ${userId}:`, error);
        return [];
    }
};

export const getGlobalRules = () => {
    // For now assuming all instances are potential global rules 
    // or we only care about max_concurrent_streams as 'key' for the UI?
    // The route uses rule.key. In instances, that matches 'id'.
    // But older logic used 'max_concurrent_streams' as a key.
    // The route expects an array of objects with a 'key' property.
    // Let's return RuleInstances mapped to have a key.
    // Wait, are there "other" global rules? 
    // The migration above converts legacy global rules to instances.
    const instances = getRuleInstances();
    return instances.map(i => ({
        ...i,
        key: i.id
    }));
};

export const getUserRules = (userId: string) => {
    try {
        const rules = db.prepare(`
        SELECT ri.*
        FROM rule_instances ri
        JOIN user_rules ur ON ri.id = ur.ruleKey
        WHERE ur.userId = ?
    `).all(userId) as any[];

        return rules.map(r => {
            let settings = {};
            try { settings = JSON.parse(r.settings); } catch (e) { }
            return {
                ...r,
                key: r.id,
                settings,
                enabled: r.enabled === 1
            };
        });
    } catch (error) {
        console.error(`Failed to get user rules for ${userId}:`, error);
        return [];
    }
};
