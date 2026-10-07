import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import FormTemplatesPanel from "./FormTemplatesPanel";
import { renderWithProviders } from "../../test/utils";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { toaster } from "@/components/ui/toaster";
import { t } from "@/i18n";
import type { FieldType, FormTemplate } from "./types";

vi.mock("../../utils/api/pdfFormsApi", () => ({
    pdfFormsApi: { deleteTemplate: vi.fn() },
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

const templates: FormTemplate[] = [
    { id: "tpl-1", name: "Intake Form", page_count: 2, field_count: 5 },
    { id: "tpl-2", name: "Consent Form", page_count: 1, field_count: 0 },
];

const props = (overrides: Partial<Parameters<typeof FormTemplatesPanel>[0]> = {}) => ({
    templates,
    templatesLoading: false,
    selectedTemplate: null,
    fields: [],
    selectedField: null,
    selectedFieldId: null,
    saving: false,
    isDrawingMode: false,
    activeFieldType: "text" as FieldType,
    visionCapable: false,
    detecting: false,
    onSetDrawingMode: vi.fn(),
    onSetFieldType: vi.fn(),
    onAutoDetect: vi.fn(),
    onOpenUpload: vi.fn(),
    onReplaceTemplate: vi.fn(),
    onSelectTemplate: vi.fn(),
    onDeleteTemplate: vi.fn(),
    onFieldsChange: vi.fn(),
    onSelectField: vi.fn(),
    onUpdateField: vi.fn(),
    onDeleteField: vi.fn(),
    onSaveFields: vi.fn(),
    ...overrides,
});

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("FormTemplatesPanel", () => {
    it("renders all template names in the sidebar", () => {
        renderWithProviders(<FormTemplatesPanel {...props()} />);
        expect(screen.getByText("Intake Form")).toBeInTheDocument();
        expect(screen.getByText("Consent Form")).toBeInTheDocument();
    });

    it("clicking a template selects it", () => {
        const onSelectTemplate = vi.fn();
        renderWithProviders(
            <FormTemplatesPanel {...props({ onSelectTemplate })} />,
        );
        fireEvent.click(screen.getByText("Intake Form"));
        expect(onSelectTemplate).toHaveBeenCalledWith("tpl-1");
    });

    it("delete calls the API, toasts, and reports the id", async () => {
        vi.mocked(pdfFormsApi.deleteTemplate).mockResolvedValue({});
        const onDeleteTemplate = vi.fn();
        renderWithProviders(
            <FormTemplatesPanel {...props({ onDeleteTemplate })} />,
        );
        const deleteButtons = screen.getAllByRole("button", {
            name: t("forms.deleteTemplate") as string,
        });
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(pdfFormsApi.deleteTemplate).toHaveBeenCalledWith("tpl-1");
            expect(onDeleteTemplate).toHaveBeenCalledWith("tpl-1");
        });
        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "success" }),
        );
    });

    it("failed delete shows an error toast and keeps the list", async () => {
        vi.mocked(pdfFormsApi.deleteTemplate).mockRejectedValue(
            new Error("boom"),
        );
        const onDeleteTemplate = vi.fn();
        renderWithProviders(
            <FormTemplatesPanel {...props({ onDeleteTemplate })} />,
        );
        fireEvent.click(
            screen.getAllByRole("button", {
                name: t("forms.deleteTemplate") as string,
            })[0],
        );

        await waitFor(() => {
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            );
        });
        expect(onDeleteTemplate).not.toHaveBeenCalled();
        expect(screen.getByText("Intake Form")).toBeInTheDocument();
    });

    it("replace button asks to replace that template", () => {
        const onReplaceTemplate = vi.fn();
        renderWithProviders(
            <FormTemplatesPanel {...props({ onReplaceTemplate })} />,
        );
        fireEvent.click(
            screen.getAllByRole("button", {
                name: t("forms.replacePdf") as string,
            })[0],
        );
        expect(onReplaceTemplate).toHaveBeenCalledWith(templates[0]);
    });

    it("shows the empty-state hint when no template is selected", () => {
        renderWithProviders(<FormTemplatesPanel {...props()} />);
        expect(
            screen.getByText(t("forms.selectTemplateHint") as string),
        ).toBeInTheDocument();
    });

    it("opens the upload modal via the New button", () => {
        const onOpenUpload = vi.fn();
        renderWithProviders(
            <FormTemplatesPanel {...props({ onOpenUpload })} />,
        );
        fireEvent.click(
            screen.getByRole("button", { name: t("forms.new") as string }),
        );
        expect(onOpenUpload).toHaveBeenCalledTimes(1);
    });

    it("loading state renders a spinner instead of the list", () => {
        renderWithProviders(
            <FormTemplatesPanel {...props({ templatesLoading: true })} />,
        );
        expect(screen.queryByText("Intake Form")).toBeNull();
    });
});
