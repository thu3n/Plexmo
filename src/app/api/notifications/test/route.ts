import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { requireOwner } from "@/lib/auth-guard";
import { parseOutboundUrl } from "@/lib/outbound-url";
import { buildTestEmbed, postEmbed } from "@/lib/notifications/dispatch";
import { Logger } from "@/lib/logger";

/** Test an unsaved URL (webhook modal). Stored webhooks use /api/notifications/webhooks/[id]/test. */
export async function POST(request: Request) {
    // Posts to a caller-supplied URL — owner-only, or it is an open relay.
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = (await request.json().catch(() => ({}))) as { targetUrl?: unknown };

        // The stored setting is the legacy single-webhook fallback.
        const candidate = body.targetUrl || getSetting("discordWebhookUrl");
        if (!candidate) {
            return NextResponse.json({ error: "No Discord Webhook URL provided or configured" }, { status: 400 });
        }
        if (!parseOutboundUrl(candidate)) {
            return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
        }

        const result = await postEmbed(String(candidate), buildTestEmbed(), "test URL");
        if (!result.ok) {
            Logger.warn(`Test notification failed: ${result.error}`);
            return NextResponse.json({ error: result.error }, { status: 502 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Test notification failed:", error);
        return NextResponse.json({ error: "Failed to send test notification" }, { status: 500 });
    }
}
