import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { usePdfForms } from "./usePdfForms";
import { pdfFormsApi } from "../api/pdfFormsApi";
import { chatApi } from "../api/chatApi";
import { loadPdfDocument } from "../helpers/pdfVisionHelpers";
import { toaster } from "@/components/ui/toaster";
import { renderWithProviders } from "../../test/utils";

vi.mock("../api/pdfFormsApi", () => ({
    pdfFormsApi: {
        fetchTemplates: vi.fn(),
        fetchTemplate: vi.fn(),
        fetchTemplatePdf: vi.fn(),
        saveFields: vi.fn(),
        detectFields: vi.fn(),
    },
}));
vi.mock("../api/chatApi", () => ({
    chatApi: { getCurrentVisionCapability: vi.fn() },
}));
vi.mock("../helpers/pdfVisionHelpers", () => ({
    loadPdfDocument: vi.fn(),
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

const templates = [
    { id: "tpl-1", name: "Intake", page_count: 2, page_heights: [792, 792] },
    { id: "tpl-2", name: "Consent", page_count: 1, page_heights: [792] },
];

const storedFields = [
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
];

function Harness() {
    const forms = usePdfForms();
    return (
        <div>
            <ul>
                {forms.templates.map((tmpl) => (
                    <li key={tmpl.id}>tpl:{tmpl.id}</li>
                ))}
            </ul>
            <output data-testid="loading">{String(forms.templatesLoading)}</output>
            <output data-testid="selected">
                {forms.selectedTemplate?.id ?? "none"}
            </output>
            <output data-testid="fields">
                {forms.fields
                    .map(
                        (f) =>
                            `${f.id}|${f.name}|${f.field_type}|${f.x}|${f.y}|${f.width}|${f.height}|${f.page_number}|${f.font_size}`,
                    )
                    .join(";")}
            </output>
            <output data-testid="selected-field">
                {forms.selectedField?.id ?? "none"}
            </output>
            <output data-testid="selected-field-id">
                {forms.selectedFieldId ?? "none"}
            </output>
            <output data-testid="vision">{String(forms.visionCapable)}</output>
            <output data-testid="detecting">{String(forms.detecting)}</output>
            <output data-testid="saving">{String(forms.saving)}</output>
            <output data-testid="upload-open">
                {String(forms.showUploadModal)}
            </output>
            <output data-testid="replace-open">
                {String(forms.showReplaceModal)}
            </output>
            <output data-testid="fill-open">{String(forms.showFillModal)}</output>
            <button onClick={() => forms.setShowUploadModal(true)}>
                open-upload
            </button>
            <button onClick={() => forms.setShowFillModal(true)}>open-fill</button>
            <button
                onClick={() =>
                    forms.handleTemplateCreated({
                        id: "tpl-new",
                        name: "Fresh",
                    })
                }
            >
                created
            </button>
            <button onClick={() => forms.handleTemplateSelected("tpl-1")}>
                select
            </button>
            <button onClick={() => forms.handleTemplateDeleted("tpl-1")}>
                delete-tpl
            </button>
            <button
                onClick={() =>
                    forms.handlePdfReplaced({
                        id: "tpl-1",
                        name: "Intake",
                        pdf_file_name: "replacement.pdf",
                        fields: [{ id: "r1", name: "Replaced", field_type: "text" }],
                    })
                }
            >
                replaced
            </button>
            <button onClick={() => forms.handleOpenReplace(templates[0])}>
                open-replace
            </button>
            <button onClick={forms.handleSaveFields}>save-fields</button>
            <button
                onClick={() =>
                    forms.handleUpdateField({
                        ...storedFields[0],
                        name: "Renamed",
                    })
                }
            >
                update-field
            </button>
            <button onClick={() => forms.handleDeleteField("f1")}>
                delete-field
            </button>
            <button onClick={forms.handleAutoDetectFields}>detect</button>
        </div>
    );
}

const renderHook = () => renderWithProviders(<Harness />);

// Loads templates and selects tpl-1 with its stored fields.
const ready = async () => {
    renderHook();
    await waitFor(() =>
        expect(screen.getByText("tpl:tpl-1")).toBeInTheDocument(),
    );
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "select" }));
    });
    await waitFor(() =>
        expect(screen.getByTestId("fields")).toHaveTextContent(/^f1\|/),
    );
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
let toDataUrlSpy;

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pdfFormsApi.fetchTemplates).mockResolvedValue(templates);
    vi.mocked(chatApi.getCurrentVisionCapability).mockResolvedValue({
        vision_capable: false,
    });
    vi.mocked(pdfFormsApi.fetchTemplate).mockResolvedValue({
        ...templates[0],
        fields: storedFields,
    });
    vi.mocked(pdfFormsApi.saveFields).mockResolvedValue(undefined);
    getContextSpy = vi
        .spyOn(HTMLCanvasElement.prototype, "getContext")
        .mockReturnValue(fakeCtx());
    toDataUrlSpy = vi
        .spyOn(HTMLCanvasElement.prototype, "toDataURL")
        .mockReturnValue("data:image/png;base64,mock");
});

