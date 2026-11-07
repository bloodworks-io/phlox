import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSettingsPanel from "./AdminSettingsPanel";
import { renderWithProviders } from "../../test/utils";

vi.mock("./ToolsSettingsTab", () => ({
    default: () => <div>Tools surface</div>,
}));
vi.mock("./LocalModelManager", () => ({
    default: () => <div>Local models surface</div>,
}));
vi.mock("./WhisperTab", () => ({
    default: () => <div>Whisper surface</div>,
}));
vi.mock("./PromptEditorTab", () => ({
    default: () => <div>Prompt editor surface</div>,
}));
vi.mock("./LlmTab", () => ({
    default: () => <div>LLM surface</div>,
}));
vi.mock("./RagTab", () => ({
    default: () => <div>RAG settings surface</div>,
}));
vi.mock("./UsersTab", () => ({
    default: () => <div>Users surface</div>,
}));
vi.mock("../../utils/api/localModelApi", () => ({
    localModelApi: {
        checkLocalStatus: vi.fn(async () => ({ available: true })),
    },
}));
vi.mock("../../utils/helpers/apiConfig", () => ({
    isTauri: vi.fn(() => false),
    buildApiUrl: vi.fn(async () => "/api/config/local/status"),
}));
vi.mock("../../utils/helpers/apiHelpers", () => ({
    universalFetch: vi.fn(async () => ({
        ok: true,
        json: async () => ({ is_docker: false }),
    })),
}));
vi.mock("../../utils/helpers/featureFlags", () => ({
    isRagEnabled: vi.fn(() => true),
}));

const handleConfigChange = vi.fn();
const baseProps = {
    isCollapsed: false,
    setIsCollapsed: vi.fn(),
    config: { LLM_PROVIDER: "openai" },
    handleConfigChange,
    modelOptions: ["gpt-4o"],
    prompts: {
        chat: { system: "Chat prompt" },
        rag: { system: "RAG prompt" },
        summary: { system: "Summary prompt" },
    },
    handlePromptChange: vi.fn(),
    handlePromptReset: vi.fn(),
    letterTemperature: 0.4,
    onLetterTemperatureChange: vi.fn(),
    onOptionsReset: vi.fn(),
};

const renderPanel = (overrides = {}) =>
    renderWithProviders(<AdminSettingsPanel {...baseProps} {...overrides} />);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("AdminSettingsPanel", () => {
    it("renders the remote-admin tab family by default", async () => {
        renderPanel();

        expect(screen.getByText(/admin settings/i)).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /whisper/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /llm/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /chat/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /summary/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /rag/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /tools/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /policy/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /users/i })).toBeInTheDocument();
        await waitFor(() => screen.getByText("Whisper surface"));
    });

    it("switches remote model and prompt surfaces without losing the shell", () => {
        renderPanel();

        fireEvent.click(screen.getByRole("tab", { name: /^llm$/i }));
        expect(screen.getByText("LLM surface")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("tab", { name: /chat/i }));
        expect(screen.getAllByText("Prompt editor surface").length).toBeGreaterThan(
            0,
        );

        fireEvent.click(screen.getByRole("tab", { name: /rag/i }));
        expect(screen.getByText("RAG settings surface")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("tab", { name: /users/i }));
        expect(screen.getByText("Users surface")).toBeInTheDocument();
    });

    it("renders the local-inference tab family when local is selected", () => {
        renderPanel({ config: { LLM_PROVIDER: "local" } });

        expect(screen.getByRole("tab", { name: /models/i })).toBeInTheDocument();
        expect(screen.queryByRole("tab", { name: /whisper/i })).not.toBeInTheDocument();
        expect(screen.getByText("Local models surface")).toBeInTheDocument();
    });

    it("changes policy switches through the shared config callback", async () => {
        const user = userEvent.setup();
        renderPanel({ config: { LLM_PROVIDER: "openai" } });

        fireEvent.click(screen.getByRole("tab", { name: /policy/i }));
        await waitFor(() =>
            expect(screen.getByText(/store original pdfs/i)).toBeInTheDocument(),
        );

        const policyControl = document.querySelector(
            '[data-scope="switch"] [data-part="control"]',
        );
        await user.click(policyControl);
        expect(handleConfigChange).toHaveBeenCalledWith(
            "STORE_ORIGINAL_PDFS",
            true,
        );
    });

    it("collapses and expands through the accessible control", () => {
        renderPanel();

        fireEvent.click(
            screen.getByRole("button", { name: /toggle collapse/i }),
        );
        expect(baseProps.setIsCollapsed).toHaveBeenCalledWith(true);
    });
});
