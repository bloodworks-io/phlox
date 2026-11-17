import { describe, expect, it } from "vitest";
import {
    FOLIO_AVATAR_COLORS,
    getAvatarColor,
    getInitials,
} from "./SidebarHelpers";

describe("SidebarHelpers", () => {
    it("exposes the Folio avatar palette", () => {
        expect(FOLIO_AVATAR_COLORS).toEqual([
            "#745752",
            "#516552",
            "#6C6246",
            "#5A5464",
            "#4B6466",
            "#705D4C",
            "#7E6059",
            "#5A6F56",
            "#83734C",
            "#55726F",
            "#6C6476",
            "#504039",
            "#38483B",
            "#7E6752",
        ]);
    });

    it("assigns avatar colors deterministically", () => {
        expect(getAvatarColor("Smith, John")).toBe(
            getAvatarColor("Smith, John"),
        );
        expect(getAvatarColor("Johnson, Emily")).toBe(
            getAvatarColor("Johnson, Emily"),
        );
    });

    it("derives initials from both supported name formats", () => {
        expect(getInitials("Smith, John")).toBe("JS");
        expect(getInitials("John Smith")).toBe("JS");
        expect(getInitials("Madonna")).toBe("MA");
    });
});
