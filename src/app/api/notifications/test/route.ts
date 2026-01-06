import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { targetUrl } = body;

        let webhookUrl: string | undefined = targetUrl;

        // If no target URL provided, this endpoint isn't really useful in the new multi-webhook system 
        // without specifying which one. 
        // But for backward compat/simple test, we can check if there's any global setting OR just error.
        // Actually, the new UI always sends targetUrl.
        if (!webhookUrl) {
            const settingUrl = getSetting("discordWebhookUrl");
            if (settingUrl) webhookUrl = settingUrl;
        }

        if (!webhookUrl) {
            return NextResponse.json({ error: "No Discord Webhook URL provided or configured" }, { status: 400 });
        }

        const payload = {
            embeds: [{
                title: "Test Notification",
                description: "This is a test notification from Plexmo.",
                color: 0x0099ff, // Standard blue
                timestamp: new Date().toISOString(),
                footer: {
                    text: "Plexmo",
                },
            }]
        };

        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Discord API returned ${response.status}: ${text}`);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Test notification failed:", error);
        return NextResponse.json({ error: error.message || "Failed to send test notification" }, { status: 500 });
    }
}
