import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import FormFillArtifact, {
    downloadFormFillArtifact,
} from "./FormFillArtifact";
import { renderWithProviders } from "../../test/utils";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { fillPdf } from "../../utils/pdf/fillForm";
import { toaster } from "@/components/ui/toaster";
import { t } from "@/i18n";

vi.mock("../../utils/api/pdfFormsApi", () => ({
    pdfFormsApi: {
        fetchTemplate: vi.fn(),
        fetchTemplatePdf: vi.fn(),
    },
}));
vi.mock("../../utils/pdf/fillForm", () => ({
    fillPdf: vi.fn(),
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

const artifact = {
    template_id: "tpl-1",
    template_name: "Intake Form",
    field_values: { "Patient Name": "Ada" },
};

const mockFetchTemplate = () => vi.mocked(pdfFormsApi.fetchTemplate);
const mockFetchTemplatePdf = () => vi.mocked(pdfFormsApi.fetchTemplatePdf);
const mockFillPdf = () => vi.mocked(fillPdf);

let clickSpy;
let createObjectURL;
let revokeObjectURL;

beforeEach(() => {
    vi.clearAllMocks();
    createObjectURL = vi.fn(() => "blob:mock-url");
    revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});
});

afterEach(() => {
    clickSpy.mockRestore();
    cleanup();
});

describe("downloadFormFillArtifact", () => {
    it("fetches the template, fills the PDF and triggers a download", async () => {
        const template = { id: "tpl-1", fields: [] };
        mockFetchTemplate().mockResolvedValue(template);
        mockFetchTemplatePdf().mockResolvedValue(new ArrayBuffer(8));
        mockFillPdf().mockResolvedValue(new Uint8Array([1, 2, 3]));

        await downloadFormFillArtifact(artifact);

        expect(pdfFormsApi.fetchTemplate).toHaveBeenCalledWith("tpl-1");
        expect(pdfFormsApi.fetchTemplatePdf).toHaveBeenCalledWith("tpl-1");
        expect(fillPdf).toHaveBeenCalledWith(
            expect.any(Uint8Array),
            template,
            { "Patient Name": "Ada" },
        );
        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("falls back to 'form' when the artifact has no template name", async () => {
        mockFetchTemplate().mockResolvedValue({ id: "tpl-1" });
        mockFetchTemplatePdf().mockResolvedValue(new ArrayBuffer(8));
        mockFillPdf().mockResolvedValue(new Uint8Array([1]));

        await downloadFormFillArtifact({
            template_id: "tpl-1",
            field_values: {},
        });

        const anchor = clickSpy.mock.instances[0];
        expect(anchor.download).toBe("form_filled.pdf");
    });

    it("shows an error toast and does not download when filling fails", async () => {
        mockFetchTemplate().mockResolvedValue({ id: "tpl-1" });
        mockFetchTemplatePdf().mockResolvedValue(new ArrayBuffer(8));
        mockFillPdf().mockRejectedValue(new Error("boom"));

        await downloadFormFillArtifact(artifact);

        expect(clickSpy).not.toHaveBeenCalled();
        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "error" }),
        );
    });
});

describe("FormFillArtifact", () => {
    it("renders the filled-PDF filename and downloads on click", async () => {
        mockFetchTemplate().mockResolvedValue({ id: "tpl-1" });
        mockFetchTemplatePdf().mockResolvedValue(new ArrayBuffer(8));
        mockFillPdf().mockResolvedValue(new Uint8Array([1]));

        renderWithProviders(<FormFillArtifact artifact={artifact} />);

        expect(screen.getByText("Intake Form_filled.pdf")).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", {
                name: t("forms.downloadFilledPdf") as string,
            }),
        );

        await waitFor(() => {
            expect(clickSpy).toHaveBeenCalledTimes(1);
        });
        const anchor = clickSpy.mock.instances[0];
        expect(anchor.download).toBe("Intake Form_filled.pdf");
    });
});
