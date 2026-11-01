import { describe, expect, it } from "vitest";
import {
    FOLIO_AVATAR_COLORS,
    getAvatarColor,
    getInitials,
} from "./SidebarHelpers";

describe("SidebarHelpers", () => {
    it("exposes the muted Folio avatar palette", () => {
        expect(FOLIO_AVATAR_COLORS).toEqual([
            "#7e746e",
            "#7d6a67",
            "#7f6778",
            "#6c5b79",
            "#7a4f4c",
            "#7b5957",
            "#7d5c46",
            "#796e52",
            "#5c724f",
            "#4c6e67",
            "#567274",
            "#4d6b74",
            "#51617c",
            "#65687e",
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
