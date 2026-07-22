import {
    getPlaysPerServer,
    getTopPlatforms,
    getTopUsers,
    type HomeStatsParams,
} from "./home-stats";

/**
 * The home bundle minus topMovies/topShows — for consumers that discard the
 * media lists (the statistics page renders those via the top-media API, so
 * computing them here would run the heaviest aggregations twice).
 */
export const getHomeStatsLight = (params: HomeStatsParams) => ({
    topUsers: getTopUsers(params),
    topPlatforms: getTopPlatforms(params),
    playsPerServer: getPlaysPerServer(params),
});
