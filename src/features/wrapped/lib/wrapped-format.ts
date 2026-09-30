import type { WrappedData } from "@/lib/stats/wrapped";

/** Pure display helpers for the Wrapped story — unit-tested in src/test/wrapped-format.test.ts. */

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const NOON = 12;
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/** Whole hours with thousands separators ("1,204"); under an hour shows minutes. */
export const formatWrappedHours = (seconds: number): { value: string; unit: string } => {
    const hours = seconds / SECONDS_PER_HOUR;
    if (hours < 1) return { value: String(Math.round(seconds / SECONDS_PER_MINUTE)), unit: "minutes" };
    const rounded = Math.round(hours);
    return { value: rounded.toLocaleString("en-US"), unit: rounded === 1 ? "hour" : "hours" };
};

/** "5h 20m" / "45m" for a single stretch of watching. */
export const formatDuration = (seconds: number): string => {
    const totalMinutes = Math.round(seconds / SECONDS_PER_MINUTE);
    const h = Math.floor(totalMinutes / MINUTES_PER_HOUR);
    const m = totalMinutes % MINUTES_PER_HOUR;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/** "That's 3.2 days of nonstop watching" — the comparison that makes hours feel real. */
export const hoursInDays = (seconds: number): string | null => {
    const days = seconds / SECONDS_PER_HOUR / HOURS_PER_DAY;
    return days >= 1 ? `${days.toFixed(1)} days` : null;
};

export const monthName = (month: number): string => MONTH_NAMES[month - 1] ?? "";
export const shortMonth = (month: number): string => monthName(month).slice(0, 3);

/** 0 → "12 AM", 13 → "1 PM". */
export const hourLabel = (hour: number): string => {
    const suffix = hour < NOON ? "AM" : "PM";
    const h = hour % NOON === 0 ? NOON : hour % NOON;
    return `${h} ${suffix}`;
};

/** "YYYY-MM-DD" (local) → "Saturday, March 14". Parsed by parts so no UTC shift. */
export const dayLabel = (date: string): string => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
};

type HourPersona = { from: number; to: number; name: string; blurb: string };

/** Ranges are [from, to) in local hours; the night owl wraps past midnight. */
const PERSONAS: HourPersona[] = [
    { from: 5, to: 10, name: "Early bird", blurb: "You like your episodes with breakfast." },
    { from: 10, to: 17, name: "Daytime viewer", blurb: "Who needs primetime?" },
    { from: 17, to: 22, name: "Primetime regular", blurb: "Evenings are for the couch." },
];
const NIGHT_OWL: Omit<HourPersona, "from" | "to"> = { name: "Night owl", blurb: "The best stories start after dark." };

export const hourPersona = (hour: number): { name: string; blurb: string } =>
    PERSONAS.find((p) => hour >= p.from && hour < p.to) ?? NIGHT_OWL;

/** "Top 3 of 12 viewers" style copy; null when there is nothing to compare against. */
export const rankLabel = (rank: WrappedData["rank"]): string | null => {
    if (!rank || rank.of < 2) return null;
    return rank.position === 1 ? `#1 of ${rank.of} viewers` : `#${rank.position} of ${rank.of} viewers`;
};

/** Share link for a Wrapped. Opening it still requires a session that may see this user. */
export const buildShareUrl = (origin: string, userId: string, year: number): string =>
    `${origin}/wrapped?${new URLSearchParams({ user: userId, year: String(year) })}`;

export type StoryCardKey = "intro" | "time" | "shows" | "movies" | "binge" | "rhythm" | "devices" | "genres" | "outro";

/** Cards with something to say, in story order. An empty year gets only intro + outro. */
export const buildStoryCards = (data: WrappedData): StoryCardKey[] => {
    if (data.totals.seconds <= 0) return ["intro", "outro"];
    const cards: StoryCardKey[] = ["intro", "time"];
    if (data.topShows.length > 0) cards.push("shows");
    if (data.topMovies.length > 0) cards.push("movies");
    if (data.longestBinge) cards.push("binge");
    if (data.favouriteHour || data.busiestDay) cards.push("rhythm");
    if (data.devices.length > 0) cards.push("devices");
    if (data.genres && data.genres.length > 0) cards.push("genres");
    cards.push("outro");
    return cards;
};

/** Bar heights as 0..1 of the series maximum (flat zero series stay zero). */
export const normalize = (values: number[]): number[] => {
    const max = Math.max(0, ...values);
    return values.map((v) => (max > 0 ? v / max : 0));
};
