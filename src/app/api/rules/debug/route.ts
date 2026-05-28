import { NextRequest, NextResponse } from "next/server";
import { getRuleInstances, getRuleAssignmentIds, getEnabledServersForRule } from "@/lib/rules";
import { getUserById } from "@/lib/users";
import { Logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        // Fetch User and their Servers
        const user = getUserById(userId);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Each `users` row is a unique (Plex user, server) pair keyed by id, so a
        // user belongs to the single server on their record.
        const userServerId = user.serverId;

        const allRules = getRuleInstances();
        const results = [];

        for (const rule of allRules) {
            let applies = false;
            const reasons = {
                global: false,
                user: false,
                servers: [] as string[]
            };

            const { userIds } = getRuleAssignmentIds(rule.id);

            // 1. Global
            if (rule.global) {
                applies = true;
                reasons.global = true;
            }

            // 2. User Specific
            if (userIds.includes(userId)) {
                applies = true;
                reasons.user = true;
            }

            // 3. Server Specific
            if (userServerId) {
                const serverMatch = getEnabledServersForRule(rule.id).find(s => s.serverId === userServerId);
                if (serverMatch) {
                    applies = true;
                    reasons.servers.push(serverMatch.name);
                }
            }

            // Push ALL rules with applies status
            results.push({ rule, applies, reasons });
        }

        return NextResponse.json(results);

    } catch (error) {
        Logger.error("Debugger API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
