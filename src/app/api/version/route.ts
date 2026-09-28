import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { Logger } from "@/lib/logger";
import { getUpdateStatus, repoSlugFromUrl, type UpdateStatus } from "@/lib/update-check";

export const dynamic = "force-dynamic";

const DEFAULT_REPOSITORY = { type: "git", url: "https://github.com/thu3n/plexmo.git" };
const DEFAULT_REPO_SLUG = "thu3n/plexmo";

interface PackageInfo {
    version: string;
    name: string;
    repository: { type: string; url: string };
}

interface VersionResponse extends PackageInfo {
    /** When this server process started (not a build date — the image carries none). */
    startedAt: string;
    update: UpdateStatus;
}

// package.json cannot change under a running process, so read it once.
let packageInfo: PackageInfo | null = null;

const readPackageInfo = (): PackageInfo => {
    if (packageInfo) return packageInfo;
    const raw = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as Partial<PackageInfo>;
    packageInfo = {
        version: typeof raw.version === "string" ? raw.version : "0.0.0",
        name: typeof raw.name === "string" ? raw.name : "plexmo",
        repository: raw.repository?.url ? raw.repository : DEFAULT_REPOSITORY,
    };
    return packageInfo;
};

/** Derived from uptime so it is correct no matter when this module first loads. */
const processStartedAt = () => new Date(Date.now() - process.uptime() * 1000).toISOString();

// Session-only by design (see api-route-guards.test.ts): build metadata and
// the public latest-release tag are nothing a signed-in viewer can't see on GitHub.
export async function GET() {
    let info: PackageInfo;
    try {
        info = readPackageInfo();
    } catch (error) {
        Logger.error("Error reading version info:", error);
        return NextResponse.json({ error: "Failed to read version information" }, { status: 500 });
    }

    const repo = repoSlugFromUrl(info.repository.url) ?? DEFAULT_REPO_SLUG;
    const body: VersionResponse = {
        ...info,
        startedAt: processStartedAt(),
        update: await getUpdateStatus(info.version, repo),
    };
    return NextResponse.json(body);
}
