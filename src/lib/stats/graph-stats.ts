import { db } from "../db";
import { getConcurrentSeries } from "./concurrent";

/**
 * Time-series and breakdown data for the statistics graphs, computed straight
 * from the v5 fact columns (GROUP BY — no meta_json parsing). Decision splits
 * are three-way plus "unknown" for pre-fact rows whose meta lacked a decision;
 * unknown is reported honestly instead of being folded into direct play.
 */

export const GRAPH_TYPES = [
  "plays_by_day",
  "plays_by_month",
  "plays_by_hour",
  "plays_by_dayofweek",
  "plays_by_platform",
  "plays_by_resolution",
  "transcode_share",
  "plays_by_dow_hour",
  "plays_by_device",
  "transcode_details",
  "concurrent_by_day",
  "concurrent_by_month",
] as const;

export type GraphType = (typeof GRAPH_TYPES)[number];

export type GraphParams = {
  since: number;
  /** Exclusive window end, epoch ms (default: open-ended) — previous-period overlays. */
  until?: number;
  serverId?: string;
  allowedServerIds?: string[];
  /** Canonical accountId — restricts the graph to one identity's rows. */
  userId?: string;
};

const buildFilter = ({ since, until, serverId, allowedServerIds, userId }: GraphParams) => {
  const conditions: string[] = ["h.startTime >= ?"];
  const args: (string | number)[] = [since];

  if (until !== undefined) {
    conditions.push("h.startTime < ?");
    args.push(until);
  }

  if (allowedServerIds && allowedServerIds.length > 0) {
    conditions.push(`h.serverId IN (${allowedServerIds.map(() => "?").join(",")})`);
    args.push(...allowedServerIds);
  }
  if (serverId && serverId !== "all") {
    conditions.push("h.serverId = ?");
    args.push(serverId);
  }
  if (userId) {
    conditions.push("h.userId = ?");
    args.push(userId);
  }
  return { where: conditions.join(" AND "), args };
};

const DECISION_SPLIT = `
  SUM(CASE WHEN h.transcode_decision = 'transcode' THEN 1 ELSE 0 END) as transcode,
  SUM(CASE WHEN h.transcode_decision = 'direct stream' THEN 1 ELSE 0 END) as directStream,
  SUM(CASE WHEN h.transcode_decision = 'direct play' THEN 1 ELSE 0 END) as directPlay,
  SUM(CASE WHEN h.transcode_decision IS NULL THEN 1 ELSE 0 END) as unknown,
  COUNT(*) as total,
  COALESCE(SUM(COALESCE(h.play_duration, h.duration)), 0) as seconds,
  COUNT(DISTINCT h.userId) as users
`;

const bucketQuery = (bucketExpr: string, params: GraphParams) => {
  const { where, args } = buildFilter(params);
  return db.prepare(`
    SELECT ${bucketExpr} as bucket, ${DECISION_SPLIT}
    FROM activity_history h
    WHERE ${where}
    GROUP BY bucket
    ORDER BY bucket
  `).all(...args);
};

