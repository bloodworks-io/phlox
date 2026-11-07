import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import ReplacePdfModal from "./ReplacePdfModal";
import { renderWithProviders } from "../../test/utils";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { loadPdfDocument } from "../../utils/helpers/pdfVisionHelpers";
import { toaster } from "@/components/ui/toaster";
import type { FormTemplate } from "./types";

vi.mock("../../utils/api/pdfFormsApi", () => ({
    pdfFormsApi: { replaceTemplatePdf: vi.fn() },
}));
vi.mock("../../utils/helpers/pdfVisionHelpers", () => ({
    loadPdfDocument: vi.fn(),
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

const template = {
    id: "seed-form",
    name: "Referral",
    page_count: 1,
    page_heights: [792],
} as FormTemplate;

const fileInput = () =>
    document.querySelector<HTMLInputElement>("input[type=file]");

const mockPdf = (numPages: number, heights: number[]) =>
    vi.mocked(loadPdfDocument).mockResolvedValue({
        numPages,
        getPage: vi.fn().mockImplementation(async (pageNumber: number) => ({
            getViewport: () => ({ height: heights[pageNumber - 1] }),
        })),
    } as never);

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mockPdf(1, [792]);
});

const openModal = (onReplaced = vi.fn()) =>
    renderWithProviders(
        <ReplacePdfModal
            isOpen
            onClose={vi.fn()}
            template={template}
            onReplaced={onReplaced}
        />,
    );

const selectFile = () =>
    fireEvent.change(fileInput(), {
        target: {
            files: [
                new File(["pdf"], "replacement.pdf", {
                    type: "application/pdf",
                }),
            ],
        },
    });

describe("ReplacePdfModal", () => {
    it("disables replacement until a PDF is selected", () => {
        openModal();

        expect(screen.getByRole("button", { name: "Replace" })).toBeDisabled();
    });

    it("rejects a non-PDF file", () => {
        openModal();
        fireEvent.change(fileInput(), {
            target: {
                files: [new File(["x"], "replacement.txt", { type: "text/plain" })],
            },
        });

        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "error" }),
        );
        expect(screen.getByRole("button", { name: "Replace" })).toBeDisabled();
    });

    it("rejects a page-count mismatch before calling the API", async () => {
        mockPdf(2, [792, 792]);
        openModal();
        selectFile();
        fireEvent.click(screen.getByRole("button", { name: "Replace" }));

        await waitFor(() =>
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            ),
        );
        expect(pdfFormsApi.replaceTemplatePdf).not.toHaveBeenCalled();
    });

    it("rejects a page-height mismatch before calling the API", async () => {
        mockPdf(1, [612]);
        openModal();
        selectFile();
        fireEvent.click(screen.getByRole("button", { name: "Replace" }));

        await waitFor(() =>
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            ),
        );
        expect(pdfFormsApi.replaceTemplatePdf).not.toHaveBeenCalled();
    });

    it("replaces matching geometry and preserves fields", async () => {
        const onReplaced = vi.fn();
        const updated = { ...template, pdf_file_name: "replacement.pdf" };
        vi.mocked(pdfFormsApi.replaceTemplatePdf).mockResolvedValue(
            updated as never,
        );
        openModal(onReplaced);
        selectFile();
        fireEvent.click(screen.getByRole("button", { name: "Replace" }));

        await waitFor(() => expect(onReplaced).toHaveBeenCalledWith(updated));
        const formData = vi.mocked(pdfFormsApi.replaceTemplatePdf).mock
            .calls[0][1];
        expect(formData.get("page_count")).toBe("1");
        expect(formData.get("page_heights")).toBe("[792]");
        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "success" }),
        );
    });

    it("keeps the modal open when replacement fails", async () => {
        vi.mocked(pdfFormsApi.replaceTemplatePdf).mockRejectedValue(
            new Error("Storage unavailable"),
        );
        const onReplaced = vi.fn();
        openModal(onReplaced);
        selectFile();
        fireEvent.click(screen.getByRole("button", { name: "Replace" }));

        await waitFor(() =>
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            ),
        );
        expect(onReplaced).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
});
