import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { useAppBootstrap } from "./useAppBootstrap";
import { renderWithProviders } from "../../test/utils";
import { isTauri } from "../../utils/helpers/apiConfig";

const encryptionApiMock = vi.hoisted(() => ({
    getStatus: vi.fn(),
}));

const settingsApiMock = vi.hoisted(() => ({
    fetchUserSettings: vi.fn(),
}));

const localModelApiMock = vi.hoisted(() => ({
    fetchEmbeddingStatus: vi.fn(),
}));

const invokeMock = vi.hoisted(() => vi.fn());
const toasterMock = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("../api/encryptionApi", () => ({
    encryptionApi: encryptionApiMock,
}));
vi.mock("../api/settingsApi", () => ({
    settingsApi: settingsApiMock,
}));
vi.mock("../api/localModelApi", () => ({
    localModelApi: localModelApiMock,
}));
vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: toasterMock,
}));
vi.mock("../helpers/featureFlags", () => ({
    isForceSplashEnabled: vi.fn(() => false),
    setEmbeddingReady: vi.fn(),
}));

vi.mock("../../components/setup/EncryptionSetup", () => ({
    default: ({ onComplete }) => (
        <button type="button" onClick={onComplete}>
            setup-complete
        </button>
    ),
}));
vi.mock("../../components/setup/EncryptionUnlock", () => ({
    default: ({ onComplete }) => (
        <button type="button" onClick={onComplete}>
            unlock-complete
        </button>
    ),
}));
vi.mock("../../components/setup/ServerStartupLoader", () => ({
    default: ({ onReady, onError }) => (
        <div>
            <button type="button" onClick={onReady}>
                server-ready
            </button>
            <button type="button" onClick={() => onError(new Error("startup failed"))}>
                server-error
            </button>
        </div>
    ),
}));
vi.mock("../../components/common/SplashScreen", () => ({
    default: ({ onComplete }) => (
        <button type="button" onClick={onComplete}>
            splash-complete
        </button>
    ),
}));

vi.mock("../../utils/helpers/apiConfig", () => ({
    isTauri: vi.fn(),
}));

const BootstrapHarness = () => {
    const { gate, isInitializing } = useAppBootstrap();
    return (
        <>
            <div data-testid="initializing">{String(isInitializing)}</div>
            <div data-testid="gate">{gate}</div>
        </>
    );
};

const renderBootstrap = () => renderWithProviders(<BootstrapHarness />);

describe("useAppBootstrap", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        invokeMock.mockResolvedValue(undefined);
        settingsApiMock.fetchUserSettings.mockResolvedValue({
            has_completed_splash_screen: true,
        });
        localModelApiMock.fetchEmbeddingStatus.mockResolvedValue({
            downloaded: true,
        });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it("routes a first-run desktop session to encryption setup", async () => {
        vi.mocked(isTauri).mockReturnValue(true);
        encryptionApiMock.getStatus.mockResolvedValue({
            has_setup: false,
            has_database: false,
            has_keychain: false,
        });

        renderBootstrap();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(
            screen.getByRole("button", { name: "setup-complete" }),
        ).toBeInTheDocument();
        expect(screen.getByTestId("initializing")).toHaveTextContent("true");
    });

    it("routes an existing encrypted desktop session to unlock", async () => {
        vi.mocked(isTauri).mockReturnValue(true);
        encryptionApiMock.getStatus.mockResolvedValue({
            has_setup: true,
            has_database: true,
            has_keychain: false,
        });

        renderBootstrap();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(
            screen.getByRole("button", { name: "unlock-complete" }),
        ).toBeInTheDocument();
        expect(invokeMock).toHaveBeenCalledWith("start_server_command");
    });

    it("returns to unlock and raises a toast when server startup fails", async () => {
        vi.mocked(isTauri).mockReturnValue(true);
        encryptionApiMock.getStatus.mockResolvedValue({
            has_setup: true,
            has_database: true,
            has_keychain: false,
        });

        renderBootstrap();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "unlock-complete" }));
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(
            screen.getByRole("button", { name: "server-error" }),
        ).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "server-error" }));
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(
            screen.getByRole("button", { name: "unlock-complete" }),
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "server-error" })).not.toBeInTheDocument();
        expect(toasterMock.create).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "error",
            }),
        );
    });

    it("finishes initialization after server readiness, settings, and grace period", async () => {
        vi.mocked(isTauri).mockReturnValue(true);
        encryptionApiMock.getStatus.mockResolvedValue({
            has_setup: true,
            has_database: true,
            has_keychain: false,
        });

        renderBootstrap();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "unlock-complete" }));
            await vi.advanceTimersByTimeAsync(0);
        });

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "server-ready" }));
            await vi.advanceTimersByTimeAsync(2_000);
        });

        expect(settingsApiMock.fetchUserSettings).toHaveBeenCalled();
        expect(localModelApiMock.fetchEmbeddingStatus).toHaveBeenCalled();
        expect(screen.getByTestId("initializing")).toHaveTextContent("false");
        expect(screen.getByTestId("gate")).toBeEmptyDOMElement();
    });

    it("checks splash status directly in browser sessions", async () => {
        vi.mocked(isTauri).mockReturnValue(false);

        renderBootstrap();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(encryptionApiMock.getStatus).not.toHaveBeenCalled();
        expect(settingsApiMock.fetchUserSettings).toHaveBeenCalled();
        expect(screen.getByTestId("initializing")).toHaveTextContent("false");
        expect(screen.getByTestId("gate")).toBeEmptyDOMElement();
    });
});
