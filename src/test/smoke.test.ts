import { describe, it, expect } from "vitest";
import { formatTime } from "@/features/dashboard/utils/sessionUtils";

describe("Smoke Test", () => {
    it("should pass standard math checks", () => {
        expect(1 + 1).toBe(2);
    });

    it("should resolve aliases correctly", () => {
        // formatTime(65000) should be "1:05"
        const result = formatTime(65000);
        expect(result).toBe("1:05");
    });

    it("should support DOM assertions (jsdom)", () => {
        const element = document.createElement("div");
        element.textContent = "Hello";
        document.body.appendChild(element);
        expect(document.body).toHaveTextContent("Hello");
    });
});
