import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Sidebar from "./Sidebar";
import { ApiToastProvider } from "../../utils/helpers/apiToastContext";
import { renderWithProviders, emotionStylesFor } from "../../test/utils";

const patientApiMock = vi.hoisted(() => ({
    fetchNoteList: vi.fn(),
    fetchIncompleteJobsCount: vi.fn(),
    deletePatient: vi.fn(),
}));
const settingsApiMock = vi.hoisted(() => ({ fetchServerStatus: vi.fn() }));
const authApiMock = vi.hoisted(() => ({ logout: vi.fn(), fetchMe: vi.fn() }));
const platformState = vi.hoisted(() => ({
    isTauri: vi.fn(() => false),
    isMacOS: vi.fn(() => false),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));
vi.mock("../../utils/api/patientApi", () => ({
    patientApi: patientApiMock,
}));
vi.mock("../../utils/api/settingsApi", () => ({
    settingsApi: settingsApiMock,
}));
vi.mock("../../utils/api/authApi", () => ({
    authApi: authApiMock,
}));
vi.mock("../../utils/helpers/apiConfig", () => ({
    isTauri: (...args) => platformState.isTauri(...args),
}));
vi.mock("../../utils/helpers/platform", () => ({
    isMacOS: (...args) => platformState.isMacOS(...args),
}));

const baseProps = {
    onNewPatient: vi.fn(),
    onSelectPatient: vi.fn(),
    selectedPatientId: 1,
    selectedDate: "2026-07-23",
    setSelectedDate: vi.fn(),
    handleNavigation: vi.fn(),
    isCollapsed: false,
    toggleSidebar: vi.fn(),
    isSmallScreen: false,
    colorMode: "light",
    toggleColorMode: vi.fn(),
    isAdmin: false,
    patientScope: "mine",
    setPatientScope: vi.fn(),
};

const renderSidebar = (overrides = {}) =>
    renderWithProviders(
        <MemoryRouter>
            <ApiToastProvider>
                <Sidebar {...baseProps} {...overrides} />
            </ApiToastProvider>
        </MemoryRouter>,
    );

const expectFlushSidebar = () => {
    const sidebar = screen.getByRole("navigation");
    const styles = emotionStylesFor(sidebar);
    expect(styles).toContain("height: 100dvh");
    expect(styles).toContain("margin-block: 0px");
    expect(styles).toContain("margin-inline: 0px");
    expect(styles).toContain("border-radius: 0px");
    expect(styles).toContain("box-shadow: none");
    expect(styles).toContain("background: var(--chakra-colors-folio-sidebar)");
};

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    platformState.isTauri.mockReturnValue(false);
    platformState.isMacOS.mockReturnValue(false);
    patientApiMock.fetchNoteList.mockResolvedValue([
        { id: 1, name: "Smith, John", ur_number: "UR00001" },
    ]);
    patientApiMock.fetchIncompleteJobsCount.mockResolvedValue({
        incomplete_jobs_count: 2,
    });
    patientApiMock.deletePatient.mockResolvedValue({ message: "deleted" });
    settingsApiMock.fetchServerStatus.mockResolvedValue({
        llm: true,
        whisper: true,
        embedding: null,
    });
});

describe("Sidebar Tauri geometry", () => {
    it("uses the web full-height treatment on macOS Tauri and keeps a drag region", async () => {
        platformState.isTauri.mockReturnValue(true);
        platformState.isMacOS.mockReturnValue(true);
        renderSidebar();

        expect(await screen.findByText("Smith, John")).toBeInTheDocument();
        expect(screen.getByRole("navigation")).toHaveStyle({
            width: "220px",
        });
        expectFlushSidebar();
        expect(
            document.querySelector("[data-tauri-drag-region]"),
        ).toBeInTheDocument();
    });

    it("uses the same full-height treatment on Windows and GNOME without a frontend drag region", async () => {
        platformState.isTauri.mockReturnValue(true);
        platformState.isMacOS.mockReturnValue(false);
        renderSidebar({ isCollapsed: true });

        expect(await screen.findByText("2")).toBeInTheDocument();
        expect(screen.getByRole("navigation")).toHaveStyle({
            width: "80px",
        });
        expectFlushSidebar();
        expect(
            document.querySelector("[data-tauri-drag-region]"),
        ).not.toBeInTheDocument();
    });

    it("keeps macOS traffic-light clearance for the small-screen close control", async () => {
        platformState.isTauri.mockReturnValue(true);
        platformState.isMacOS.mockReturnValue(true);
        renderSidebar({ isSmallScreen: true });

        expect(await screen.findByText("Smith, John")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Close sidebar" })).toHaveStyle({
            top: "44px",
        });
    });

    it("uses the web close-control position on non-macOS Tauri", async () => {
        platformState.isTauri.mockReturnValue(true);
        platformState.isMacOS.mockReturnValue(false);
        renderSidebar({ isSmallScreen: true });

        expect(await screen.findByText("Smith, John")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Close sidebar" })).toHaveStyle({
            top: "12px",
        });
    });
});
