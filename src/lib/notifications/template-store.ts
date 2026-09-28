import { getSetting, setSetting } from "@/lib/settings";
import { sanitizeTemplates, type TemplateOverrides } from "@/features/notifications/lib/templates";

/**
 * Message templates are global (one per event), kept as a single JSON value in
 * the key/value `settings` table. Only overridden events are stored, so a
 * default template improved in a later release reaches everyone who never
 * customised it.
 */
const TEMPLATES_SETTING_KEY = "notificationTemplates";

export const getTemplateOverrides = (): TemplateOverrides => {
    const raw = getSetting(TEMPLATES_SETTING_KEY);
    if (!raw) return {};
    try {
        return sanitizeTemplates(JSON.parse(raw));
    } catch {
        console.error("[Notifications] Stored templates are not valid JSON; using defaults.");
        return {};
    }
};

/** Accepts untrusted input; returns what was actually stored. */
export const saveTemplateOverrides = (overrides: unknown): TemplateOverrides => {
    const clean = sanitizeTemplates(overrides);
    setSetting(TEMPLATES_SETTING_KEY, JSON.stringify(clean));
    return clean;
};
