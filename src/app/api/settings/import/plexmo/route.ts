import { NextResponse } from "next/server";
import path from "path";
import { requireOwner } from "@/lib/auth-guard";
import { resolveConfigDir, resolveDbPath } from "@/lib/config-dir";
import { validateAndStage } from "@/lib/backup/restore-validate";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const EXIT_DELAY_MS = 750;

/**
 * Restore upload. SECURITY: the middleware matcher EXEMPTS this exact path
 * (to bypass the body-size limit), so no upstream auth ever runs — this
 * handler must fully self-guard.
 *
 * A session is required in every instance state. On a configured instance that
 * means an owner; on a fresh one a `setup` session (minted by Plex OAuth in
 * the wizard) also passes, since whoever claims a never-configured box owns
 * it. What this rules out is the anonymous upload: a backup zip may carry a
 * `jwt-secret` entry that becomes the instance signing key, so accepting one
 * without any credential handed an attacker a bootable backdoor on any
 * internet-reachable fresh install.
 *
 * On success the staged restore is committed and the process exits after the
 * response flushes; Docker `restart: unless-stopped` brings it back and the
 * boot-time swap in db.ts applies the staged files. In `next dev` the process
 * does NOT resurrect itself — the UI tells the user to restart manually.
 */
export async function POST(request: Request) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
