import { getSetting, setSetting } from "../settings";

/**
 * Configured WAN upload capacity (Mbps) the WAN-load chart is drawn against.
 * One instance-wide value: servers behind different uplinks are rare enough
 * that a per-server setting isn't worth the UI. Stored as a plain settings
 * row; an empty string means "not configured" (settings has no delete helper).
 */

export const UPLOAD_CAPACITY_SETTING_KEY = "WAN_UPLOAD_CAPACITY_MBPS";
/** 100 Gbps — anything above is a typo, not an uplink. */
export const MAX_UPLOAD_CAPACITY_MBPS = 100_000;

export const getUploadCapacityMbps = (): number | null => {
    const raw = getSetting(UPLOAD_CAPACITY_SETTING_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
};

export type CapacityParseResult = { ok: true; value: number | null } | { ok: false; error: string };

/** Validates an untrusted request body value: a positive number within bounds, or null to clear. */
export const parseUploadCapacity = (input: unknown): CapacityParseResult => {
    if (input === null) return { ok: true, value: null };
    if (typeof input !== "number" || !Number.isFinite(input)) {
        return { ok: false, error: "mbps must be a number or null" };
    }
    if (input <= 0 || input > MAX_UPLOAD_CAPACITY_MBPS) {
        return { ok: false, error: `mbps must be between 0 and ${MAX_UPLOAD_CAPACITY_MBPS}` };
    }
    return { ok: true, value: input };
};

export const setUploadCapacityMbps = (mbps: number | null): void => {
    setSetting(UPLOAD_CAPACITY_SETTING_KEY, mbps === null ? "" : String(mbps));
};
