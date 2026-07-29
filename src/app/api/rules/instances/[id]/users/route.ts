import { NextRequest, NextResponse } from "next/server";
import { getRuleUsers, getRuleInstance, toggleUserRule } from "@/lib/rules";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";

interface Props {
    params: Promise<{
        id: string;
    }>
}

/**
 * Assignment picker: every known user, each flagged with whether this rule is
 * assigned to them. Unknown ids (the "new" sentinel an unsaved rule uses) are
 * intentionally valid and yield the full roster with everything unchecked.
 */
export async function GET(req: NextRequest, props: Props) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await props.params;
    try {
        const users = getRuleUsers(params.id);
        return NextResponse.json(users);
    } catch (error) {
        Logger.error("Failed to fetch rule users:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: Props) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await props.params;
    try {
        const { userId, enabled } = await req.json();
        if (!userId || typeof enabled !== "boolean") {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // user_rules carries no foreign key, so an unknown rule would silently
        // accumulate orphan assignment rows. Unsaved rules post their
        // assignments with the rule itself, never here.
        if (!getRuleInstance(params.id)) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }

        toggleUserRule(userId, params.id, enabled);
        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Failed to update rule users:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}
