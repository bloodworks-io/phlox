import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import {
    SessionStatusIcon,
    formatDuration,
    sessionDay,
    sessionDetails,
    sessionTime,
} from "./sessionUi";
import { renderWithProviders } from "../../test/utils";

afterEach(cleanup);

describe("companion session formatting helpers", () => {
    it("formats durations under a minute, minutes, and mixed hours", () => {
        expect(formatDuration("2026-10-27T09:00:00Z", "2026-10-27T09:00:20Z")).toBe(
            "under a minute",
        );
        expect(formatDuration("2026-10-27T09:00:00Z", "2026-10-27T09:12:00Z")).toBe(
            "12 min",
        );
        expect(formatDuration("2026-10-27T09:00:00Z", "2026-10-27T11:41:00Z")).toBe(
            "2 hr 41 min",
        );
        expect(formatDuration(null, "2026-10-27T11:41:00Z")).toBeNull();
    });

    it("uses the consultation start timestamp and locale-aware time", () => {
        const stamp = "2026-10-27T09:56:00";
        expect(sessionTime({ started_at: stamp })).toMatch(/9:56/);
        expect(sessionTime({ received_at: stamp })).toMatch(/9:56/);
        expect(sessionTime({})).toBeNull();
    });

    it("groups sessions by today, yesterday, and longer-form dates", () => {
        const t = (key) =>
            ({
                "settings.companion.today": "Today",
                "settings.companion.yesterday": "Yesterday",
            })[key];
        const now = new Date();
        const today = now.toISOString();
        const yesterdayDate = new Date(now);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = yesterdayDate.toISOString();

        expect(sessionDay({ started_at: today }, t)).toBe("Today");
        expect(sessionDay({ started_at: yesterday }, t)).toBe("Yesterday");
        expect(sessionDay({}, t)).toBe("");
    });

    it("joins the available time and duration details", () => {
        expect(
            sessionDetails(
                {
                    started_at: "2026-10-27T09:00:00",
                    ended_at: "2026-10-27T09:20:00",
                },
                vi.fn(),
            ),
        ).toMatch(/9:00 .* 20 min/);
    });

    it("renders processing, imported, received, and fallback status indicators", () => {
        const { container } = renderWithProviders(
            <>
                <SessionStatusIcon status="processing" />
                <SessionStatusIcon status="imported" />
                <SessionStatusIcon status="received" />
                <SessionStatusIcon status="unknown" />
            </>,
        );

        expect(container.querySelector(".chakra-spinner")).not.toBeNull();
        expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(3);
    });
});
