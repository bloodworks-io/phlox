import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import DemographicsForm from "./DemographicsForm";
import { emotionStylesFor, renderWithProviders } from "../../test/utils";
import { extractFromFile } from "../../utils/helpers/documentExtraction";
import { transcriptionApi } from "../../utils/api/transcriptionApi";
import { toaster } from "@/components/ui/toaster";
import { t } from "@/i18n";

vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));
vi.mock("../../utils/helpers/documentExtraction", () => ({
    extractFromFile: vi.fn(),
}));
vi.mock("../../utils/api/transcriptionApi", () => ({
    transcriptionApi: {
        extractDemographics: vi.fn(),
        extractDemographicsFromText: vi.fn(),
        extractDemographicsVisual: vi.fn(),
    },
}));

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});
beforeEach(() => {
    vi.clearAllMocks();
});

const renderForm = (props = {}) =>
    renderWithProviders(
        <DemographicsForm patient={{}} setPatient={vi.fn()} {...props} />,
    );

const fileInput = () => document.querySelector('input[type="file"]');
const dropZone = () => fileInput().parentElement;
const dobInput = () => document.querySelector('input[type="date"]');

const fillRequired = ({ first = "John", last = "Smith", dob = "1975-03-15", ur = "UR1" } = {}) => {
    fireEvent.change(screen.getByPlaceholderText(t("patient.firstName")), {
        target: { value: first },
    });
    fireEvent.change(screen.getByPlaceholderText(t("patient.lastName")), {
        target: { value: last },
    });
    fireEvent.change(dobInput(), { target: { value: dob } });
    fireEvent.change(screen.getByPlaceholderText(t("patient.urNumber")), {
        target: { value: ur },
    });
};

const dropFile = (file) =>
    fireEvent.change(fileInput(), { target: { files: [file] } });

describe("DemographicsForm required-field gating", () => {
    it("marks first/last name, DOB, and UR number as required but not the rest", () => {
        renderForm();

        // Required labels carry a danger-toned asterisk.
        for (const label of [
            t("patient.firstName"),
            t("patient.lastName"),
            t("patient.dateOfBirth"),
            t("patient.urNumber"),
        ]) {
            const labelEl = screen.getByText(label);
            expect(labelEl.textContent).toBe(`${label}*`);
            expect(emotionStylesFor(labelEl.querySelector("span"))).toContain(
                "var(--chakra-colors-folio-danger)",
            );
        }
        // Optional labels render bare.
        for (const label of [
            t("patient.gender"),
            t("patient.phone"),
            t("patient.address"),
        ]) {
            expect(screen.getByText(label).textContent).toBe(label);
        }
    });

    it("prefills the form from the patient record", () => {
        renderForm({
            patient: {
                first_name: "John",
                last_name: "Smith",
                dob: "1975-03-15",
                gender: "M",
                ur_number: "UR1",
                phone: "0412",
                address: "1 Main St",
            },
        });

        expect(screen.getByPlaceholderText(t("patient.firstName"))).toHaveValue(
            "John",
        );
        expect(screen.getByPlaceholderText(t("patient.lastName"))).toHaveValue(
            "Smith",
        );
        expect(dobInput()).toHaveValue("1975-03-15");
        expect(document.querySelector("select")).toHaveValue("M");
        expect(screen.getByPlaceholderText(t("patient.urNumber"))).toHaveValue(
            "UR1",
        );
        expect(screen.getByPlaceholderText(t("patient.phone"))).toHaveValue(
            "0412",
        );
        expect(screen.getByPlaceholderText(t("patient.address"))).toHaveValue(
            "1 Main St",
        );
    });

    it("disables save until every required field is filled", () => {
        renderForm();

        const save = screen.getByRole("button", { name: t("action.save") });
        expect(save).toBeDisabled();

        fillRequired({ first: "", last: "Smith", dob: "1975-03-15", ur: "UR1" });
        expect(save).toBeDisabled();

        fillRequired();
        expect(save).toBeEnabled();
    });

    it("hides the cancel button unless a handler is provided", () => {
        renderForm();
        expect(
            screen.queryByRole("button", { name: t("action.cancel") }),
        ).not.toBeInTheDocument();

        cleanup();

        renderForm({ onCancel: vi.fn() });
        expect(
            screen.getByRole("button", { name: t("action.cancel") }),
        ).toBeInTheDocument();
    });

    it("supports custom save and cancel labels", () => {
        renderForm({
            onCancel: vi.fn(),
            saveLabel: "Create",
            cancelLabel: "Not now",
        });

        expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Not now" }),
        ).toBeInTheDocument();
    });
});

