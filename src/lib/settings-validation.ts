import { parseRetentionDays, RETENTION_LAST_RUN_KEY, RETENTION_SETTING_KEYS } from "./retention-config";

/**
 * Validation for the generic /api/settings endpoint. Pure (no DB) so the
 * General settings form can apply the same rules before submitting.
 */

export const APP_NAME_KEY = "APP_NAME";
export const DEFAULT_APP_NAME = "Plexmo";
/** Long enough for any real instance name, short enough for the header and <title>. */
export const APP_NAME_MAX_LENGTH = 50;

const RETENTION_KEYS: readonly string[] = Object.values(RETENTION_SETTING_KEYS);

/**
 * Keys a client may write. Everything else in the `settings` table either
 * holds a secret (API_KEY, TAUTULLI_API_KEY, discordWebhookUrl) or is owned by
 * a dedicated route — accepting an arbitrary key once let a caller overwrite
 * API_KEY, which api-auth.ts trusts.
 */
export const WRITABLE_SETTING_KEYS: readonly string[] = [APP_NAME_KEY, ...RETENTION_KEYS];

/** Keys a client may read: the writable ones plus server-maintained status. */
export const READABLE_SETTING_KEYS: readonly string[] = [...WRITABLE_SETTING_KEYS, RETENTION_LAST_RUN_KEY];

export type SettingValidation = { ok: true; value: string } | { ok: false; error: string };

export const validateAppName = (raw: unknown): SettingValidation => {
  if (typeof raw !== "string") return { ok: false, error: "Application name must be text" };
  const value = raw.trim();
  if (!value) return { ok: false, error: "Application name cannot be empty" };
  if (value.length > APP_NAME_MAX_LENGTH) {
    return { ok: false, error: `Application name must be at most ${APP_NAME_MAX_LENGTH} characters` };
  }
  return { ok: true, value };
};

export const validateClientSetting = (key: unknown, value: unknown): SettingValidation => {
  if (typeof key !== "string" || !WRITABLE_SETTING_KEYS.includes(key)) {
    return { ok: false, error: "Unknown setting" };
  }
  if (key === APP_NAME_KEY) return validateAppName(value);
  const days = parseRetentionDays(value);
  return days.ok ? { ok: true, value: String(days.days) } : days;
};
