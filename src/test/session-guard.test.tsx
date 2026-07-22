import { cleanup, render, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionGuard, isGuardExempt } from "@/components/SessionGuard";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => "/") }));
vi.mock("next/navigation", () => ({ usePathname: pathnameMock }));

const replaceMock = vi.fn();

const stubFetch = (status: number) => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
            ok: status < 400,
            status,
            json: async () => (status < 400 ? { user: { username: "elias" } } : { error: "Unauthorized" }),
        })),
    );
};

const renderGuard = () =>
    render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <SessionGuard />
        </SWRConfig>,
    );

describe("SessionGuard", () => {
    beforeEach(() => {
        // jsdom's location is non-navigable — replace it wholesale.
        Object.defineProperty(window, "location", {
            value: { replace: replaceMock, search: "", pathname: "/" },
            writable: true,
        });
        replaceMock.mockClear();
        pathnameMock.mockReturnValue("/");
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it("redirects to /login on 401 from a protected page", async () => {
        stubFetch(401);
        renderGuard();
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
        expect(replaceMock).toHaveBeenCalledTimes(1);
    });

    it("does nothing when the session is valid", async () => {
        stubFetch(200);
        renderGuard();
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(replaceMock).not.toHaveBeenCalled();
    });

    it("does nothing on exempt pages even when unauthenticated", async () => {
        pathnameMock.mockReturnValue("/login");
        stubFetch(401);
        renderGuard();
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(replaceMock).not.toHaveBeenCalled();
    });
});

describe("isGuardExempt", () => {
    it("exempts login, setup and invite flows", () => {
        expect(isGuardExempt("/login")).toBe(true);
        expect(isGuardExempt("/setup")).toBe(true);
        expect(isGuardExempt("/invite/continue")).toBe(true);
    });

    it("guards app pages", () => {
        expect(isGuardExempt("/")).toBe(false);
        expect(isGuardExempt("/settings")).toBe(false);
        expect(isGuardExempt("/history")).toBe(false);
    });
});