export const getGraphData = (type: GraphType, params: GraphParams) => {
  switch (type) {
    case "plays_by_day":
      return bucketQuery(
        `strftime('%Y-%m-%d', datetime(h.startTime / 1000, 'unixepoch', 'localtime'))`,
        params
      );
    case "plays_by_month":
      return bucketQuery(
        `strftime('%Y-%m', datetime(h.startTime / 1000, 'unixepoch', 'localtime'))`,
        params
      );
    case "plays_by_hour":
      return bucketQuery(
        `strftime('%H', datetime(h.startTime / 1000, 'unixepoch', 'localtime'))`,
        params
      );
    case "plays_by_dayofweek":
      // 0 = Sunday .. 6 = Saturday (SQLite %w)
      return bucketQuery(
        `strftime('%w', datetime(h.startTime / 1000, 'unixepoch', 'localtime'))`,
        params
      );
    case "plays_by_platform": {
      const { where, args } = buildFilter(params);
      return db.prepare(`
        SELECT h.platform as bucket, ${DECISION_SPLIT}
        FROM activity_history h
        WHERE ${where} AND h.platform IS NOT NULL
        GROUP BY h.platform
        ORDER BY total DESC
        LIMIT 10
      `).all(...args);
    }
    case "plays_by_resolution": {
      const { where, args } = buildFilter(params);
      return db.prepare(`
        SELECT COALESCE(h.stream_video_resolution, 'unknown') as bucket, ${DECISION_SPLIT}
        FROM activity_history h
        WHERE ${where}
        GROUP BY bucket
        ORDER BY total DESC
      `).all(...args);
    }
    case "plays_by_dow_hour":
      // "<%w>-<%H>", e.g. "1-20" = Monday 20:00 — one cell of the weekday × hour heatmap.
      return bucketQuery(
        `strftime('%w', datetime(h.startTime / 1000, 'unixepoch', 'localtime')) || '-' ||
         strftime('%H', datetime(h.startTime / 1000, 'unixepoch', 'localtime'))`,
        params
      );
    case "plays_by_device": {
      const { where, args } = buildFilter(params);
      return db.prepare(`
        SELECT h.device as bucket, COUNT(*) as total,
          SUM(COALESCE(h.play_duration, h.duration)) as duration
        FROM activity_history h
        WHERE ${where} AND h.device IS NOT NULL AND h.device != ''
        GROUP BY h.device
        ORDER BY total DESC
        LIMIT 25
      `).all(...args);
    }
    case "concurrent_by_day":
    case "concurrent_by_month": {
      const scope = {
        serverId: params.serverId && params.serverId !== "all" ? params.serverId : undefined,
        allowedServerIds: params.allowedServerIds,
      };
      return getConcurrentSeries(scope, params.since, type === "concurrent_by_day" ? "day" : "month", params.until);
    }
    case "transcode_details": {
      // Per-stream-component transcode counts plus the most common "from → to"
      // change. Codecs aren't fact columns: live sessions store
      // originalVideoCodec, Tautulli imports videoCodec — read either.
      const { where, args } = buildFilter(params);
      const topCodec = (kind: "Video" | "Audio") => db.prepare(`
        SELECT upper(COALESCE(json_extract(h.meta_json, '$.original${kind}Codec'),
                              json_extract(h.meta_json, '$.${kind.toLowerCase()}Codec')))
               || ' → ' || upper(json_extract(h.meta_json, '$.transcode${kind}Codec')) as detail,
               COUNT(*) as total
        FROM activity_history h
        WHERE ${where} AND h.${kind.toLowerCase()}_decision = 'transcode'
        GROUP BY detail
        HAVING detail IS NOT NULL
        ORDER BY total DESC
        LIMIT 1
      `).get(...args) as { detail: string } | undefined;
      const counts = db.prepare(`
        SELECT
          SUM(CASE WHEN h.video_decision = 'transcode' THEN 1 ELSE 0 END) as video,
          SUM(CASE WHEN h.audio_decision = 'transcode' THEN 1 ELSE 0 END) as audio,
          SUM(CASE WHEN h.stream_video_resolution IS NOT NULL
                    AND h.video_resolution IS NOT NULL
                    AND h.stream_video_resolution != h.video_resolution THEN 1 ELSE 0 END) as resolution
        FROM activity_history h
        WHERE ${where}
      `).get(...args) as { video: number | null; audio: number | null; resolution: number | null };
      const topResolution = db.prepare(`
        SELECT h.video_resolution || ' → ' || h.stream_video_resolution as detail, COUNT(*) as total
        FROM activity_history h
        WHERE ${where}
          AND h.stream_video_resolution IS NOT NULL AND h.video_resolution IS NOT NULL
          AND h.stream_video_resolution != h.video_resolution
        GROUP BY detail
        ORDER BY total DESC
        LIMIT 1
      `).get(...args) as { detail: string } | undefined;
      return [
        { bucket: "video", total: counts.video ?? 0, detail: topCodec("Video")?.detail ?? null },
        { bucket: "audio", total: counts.audio ?? 0, detail: topCodec("Audio")?.detail ?? null },
        { bucket: "resolution", total: counts.resolution ?? 0, detail: topResolution?.detail ?? null },
      ];
    }
    case "transcode_share": {
      const { where, args } = buildFilter(params);
      return db.prepare(`
        SELECT COALESCE(h.transcode_decision, 'unknown') as bucket, COUNT(*) as total
        FROM activity_history h
        WHERE ${where}
        GROUP BY bucket
        ORDER BY total DESC
      `).all(...args);
    }
  }
};
