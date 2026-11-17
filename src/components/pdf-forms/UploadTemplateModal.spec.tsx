import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import UploadTemplateModal from "./UploadTemplateModal";
import { renderWithProviders } from "../../test/utils";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { loadPdfDocument } from "../../utils/helpers/pdfVisionHelpers";
import { toaster } from "@/components/ui/toaster";

vi.mock("../../utils/api/pdfFormsApi", () => ({
    pdfFormsApi: { uploadTemplate: vi.fn() },
}));
vi.mock("../../utils/helpers/pdfVisionHelpers", () => ({
    loadPdfDocument: vi.fn(),
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

const template = {
    id: "created-template",
    name: "Referral",
};

const fileInput = () =>
    document.querySelector<HTMLInputElement>("input[type=file]");

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadPdfDocument).mockResolvedValue({
        numPages: 2,
        getPage: vi.fn().mockResolvedValue({
            getViewport: () => ({ height: 792 }),
        }),
    } as never);
    vi.mocked(pdfFormsApi.uploadTemplate).mockResolvedValue(template as never);
});

const openModal = (onCreated = vi.fn()) =>
    renderWithProviders(
        <UploadTemplateModal isOpen onClose={vi.fn()} onCreated={onCreated} />,
    );

describe("UploadTemplateModal", () => {
    it("disables upload until a file and template name exist", () => {
        openModal();

        expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    });

    it("rejects a non-PDF file", () => {
        openModal();
        fireEvent.change(fileInput(), {
            target: { files: [new File(["x"], "note.txt", { type: "text/plain" })] },
        });

        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "error" }),
        );
        expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    });

    it("auto-names the template from a valid PDF filename", () => {
        openModal();
        fireEvent.change(fileInput(), {
            target: {
                files: [new File(["pdf"], "referral-form.pdf", { type: "application/pdf" })],
            },
        });

        expect(screen.getByDisplayValue("referral-form")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled();
    });

    it("extracts page metadata and uploads the template", async () => {
        const onCreated = vi.fn();
        openModal(onCreated);
        const file = new File(["pdf"], "referral-form.pdf", {
            type: "application/pdf",
        });
        fireEvent.change(fileInput(), {
            target: { files: [file] },
        });
        fireEvent.click(screen.getByRole("button", { name: "Upload" }));

        await waitFor(() => expect(onCreated).toHaveBeenCalledWith(template));
        const formData = vi.mocked(pdfFormsApi.uploadTemplate).mock.calls[0][0];
        expect(formData.get("name")).toBe("referral-form");
        expect(formData.get("pdf")).toBe(file);
        expect(formData.get("page_count")).toBe("2");
        expect(formData.get("page_heights")).toBe("[792,792]");
        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "success" }),
        );
    });

    it("keeps the modal open and reports upload failure", async () => {
        vi.mocked(pdfFormsApi.uploadTemplate).mockRejectedValue(
            new Error("Storage unavailable"),
        );
        const onCreated = vi.fn();
        openModal(onCreated);
        fireEvent.change(fileInput(), {
            target: {
                files: [new File(["pdf"], "referral.pdf", { type: "application/pdf" })],
            },
        });
        fireEvent.click(screen.getByRole("button", { name: "Upload" }));

        await waitFor(() =>
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            ),
        );
        expect(onCreated).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
});