describe("DemographicsForm saving", () => {
    it("composes the display name as Last, First and persists via onSave/onSaved", async () => {
        const setPatient = vi.fn();
        const onSave = vi.fn().mockResolvedValue();
        const onSaved = vi.fn();
        renderForm({
            patient: { id: 5 },
            setPatient,
            onSave,
            onSaved,
        });

        fillRequired();
        fireEvent.change(screen.getByPlaceholderText(t("patient.phone")), {
            target: { value: "0412" },
        });
        fireEvent.click(screen.getByRole("button", { name: t("action.save") }));

        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

        const expected = {
            id: 5,
            first_name: "John",
            last_name: "Smith",
            name: "Smith, John",
            dob: "1975-03-15",
            gender: "",
            ur_number: "UR1",
            address: "",
            phone: "0412",
        };
        expect(setPatient).toHaveBeenCalledWith(expected);
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith(expected);
        expect(onSaved).toHaveBeenCalledWith(expected);
    });

    it("shows an error toast and skips onSaved when onSave rejects", async () => {
        const onSave = vi.fn().mockRejectedValue(new Error("offline"));
        const onSaved = vi.fn();
        renderForm({ onSave, onSaved });

        fillRequired();
        const save = screen.getByRole("button", { name: t("action.save") });
        fireEvent.click(save);

        await waitFor(() => expect(toaster.create).toHaveBeenCalledTimes(1));
        expect(toaster.create).toHaveBeenCalledWith({
            title: t("patient.saveDemographicsFailed"),
            description: t("patient.tryAgain"),
            type: "error",
            duration: 3000,
        });
        expect(onSaved).not.toHaveBeenCalled();
        expect(save).toBeEnabled();
    });

    it("commits straight to onSaved when no onSave handler is given", async () => {
        const setPatient = vi.fn();
        const onSaved = vi.fn();
        renderForm({ setPatient, onSaved });

        fillRequired();
        fireEvent.click(screen.getByRole("button", { name: t("action.save") }));

        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        expect(setPatient).toHaveBeenCalledWith(
            expect.objectContaining({ name: "Smith, John" }),
        );
    });
});

