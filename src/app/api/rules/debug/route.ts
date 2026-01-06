import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRuleInstances } from "@/lib/rules";

export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        // Fetch User and their Servers
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Users can be on multiple servers. The 'users' table has 'serverId'.
        // Is it one row per server or one row per user?
        // Let's check `getRuleUsers` implementation in `src/lib/rules.ts`...
        // ... "FROM users u LEFT JOIN servers s ON u.serverId = s.id GROUP BY u.id..."
        // This implies 'users' table might double up or we group them.
        // Wait, `users` table usually has `id` as primary key.
        // Let's verify schema or assume standard Plexmo usage:
        // A user row = a unique user. BUT if they are on multiple servers, how is that linked?
        // Ah, `getRuleUsers` does `GROUP_CONCAT(s.name)`.
        // This implies one user row can link to a server? Or maybe `users` table is PER SERVER?
        // Re-reading `src/lib/rules.ts` line 198:
        // `SELECT u.id... FROM users u ... GROUP BY u.id`.
        // If `id` is unique, then `serverId` column on `users` table implies One Web User -> One Server?
        // Or maybe `users` table has many rows for same "Plex User"?
        // Let's look at `prisma/schema.prisma` if it exists, or infer from `users` table structure.
        // Actually, let's look at `src/lib/sync.ts` or similar if available, or just use what we know.
        // If I assume `users.serverId` is the server they belong to... what if they are on two?
        // The `plex.ts` or `sync` logic would clarify.
        // However, specifically for RULES, `getRuleUsers` returns unique users.
        // Let's just fetch ALL servers the user has access to.
        // If `users` has `email` or `username` as unique identifier across Plex...
        // Let's assume for now we look up by `id`.

        // Actually, simpler:
        // 1. Get all rules.
        // 2. For each rule, check if `user_rules` has (userId, ruleId).
        // 3. For each rule, check if `server_rules` has (serverId, ruleId) WHERE serverId is one of user's servers.

        // We need to know WHICH servers the user belongs to.
        // `SELECT serverId FROM users WHERE id = ?` might not be enough if they have multiple entries?
        // If `users.id` is the primary key, they only have ONE entry.
        // If the system supports multi-server, maybe `users` table is just a cache?
        // Let's stick to what `checkAndLogViolations` does:
        // `const userSessions = sessions.filter(s => s.user === user.username);`
        // It matches by USERNAME.
        // But rules are assigned by `userId`.
        // Let's use `userId` to find the user record, and if we need servers...
        // `getRuleUsers` helper joins `servers`.
        // Let's fetch the user's `serverId`.

        // Wait, looking at `getRuleUsers` in `lib/rules.ts`:
        // `FROM users u LEFT JOIN servers s ON u.serverId = s.id`
        // So a user row has ONE `serverId`.
        // If the same "Plex Person" is on multiple servers, do they have multiple `users` rows?
        // If so, they would have different `id`s? 
        // If they have different IDs, then "Rule for User X" is specific to that ID (that server-user combo).
        // So we only need to check the server of THAT specific user ID.

        const userRecord = db.prepare("SELECT serverId FROM users WHERE id = ?").get(userId) as { serverId: string };
        const userServerId = userRecord?.serverId;

        const allRules = getRuleInstances();
        const results = [];

        for (const rule of allRules) {
            let applies = false;
            const reasons = {
                global: false,
                user: false,
                servers: [] as string[]
            };

            // 1. Global
            if (rule.global) {
                applies = true;
                reasons.global = true;
            }

            // 2. User Specific
            const userRule = db.prepare("SELECT 1 FROM user_rules WHERE userId = ? AND ruleKey = ?").get(userId, rule.id);
            if (userRule) {
                applies = true;
                reasons.user = true;
            }

            // 3. Server Specific
            if (userServerId) {
                const serverRule = db.prepare(`
                    SELECT s.name 
                    FROM server_rules sr
                    JOIN servers s ON sr.serverId = s.id
                    WHERE sr.serverId = ? AND sr.ruleKey = ?
                `).get(userServerId, rule.id) as { name: string };

                if (serverRule) {
                    applies = true;
                    reasons.servers.push(serverRule.name);
                }
            }

            if (applies) {
                // Previously only pushed if applied
            }
            // Push ALL rules with applies status
            results.push({ rule, applies, reasons });
        }

        return NextResponse.json(results);

    } catch (error) {
        console.error("Debugger API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
