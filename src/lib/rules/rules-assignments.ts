import { db } from "../db";
import { Logger } from "../logger";

// --- Assignments ---

export const getRuleUsers = (ruleId: string): { userId: string; username: string; email: string; serverNames: string; enabled: boolean }[] => {
    try {
        const users = db.prepare(`
            SELECT ui.accountId as id, ui.username, ui.email, GROUP_CONCAT(s.name, ', ') as serverNames
            FROM user_identities ui
            LEFT JOIN server_users su ON su.accountId = ui.accountId
            LEFT JOIN servers s ON su.serverId = s.id
            GROUP BY ui.accountId, ui.username, ui.email
        `).all() as { id: string, username: string, email: string, serverNames: string | null }[];

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
        Logger.error(`Failed to fetch users for rule ${ruleId}:`, error);
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
        Logger.error(`Failed to toggle rule ${ruleId} for user ${userId}:`, error);
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
        Logger.error(`Failed to fetch servers for rule ${ruleId}:`, error);
        return [];
    }
};

/** The raw user and server id assignments for a rule (no name joins). */
export const getRuleAssignmentIds = (ruleKey: string): { userIds: string[]; serverIds: string[] } => {
    const users = db.prepare<[string], { userId: string }>("SELECT userId FROM user_rules WHERE ruleKey = ?").all(ruleKey);
    const servers = db.prepare<[string], { serverId: string }>("SELECT serverId FROM server_rules WHERE ruleKey = ?").all(ruleKey);
    return {
        userIds: users.map(u => u.userId),
        serverIds: servers.map(s => s.serverId),
    };
};

/** Servers (id + name) that have the given rule assigned/enabled. */
export const getEnabledServersForRule = (ruleKey: string): { serverId: string; name: string }[] => {
    return db.prepare<[string], { serverId: string; name: string }>(`
        SELECT sr.serverId, s.name
        FROM server_rules sr
        JOIN servers s ON sr.serverId = s.id
        WHERE sr.ruleKey = ?
    `).all(ruleKey);
};

export const toggleServerRule = (serverId: string, ruleId: string, enabled: boolean): void => {
    try {
        if (enabled) {
            db.prepare("INSERT OR IGNORE INTO server_rules (serverId, ruleKey) VALUES (?, ?)").run(serverId, ruleId);
        } else {
            db.prepare("DELETE FROM server_rules WHERE serverId = ? AND ruleKey = ?").run(serverId, ruleId);
        }
    } catch (error) {
        Logger.error(`Failed to toggle rule ${ruleId} for server ${serverId}:`, error);
        throw error;
    }
};

// --- Logging ---

export const logRuleEvent = (userId: string, ruleInstanceId: string, details: string, serverId: string | null = null) => {
    try {
        db.prepare("INSERT INTO rule_events (userId, ruleKey, triggeredAt, details, serverId) VALUES (?, ?, ?, ?, ?)").run(
            userId,
            ruleInstanceId,
            new Date().toISOString(),
            details,
            serverId
        );
    } catch (error) {
        Logger.error("Failed to log rule event:", error);
    }
};

export const closeRuleEvent = (id: number) => {
    try {
        db.prepare("UPDATE rule_events SET endedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
    } catch (error) {
        Logger.error(`Failed to close rule event ${id}:`, error);
    }
};

export const deleteRuleEvent = (id: number) => {
    try {
        db.prepare("DELETE FROM rule_events WHERE id = ?").run(id);
    } catch (error) {
        Logger.error(`Failed to delete rule event ${id}:`, error);
    }
};

export const updateRuleEventDetails = (id: number, details: string) => {
    try {
        db.prepare("UPDATE rule_events SET details = ? WHERE id = ?").run(details, id);
    } catch (error) {
        Logger.error(`Failed to update rule event details ${id}:`, error);
    }
};
