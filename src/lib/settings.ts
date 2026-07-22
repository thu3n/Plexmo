import { db } from "./db";
import type { SettingRow } from "./db-types";

/** Public alias for the raw `settings` row shape. */
export type Setting = SettingRow;

export const getSettings = (): Record<string, string> => {
    try {
        const rows = db.prepare<[], SettingRow>("SELECT key, value FROM settings").all();
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
        const row = db.prepare<[string], Pick<SettingRow, "value">>("SELECT value FROM settings WHERE key = ?").get(key);
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
