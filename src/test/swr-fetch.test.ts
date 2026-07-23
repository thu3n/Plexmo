// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJsonOrThrow } from "@/lib/swr-fetch";

const stubFetch = (status: number, body: unknown) => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
            ok: status < 400,
            status,
            json: async () => body,
        })),
    );
};

afterEach(() => vi.unstubAllGlobals());

describe("fetchJsonOrThrow", () => {
    it("returns parsed JSON on success", async () => {
        stubFetch(200, { history: [], activeSessions: [] });
        await expect(fetchJsonOrThrow("/api/history")).resolves.toEqual({
            history: [],
            activeSessions: [],
        });
    });

    it("throws the API error message instead of returning the error body as data", async () => {
        // The exact fresh-install crash: a 401 body used to reach the component
        // as SWR data, and spreading data.activeSessions threw.
        stubFetch(401, { error: "Unauthorized" });
        await expect(fetchJsonOrThrow("/api/history")).rejects.toThrow("Unauthorized");
    });

    it("falls back to a status-based message when the error body is not JSON", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                ok: false,
                status: 502,
                json: async () => {
                    throw new Error("not json");
                },
            })),
        );
        await expect(fetchJsonOrThrow("/x")).rejects.toThrow("Request failed (502)");
    });
});
