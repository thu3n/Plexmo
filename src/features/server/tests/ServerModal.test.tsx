import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/components/LanguageContext";
import { FeedbackProvider } from "@/components/ui/Feedback";
import { ServerModal } from "../components/settings/ServerModal";
import type { PublicServer } from "@/lib/servers";

const saved: PublicServer = {
    id: "srv-1",
    name: "Basement",
    baseUrl: "http://plex.local:32400",
    createdAt: "",
    updatedAt: "",
    hasToken: true,
    maskedToken: "abcd…yz",
    color: null,
};

const stubFetch = () => {
    const fn = vi.fn(async () => new Response(JSON.stringify({ success: true, message: "Connected to Basement" }), { status: 200 }));
    vi.stubGlobal("fetch", fn);
    return fn;
};

const renderModal = (onSaved = vi.fn()) =>
    render(
        <LanguageProvider>
            <FeedbackProvider>
                <ServerModal server={saved} onClose={vi.fn()} onSaved={onSaved} />
            </FeedbackProvider>
        </LanguageProvider>
    );

const lastBody = (fn: ReturnType<typeof stubFetch>) => {
    const calls = fn.mock.calls as unknown as [string, RequestInit][];
    return JSON.parse(String(calls[calls.length - 1][1].body));
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("ServerModal (edit)", () => {
    it("tests an unchanged server by serverId instead of sending the masked token", async () => {
        const fetchMock = stubFetch();
        renderModal();

        fireEvent.click(screen.getByRole("button", { name: "Test Connection" }));
        expect(await screen.findByText("Connected to Basement")).toBeInTheDocument();
        expect(lastBody(fetchMock)).toEqual({ baseUrl: "http://plex.local:32400", serverId: "srv-1" });
    });

    it("sends a newly typed token", async () => {
        const fetchMock = stubFetch();
        renderModal();

        fireEvent.change(screen.getByLabelText("Token"), { target: { value: "new-token" } });
        fireEvent.click(screen.getByRole("button", { name: "Test Connection" }));
        await waitFor(() => expect(lastBody(fetchMock)).toMatchObject({ token: "new-token", serverId: "srv-1" }));
    });

    it("saves without the masked token and with the picked color", async () => {
        const fetchMock = stubFetch();
        const onSaved = vi.fn();
        renderModal(onSaved);

        fireEvent.click(screen.getByRole("button", { name: "Color #34D399" }));
        fireEvent.click(screen.getByRole("button", { name: "Save Server" }));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        const body = lastBody(fetchMock);
        expect(body).not.toHaveProperty("token");
        expect(body).toMatchObject({ name: "Basement", color: "#34D399" });
    });
});
