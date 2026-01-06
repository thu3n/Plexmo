import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";

export async function GET() {
    try {
        const discordWebhookUrl = getSetting("discordWebhookUrl", "");
        const discordEnabled = getSetting("discordEnabled", "true") === "true";
        const discordNotifyStart = getSetting("discordNotifyStart", "true") === "true";
        const discordNotifyStop = getSetting("discordNotifyStop", "true") === "true";
        const discordNotifyTerminate = getSetting("discordNotifyTerminate", "true") === "true";

        return NextResponse.json({
            discordWebhookUrl,
            discordEnabled,
            discordNotifyStart,
            discordNotifyStop,
            discordNotifyTerminate,
        });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            discordWebhookUrl,
            discordEnabled,
            discordNotifyStart,
            discordNotifyStop,
            discordNotifyTerminate
        } = body;

        if (typeof discordWebhookUrl === "string") {
            setSetting("discordWebhookUrl", discordWebhookUrl.trim());
        }

        if (typeof discordEnabled === "boolean") {
            setSetting("discordEnabled", String(discordEnabled));
        }

        if (typeof discordNotifyStart === "boolean") {
            setSetting("discordNotifyStart", String(discordNotifyStart));
        }

        if (typeof discordNotifyStop === "boolean") {
            setSetting("discordNotifyStop", String(discordNotifyStop));
        }

        if (typeof discordNotifyTerminate === "boolean") {
            setSetting("discordNotifyTerminate", String(discordNotifyTerminate));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }
}
