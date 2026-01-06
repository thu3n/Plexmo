import { NextResponse } from "next/server";
import { getAllHistory } from "@/lib/history";
import { validateApiKey } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    if (!validateApiKey(request)) {
        return NextResponse.json({ error: "Unauthorized: Invalid or missing API Key" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || undefined;
    const serverId = searchParams.get("serverId") || undefined;
    const yearParam = searchParams.get("year");

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

    // Reuse the generic getAllHistory function from lib
    // Note: serverId filter was not in the original getAllHistory but we can filter in memory or update lib if really needed.
    // The requirement was "get all data", so let's stick to what we built in lib which supports userId, start, end.
    // Ideally we should update lib to support serverId too if strict filtering is needed, but "Rewrap" usually cares about User + Time.
    // Let's filter by serverId in memory here if provided, to keep it simple unless performance is hit.

    let history = getAllHistory({ start, end, userId });

    if (serverId) {
        history = history.filter(h => h.serverId === serverId);
    }

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
