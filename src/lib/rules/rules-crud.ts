import { db } from "../db";
import { Logger } from "../logger";
import type { RuleInstanceRow } from "../db-types";
import type { RuleInstance } from "@/features/rules/types";
import type { PersistedRuleInstance, RuleEventRow } from "./types";

// --- CRUD ---

export const getRuleInstances = (): PersistedRuleInstance[] => {
    try {
        const rows = db.prepare<[], RuleInstanceRow>("SELECT * FROM rule_instances").all();
        return rows.map((r): PersistedRuleInstance => {
            // Fetch assigned server names
            const servers = db.prepare(`
                SELECT s.name
                FROM servers s
                JOIN server_rules sr ON s.id = sr.serverId
                WHERE sr.ruleKey = ?
            `).all(r.id) as { name: string }[];
            const serverNames = servers.map(s => s.name);

            const serverCountResult = db.prepare("SELECT COUNT(*) as count FROM server_rules WHERE ruleKey = ?").get(r.id) as { count: number };
            const serverCount = serverCountResult.count;

            // Fetch assigned user names (limit 5 for preview)
            const users = db.prepare(`
                SELECT ui.username
                FROM user_identities ui
                JOIN user_rules ur ON ui.accountId = ur.userId
                WHERE ur.ruleKey = ?
                LIMIT 5
            `).all(r.id) as { username: string }[];
            const userNames = users.map(u => u.username);

            // Get total user count
            const userCountResult = db.prepare("SELECT COUNT(*) as count FROM user_rules WHERE ruleKey = ?").get(r.id) as { count: number };
            const userCount = userCountResult.count;

            const isGlobal = userCount === 0 && serverCount === 0;

            let ids: string[] = [];
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
        Logger.error("Failed to fetch rule instances:", error);
        return [];
    }
};

export const getRuleInstance = (id: string): PersistedRuleInstance | undefined => {
    try {
        const row = db.prepare<[string], RuleInstanceRow>("SELECT * FROM rule_instances WHERE id = ?").get(id);
        if (!row) return undefined;

        const userCountResult = db.prepare("SELECT COUNT(*) as count FROM user_rules WHERE ruleKey = ?").get(id) as { count: number };
        const serverCountResult = db.prepare("SELECT COUNT(*) as count FROM server_rules WHERE ruleKey = ?").get(id) as { count: number };

        const userCount = userCountResult.count;
        const serverCount = serverCountResult.count;
        const isGlobal = userCount === 0 && serverCount === 0;

        let ids: string[] = [];
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
        Logger.error(`Failed to fetch rule instance ${id}:`, error);
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
        Logger.error("Failed to create rule instance:", error);
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
        Logger.error("Failed to update rule instance:", error);
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
        Logger.error("Failed to delete rule instance:", error);
        throw error;
    }
};

// --- Read helpers ---

export const getUserRuleHistory = (userId: string) => {
    try {
        const events = db.prepare(`
        SELECT re.*, ri.name as ruleName, ri.type as ruleType
        FROM rule_events re
        LEFT JOIN rule_instances ri ON re.ruleKey = ri.id
        WHERE re.userId = ?
        ORDER BY re.triggeredAt DESC
    `).all(userId) as RuleEventRow[];

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
        Logger.error(`Failed to get rule history for user ${userId}:`, error);
        return [];
    }
};

export const getGlobalRules = () => {
    try {
        const rules = db.prepare(`
            SELECT r.*
            FROM rule_instances r
            LEFT JOIN user_rules ur ON r.id = ur.ruleKey
            LEFT JOIN server_rules sr ON r.id = sr.ruleKey
            WHERE ur.userId IS NULL AND sr.serverId IS NULL
            GROUP BY r.id
        `).all() as RuleInstanceRow[];

        return rules.map(r => ({
            ...r,
            enabled: r.enabled === 1,
            settings: JSON.parse(r.settings)
        }));
    } catch (error) {
        Logger.error("Failed to fetch global rules:", error);
        return [];
    }
};

export const getUserRules = (userId: string) => {
    try {
        const rules = db.prepare(`
        SELECT ri.*
        FROM rule_instances ri
        JOIN user_rules ur ON ri.id = ur.ruleKey
        WHERE ur.userId = ?
    `).all(userId) as RuleInstanceRow[];

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
        Logger.error(`Failed to get user rules for ${userId}:`, error);
        return [];
    }
};
