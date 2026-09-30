import { redirect } from "next/navigation";

/** The v2 preview became /statistics; keep old bookmarks working. */
export default function StatisticsV2Redirect() {
    redirect("/statistics");
}