describe("DemographicsForm document extraction", () => {
    it("extracts from a chosen file through the transcription API adapters", async () => {
        vi.mocked(extractFromFile).mockResolvedValue({
            first_name: "Ada",
        });
        renderForm();

        const file = new File(["referral"], "referral.txt", {
            type: "text/plain",
        });
        dropFile(file);

        await waitFor(() =>
            expect(extractFromFile).toHaveBeenCalledTimes(1),
        );
        expect(extractFromFile).toHaveBeenCalledWith(
            file,
            expect.objectContaining({
                fromText: transcriptionApi.extractDemographicsFromText,
                visual: transcriptionApi.extractDemographicsVisual,
                legacyFile: expect.any(Function),
            }),
            {},
        );
    });

    it("shows the reading state while a document is being parsed", async () => {
        let resolveExtraction;
        vi.mocked(extractFromFile).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveExtraction = resolve;
                }),
        );
        const { container } = renderForm();

        dropFile(new File(["x"], "doc.txt", { type: "text/plain" }));

        expect(
            await screen.findByText(t("patient.readingDocument")),
        ).toBeInTheDocument();
        expect(container.querySelector(".chakra-spinner")).not.toBeNull();

        await act(async () => {
            resolveExtraction({ first_name: "Ada" });
        });

        expect(
            await screen.findByText(t("patient.dropDocumentHint")),
        ).toBeInTheDocument();
        expect(container.querySelector(".chakra-spinner")).toBeNull();
    });

    it("merges only extracted fields and flashes them briefly", async () => {
        vi.useFakeTimers();
        vi.mocked(extractFromFile).mockResolvedValue({
            first_name: "Ada",
            ur_number: "UR777",
        });
        renderForm();

        fillRequired();
        const first = screen.getByPlaceholderText(t("patient.firstName"));
        const last = screen.getByPlaceholderText(t("patient.lastName"));
        const ur = screen.getByPlaceholderText(t("patient.urNumber"));

        await act(async () => {
            dropFile(new File(["x"], "doc.txt", { type: "text/plain" }));
        });

        // Only extracted keys are merged — untouched fields keep their values.
        expect(first).toHaveValue("Ada");
        expect(ur).toHaveValue("UR777");
        expect(last).toHaveValue("Smith");
        expect(dobInput()).toHaveValue("1975-03-15");

        // Extracted inputs flash the live-update marker; others do not.
        expect(first).toHaveClass("live-field-updated");
        expect(ur).toHaveClass("live-field-updated");
        expect(last).not.toHaveClass("live-field-updated");

        act(() => {
            vi.advanceTimersByTime(1800);
        });

        expect(first).not.toHaveClass("live-field-updated");
        expect(first).toHaveValue("Ada");
    });

    it("leaves the form untouched when extraction returns nothing usable", async () => {
        vi.mocked(extractFromFile).mockResolvedValue(null);
        renderForm();

        fillRequired();
        dropFile(new File(["x"], "doc.txt", { type: "text/plain" }));

        await waitFor(() =>
            expect(extractFromFile).toHaveBeenCalledTimes(1),
        );
        expect(screen.getByPlaceholderText(t("patient.firstName"))).toHaveValue(
            "John",
        );
        expect(
            screen.getByPlaceholderText(t("patient.firstName")),
        ).not.toHaveClass("live-field-updated");
    });

    it("surfaces the extraction error message above the drop zone", async () => {
        vi.mocked(extractFromFile).mockRejectedValue(
            new Error("Unreadable scan"),
        );
        renderForm();

        dropFile(new File(["x"], "doc.pdf", { type: "application/pdf" }));

        expect(
            await screen.findByText("Unreadable scan"),
        ).toBeInTheDocument();
        expect(screen.getByPlaceholderText(t("patient.firstName"))).toHaveValue(
            "",
        );
    });

    it("falls back to the generic extraction message when the error has none", async () => {
        vi.mocked(extractFromFile).mockRejectedValue("network blip");
        renderForm();

        dropFile(new File(["x"], "doc.txt", { type: "text/plain" }));

        expect(
            await screen.findByText(t("patient.extractDemographicsFailed")),
        ).toBeInTheDocument();
    });
});

describe("DemographicsForm drop zone", () => {
    it("highlights the drop zone with Folio action tokens while files drag over", () => {
        renderForm();

        const zone = dropZone();
        expect(emotionStylesFor(zone)).toContain(
            "var(--chakra-colors-folio-line)",
        );
        expect(emotionStylesFor(zone)).toContain(
            "var(--chakra-colors-transparent)",
        );

        fireEvent.dragOver(zone, { dataTransfer: { types: ["Files"] } });
        expect(emotionStylesFor(zone)).toContain(
            "var(--chakra-colors-folio-accent)",
        );
        expect(emotionStylesFor(zone)).toContain(
            "var(--chakra-colors-folio-accent-soft)",
        );

        fireEvent.dragLeave(zone);
        expect(emotionStylesFor(zone)).toContain(
            "var(--chakra-colors-folio-line)",
        );
        expect(emotionStylesFor(zone)).toContain(
            "var(--chakra-colors-transparent)",
        );
    });

    it("ignores drags that carry no files", () => {
        renderForm();

        const zone = dropZone();
        fireEvent.dragOver(zone, {
            dataTransfer: { types: ["text/uri-list"] },
        });
        expect(emotionStylesFor(zone)).not.toContain(
            "var(--chakra-colors-folio-accent)",
        );
    });

    it("extracts from the dropped file", async () => {
        vi.mocked(extractFromFile).mockResolvedValue({ first_name: "Ada" });
        renderForm();

        const file = new File(["scan"], "id.png", { type: "image/png" });
        fireEvent.drop(dropZone(), {
            dataTransfer: { types: ["Files"], files: [file] },
        });

        await waitFor(() =>
            expect(extractFromFile).toHaveBeenCalledWith(
                file,
                expect.anything(),
                {},
            ),
        );
    });
});
