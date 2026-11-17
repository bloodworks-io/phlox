import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanionUserSettings from "./CompanionUserSettings";
import { renderWithProviders } from "../../test/utils";

const mutateStatus = vi.fn(async () => undefined);
const api = vi.hoisted(() => ({
    startCompanionHost: vi.fn(async () => undefined),
    stopCompanionHost: vi.fn(async () => undefined),
}));

vi.mock("../../utils/api/companionApi", () => ({
    companionApi: {
        fetchStatus: vi.fn(),
    },
}));
vi.mock("../../utils/api/localModelApi", () => ({
    localModelApi: api,
}));
vi.mock("../companion/CompanionSessionList", () => ({
    default: () => <div>Companion sessions surface</div>,
}));
vi.mock("../../utils/helpers/apiConfig", () => ({
    isTauri: vi.fn(() => false),
}));
vi.mock("swr", () => ({
    default: vi.fn((_, fetcher) => {
        fetcher?.();
        return {
            data: {
                pairing_code: "AB1234",
                phone: { connected: true },
            },
            mutate: mutateStatus,
        };
    }),
}));

const handleConfigChange = vi.fn();
const renderSettings = (config = { COMPANION_ENABLED: true }) =>
    renderWithProviders(
        <CompanionUserSettings
            config={config}
            handleConfigChange={handleConfigChange}
        />,
    );

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("navigator", {
        clipboard: { writeText: vi.fn(async () => undefined) },
    });
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("CompanionUserSettings", () => {
    it("shows auto-import, pairing, and session controls while enabled", () => {
        renderSettings();

        expect(screen.getByText(/file uploads into the patient record/i)).toBeInTheDocument();
        expect(screen.getByText("AB••••")).toBeInTheDocument();
        expect(screen.getByText("Companion sessions surface")).toBeInTheDocument();
    });

    it("hides pairing and sessions while companion sync is disabled", () => {
        renderSettings({ COMPANION_ENABLED: false });

        expect(screen.getByText(/companion sync/i)).toBeInTheDocument();
        expect(screen.queryByText(/pairing code/i)).not.toBeInTheDocument();
        expect(
            screen.queryByText("Companion sessions surface"),
        ).not.toBeInTheDocument();
    });

    it("reveals and copies the pairing code", async () => {
        const user = userEvent.setup();
        renderSettings();

        await user.click(screen.getByRole("button", { name: /reveal/i }));
        expect(screen.getByText("AB1234")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /copy/i }));
        await waitFor(() => expect(screen.getByText(/copied/i)).toBeInTheDocument());
    });

    it("changes the sync and auto-import policy switches", async () => {
        const user = userEvent.setup();
        renderSettings();

        const controls = document.querySelectorAll(
            '[data-scope="switch"] [data-part="control"]',
        );
        await user.click(controls[0]);
        expect(handleConfigChange).toHaveBeenCalledWith(
            "COMPANION_ENABLED",
            false,
        );

        await user.click(controls[1]);
        expect(handleConfigChange).toHaveBeenCalledWith(
            "COMPANION_AUTO_IMPORT",
            false,
        );
    });

    it("does not start or stop the desktop companion host in browser builds", async () => {
        const user = userEvent.setup();
        renderSettings();

        const controls = document.querySelectorAll(
            '[data-scope="switch"] [data-part="control"]',
        );
        await user.click(controls[0]);

        expect(handleConfigChange).toHaveBeenCalled();
        expect(api.startCompanionHost).not.toHaveBeenCalled();
        expect(api.stopCompanionHost).not.toHaveBeenCalled();
    });
});
