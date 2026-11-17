import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import Rag from "./Rag";
import { renderWithProviders } from "../test/utils";
import { useRagDocuments } from "../utils/hooks/useRagDocuments";
import { usePdfForms } from "../utils/hooks/usePdfForms";
import { isRagEnabled, isPdfFormsEnabled } from "../utils/helpers/featureFlags";
import { t } from "@/i18n";

vi.mock("../utils/helpers/featureFlags", () => ({
    isRagEnabled: vi.fn(),
    isPdfFormsEnabled: vi.fn(),
}));
vi.mock("../utils/hooks/useRagDocuments", () => ({
    useRagDocuments: vi.fn(),
}));
vi.mock("../utils/hooks/usePdfForms", () => ({
    usePdfForms: vi.fn(),
}));
vi.mock("../components/rag/KnowledgeBasePanel", () => ({
    default: (props) => (
        <div
            data-testid="knowledge-base"
            data-collections={props.collections.map((c) => c.name).join(",")}
            data-loading={String(props.loading)}
        />
    ),
}));
vi.mock("../components/pdf-forms/FormTemplatesPanel", () => ({
    default: (props) => (
        <div
            data-testid="form-templates"
            data-selected={props.selectedTemplate?.id ?? "none"}
        />
    ),
}));
vi.mock("../components/common/ConfirmDialog", () => ({
    default: ({ isOpen, title, body, onConfirm, onClose }) =>
        isOpen ? (
            <div data-testid="confirm-dialog" data-open="true">
                <span>{title}</span>
                <p>{body}</p>
                <button onClick={onConfirm}>stub-confirm</button>
                <button onClick={onClose}>stub-close</button>
            </div>
        ) : (
            <div data-testid="confirm-dialog" data-open="false" />
        ),
}));
vi.mock("../components/pdf-forms/UploadTemplateModal", () => ({
    default: ({ isOpen }) => (
        <div data-testid="upload-modal" data-open={String(Boolean(isOpen))} />
    ),
}));
vi.mock("../components/pdf-forms/ReplacePdfModal", () => ({
    default: ({ isOpen, template }) => (
        <div
            data-testid="replace-modal"
            data-open={String(Boolean(isOpen))}
            data-template={template?.id ?? "none"}
        />
    ),
}));
vi.mock("../components/pdf-forms/FillFormModal", () => ({
    default: ({ isOpen, template }) => (
        <div
            data-testid="fill-modal"
            data-open={String(Boolean(isOpen))}
            data-template={template?.id ?? "none"}
        />
    ),
}));

const ragHookValue = (overrides = {}) => ({
    collections: [{ name: "influenza", files: [], loaded: false }],
    setCollections: vi.fn(),
    loading: false,
    itemToDelete: null,
    setItemToDelete: vi.fn(),
    handleDelete: vi.fn(),
    collapseExplorer: { isCollapsed: false, toggle: vi.fn() },
    collapseUploader: { isCollapsed: false, toggle: vi.fn() },
    ...overrides,
});

const formsHookValue = (overrides = {}) => ({
    templates: [],
    templatesLoading: false,
    selectedTemplate: null,
    fields: [],
    selectedField: null,
    selectedFieldId: null,
    saving: false,
    isDrawingMode: false,
    activeFieldType: "text",
    visionCapable: false,
    detecting: false,
    showUploadModal: false,
    showReplaceModal: false,
    showFillModal: false,
    setShowUploadModal: vi.fn(),
    setShowReplaceModal: vi.fn(),
    setShowFillModal: vi.fn(),
    setSelectedFieldId: vi.fn(),
    setIsDrawingMode: vi.fn(),
    setActiveFieldType: vi.fn(),
    setFields: vi.fn(),
    handleTemplateCreated: vi.fn(),
    handleTemplateSelected: vi.fn(),
    handleTemplateDeleted: vi.fn(),
    handlePdfReplaced: vi.fn(),
    handleOpenReplace: vi.fn(),
    handleSaveFields: vi.fn(),
    handleUpdateField: vi.fn(),
    handleDeleteField: vi.fn(),
    handleAutoDetectFields: vi.fn(),
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRagDocuments).mockReturnValue(ragHookValue());
    vi.mocked(usePdfForms).mockReturnValue(formsHookValue());
    vi.mocked(isRagEnabled).mockReturnValue(true);
    vi.mocked(isPdfFormsEnabled).mockReturnValue(true);
});

afterEach(cleanup);

// Tabs.Content may stay mounted with a hidden attribute or unmount
// entirely; both count as "not shown" for the flag matrix.
const isPanelShown = (testId) => {
    const el = screen.queryByTestId(testId);
    if (!el) return false;
    return (
        !el.hasAttribute("hidden") &&
        window.getComputedStyle(el).display !== "none"
    );
};