afterEach(() => {
    getContextSpy.mockRestore();
    toDataUrlSpy.mockRestore();
    cleanup();
});

describe("usePdfForms templates", () => {
    it("fetches templates and vision capability on mount", async () => {
        await renderHook();

        expect(pdfFormsApi.fetchTemplates).toHaveBeenCalledTimes(1);
        await waitFor(() =>
            expect(screen.getByTestId("loading")).toHaveTextContent("false"),
        );
        expect(screen.getByText("tpl:tpl-1")).toBeInTheDocument();
        expect(screen.getByText("tpl:tpl-2")).toBeInTheDocument();
        expect(screen.getByTestId("vision")).toHaveTextContent("false");
        expect(chatApi.getCurrentVisionCapability).toHaveBeenCalledTimes(1);
    });

    it("reflects a vision-capable model", async () => {
        vi.mocked(chatApi.getCurrentVisionCapability).mockResolvedValue({
            vision_capable: true,
        });
        await renderHook();

        await waitFor(() =>
            expect(screen.getByTestId("vision")).toHaveTextContent("true"),
        );
    });

    it("toasts when the template list cannot load", async () => {
        vi.mocked(pdfFormsApi.fetchTemplates).mockRejectedValue(
            new Error("server gone"),
        );
        renderHook();

        await waitFor(() => {
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            );
        });
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
});

describe("usePdfForms template lifecycle", () => {
    it("prepends and selects a created template with cleared fields", async () => {
        await ready();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "created" }));
        });

        expect(screen.getByText("tpl:tpl-new")).toBeInTheDocument();
        expect(screen.getByTestId("selected")).toHaveTextContent("tpl-new");
        expect(screen.getByTestId("fields")).toHaveTextContent("");
    });

    it("loads a selected template's fields and clears the field selection", async () => {
        await ready();

        expect(screen.getByTestId("selected")).toHaveTextContent("tpl-1");
        expect(pdfFormsApi.fetchTemplate).toHaveBeenCalledWith("tpl-1");
        expect(screen.getByTestId("fields")).toHaveTextContent(
            "f1|Patient Name|text|72|640|300|18|1|",
        );
        expect(screen.getByTestId("selected-field-id")).toHaveTextContent("none");
    });

    it("toasts and keeps the selection when loading a template fails", async () => {
        vi.mocked(pdfFormsApi.fetchTemplate).mockRejectedValue(
            new Error("not found"),
        );
        renderHook();
        await waitFor(() =>
            expect(screen.getByText("tpl:tpl-1")).toBeInTheDocument(),
        );

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "select" }));
        });

        await waitFor(() => {
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            );
        });
        expect(screen.getByTestId("selected")).toHaveTextContent("none");
    });

    it("removes a deleted template and clears its open selection", async () => {
        await ready();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "delete-tpl" }));
        });

        expect(screen.queryByText("tpl:tpl-1")).toBeNull();
        expect(screen.getByText("tpl:tpl-2")).toBeInTheDocument();
        expect(screen.getByTestId("selected")).toHaveTextContent("none");
        expect(screen.getByTestId("fields")).toHaveTextContent("");
    });

    it("merges a replaced PDF and adopts its field definitions", async () => {
        await ready();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "replaced" }));
        });

        expect(screen.getByTestId("selected")).toHaveTextContent("tpl-1");
        expect(screen.getByTestId("fields")).toHaveTextContent(/^r1\|Replaced/);
    });

    it("opens the replace dialog for the targeted template", async () => {
        await ready();

        fireEvent.click(screen.getByRole("button", { name: "open-replace" }));

        expect(screen.getByTestId("replace-open")).toHaveTextContent("true");
        expect(screen.getByTestId("selected")).toHaveTextContent("tpl-1");
    });

    it("exposes upload and fill dialog switches", async () => {
        await ready();

        fireEvent.click(screen.getByRole("button", { name: "open-upload" }));
        expect(screen.getByTestId("upload-open")).toHaveTextContent("true");

        fireEvent.click(screen.getByRole("button", { name: "open-fill" }));
        expect(screen.getByTestId("fill-open")).toHaveTextContent("true");
    });
});

