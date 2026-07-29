import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";
import { SETTING_KEYS as RETENTION_KEYS } from "@/lib/retention";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";

/**
 * The settings this generic endpoint may read and write.
 *
 * Everything else in the `settings` table either holds a secret (API_KEY,
 * TAUTULLI_API_KEY, discordWebhookUrl) or is owned by a dedicated route that
 * validates it properly. Returning the whole table leaked those secrets, and
 * accepting an arbitrary key let a caller overwrite API_KEY with a value of
 * their choosing — an auth bypass, since api-auth.ts trusts that row.
 */
const CLIENT_SETTING_KEYS: readonly string[] = [
    "APP_NAME",
    ...Object.values(RETENTION_KEYS),
];

export async function GET(request: NextRequest) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings: Record<string, string> = {};
    for (const key of CLIENT_SETTING_KEYS) {
        const value = getSetting(key);
        if (value !== undefined) settings[key] = value;
    }
    return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { key, value } = body;

        if (!key || value === undefined) {
            return new NextResponse("Missing key or value", { status: 400 });
        }

        if (!CLIENT_SETTING_KEYS.includes(key)) {
            return NextResponse.json({ error: "Unknown setting" }, { status: 400 });
        }

        setSetting(key, String(value));
        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Failed to save setting:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