describe("Rag route flag matrix", () => {
    it("shows tabbed panels with the knowledge base first when both features are enabled", async () => {
        renderWithProviders(<Rag />);

        const knowledgeTab = screen.getByRole("tab", {
            name: t("page.rag.knowledgeBaseTab"),
        });
        const formsTab = screen.getByRole("tab", {
            name: t("page.rag.formTemplatesTab"),
        });
        expect(knowledgeTab).toHaveAttribute("aria-selected", "true");
        expect(formsTab).toHaveAttribute("aria-selected", "false");

        expect(isPanelShown("knowledge-base")).toBe(true);
        expect(screen.getByTestId("form-templates")).toBeInTheDocument();

        fireEvent.click(formsTab);
        await waitFor(() =>
            expect(formsTab).toHaveAttribute("aria-selected", "true"),
        );
        expect(knowledgeTab).toHaveAttribute("aria-selected", "false");
        expect(isPanelShown("form-templates")).toBe(true);
    });

    it("renders only the form templates panel without tabs when RAG is disabled", () => {
        vi.mocked(isRagEnabled).mockReturnValue(false);
        renderWithProviders(<Rag />);

        expect(screen.queryByRole("tablist")).toBeNull();
        expect(isPanelShown("form-templates")).toBe(true);
        expect(screen.queryByTestId("knowledge-base")).toBeNull();
        expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("renders only the knowledge base panel without tabs when forms are disabled", () => {
        vi.mocked(isPdfFormsEnabled).mockReturnValue(false);
        renderWithProviders(<Rag />);

        expect(screen.queryByRole("tablist")).toBeNull();
        expect(isPanelShown("knowledge-base")).toBe(true);
        expect(screen.queryByTestId("form-templates")).toBeNull();
        expect(screen.queryByTestId("upload-modal")).toBeNull();
        expect(screen.queryByTestId("replace-modal")).toBeNull();
        expect(screen.queryByTestId("fill-modal")).toBeNull();
    });

    it("renders no panels when both features are disabled", () => {
        vi.mocked(isRagEnabled).mockReturnValue(false);
        vi.mocked(isPdfFormsEnabled).mockReturnValue(false);
        renderWithProviders(<Rag />);

        expect(screen.getByText(t("page.rag.title"))).toBeInTheDocument();
        expect(screen.queryByTestId("knowledge-base")).toBeNull();
        expect(screen.queryByTestId("form-templates")).toBeNull();
        expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("forwards collection state to the knowledge base panel", () => {
        renderWithProviders(<Rag />);

        const panel = screen.getByTestId("knowledge-base");
        expect(panel).toHaveAttribute("data-collections", "influenza");
        expect(panel).toHaveAttribute("data-loading", "false");
    });

    it("forwards the selected template id to the form templates panel", () => {
        vi.mocked(usePdfForms).mockReturnValue(
            formsHookValue({ selectedTemplate: { id: "tpl-1" } }),
        );
        renderWithProviders(<Rag />);

        fireEvent.click(
            screen.getByRole("tab", {
                name: t("page.rag.formTemplatesTab"),
            }),
        );
        expect(screen.getByTestId("form-templates")).toHaveAttribute(
            "data-selected",
            "tpl-1",
        );
    });
});

describe("Rag route delete dialog", () => {
    it("confirms file deletion with the file wording and invokes handleDelete", () => {
        const handleDelete = vi.fn();
        const setItemToDelete = vi.fn();
        vi.mocked(useRagDocuments).mockReturnValue(
            ragHookValue({
                itemToDelete: {
                    type: "file",
                    name: "guide.pdf",
                    collection: "influenza",
                },
                handleDelete,
                setItemToDelete,
            }),
        );
        renderWithProviders(<Rag />);

        const dialog = screen.getByTestId("confirm-dialog");
        expect(dialog).toHaveAttribute("data-open", "true");
        expect(
            screen.getByText(t("page.rag.delete.titleFile")),
        ).toBeInTheDocument();
        expect(screen.getByText(/guide\.pdf/)).toBeInTheDocument();
        expect(
            screen.getByText(
                new RegExp(
                    t("page.rag.delete.fromCollection", {
                        collection: "influenza",
                    }),
                ),
            ),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByText("stub-confirm"));
        expect(handleDelete).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByText("stub-close"));
        expect(setItemToDelete).toHaveBeenCalledWith(null);
    });

    it("confirms collection deletion with the collection wording", () => {
        vi.mocked(useRagDocuments).mockReturnValue(
            ragHookValue({
                itemToDelete: {
                    type: "collection",
                    name: "influenza",
                    collection: null,
                },
            }),
        );
        renderWithProviders(<Rag />);

        expect(
            screen.getByText(t("page.rag.delete.titleCollection")),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/influenza/),
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/guide\.pdf/),
        ).toBeNull();
    });

    it("keeps the dialog closed while no delete target is pending", () => {
        renderWithProviders(<Rag />);

        expect(screen.getByTestId("confirm-dialog")).toHaveAttribute(
            "data-open",
            "false",
        );
    });
});

describe("Rag route direct PDF dialogs", () => {
    it("mounts the upload, replace, and fill modals for forms", () => {
        vi.mocked(usePdfForms).mockReturnValue(
            formsHookValue({ selectedTemplate: { id: "tpl-1" } }),
        );
        renderWithProviders(<Rag />);

        expect(screen.getByTestId("upload-modal")).toHaveAttribute(
            "data-open",
            "false",
        );
        expect(screen.getByTestId("replace-modal")).toHaveAttribute(
            "data-open",
            "false",
        );
        expect(screen.getByTestId("fill-modal")).toHaveAttribute(
            "data-open",
            "false",
        );
        expect(screen.getByTestId("replace-modal")).toHaveAttribute(
            "data-template",
            "tpl-1",
        );
        expect(screen.getByTestId("fill-modal")).toHaveAttribute(
            "data-template",
            "tpl-1",
        );
    });

    it("omits the replace and fill modals until a template is selected", () => {
        renderWithProviders(<Rag />);

        expect(screen.getByTestId("upload-modal")).toBeInTheDocument();
        expect(screen.queryByTestId("replace-modal")).toBeNull();
        expect(screen.queryByTestId("fill-modal")).toBeNull();
    });
});
