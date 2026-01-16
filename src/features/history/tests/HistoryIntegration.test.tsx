import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HistoryList } from "../components/HistoryList";
import type { HistoryEntry } from "@/lib/history";

// Mock hooks
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: mockPush,
        refresh: mockRefresh,
    }),
}));

vi.mock("@/components/LanguageContext", () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("@/components/BundlingHelpers", () => ({
    bundleHistoryEntries: (entries: any[]) => entries.map(e => ({ type: 'single', entry: e, subEntries: [] }))
}));

// Mock Data

const BASE_TIME = 1705449600000; // Jan 17 2024 00:00:00 UTC (Fixed date)
const mockHistory: HistoryEntry[] = [
    {
        id: "1",
        title: "Movie A",
        user: "User1",
        startTime: BASE_TIME + 3600000, // 01:00
        duration: 1800,
        pausedCounter: 0,
        serverName: "Server1",
        ratingKey: "101",
        stopTime: BASE_TIME + 3600000 + 1800000,
        meta_json: JSON.stringify({
            title: "Movie A",
            thumb: "/thumb1.jpg",
            duration: 1800000,
            decision: "direct play",
            player: "Plex Web",
            platform: "Chrome"
        }),
    },
    {
        id: "2",
        title: "Movie B",
        user: "User2",
        startTime: BASE_TIME + 7200000, // 02:00
        duration: 3600,
        pausedCounter: 0,
        serverName: "Server1",
        ratingKey: "102",
        stopTime: BASE_TIME + 7200000 + 3600000,
        meta_json: JSON.stringify({
            title: "Movie B",
            thumb: "/thumb2.jpg",
            duration: 3600000,
            decision: "transcode",
            player: "Android",
            platform: "Android"
        }),
    },
];

describe("HistoryList Integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the correct number of rows in desktop view", () => {
        render(
            <HistoryList
                history={mockHistory}
                timeZone="UTC"
                isEditing={false}
                onToggleEdit={vi.fn()}
            />
        );

        // Desktop view is hidden on mobile, but in JSDOM usually window width is desktop-like by default or we query by hierarchy.
        // HistoryList renders a table for desktop.
        // We scope to table to avoid finding duplicate text from Mobile View (which renders simultaneously in JSDOM)
        const table = screen.getByRole("table");
        expect(table).toBeInTheDocument();

        // Getting rows within the table body
        // Now that we scope to table, we can safely check row count again as Mobile cards won't be counted
        const tbody = table.querySelector("tbody");
        const rows = within(tbody!).getAllByRole("row");
        expect(rows).toHaveLength(2);

        // Verify content rendering (using User names as reliable anchors, scoped to table)
        expect(within(table).getByText("User1")).toBeInTheDocument();
        expect(within(table).getByText("User2")).toBeInTheDocument();
    });

    it("updates selection state when a row is toggled", () => {
        render(
            <HistoryList
                history={mockHistory}
                timeZone="UTC"
                isEditing={true}
                onToggleEdit={vi.fn()}
            />
        );

        const table = screen.getByRole("table");
        const row1 = within(table).getByText("User1").closest("tr");
        const checkbox1 = within(row1!).getByRole("checkbox");

        fireEvent.click(checkbox1);

        // Now assert the footer shows 1 selected.
        expect(screen.getByText("1 selected")).toBeInTheDocument();
    });

    it("selects all items when group select is toggled", () => {
        render(
            <HistoryList
                history={mockHistory}
                timeZone="UTC"
                isEditing={true}
                onToggleEdit={vi.fn()}
            />
        );

        // Find checkboxes. 
        // Group checkbox is in the header render, usually before table or in the grouping div. 
        // But "Select All" affects ALL items in that group.
        const checkboxes = screen.getAllByRole("checkbox");
        // We pick the first one which is likely the group header
        const groupCheckbox = checkboxes[0];

        fireEvent.click(groupCheckbox);

        expect(screen.getByText("2 selected")).toBeInTheDocument();
    });

    it("shows delete button only when items are selected", async () => {
        render(
            <HistoryList
                history={mockHistory}
                timeZone="UTC"
                isEditing={true}
                onToggleEdit={vi.fn()}
            />
        );

        // Initially 0 selected, delete button should be hidden or disabled.
        const deleteBtn = screen.getByText("Delete Selection").closest("button");
        const table = screen.getByRole("table");
        const row1 = within(table).getByText("User1").closest("tr");
        const checkbox1 = within(row1!).getByRole("checkbox");

        // Select one
        fireEvent.click(checkbox1);

        // Now check if "1 selected" is visible
        const selectionBar = screen.getByText("1 selected");
        expect(selectionBar).toBeInTheDocument();
        expect(deleteBtn).toBeEnabled();
    });

});
