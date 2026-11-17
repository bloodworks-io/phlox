import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import FormTemplatesPanel from "./FormTemplatesPanel";
import { renderWithProviders } from "../../test/utils";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { loadPdfDocument } from "../../utils/helpers/pdfVisionHelpers";
import { toaster } from "@/components/ui/toaster";
import { t } from "@/i18n";
import type { FieldType, FormField, FormTemplate } from "./types";

vi.mock("../../utils/api/pdfFormsApi", () => ({
    pdfFormsApi: { deleteTemplate: vi.fn(), fetchTemplatePdf: vi.fn() },
}));
vi.mock("../../utils/helpers/pdfVisionHelpers", () => ({
    loadPdfDocument: vi.fn(),
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

const templates: FormTemplate[] = [
    { id: "tpl-1", name: "Intake Form", page_count: 2, field_count: 5 },
    { id: "tpl-2", name: "Consent Form", page_count: 1, field_count: 0 },
];

const builderTemplate: FormTemplate = {
    ...templates[0],
    page_heights: [792, 792],
};

const builderFields: FormField[] = [
    {
        id: "f1",
        name: "Patient Name",
        field_type: "text",
        page_number: 1,
        x: 72,
        y: 640,
        width: 300,
        height: 18,
    },
    {
        id: "f2",
        name: "Visit Date",
        field_type: "date",
        page_number: 2,
        x: 72,
        y: 640,
        width: 150,
        height: 18,
    },
];

const fakePage = {
    getViewport: ({ scale }: { scale: number }) => ({
        width: 612 * scale,
        height: 792 * scale,
    }),
    render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
};

const fakeDoc = {
    numPages: 2,
    getPage: async () => fakePage,
};

const fakeCtx = () => {
    const noop = () => {};
    return {
        canvas: { width: 612, height: 792 },
        clearRect: noop,
        strokeRect: noop,
        fillRect: noop,
        fillText: noop,
        setLineDash: noop,
    };
};

let getContextSpy;

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

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pdfFormsApi.fetchTemplatePdf).mockResolvedValue(
        new ArrayBuffer(8),
    );
    vi.mocked(loadPdfDocument).mockResolvedValue(fakeDoc as never);
    getContextSpy = vi
        .spyOn(HTMLCanvasElement.prototype, "getContext")
        .mockReturnValue(fakeCtx() as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
    getContextSpy.mockRestore();
    cleanup();
});

const renderBuilder = (overrides: Partial<Parameters<typeof FormTemplatesPanel>[0]> = {}) =>
    renderWithProviders(
        <FormTemplatesPanel
            {...props({
                selectedTemplate: builderTemplate,
                fields: builderFields,
                ...overrides,
            })}
        />,
    );

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

    it("loads the selected template's PDF into the builder canvas", async () => {
        renderBuilder();

        await waitFor(() => {
            expect(pdfFormsApi.fetchTemplatePdf).toHaveBeenCalledWith("tpl-1");
            expect(loadPdfDocument).toHaveBeenCalledWith({
                data: expect.any(ArrayBuffer),
            });
        });
        expect(screen.getByText("1 / 2")).toBeInTheDocument();
    });

    it("saves the field definitions through the sidebar action", () => {
        const onSaveFields = vi.fn();
        renderBuilder({ onSaveFields });

        fireEvent.click(
            screen.getByRole("button", { name: t("forms.saveFields") as string }),
        );
        expect(onSaveFields).toHaveBeenCalledTimes(1);
    });

    it("enters drawing mode through the new-field control", () => {
        const onSetDrawingMode = vi.fn();
        renderBuilder({ onSetDrawingMode });

        expect(
            screen.queryByRole("combobox"),
        ).toBeNull();
        fireEvent.click(
            screen.getByRole("button", { name: t("forms.newField") as string }),
        );
        expect(onSetDrawingMode).toHaveBeenCalledWith(true);
    });

    it("drawing mode offers the field-type selector and a Done action", () => {
        const onSetDrawingMode = vi.fn();
        const onSetFieldType = vi.fn();
        renderBuilder({
            isDrawingMode: true,
            activeFieldType: "text",
            onSetDrawingMode,
            onSetFieldType,
        });

        expect(
            screen.getByText(t("forms.drawingMode") as string),
        ).toBeInTheDocument();
        fireEvent.change(screen.getByRole("combobox"), {
            target: { value: "checkbox" },
        });
        expect(onSetFieldType).toHaveBeenCalledWith("checkbox");

        expect(
            screen.queryByRole("button", { name: t("forms.newField") as string }),
        ).toBeNull();
        fireEvent.click(
            screen.getByRole("button", { name: t("forms.done") as string }),
        );
        expect(onSetDrawingMode).toHaveBeenCalledWith(false);
    });

    it("auto-detect is gated on vision capability", () => {
        renderBuilder({ visionCapable: false });
        expect(
            screen.queryByRole("button", { name: t("forms.autoDetect") as string }),
        ).toBeNull();

        const onAutoDetect = vi.fn();
        renderBuilder({ visionCapable: true, onAutoDetect });
        fireEvent.click(
            screen.getByRole("button", { name: t("forms.autoDetect") as string }),
        );
        expect(onAutoDetect).toHaveBeenCalledTimes(1);
    });

    it("lists every field with its page and deletes through the list", () => {
        const onDeleteField = vi.fn();
        const onSelectField = vi.fn();
        renderBuilder({ onDeleteField, onSelectField });

        expect(
            screen.getByText(t("forms.fieldsCount", { number: 2 }) as string),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", {
                name: t("forms.deleteFieldNamed", {
                    name: "Patient Name",
                }) as string,
            }),
        );
        expect(onDeleteField).toHaveBeenCalledWith("f1");
        expect(onSelectField).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText("Visit Date"));
        expect(onSelectField).toHaveBeenCalledWith("f2");
    });
});
