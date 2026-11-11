import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import UserSettingsPanel from "./UserSettingsPanel";
import { renderWithProviders } from "../../test/utils";
import { isCompanionEnabled } from "../../utils/helpers/featureFlags";
import { isTauri } from "../../utils/helpers/apiConfig";

vi.mock("./TemplateSettingsPanel", () => ({
    default: () => <div>Note templates surface</div>,
}));
vi.mock("./LetterTemplatesPanel", () => ({
    default: () => <div>Letter templates surface</div>,
}));
vi.mock("./ChatSettingsPanel", () => ({
    default: () => <div>Quick chat surface</div>,
}));
vi.mock("./CompanionUserSettings", () => ({
    default: () => <div>Companion settings surface</div>,
}));
vi.mock("../../utils/helpers/featureFlags", () => ({
    isChatEnabled: vi.fn(() => true),
    isCompanionEnabled: vi.fn(() => true),
}));
vi.mock("../../utils/helpers/apiConfig", () => ({
    isTauri: vi.fn(() => false),
}));
vi.mock("../../utils/api/settingsApi", () => ({
    settingsApi: {
        fetchCapabilities: vi.fn(async () => ["en"]),
    },
}));
vi.mock("../../i18n", () => ({
    syncLanguage: vi.fn(),
}));

const setUserSettings = vi.fn();
const baseProps = {
    isCollapsed: false,
    setIsCollapsed: vi.fn(),
    userSettings: {
        name: "Dana Wells",
        specialty: "general practice",
        preferred_language: "en",
        default_template: "general",
        default_letter_template_id: "letter-1",
    },
    setUserSettings,
    specialties: ["general practice", "cardiology"],
    templates: [{ template_key: "general", template_name: "General practice" }],
    letterTemplates: [{ id: "letter-1", name: "Dictation" }],
    onDefaultTemplateChange: vi.fn(),
    config: {},
    handleConfigChange: vi.fn(),
};

const renderPanel = (overrides = {}) =>
    renderWithProviders(<UserSettingsPanel {...baseProps} {...overrides} />);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("UserSettingsPanel", () => {
    it("renders general user fields and the established tab family", async () => {
        renderPanel();

        expect(screen.getByDisplayValue("Dana Wells")).toBeInTheDocument();
        expect(
            screen.getByDisplayValue("General practice"),
        ).toBeInTheDocument();
        expect(screen.getByText(/user settings/i)).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /general/i })).toBeInTheDocument();
        expect(
            screen.getByRole("tab", { name: /note templates/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("tab", { name: /letter templates/i }),
        ).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /quick chat/i })).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.queryByText(/transcription does not support/i)).not.toBeInTheDocument(),
        );
    });

    it("updates the clinician name through the settings state callback", () => {
        renderPanel();

        fireEvent.change(screen.getByDisplayValue("Dana Wells"), {
            target: { value: "Dana Wells-Or" },
        });

        expect(setUserSettings).toHaveBeenCalledWith(expect.any(Function));
    });

    it("warns when the selected language is not supported by local transcription", async () => {
        const { settingsApi } = await import("../../utils/api/settingsApi");
        settingsApi.fetchCapabilities.mockResolvedValueOnce({
            stt_languages: ["en"],
        });

        renderPanel({
            userSettings: { ...baseProps.userSettings, preferred_language: "fr" },
        });

        await waitFor(() =>
            expect(
                screen.getByText(/doesn.t support/i),
            ).toBeInTheDocument(),
        );
    });

    it("changes the default note and letter template selections independently", () => {
        renderPanel();

        const selects = screen.getAllByRole("combobox");
        fireEvent.change(selects[2], { target: { value: "general" } });
        fireEvent.change(selects[3], { target: { value: "letter-1" } });

        expect(baseProps.onDefaultTemplateChange).toHaveBeenCalledWith("general");
        expect(setUserSettings).toHaveBeenCalledTimes(2);
    });

    it("mounts template, letter, and quick-chat surfaces through their tabs", () => {
        renderPanel();

        fireEvent.click(screen.getByRole("tab", { name: /note templates/i }));
        expect(screen.getByText("Note templates surface")).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("tab", { name: /letter templates/i }),
        );
        expect(screen.getByText("Letter templates surface")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("tab", { name: /quick chat/i }));
        expect(screen.getByText("Quick chat surface")).toBeInTheDocument();
    });

    it("keeps companion settings desktop-only in the browser build", () => {
        renderPanel();
        expect(
            screen.queryByRole("tab", { name: /companion/i }),
        ).not.toBeInTheDocument();
    });

    it("shows companion settings on desktop when the feature flag is on", () => {
        isTauri.mockReturnValue(true);
        renderPanel();
        expect(
            screen.getByRole("tab", { name: /companion/i }),
        ).toBeInTheDocument();
        isTauri.mockReturnValue(false);
    });

    it("hides companion settings when the companion flag is off, even on desktop", () => {
        isTauri.mockReturnValue(true);
        isCompanionEnabled.mockReturnValue(false);
        renderPanel();
        expect(
            screen.queryByRole("tab", { name: /companion/i }),
        ).not.toBeInTheDocument();
        isCompanionEnabled.mockReturnValue(true);
        isTauri.mockReturnValue(false);
    });
});
