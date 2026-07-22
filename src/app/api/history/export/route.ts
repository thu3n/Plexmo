import { NextResponse } from "next/server";
import { getAllHistory } from "@/lib/history";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { validateApiKey } from "@/lib/api-auth";
import { resolveScope, scopedServerIds } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    // Auth Priority: 1. Session, 2. API Key (for 3rd party tools like Wrapperr)

    // 1. Check Session
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const sessionUser = token ? await verifyToken(token) : null;

    // 2. Check API Key
    const isApiKeyValid = validateApiKey(request);

    // Require at least one valid auth method
    if (!sessionUser && !isApiKeyValid) {
        return NextResponse.json({ error: "Unauthorized: Invalid Session or API Key" }, { status: 401 });
    }

    // Opt-in viewer scoping (API keys are unscoped).
    const allowedServerIds = sessionUser ? scopedServerIds(resolveScope(sessionUser)) : undefined;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || undefined;
    const serverId = searchParams.get("serverId") || undefined;
    const yearParam = searchParams.get("year");

    // Optional pagination. Absent params keep the historical full-dump
    // behavior that Wrapperr/Rewrap consumers depend on.
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    let limit: number | undefined;
    let offset: number | undefined;
    if (pageParam || pageSizeParam) {
        const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
        const pageSize = Math.max(1, parseInt(pageSizeParam || "1000", 10) || 1000);
        limit = pageSize;
        offset = (page - 1) * pageSize;
    }

    let start: number | undefined;
    let end: number | undefined;

    if (yearParam) {
        const year = parseInt(yearParam, 10);
        if (!isNaN(year)) {
            const startDate = new Date(`${year}-01-01T00:00:00Z`);
            const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
            start = startDate.getTime(); // already in ms
            end = endDate.getTime();
        }
    }

    const history = getAllHistory({ start, end, userId, serverId, limit, offset, allowedServerIds });

    // Enhance history entries by parsing meta_json
    const enhancedHistory = history.map(entry => {
        let meta: any = {};
        try {
            if (entry.meta_json) {
                meta = JSON.parse(entry.meta_json);
            }
        } catch (e) {
            // ignore parse errors
        }

        // Infer Media Type
        let mediaType = "unknown";
        if ((meta && meta.grandparentTitle) || (meta && meta.parentTitle)) {
            mediaType = "episode";
        } else if (entry.title) {
            // If we have a subtitle, it's often an episode title in some contexts, but let's rely on grandparentTitle presence in meta which is safer for "Show" detection.
            // If no meta info is available, we default to movie or unknown.
            mediaType = "movie";
        }

        return {
            ...entry,
            meta_json: undefined, // Remove raw json string to clean up response

            // Expanded Metadata from meta_json
            mediaType,
            grandparentTitle: meta.grandparentTitle || undefined,
            parentTitle: meta.parentTitle || undefined,

            originalTitle: meta.originalTitle,
            year: meta.year,

            // Stream Details
            resolution: meta.resolution,
            container: meta.container,
            videoCodec: meta.originalVideoCodec,
            audioCodec: meta.originalAudioCodec,

            // Transcode Details
            isTranscoded: meta.decision === "transcode",
            transcodeDecision: meta.decision, // direct play, transcode, direct stream
            transcodeVideoCodec: meta.transcodeVideoCodec,
            transcodeAudioCodec: meta.transcodeAudioCodec,
            transcodeContainer: meta.transcodeContainer,
            transcodeHwRequested: meta.transcodeHwRequested,
            qualityProfile: meta.qualityProfile,

            // Player/Network
            playerProduct: meta.player,
            playerPlatform: meta.platform, // Top level has platform too, usually same
            playerDevice: meta.device,     // Top level has device too
            ip: meta.ip,
            bandwidth: meta.bandwidth,
            location: meta.location, // lan/wan
            secure: meta.secure,
            relayed: meta.relayed,
        };
    });

    return NextResponse.json(enhancedHistory);
}
