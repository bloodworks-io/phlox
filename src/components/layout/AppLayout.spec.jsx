import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import AppLayout from "./AppLayout";
import { renderWithProviders } from "../../test/utils";

const platformState = vi.hoisted(() => ({
    isTauri: vi.fn(() => false),
    isMacOS: vi.fn(() => false),
}));

vi.mock("../../utils/helpers/apiConfig", () => ({
    isTauri: (...args) => platformState.isTauri(...args),
}));
vi.mock("../../utils/helpers/platform", () => ({
    isMacOS: (...args) => platformState.isMacOS(...args),
}));
vi.mock("../sidebar/Sidebar", () => ({
    default: () => <nav data-testid="sidebar" />,
}));

const renderLayout = (props = {}) =>
    renderWithProviders(
        <MemoryRouter>
            <AppLayout
                isSmallScreen={false}
                isCollapsed={false}
                toggleSidebar={vi.fn()}
                sidebarProps={{}}
                {...props}
            >
                <div data-testid="route-content">Content</div>
            </AppLayout>
        </MemoryRouter>,
    );

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    platformState.isTauri.mockReturnValue(false);
    platformState.isMacOS.mockReturnValue(false);
});

describe("AppLayout full-height sidebar geometry", () => {
    it.each([
        [false, false, "220px"],
        [false, true, "80px"],
        [true, false, "0px"],
        [true, true, "0px"],
    ])(
        "uses one content-offset contract (small=%s, collapsed=%s)",
        (isSmallScreen, isCollapsed, expectedMargin) => {
            renderLayout({ isSmallScreen, isCollapsed });
            const shell = screen.getByTestId("sidebar").nextElementSibling;
            expect(shell).toHaveStyle({
                marginLeft: expectedMargin,
            });
        },
    );

    it("tracks the macOS drag boundary with the sidebar width", () => {
        platformState.isTauri.mockReturnValue(true);
        platformState.isMacOS.mockReturnValue(true);
        renderLayout({ isCollapsed: false });
        const dragRegion = document.querySelector("[data-tauri-drag-region]");
        expect(dragRegion).toBeInTheDocument();
        expect(dragRegion).toHaveStyle({ left: "220px" });
    });

    it("moves the macOS drag boundary when the sidebar collapses", () => {
        platformState.isTauri.mockReturnValue(true);
        platformState.isMacOS.mockReturnValue(true);
        renderLayout({ isCollapsed: true });
        const dragRegion = document.querySelector("[data-tauri-drag-region]");
        expect(dragRegion).toBeInTheDocument();
        expect(dragRegion).toHaveStyle({ left: "80px" });
    });

    it("keeps extra small-screen top padding only on macOS Tauri", () => {
        platformState.isTauri.mockReturnValue(true);
        platformState.isMacOS.mockReturnValue(true);
        renderLayout({ isSmallScreen: true });
        expect(screen.getByTestId("route-content").closest(".main-bg")).toHaveStyle({
            paddingTop: "50px",
        });
    });

    it("does not add a frontend drag strip on Windows or GNOME", () => {
        platformState.isTauri.mockReturnValue(true);
        platformState.isMacOS.mockReturnValue(false);
        renderLayout({ isSmallScreen: true });
        expect(
            document.querySelector("[data-tauri-drag-region]"),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("route-content").closest(".main-bg")).toHaveStyle({
            paddingTop: "0px",
        });
    });
});
