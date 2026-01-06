import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRuleInstances, getRuleUsers, getRuleServers } from "@/lib/rules";

export async function POST(req: NextRequest) {
    try {
        const { rule, assignments } = await req.json();
        // rule: RuleInstance (draft)
        // assignments: { userIds: string[], serverIds: string[] } (IDs of ENABLED entities)
        // If creating new global rule, these might be empty arrays, meaning Global if logic dictates?
        // Wait, frontend logic: if !isEditing => Global. 
        // We need explicit "isGlobal" flag or deduce it?
        // Let's pass 'isGlobal' explicitly from frontend to be safe.

        const { id, settings } = rule;
        const draftLimit = settings.limit;
        const draftIsEnforced = settings.enforce; // Only counting enforced rules? Or all? Usually all active rules count towards limit logic.
        // Actually Plexmo logic: `checkAndLogViolations` uses `limit`. Enforcement is separate action.
        // So we just check limits.

        // 1. Fetch all users
        const allUsers = db.prepare("SELECT id, username FROM users").all() as { id: string, username: string }[];

        // 2. Fetch all EXISTING ACTIVE rules
        // Exclude the one we are editing (if id exists)
        const allRules = getRuleInstances().filter(r => r.enabled && r.type === "max_concurrent_streams" && r.id !== id);

        // 3. Build User -> Current Effective Limit
        const userLimits = new Map<string, number>();

        // Pre-fetch assignments for all rules to avoid N+1
        // Actually getRuleInstances doesn't return assignments.
        // We can do a single big query or loop. 
        // For 'analyze', we can optimize or just loop. Loop is fine for < 100 rules.

        // Helper to get assignments for a rule (cached or not?)
        // We'll just fetch them.
        const ruleAssignments = new Map<string, { userIds: Set<string>, serverIds: Set<string>, isGlobal: boolean }>();

        for (const r of allRules) {
            const users = db.prepare("SELECT userId FROM user_rules WHERE ruleKey = ?").all(r.id) as { userId: string }[];
            const servers = db.prepare("SELECT serverId FROM server_rules WHERE ruleKey = ?").all(r.id) as { serverId: string }[];

            const uSet = new Set(users.map(u => u.userId));
            const sSet = new Set(servers.map(s => s.serverId));
            const isGlobal = uSet.size === 0 && sSet.size === 0; // Backend logic for Global

            ruleAssignments.set(r.id, { userIds: uSet, serverIds: sSet, isGlobal });
        }

        // User Server mapping
        // We need to know which server a user belongs to? 
        // Backend `getRuleUsers` joins `users` on `serverId`.
        // Let's get user-server map.
        const userServerMap = new Map<string, string>(); // userId -> serverId
        const usersWithServer = db.prepare("SELECT id, serverId FROM users").all() as { id: string, serverId: string }[];
        usersWithServer.forEach(u => userServerMap.set(u.id, u.serverId));

        // Calculate Current Limits
        for (const user of allUsers) {
            let limit = Infinity;

            for (const r of allRules) {
                const assign = ruleAssignments.get(r.id)!;
                const applies = assign.isGlobal ||
                    assign.userIds.has(user.id) ||
                    (userServerMap.has(user.id) && assign.serverIds.has(userServerMap.get(user.id)!));

                if (applies) {
                    limit = Math.min(limit, r.settings.limit);
                }
            }
            userLimits.set(user.id, limit);
        }

        // 4. Calculate NEW Limits with Draft Rule
        const impactedUsers: any[] = [];

        // Determine Draft Scope
        const draftUserIds = new Set(assignments?.userIds || []);
        const draftServerIds = new Set(assignments?.serverIds || []);
        // Explicitly passed isGlobal or deduced
        // If frontend passes empty arrays for a new rule, it implies Global.
        // But if editing, empty means Global too.
        // Let's rely on the sets.
        const draftIsGlobal = draftUserIds.size === 0 && draftServerIds.size === 0;

        for (const user of allUsers) {
            const currentLimit = userLimits.get(user.id)!;

            // Does draft rule apply?
            const applies = draftIsGlobal ||
                draftUserIds.has(user.id) ||
                (userServerMap.has(user.id) && draftServerIds.has(userServerMap.get(user.id)!));

            if (applies) {
                const newLimit = Math.min(currentLimit, draftLimit);
                if (newLimit < currentLimit) {
                    impactedUsers.push({
                        username: user.username,
                        oldLimit: currentLimit === Infinity ? "Unlimited" : currentLimit,
                        newLimit: newLimit
                    });
                }
            }
        }

        return NextResponse.json({ impactedUsers });

    } catch (error) {
        console.error("Analysis failed:", error);
        return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }
}
