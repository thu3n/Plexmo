import HistoryClient from "./HistoryClient";

export default function HistoryPage() {
    const timeZone = process.env.TZ || "Europe/Stockholm";
    return <HistoryClient timeZone={timeZone} />;
}
