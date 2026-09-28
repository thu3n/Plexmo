import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { FeedbackProvider } from "@/components/ui/Feedback";
import RuleModal from "../components/settings/RuleModal";
import { getDefaultSettings, RULE_TYPE } from "@/features/rules/constants";
import type { RuleInstance } from "@/features/rules/types";

const newRule = (overrides: Partial<RuleInstance> = {}): RuleInstance => ({
    type: RULE_TYPE.MAX_CONCURRENT,
    name: "",
    enabled: true,
    settings: getDefaultSettings(RULE_TYPE.MAX_CONCURRENT),
    discordWebhookId: null,
    discordWebhookIds: [],
    ...overrides,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Assignment lists and webhooks load empty; analysis reports no impact. */
const stubFetch = () => {
    const fn = vi.fn(async (url: string) => {
        if (url.includes("/webhooks")) return json({ webhooks: [] });
        if (url.includes("/analyze")) return json({ impactedUsers: [] });
        return json([]);
    });
    vi.stubGlobal("fetch", fn);
    return fn;
};

const renderModal = (rule: RuleInstance, onSave = vi.fn(async () => {})) =>
    render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <FeedbackProvider>
                <RuleModal target={{ rule }} onClose={vi.fn()} onSave={onSave} />
            </FeedbackProvider>
        </SWRConfig>
    );

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("RuleModal validation", () => {
    it("jumps back to Configuration and flags an empty name instead of silently doing nothing", async () => {
        stubFetch();
        const onSave = vi.fn(async () => {});
        renderModal(newRule(), onSave);

        fireEvent.click(screen.getByRole("tab", { name: "Notifications" }));
        fireEvent.click(screen.getByRole("button", { name: "Create Rule" }));

        expect(await screen.findByText("Rule name is required.")).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /Configuration/ })).toHaveAttribute("aria-selected", "true");
        await waitFor(() => expect(screen.getByLabelText("Rule Name")).toHaveFocus());
        expect(onSave).not.toHaveBeenCalled();
    });

    it("lets the limit be cleared and rejects it rather than coercing to 1", async () => {
        stubFetch();
        const onSave = vi.fn(async () => {});
        renderModal(newRule({ name: "Family" }), onSave);

        const limit = screen.getByLabelText("Stream Limit");
        fireEvent.change(limit, { target: { value: "" } });
        expect(limit).toHaveValue(null);

        fireEvent.click(screen.getByRole("button", { name: "Create Rule" }));
        expect(await screen.findByText(/Must be between|Enter a whole number/)).toBeInTheDocument();
        expect(onSave).not.toHaveBeenCalled();
    });

    it("keeps the modal open and toasts when saving fails", async () => {
        stubFetch();
        const onSave = vi.fn(async () => {
            throw new Error("Rule name is too long");
        });
        renderModal(newRule({ name: "Family" }), onSave);

        fireEvent.click(screen.getByRole("button", { name: "Create Rule" }));
        // Global scope asks for confirmation first.
        fireEvent.click(await screen.findByRole("button", { name: "Confirm Save" }));

        expect(await screen.findByText("Rule name is too long")).toBeInTheDocument();
        expect(screen.getByLabelText("Rule Name")).toHaveValue("Family");
    });
});
