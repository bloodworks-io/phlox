import { describe, expect, it } from "vitest";
import { SIDEBAR, sidebarWidth } from "./dimensions";

describe("sidebar dimensions", () => {
    it("keeps one full-height width contract for web and every Tauri platform", () => {
        expect(SIDEBAR.width).toBe("220px");
        expect(SIDEBAR.collapsedWidth).toBe("80px");
        expect(sidebarWidth(false)).toBe("220px");
        expect(sidebarWidth(true)).toBe("80px");
        expect(SIDEBAR).not.toHaveProperty("tauriOffset");
        expect(SIDEBAR).not.toHaveProperty("tauriCollapsedOffset");
    });
});
