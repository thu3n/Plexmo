import {
    parseRetentionDays,
    RETENTION_DEFAULTS,
    RETENTION_SETTING_KEYS,
    type RetentionWindow,
} from "@/lib/retention-config";

export type RetentionForm = Record<RetentionWindow, string>;

export const RETENTION_WINDOWS = Object.keys(RETENTION_DEFAULTS) as RetentionWindow[];

export const RETENTION_LABELS: Record<RetentionWindow, { label: string; description: string }> = {
    concurrentSnapshotsDays: {
        label: "Concurrent stream snapshots",
        description: "Per-minute stream counts behind the concurrency charts. Peaks are kept separately.",
    },
    ruleEventsDays: {
        label: "Rule events",
        description: "Rule violation and enforcement log entries.",
    },
    finishedJobsDays: {
        label: "Background jobs",
        description: "Job history shown under Settings → Jobs.",
    },
};

/** Effective values: stored setting when valid, otherwise the sweep's default. */
export const buildRetentionForm = (settings: Record<string, string> | undefined): RetentionForm => {
    const form = {} as RetentionForm;
    for (const window of RETENTION_WINDOWS) {
        const parsed = parseRetentionDays(settings?.[RETENTION_SETTING_KEYS[window]] ?? "");
        form[window] = String(parsed.ok ? parsed.days : RETENTION_DEFAULTS[window]);
    }
    return form;
};

export type RetentionDiff =
    | { ok: true; changes: Record<string, string> }
    | { ok: false; errors: Partial<Record<RetentionWindow, string>> };

/** Validates every field and returns only the settings that actually changed. */
export const diffRetentionForm = (form: RetentionForm, saved: RetentionForm): RetentionDiff => {
    const errors: Partial<Record<RetentionWindow, string>> = {};
    const changes: Record<string, string> = {};
    for (const window of RETENTION_WINDOWS) {
        const parsed = parseRetentionDays(form[window]);
        if (!parsed.ok) {
            errors[window] = parsed.error;
            continue;
        }
        if (String(parsed.days) !== saved[window]) {
            changes[RETENTION_SETTING_KEYS[window]] = String(parsed.days);
        }
    }
    return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, changes };
};
