import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { requireOwner } from "@/lib/auth-guard";
import { parseOutboundUrl } from "@/lib/outbound-url";
import { Logger } from "@/lib/logger";

const WEBHOOK_TIMEOUT_MS = 10_000;

export async function POST(request: Request) {
    // Posts to a caller-supplied URL — owner-only, or it is an open relay.
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { targetUrl } = body;

        // The UI always sends targetUrl; the stored setting is the legacy
        // single-webhook fallback.
        const candidate = targetUrl || getSetting("discordWebhookUrl");

        if (!candidate) {
            return NextResponse.json({ error: "No Discord Webhook URL provided or configured" }, { status: 400 });
        }

        const webhookUrl = parseOutboundUrl(candidate);
        if (!webhookUrl) {
            return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
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
            signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        });

        if (!response.ok) {
            // Only the status code travels back. Reflecting the body would turn
            // this into a readable SSRF against anything the container can reach.
            Logger.warn(`Test notification rejected upstream: ${response.status}`);
            return NextResponse.json(
                { error: `Webhook endpoint returned ${response.status}` },
                { status: 502 },
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Test notification failed:", error);
        return NextResponse.json({ error: "Failed to send test notification" }, { status: 500 });
    }
}
