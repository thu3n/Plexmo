import { db } from "./db";

export interface Setting {
    key: string;
    value: string;
}

export const getSettings = (): Record<string, string> => {
    try {
        const rows = db.prepare("SELECT key, value FROM settings").all() as Setting[];
        return rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {} as Record<string, string>);
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return {};
    }
};

export const getSetting = (key: string, defaultValue?: string): string | undefined => {
    try {
        const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as Setting | undefined;
        return row ? row.value : defaultValue;
    } catch (error) {
        console.error(`Failed to fetch setting ${key}:`, error);
        return defaultValue;
    }
};

export const setSetting = (key: string, value: string): void => {
    try {
        // Upsert equivalent for SQLite
        db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
    } catch (error) {
        console.error(`Failed to set setting ${key}:`, error);
        throw error;
    }
};
