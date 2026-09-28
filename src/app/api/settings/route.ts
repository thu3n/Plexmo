import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";
import { READABLE_SETTING_KEYS, validateClientSetting } from "@/lib/settings-validation";

/**
 * Generic settings endpoint, restricted to an allowlist (see
 * settings-validation.ts). Returning the whole table leaked secrets, and
 * accepting an arbitrary key let a caller overwrite API_KEY — an auth bypass.
 */

export async function GET(request: NextRequest) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings: Record<string, string> = {};
    for (const key of READABLE_SETTING_KEYS) {
        const value = getSetting(key);
        if (value !== undefined) settings[key] = value;
    }
    return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { key, value } = (body ?? {}) as { key?: unknown; value?: unknown };
    if (key === undefined || value === undefined) {
        return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
    }

    const validated = validateClientSetting(key, value);
    if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    try {
        setSetting(key as string, validated.value);
        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Failed to save setting:", error);
        return NextResponse.json({ error: "Failed to save setting" }, { status: 500 });
    }
}
