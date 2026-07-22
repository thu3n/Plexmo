import { NextResponse } from "next/server";
import path from "path";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { isOwnerLike, resolveScope } from "@/lib/authz";
import { getServerCount } from "@/lib/servers";
import { resolveConfigDir, resolveDbPath } from "@/lib/config-dir";
import { validateAndStage } from "@/lib/backup/restore-validate";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const EXIT_DELAY_MS = 750;

/**
 * Restore upload. SECURITY: the middleware matcher EXEMPTS this exact path
 * (to bypass the body-size limit), so no upstream auth ever runs — this
 * handler must fully self-guard:
 * - Configured instance (servers exist): owner session required.
 * - Fresh instance (zero servers): sessionless upload allowed — identical
 *   trust model to setup mode, where anyone completing setup owns the box.
 *
 * On success the staged restore is committed and the process exits after the
 * response flushes; Docker `restart: unless-stopped` brings it back and the
 * boot-time swap in db.ts applies the staged files. In `next dev` the process
 * does NOT resurrect itself — the UI tells the user to restart manually.
 */
export async function POST(request: Request) {
    if (getServerCount() > 0) {
        const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value;
        const session = token ? await verifyToken(token) : null;
        if (!session || !isOwnerLike({ scope: resolveScope(session) })) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: "Backup file too large" }, { status: 413 });
    }

    try {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) {
            return NextResponse.json({ error: "No backup file uploaded" }, { status: 400 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const configDir = resolveConfigDir() ?? path.dirname(resolveDbPath());

        const result = validateAndStage(buffer, configDir);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        Logger.info("[Restore] Backup validated and staged - restarting to apply.");
        // Respond first; the timeout lets Next flush the response before exit.
        setTimeout(() => process.exit(0), EXIT_DELAY_MS);
        return NextResponse.json({ status: "restarting" });
    } catch (error) {
        Logger.error("[Restore] Upload failed:", error);
        return NextResponse.json({ error: "Restore upload failed" }, { status: 500 });
    }
}
