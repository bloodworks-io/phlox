import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import FormBuilder from "./FormBuilder";
import { renderWithProviders } from "../../test/utils";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { loadPdfDocument } from "../../utils/helpers/pdfVisionHelpers";
import { t } from "@/i18n";
import type { FormField, FormTemplate } from "./types";

vi.mock("../../utils/api/pdfFormsApi", () => ({
    pdfFormsApi: { fetchTemplatePdf: vi.fn() },
}));
vi.mock("../../utils/helpers/pdfVisionHelpers", () => ({
    loadPdfDocument: vi.fn(),
}));

const template: FormTemplate = {
    id: "tpl-1",
    name: "Intake",
    page_count: 3,
    page_heights: [792, 792, 792],
};

const existingField: FormField = {
    id: "f1",
    name: "Patient Name",
    field_type: "text",
    required: false,
    page_number: 1,
    x: 50,
    y: 400,
    width: 120,
    height: 18,
    font_size: 12,
};

const fakePage = {
    getViewport: ({ scale }) => ({
        width: 612 * scale,
        height: 792 * scale,
    }),
    render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
};
const fakeDoc = {
    numPages: 3,
    getPage: async () => fakePage,
};

const fakeCtx = () => {
    const noop = () => {};
    return {
        canvas: { width: 560, height: 725 },
        clearRect: noop,
        strokeRect: noop,
        fillRect: noop,
        fillText: noop,
        setLineDash: noop,
    };
};

let getContextSpy;

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pdfFormsApi.fetchTemplatePdf).mockResolvedValue(
        new ArrayBuffer(8),
    );
    vi.mocked(loadPdfDocument).mockResolvedValue(fakeDoc);
    getContextSpy = vi
        .spyOn(HTMLCanvasElement.prototype, "getContext")
        .mockReturnValue(
            fakeCtx() as unknown as CanvasRenderingContext2D,
        );
});

afterEach(() => {
    getContextSpy.mockRestore();
    cleanup();
});

const renderBuilder = (props = {}) =>
    renderWithProviders(
        <FormBuilder
            template={template}
            fields={[existingField]}
            onFieldsChange={() => {}}
            selectedFieldId={null}
            onSelectField={() => {}}
            onUpdateField={() => {}}
            currentPage={1}
            onCurrentPageChange={() => {}}
            {...props}
        />,
    );

const getOverlayCanvas = (container: HTMLElement) =>
    container.querySelectorAll("canvas")[1] as HTMLCanvasElement;

// renderPage runs async (fetch → render → set scale); wait until the
// overlay is sized AND the re-render has flushed the new renderScale into
// the event-handler closures.
const waitForRender = async (container: HTMLElement) => {
    await waitFor(() => {
        const overlay = getOverlayCanvas(container);
        expect(overlay.width).toBeGreaterThan(0);
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
};

describe("FormBuilder", () => {
    it("renders the page toolbar with prev/next and the page indicator", async () => {
        const onCurrentPageChange = vi.fn();
        const { container } = renderBuilder({ onCurrentPageChange });

        expect(screen.getByText("1 / 3")).toBeInTheDocument();
        const prev = screen.getByLabelText(t("forms.previousPage") as string);
        const next = screen.getByLabelText(t("forms.nextPage") as string);
        expect(prev).toBeDisabled();
        expect(next).not.toBeDisabled();

        fireEvent.click(next);
        expect(onCurrentPageChange).toHaveBeenCalledWith(2);

        expect(container.querySelectorAll("canvas")).toHaveLength(2);
    });

    it("loads the template PDF once on mount", async () => {
        renderBuilder();
        await waitFor(() => {
            expect(pdfFormsApi.fetchTemplatePdf).toHaveBeenCalledWith("tpl-1");
            expect(loadPdfDocument).toHaveBeenCalledWith({ data: expect.any(ArrayBuffer) });
        });
    });

    it("drawing a rectangle adds a field of the active type", async () => {
        const onFieldsChange = vi.fn();
        const onSelectField = vi.fn();
        const { container } = renderBuilder({
            isDrawing: true,
            activeFieldType: "date",
            onFieldsChange,
            onSelectField,
        });

        const overlay = getOverlayCanvas(container);
        fireEvent.mouseDown(overlay, { button: 0, clientX: 10, clientY: 10 });
        fireEvent.mouseUp(overlay, { clientX: 80, clientY: 50 });

        await waitFor(() => {
            expect(onFieldsChange).toHaveBeenCalledTimes(1);
        });
        const added = onFieldsChange.mock.calls[0][0];
        expect(added).toHaveLength(2);
        const newField = added[1];
        expect(newField.field_type).toBe("date");
        expect(newField.page_number).toBe(1);
        expect(newField.name).toBe("");
        expect(newField.width).toBeGreaterThan(0);
        expect(newField.height).toBeGreaterThan(0);
        expect(onSelectField).toHaveBeenCalledWith(newField.id);
    });

    it("tiny drawn rectangles are discarded", async () => {
        const onFieldsChange = vi.fn();
        const { container } = renderBuilder({
            isDrawing: true,
            onFieldsChange,
        });

        await waitForRender(container);
        const overlay = getOverlayCanvas(container);
        fireEvent.mouseDown(overlay, { button: 0, clientX: 10, clientY: 10 });
        fireEvent.mouseUp(overlay, { clientX: 14, clientY: 14 });

        expect(onFieldsChange).not.toHaveBeenCalled();
    });

    it("clicking an existing field selects it; clicking empty space clears", async () => {
        const onSelectField = vi.fn();
        const { container } = renderBuilder({ onSelectField });

        await waitForRender(container);
        const overlay = getOverlayCanvas(container);
        // Existing field: PDF x=50..170, y=400..418 → canvas ≈ 46..156 / 342..359
        fireEvent.mouseDown(overlay, {
            button: 0,
            clientX: 100,
            clientY: 350,
        });
        expect(onSelectField).toHaveBeenCalledWith("f1");

        fireEvent.mouseDown(overlay, { button: 0, clientX: 5, clientY: 5 });
        expect(onSelectField).toHaveBeenCalledWith(null);
    });
});
