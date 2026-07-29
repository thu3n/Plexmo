import { NextRequest, NextResponse } from "next/server";
import { getRuleInstances, createRuleInstance } from "@/lib/rules";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const instances = getRuleInstances();
        return NextResponse.json(instances);
    } catch (error) {
        Logger.error("Failed to fetch rule instances:", error);
        return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();

        // Basic validation
        if (!body.name || !body.type || !body.settings) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const newRule = {
            id: crypto.randomUUID(),
            type: body.type,
            name: body.name,
            enabled: body.enabled ?? true, // Default to true if not provided
            settings: body.settings,
            discordWebhookId: body.discordWebhookId || null,
            discordWebhookIds: body.discordWebhookIds || [],
        };

        createRuleInstance(newRule, {
            userIds: body.assignments?.userIds || [],
            serverIds: body.assignments?.serverIds || []
        });
        return NextResponse.json(newRule, { status: 201 });
    } catch (error) {
        Logger.error("Failed to create rule instance:", error);
        return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
    }
}
