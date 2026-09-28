import { describe, it, expect } from "vitest";
import { parser } from "@/lib/plex/plex-client";
import { parseResources } from "@/lib/server-resources";

// Shape captured from a real PMS /statistics/resources?timespan=6 response.
const XML = `<MediaContainer size="2">
<StatisticsResources timespan="6" at="1790631212" hostCpuUtilization="3.645" processCpuUtilization="1.338" hostMemoryUtilization="49.577" processMemoryUtilization="2.449" />
<StatisticsResources timespan="6" at="1790631217" hostCpuUtilization="22.6" processCpuUtilization="1.807" hostMemoryUtilization="41.306" processMemoryUtilization="2.448" />
</MediaContainer>`;

describe("parseResources", () => {
    it("keeps the newest sample, rounded to whole percent", () => {
        expect(parseResources("srv", parser.parse(XML))).toEqual({
            serverId: "srv",
            hostCpu: 23,
            processCpu: 2,
            hostMemory: 41,
            processMemory: 2,
            at: 1790631217000,
        });
    });

    it("returns nulls when Plex sent nothing usable", () => {
        expect(parseResources("srv", null)).toMatchObject({ hostCpu: null, hostMemory: null, at: null });
        expect(parseResources("srv", parser.parse("<MediaContainer size=\"0\" />")).hostCpu).toBeNull();
    });
});
