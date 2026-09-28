import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { getRuleInstance } from "@/lib/rules";
import { getRecentRuleEvents } from "@/lib/rules/rule-events-query";
import { Logger } from "@/lib/logger";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface Props {
    params: Promise<{ id: string }>;
}

const parseLimit = (raw: string | null): number => {
    const n = raw === null ? NaN : Number(raw);
    if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
    return Math.min(n, MAX_LIMIT);
};

/** Recent enforcement events (when, user, server, action) for one rule. Owner-only. */
export async function GET(req: NextRequest, props: Props) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await props.params;
    try {
        if (!getRuleInstance(id)) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }
        const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
        return NextResponse.json({ events: getRecentRuleEvents(id, limit) });
    } catch (error) {
        Logger.error("Failed to fetch rule events:", error);
        return NextResponse.json({ error: "Failed to fetch rule events" }, { status: 500 });
    }
}
