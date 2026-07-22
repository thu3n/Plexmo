import { db } from "../db";

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
] as const;

export type GraphType = (typeof GRAPH_TYPES)[number];

export type GraphParams = {
  since: number;
  serverId?: string;
  allowedServerIds?: string[];
  /** Canonical accountId — restricts the graph to one identity's rows. */
  userId?: string;
};

const buildFilter = ({ since, serverId, allowedServerIds, userId }: GraphParams) => {
  const conditions: string[] = ["h.startTime >= ?"];
  const args: (string | number)[] = [since];

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
  COUNT(*) as total
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
