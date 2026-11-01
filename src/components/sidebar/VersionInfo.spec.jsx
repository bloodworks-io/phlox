import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
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

afterEach(cleanup);
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
        renderWithProviders(
            <VersionInfo colorMode="light" toggleColorMode={vi.fn()} />,
        );

        expect(screen.getByText("v2.5.2")).toBeInTheDocument();
        await waitFor(() =>
            expect(settingsApiMock.fetchServerStatus).toHaveBeenCalledTimes(1),
        );
    });

    it("renders the collapsed browser version controls", async () => {
        renderWithProviders(
            <VersionInfo
                isCollapsed
                colorMode="dark"
                toggleColorMode={vi.fn()}
            />,
        );

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

        renderWithProviders(
            <VersionInfo colorMode="light" toggleColorMode={vi.fn()} />,
        );

        await waitFor(() =>
            expect(settingsApiMock.fetchServerStatus).toHaveBeenCalledTimes(1),
        );
        expect(screen.getByText("v2.5.2")).toBeInTheDocument();
    });

    it("opens the changelog dialog from the version control", async () => {
        renderWithProviders(
            <VersionInfo colorMode="light" toggleColorMode={vi.fn()} />,
        );

        fireEvent.click(screen.getByText("v2.5.2"));
        expect(await screen.findByText("GitHub")).toBeInTheDocument();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
});
