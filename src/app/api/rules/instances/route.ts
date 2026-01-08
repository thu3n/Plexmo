import { NextRequest, NextResponse } from "next/server";
import { getRuleInstances, createRuleInstance } from "@/lib/rules";

export async function GET() {
    try {
        const instances = getRuleInstances();
        return NextResponse.json(instances);
    } catch (error) {
        console.error("Failed to fetch rule instances:", error);
        return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
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
        console.error("Failed to create rule instance:", error);
        return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
    }
}
