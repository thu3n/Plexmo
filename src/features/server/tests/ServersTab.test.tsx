import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { LanguageProvider } from "@/components/LanguageContext";
import { FeedbackProvider } from "@/components/ui/Feedback";
import { ServersTab } from "../components/settings/ServersTab";

const server = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    name: `Server ${id}`,
    baseUrl: `http://${id}:32400`,
    createdAt: "",
    updatedAt: "",
    hasToken: true,
    maskedToken: "abcd…yz",
    color: null,
    archived: false,
    disabled: false,
    ...extra,
});

type Handler = (url: string, init?: RequestInit) => { status: number; body: unknown };

const stubFetch = (handler: Handler) => {
    const fn = vi.fn(async (url: string, init?: RequestInit) => {
        const { status, body } = handler(url, init);
        return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fn);
    return fn;
};

const renderTab = () =>
    render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <LanguageProvider>
                <FeedbackProvider>
                    <ServersTab />
                </FeedbackProvider>
            </LanguageProvider>
        </SWRConfig>
    );

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("ServersTab", () => {
    it("lists only configured servers and shows live health instead of a hard-coded status", async () => {
        stubFetch((url) => {
            if (url === "/api/servers/status") {
                return {
                    status: 200,
                    body: {
                        servers: [
                            { serverId: "a", state: "online", latencyMs: 12, version: "1.41.0", platform: "Linux", message: null, lastSeenAt: null, checkedAt: "" },
                        ],
                    },
                };
            }
            return {
                status: 200,
                body: { servers: [server("a"), server("old", { archived: true }), server("orphan", { hasToken: false, maskedToken: null })] },
            };
        });
        renderTab();

        expect(await screen.findByText("Server a")).toBeInTheDocument();
        expect(screen.queryByText("Server old")).not.toBeInTheDocument();
        expect(screen.queryByText("Server orphan")).not.toBeInTheDocument();
        expect(await screen.findByText("Online")).toBeInTheDocument();
        expect(screen.getByText(/Plex 1\.41\.0/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Remove Server a" })).toBeInTheDocument();
    });

    it("confirms before removing and reports a failed DELETE instead of pretending success", async () => {
        const fetchMock = stubFetch((url, init) => {
            if (init?.method === "DELETE") return { status: 500, body: { error: "Disk is read-only" } };
            if (url === "/api/servers/status") return { status: 200, body: { servers: [] } };
            return { status: 200, body: { servers: [server("a")] } };
        });
        renderTab();

        fireEvent.click(await screen.findByRole("button", { name: "Remove Server a" }));
        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByText(/watch history, users and rule assignments are kept/)).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Remove server" }));

        expect(await screen.findByText("Disk is read-only")).toBeInTheDocument();
        await waitFor(() =>
            expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/servers/a" && i?.method === "DELETE")).toBe(true)
        );
    });

    it("pauses monitoring through PUT { disabled: true }", async () => {
        const fetchMock = stubFetch((url, init) => {
            if (init?.method === "PUT") return { status: 200, body: { server: server("a", { disabled: true }) } };
            if (url === "/api/servers/status") return { status: 200, body: { servers: [] } };
            return { status: 200, body: { servers: [server("a")] } };
        });
        renderTab();

        fireEvent.click(await screen.findByRole("button", { name: "Pause monitoring Server a" }));
        fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Pause monitoring" }));

        await waitFor(() => {
            const put = fetchMock.mock.calls.find(([, i]) => i?.method === "PUT");
            expect(put?.[0]).toBe("/api/servers/a");
            expect(JSON.parse(String(put?.[1]?.body))).toEqual({ disabled: true });
        });
    });
});
