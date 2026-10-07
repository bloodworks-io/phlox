import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import FillFormModal from "./FillFormModal";
import { renderWithProviders } from "../../test/utils";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { fillPdf } from "../../utils/pdf/fillForm";
import { toaster } from "@/components/ui/toaster";
import { t } from "@/i18n";
import type { FormTemplate } from "./types";

vi.mock("../../utils/api/pdfFormsApi", () => ({
    pdfFormsApi: { fetchTemplatePdf: vi.fn() },
}));
vi.mock("../../utils/pdf/fillForm", () => ({ fillPdf: vi.fn() }));
vi.mock("../../utils/helpers/pdfVisionHelpers", () => ({
    loadPdfDocument: vi.fn(),
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

const template: FormTemplate = {
    id: "tpl-1",
    name: "Intake Form",
    fields: [
        {
            id: "f1",
            name: "Patient Name",
            field_type: "text",
            required: true,
            description: "",
            page_number: 1,
            x: 0,
            y: 0,
            width: 100,
            height: 16,
        },
        {
            id: "f2",
            name: "Consent",
            field_type: "checkbox",
            required: false,
            description: "I agree",
            page_number: 1,
            x: 0,
            y: 30,
            width: 14,
            height: 14,
        },
        {
            id: "f3",
            name: "Visit Date",
            field_type: "date",
            required: false,
            description: "",
            page_number: 1,
            x: 0,
            y: 60,
            width: 100,
            height: 16,
        },
    ],
};

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
    vi.mocked(pdfFormsApi.fetchTemplatePdf).mockResolvedValue(
        new ArrayBuffer(8),
    );
    vi.mocked(fillPdf).mockResolvedValue(new Uint8Array([1, 2, 3]));
});

afterEach(() => {
    clickSpy.mockRestore();
    cleanup();
});

const openModal = () =>
    renderWithProviders(
        <FillFormModal isOpen onClose={() => {}} template={template} />,
    );

describe("FillFormModal", () => {
    it("renders one input per non-checkbox field plus the checkbox", () => {
        openModal();
        expect(
            screen.getByLabelText(/Patient Name/),
        ).toBeInTheDocument();
        expect(screen.getByText("I agree")).toBeInTheDocument();
        expect(screen.getByLabelText(/Visit Date/)).toHaveAttribute(
            "type",
            "date",
        );
    });

    it("marks required fields with an asterisk", () => {
        openModal();
        const label = screen.getByText("Patient Name").closest("label");
        expect(label?.textContent).toContain("*");
    });

    it("sends entered values to fillPdf keyed by field name", async () => {
        openModal();
        fireEvent.change(screen.getByLabelText(/Patient Name/), {
            target: { value: "Ada Lovelace" },
        });
        fireEvent.click(
            screen.getByRole("button", {
                name: t("forms.fillAndDownload") as string,
            }),
        );

        await waitFor(() => {
            expect(clickSpy).toHaveBeenCalledTimes(1);
        });
        expect(fillPdf).toHaveBeenCalledWith(
            expect.any(Uint8Array),
            template,
            expect.objectContaining({ "Patient Name": "Ada Lovelace" }),
        );
        expect(clickSpy.mock.instances[0].download).toBe(
            "Intake Form_filled.pdf",
        );
    });

    it("renders the checkbox with its description and leaves it out when unchecked", async () => {
        openModal();
        expect(screen.getByRole("checkbox")).not.toBeChecked();
        fireEvent.change(screen.getByLabelText(/Patient Name/), {
            target: { value: "Ada" },
        });
        fireEvent.click(
            screen.getByRole("button", {
                name: t("forms.fillAndDownload") as string,
            }),
        );

        await waitFor(() => {
            expect(fillPdf).toHaveBeenCalled();
        });
        // Consent (unchecked) contributes nothing to the payload.
        expect(vi.mocked(fillPdf).mock.calls[0][2]).toEqual({
            "Patient Name": "Ada",
        });
    });

    it("shows the empty-fields hint and disables actions without fields", () => {
        renderWithProviders(
            <FillFormModal
                isOpen
                onClose={() => {}}
                template={{ ...template, fields: [] }}
            />,
        );
        expect(
            screen.getByText(t("forms.noFieldsDefined") as string),
        ).toBeInTheDocument();
        const fill = screen.getByRole("button", {
            name: t("forms.fillAndDownload") as string,
        });
        expect(fill).toBeDisabled();
    });

    it("error in fill shows an error toast and keeps the modal open", async () => {
        vi.mocked(fillPdf).mockRejectedValue(new Error("boom"));
        openModal();
        fireEvent.click(
            screen.getByRole("button", {
                name: t("forms.fillAndDownload") as string,
            }),
        );

        await waitFor(() => {
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            );
        });
        expect(
            screen.getByText(t("forms.fillAndDownload") as string),
        ).toBeInTheDocument();
    });
});
