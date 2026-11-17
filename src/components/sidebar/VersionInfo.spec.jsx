import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VersionInfo from "./VersionInfo";
import { renderWithProviders } from "../../test/utils";

const settingsApiMock = vi.hoisted(() => ({
    fetchServerStatus: vi.fn(),
}));

const authApiMock = vi.hoisted(() => ({
    logout: vi.fn(),
}));

vi.mock("../../utils/api/settingsApi", () => ({ settingsApi: settingsApiMock }));
vi.mock("../../utils/api/authApi", () => ({ authApi: authApiMock }));

afterEach(() => {
    cleanup();
    if (window.localStorage) {
        window.localStorage.removeItem("theme");
    }
});
beforeEach(() => {
    vi.clearAllMocks();
    settingsApiMock.fetchServerStatus.mockResolvedValue({
        llm: true,
        whisper: true,
        embedding: null,
    });
});

describe("VersionInfo", () => {
    it("renders the expanded browser version controls", async () => {
        renderWithProviders(<VersionInfo />);

        expect(screen.getByText("v2.5.2")).toBeInTheDocument();
        await waitFor(() =>
            expect(settingsApiMock.fetchServerStatus).toHaveBeenCalledTimes(1),
        );
    });

    it("renders the collapsed browser version controls", async () => {
        renderWithProviders(<VersionInfo isCollapsed />);

        expect(screen.queryByText("v2.5.2")).not.toBeInTheDocument();
        await waitFor(() =>
            expect(settingsApiMock.fetchServerStatus).toHaveBeenCalledTimes(1),
        );
    });

    it("records degraded service rather than treating it as connected", async () => {
        settingsApiMock.fetchServerStatus.mockResolvedValue({
            llm: true,
            whisper: false,
            embedding: null,
        });

        renderWithProviders(<VersionInfo />);

        await waitFor(() =>
            expect(settingsApiMock.fetchServerStatus).toHaveBeenCalledTimes(1),
        );
        expect(screen.getByText("v2.5.2")).toBeInTheDocument();
    });

    it("opens the changelog dialog from the version control", async () => {
        renderWithProviders(<VersionInfo />);

        fireEvent.click(screen.getByText("v2.5.2"));
        expect(await screen.findByText("GitHub")).toBeInTheDocument();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("renders real expanded controls with accessible names", async () => {
        renderWithProviders(<VersionInfo />);

        expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /switch to light mode/i }),
        ).toBeInTheDocument();
        expect(screen.getByRole("status")).toBeInTheDocument();
        await waitFor(() =>
            expect(settingsApiMock.fetchServerStatus).toHaveBeenCalledTimes(1),
        );
    });

    it("renders real collapsed controls with accessible names", async () => {
        renderWithProviders(<VersionInfo isCollapsed />);

        expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /switch to light mode/i }),
        ).toBeInTheDocument();
        await waitFor(() =>
            expect(settingsApiMock.fetchServerStatus).toHaveBeenCalledTimes(1),
        );
    });

    it("cycles light → dark → system from the expanded theme control", async () => {
        renderWithProviders(<VersionInfo />);

        const control = () => screen.getByRole("button", { name: /switch to/i });
        expect(control()).not.toHaveAttribute("aria-pressed");

        // Default preference is system; the first click pins light.
        fireEvent.click(control());
        await waitFor(() =>
            expect(document.documentElement.dataset.themePreference).toBe("light"),
        );

        fireEvent.click(
            screen.getByRole("button", { name: /switch to dark mode/i }),
        );
        await waitFor(() =>
            expect(document.documentElement.dataset.themePreference).toBe("dark"),
        );

        fireEvent.click(
            screen.getByRole("button", { name: /switch to system appearance/i }),
        );
        await waitFor(() =>
            expect(document.documentElement.dataset.themePreference).toBe("system"),
        );
        expect(
            screen.getByRole("button", { name: /switch to light mode/i }),
        ).toBeInTheDocument();
    });

    it("shows a tooltip naming the next theme stop on hover", async () => {
        const user = userEvent.setup();
        renderWithProviders(<VersionInfo />);

        await user.hover(
            screen.getByRole("button", { name: /switch to light mode/i }),
        );

        expect(
            await screen.findByText(
                /switch to light mode/i,
                {},
                { timeout: 3000 },
            ),
        ).toBeInTheDocument();
    });

    it("exposes the theme cycle control in the collapsed sidebar", () => {
        renderWithProviders(<VersionInfo isCollapsed />);

        expect(
            screen.getByRole("button", { name: /switch to light mode/i }),
        ).toBeInTheDocument();
    });
});