describe("usePdfForms field editing", () => {
    it("saves the current fields with the template id", async () => {
        await ready();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "save-fields" }));
        });

        await waitFor(() => {
            expect(pdfFormsApi.saveFields).toHaveBeenCalledWith(
                "tpl-1",
                storedFields,
            );
        });
        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "success" }),
        );
        expect(screen.getByTestId("saving")).toHaveTextContent("false");
    });

    it("toasts and stops saving when the field save fails", async () => {
        vi.mocked(pdfFormsApi.saveFields).mockRejectedValue(
            new Error("disk full"),
        );
        await ready();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "save-fields" }));
        });

        await waitFor(() => {
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            );
        });
        expect(screen.getByTestId("saving")).toHaveTextContent("false");
    });

    it("updates one field in place", async () => {
        await ready();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "update-field" }));
        });

        expect(screen.getByTestId("fields")).toHaveTextContent(
            "f1|Renamed|text|72|640|300|18|1|",
        );
    });

    it("deletes a field and clears its selection", async () => {
        await ready();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "delete-field" }));
        });

        expect(screen.getByTestId("fields")).toHaveTextContent("");
        expect(screen.getByTestId("selected-field-id")).toHaveTextContent("none");
    });
});

describe("usePdfForms auto-detect", () => {
    it("harvests AcroForm widget geometry without calling the vision model", async () => {
        vi.mocked(pdfFormsApi.fetchTemplatePdf).mockResolvedValue(
            new ArrayBuffer(8),
        );
        vi.mocked(loadPdfDocument).mockResolvedValue({
            numPages: 1,
            getPage: vi.fn().mockResolvedValue({
                getViewport: ({ scale }) => ({
                    width: 612 * scale,
                    height: 792 * scale,
                }),
                render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
                getAnnotations: vi.fn().mockResolvedValue([
                    {
                        subtype: "Widget",
                        rect: [72, 600, 372, 618],
                        fieldType: "Tx",
                        fieldName: "patient_name",
                    },
                    {
                        subtype: "Widget",
                        rect: [72, 560, 90, 578],
                        fieldType: "Btn",
                        fieldName: "checkbox 1",
                        alternativeText: "Urgent review",
                    },
                ]),
                getTextContent: vi.fn(() => {
                    throw new Error(
                        "text harvest must not run for named widgets",
                    );
                }),
            }),
        });
        await ready();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "detect" }));
        });

        await waitFor(() =>
            expect(screen.getByTestId("detecting")).toHaveTextContent("false"),
        );
        expect(pdfFormsApi.detectFields).not.toHaveBeenCalled();

        const fields = screen.getByTestId("fields").textContent.split(";");
        expect(fields).toHaveLength(2);
        const [text, checkbox] = fields;
        expect(text).toMatch(/^field_\d+_[a-z0-9]+\|patient_name\|text\|72\|600\|300\|18\|1\|12$/);
        expect(checkbox).toMatch(/\|Urgent review\|checkbox\|72\|560\|18\|18\|1\|12$/);
        expect(screen.getByTestId("selected-field-id")).toHaveTextContent(
            fields[0].split("|")[0],
        );

        const saved = vi.mocked(pdfFormsApi.saveFields).mock.calls[0][1];
        expect(saved).toHaveLength(2);
        expect(saved[0]).not.toHaveProperty("_id");
        expect(saved.map((f) => f.name)).toEqual([
            "patient_name",
            "Urgent review",
        ]);
        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "success" }),
        );
    });

    it("runs vision detection on widget-free pages and converts percentages to points", async () => {
        vi.mocked(pdfFormsApi.fetchTemplatePdf).mockResolvedValue(
            new ArrayBuffer(8),
        );
        vi.mocked(loadPdfDocument).mockResolvedValue({
            numPages: 1,
            getPage: vi.fn().mockResolvedValue({
                getViewport: ({ scale }) => ({
                    width: 612 * scale,
                    height: 792 * scale,
                }),
                render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
                getAnnotations: vi.fn().mockResolvedValue([]),
            }),
        });
        vi.mocked(pdfFormsApi.detectFields).mockResolvedValue({
            fields: [
                {
                    name: "Notes",
                    field_type: "garbage",
                    page_number: 1,
                    x_pct: 10,
                    y_pct: 20,
                    width_pct: 50,
                    height_pct: 5,
                },
            ],
        });
        await ready();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "detect" }));
        });

        await waitFor(() =>
            expect(screen.getByTestId("detecting")).toHaveTextContent("false"),
        );
        expect(pdfFormsApi.detectFields).toHaveBeenCalledTimes(1);
        const pages = vi.mocked(pdfFormsApi.detectFields).mock.calls[0][1];
        expect(pages).toHaveLength(1);
        expect(pages[0].page_number).toBe(1);
        expect(pages[0].data_url).toBe("data:image/png;base64,mock");

        const detected = screen
            .getByTestId("fields")
            .textContent.split("|");
        expect(detected[1]).toBe("Notes");
        expect(detected[2]).toBe("text");
        expect(Number(detected[3])).toBeCloseTo(61.2, 5);
        expect(Number(detected[4])).toBeCloseTo(594, 5);
        expect(Number(detected[5])).toBeCloseTo(306, 5);
        expect(Number(detected[6])).toBeCloseTo(39.6, 5);
        expect(detected[7]).toBe("1");
        expect(detected[8]).toBe("12");
        expect(pdfFormsApi.saveFields).toHaveBeenCalledTimes(1);
    });

    it("toasts and stops detecting when detection fails", async () => {
        vi.mocked(pdfFormsApi.fetchTemplatePdf).mockResolvedValue(
            new ArrayBuffer(8),
        );
        vi.mocked(loadPdfDocument).mockResolvedValue({
            numPages: 1,
            getPage: vi.fn().mockResolvedValue({
                getViewport: ({ scale }) => ({
                    width: 612 * scale,
                    height: 792 * scale,
                }),
                render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
                getAnnotations: vi.fn().mockResolvedValue([]),
            }),
        });
        vi.mocked(pdfFormsApi.detectFields).mockRejectedValue(
            new Error("vision unavailable"),
        );
        await ready();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "detect" }));
        });

        await waitFor(() => {
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            );
        });
        expect(screen.getByTestId("detecting")).toHaveTextContent("false");
        expect(screen.getByTestId("fields")).toHaveTextContent(/^f1\|/);
        expect(pdfFormsApi.saveFields).not.toHaveBeenCalled();
    });
});
