import { NextRequest, NextResponse } from "next/server";
import { getUserRules, getGlobalRules, getEnabledServersForRule } from "@/lib/rules";
import { getUsersByUsername } from "@/lib/users";
import { Logger } from "@/lib/logger";

export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
    try {
        const { username } = await params;

        // Resolve username to userId and get all servers this user belongs to
        const users = getUsersByUsername(decodeURIComponent(username));

        if (!users || users.length === 0) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Get the first user's ID for user rules
        const userId = users[0].id;

        // Get all server IDs this user belongs to
        const userServerIds = users.map(u => u.serverId);

        // Get user-level rules
        const userRules = getUserRules(userId);

        // Get all global rules to check server-level enforcement
        const allRules = getGlobalRules();

        // For each rule, check which of the user's servers have it enabled
        const serverRules: Record<string, { enabled: boolean, servers: Array<{ serverId: string, name: string }> }> = {};

        for (const rule of allRules) {
            // Get all servers that have this rule enabled
            const enabledServers = getEnabledServersForRule(rule.id);

            // Filter to only the servers this user belongs to
            const userEnabledServers = enabledServers.filter(s => userServerIds.includes(s.serverId));

            serverRules[rule.id] = {
                enabled: userEnabledServers.length > 0,
                servers: userEnabledServers
            };
        }

        return NextResponse.json({ userId, rules: userRules.map((r: any) => r.id), serverRules });
    } catch (error) {
        Logger.error("Error fetching user rules:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
