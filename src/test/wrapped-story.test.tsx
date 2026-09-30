import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WrappedStory } from "@/features/wrapped/components/WrappedStory";
import type { WrappedData } from "@/lib/stats/wrapped";

const { useAnomalies } = vi.hoisted(() => ({ useAnomalies: vi.fn() }));
vi.mock("@/features/stats-v2/hooks/insights", () => ({ useAnomalies }));

import { AnomaliesPanel } from "@/features/stats-v2/components/insights/AnomaliesPanel";

beforeAll(() => {
    // jsdom has no IntersectionObserver or element scrolling.
    class NoopObserver {
        observe() {}
        disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", NoopObserver);
    Element.prototype.scrollTo = () => {};
});

const title = (mediaId: number, name: string) => ({ mediaId, title: name, year: 2020, plays: 3, seconds: 7200, thumb: null });

const data: WrappedData = {
    userId: "u1",
    userName: "Alice",
    year: 2026,
    totals: { plays: 42, seconds: 3600 * 120, activeDays: 30, titles: 12 },
    topMovies: [title(1, "Dune"), title(2, "Heat")],
    topShows: [title(10, "Severance")],
    longestBinge: { showMediaId: 10, showTitle: "Severance", episodes: 6, seconds: 14_400, startedAt: 0, endedAt: 1, thumb: null },
    busiestDay: { date: "2026-03-14", seconds: 18_000, plays: 6 },
    busiestMonth: { month: 3, seconds: 90_000 },
    favouriteHour: { hour: 21, plays: 10 },
    monthlySeconds: Array.from({ length: 12 }, (_, i) => i * 100),
    hourlyPlays: Array.from({ length: 24 }, (_, i) => (i === 21 ? 10 : 1)),
    devices: [{ name: "Apple TV", plays: 20, seconds: 300_000 }],
    genres: [{ genre: "Drama", plays: 12 }],
    rank: { position: 1, of: 5 },
};

describe("WrappedStory", () => {
    it("renders every card that has data", () => {
        render(<WrappedStory data={data} />);
        expect(screen.getAllByRole("tab")).toHaveLength(9);
        expect(screen.getByText("Alice's year on Plex")).toBeInTheDocument();
        expect(screen.getByText("#1 of 5 viewers by watch time")).toBeInTheDocument();
        expect(screen.getByText("Primetime regular")).toBeInTheDocument();
        expect(screen.getByText("Copy link")).toBeInTheDocument();
    });

    it("copies the share link", async () => {
        const writeText = vi.fn(async () => {});
        Object.assign(navigator, { clipboard: { writeText } });
        render(<WrappedStory data={data} />);
        fireEvent.click(screen.getByText("Copy link"));
        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/wrapped?user=u1&year=2026`);
        expect(await screen.findByText("Link copied")).toBeInTheDocument();
    });
});

describe("AnomaliesPanel", () => {
    it("lists incidents and reveals the hint on tap", () => {
        const now = Date.now();
        useAnomalies.mockReturnValue({
            days: 30,
            items: [
                {
                    id: 1,
                    kind: "server_silent",
                    severity: "critical",
                    serverId: "a",
                    serverName: "Home",
                    headline: "No plays for 48 hours",
                    detail: "Nothing has played.",
                    hint: "Check the server.",
                    firstDetectedAt: now - 3 * 86_400_000,
                    lastSeenAt: now,
                },
            ],
        });
        render(<AnomaliesPanel days={30} serverId={null} />);
        expect(screen.getByText("No plays for 48 hours")).toBeInTheDocument();
        expect(screen.getByText(/ongoing since 3 days ago/)).toBeInTheDocument();
        expect(screen.queryByText("Check the server.")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button"));
        expect(screen.getByText("Check the server.")).toBeInTheDocument();
    });

    it("shows an empty state", () => {
        useAnomalies.mockReturnValue({ days: 30, items: [] });
        render(<AnomaliesPanel days={30} serverId={null} />);
        expect(screen.getByText("Nothing unusual in the last 30 days")).toBeInTheDocument();
    });
});
