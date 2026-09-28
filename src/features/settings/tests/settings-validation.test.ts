import { describe, expect, it } from "vitest";
import { parseRetentionDays, RETENTION_DEFAULTS, RETENTION_MAX_DAYS, RETENTION_SETTING_KEYS } from "@/lib/retention-config";
import { APP_NAME_MAX_LENGTH, validateAppName, validateClientSetting } from "@/lib/settings-validation";
import { buildRetentionForm, diffRetentionForm } from "@/features/settings/lib/retention-form";

describe("parseRetentionDays", () => {
    it("accepts whole days in range, as string or number", () => {
        expect(parseRetentionDays("30")).toEqual({ ok: true, days: 30 });
        expect(parseRetentionDays(" 7 ")).toEqual({ ok: true, days: 7 });
        expect(parseRetentionDays(1)).toEqual({ ok: true, days: 1 });
        expect(parseRetentionDays(String(RETENTION_MAX_DAYS))).toEqual({ ok: true, days: RETENTION_MAX_DAYS });
    });

    it.each(["0", "-5", "1.5", "abc", "", "1e3", String(RETENTION_MAX_DAYS + 1)])("rejects %j", (raw) => {
        expect(parseRetentionDays(raw).ok).toBe(false);
    });

    it("rejects non-string, non-number input", () => {
        expect(parseRetentionDays(null).ok).toBe(false);
        expect(parseRetentionDays({}).ok).toBe(false);
    });
});

describe("validateClientSetting", () => {
    it("rejects keys outside the writable allowlist", () => {
        expect(validateClientSetting("API_KEY", "x")).toEqual({ ok: false, error: "Unknown setting" });
        expect(validateClientSetting("retention_last_run_date", "2026-01-01").ok).toBe(false);
    });

    it("normalises retention values", () => {
        expect(validateClientSetting(RETENTION_SETTING_KEYS.ruleEventsDays, " 045 ")).toEqual({ ok: true, value: "45" });
        expect(validateClientSetting(RETENTION_SETTING_KEYS.ruleEventsDays, "0").ok).toBe(false);
    });

    it("trims and bounds APP_NAME", () => {
        expect(validateClientSetting("APP_NAME", "  My Plex  ")).toEqual({ ok: true, value: "My Plex" });
        expect(validateAppName("   ").ok).toBe(false);
        expect(validateAppName("x".repeat(APP_NAME_MAX_LENGTH + 1)).ok).toBe(false);
        expect(validateAppName(42).ok).toBe(false);
    });
});

describe("retention form", () => {
    it("falls back to defaults for missing or invalid stored values", () => {
        const form = buildRetentionForm({ [RETENTION_SETTING_KEYS.finishedJobsDays]: "-1" });
        expect(form).toEqual({
            concurrentSnapshotsDays: String(RETENTION_DEFAULTS.concurrentSnapshotsDays),
            ruleEventsDays: String(RETENTION_DEFAULTS.ruleEventsDays),
            finishedJobsDays: String(RETENTION_DEFAULTS.finishedJobsDays),
        });
    });

    it("returns only changed keys", () => {
        const saved = buildRetentionForm({});
        const diff = diffRetentionForm({ ...saved, ruleEventsDays: "365" }, saved);
        expect(diff).toEqual({ ok: true, changes: { [RETENTION_SETTING_KEYS.ruleEventsDays]: "365" } });
        expect(diffRetentionForm(saved, saved)).toEqual({ ok: true, changes: {} });
    });

    it("reports per-field errors", () => {
        const saved = buildRetentionForm({});
        const diff = diffRetentionForm({ ...saved, finishedJobsDays: "0" }, saved);
        expect(diff.ok).toBe(false);
        if (!diff.ok) expect(Object.keys(diff.errors)).toEqual(["finishedJobsDays"]);
    });
});
