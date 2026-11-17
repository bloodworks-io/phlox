import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import NewNoteModal from "./NewNoteModal";
import { renderWithProviders } from "../../test/utils";
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

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
});

const candidate = { id: 7, name: "Smith, John", ur_number: "UR7" };

const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    setPatient: vi.fn(),
    createNewPatient: vi.fn(),
    findPatients: vi.fn().mockResolvedValue([candidate, { id: 8, name: "Doe, Jane", ur_number: "UR8" }]),
    loadSelectedPatient: vi.fn().mockResolvedValue(),
    selectedDate: "2026-10-26",
    onComplete: vi.fn(),
};

const renderModal = (overrides = {}) =>
    renderWithProviders(<NewNoteModal {...baseProps} {...overrides} />);

const searchInput = () =>
    screen.getByPlaceholderText(t("modal.newNote.urPlaceholder"));
const searchButton = () =>
    screen.getByRole("button", { name: t("patient.findExistingPatient") });
const closeTrigger = () =>
    document.querySelector('[data-part="close-trigger"]');

const submitSearch = async (query, props) => {
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    fireEvent.change(searchInput(), { target: { value: query } });
    fireEvent.submit(searchInput().closest("form"));
    await waitFor(() => expect(props.findPatients).toHaveBeenCalledTimes(1));
};

const fillNewPatientForm = () => {
    fireEvent.change(screen.getByPlaceholderText(t("patient.firstName")), {
        target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText(t("patient.lastName")), {
        target: { value: "Lovelace" },
    });
    fireEvent.change(document.querySelector('input[type="date"]'), {
        target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByPlaceholderText(t("patient.urNumber")), {
        target: { value: "UR42" },
    });
};

describe("NewNoteModal view machine", () => {
    it("renders nothing while closed", () => {
        renderModal({ isOpen: false });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(closeTrigger()).toBeNull();
    });

    it("opens on the choose view with both paths", () => {
        renderModal();

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: t("modal.newNote.title") }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(t("modal.newNote.subtitleChoose")),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /New patient/ }),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Search/ })).toBeInTheDocument();
    });

    it("moves choose → search → choose through the back button", () => {
        renderModal();

        fireEvent.click(screen.getByRole("button", { name: /Search/ }));
        expect(
            screen.getByText(t("modal.newNote.subtitleSearch")),
        ).toBeInTheDocument();
        expect(searchInput()).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: t("action.back") }));
        expect(
            screen.getByText(t("modal.newNote.subtitleChoose")),
        ).toBeInTheDocument();
    });

    it("moves search → results → search through the back button", async () => {
        renderModal();

        await submitSearch("UR7", baseProps);
        expect(
            await screen.findByText(t("modal.newNote.subtitleResults")),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: t("action.back") }));
        expect(
            await screen.findByText(t("modal.newNote.subtitleSearch")),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: t("action.back") }));
        expect(
            await screen.findByText(t("modal.newNote.subtitleChoose")),
        ).toBeInTheDocument();
    });

    it("notifies the owner when the dialog close trigger is used", async () => {
        renderModal();

        fireEvent.click(closeTrigger());
        await waitFor(() => expect(baseProps.onClose).toHaveBeenCalledTimes(1));
    });
});

describe("NewNoteModal search", () => {
    it("warns on a blank query without hitting the API", () => {
        renderModal();

        fireEvent.click(screen.getByRole("button", { name: /Search/ }));
        fireEvent.submit(searchInput().closest("form"));

        expect(toaster.create).toHaveBeenCalledTimes(1);
        expect(toaster.create).toHaveBeenCalledWith({
            title: t("modal.newNote.searchPromptTitle"),
            description: t("modal.newNote.searchPromptDescription"),
            type: "warning",
            duration: 3000,
        });
        expect(baseProps.findPatients).not.toHaveBeenCalled();
    });

    it("renders candidates for a successful search", async () => {
        renderModal();

        await submitSearch("  Smith  ", baseProps);

        expect(baseProps.findPatients).toHaveBeenCalledWith("Smith");
        expect(
            await screen.findByText(candidate.name),
        ).toBeInTheDocument();
        expect(screen.getByText("Doe, Jane")).toBeInTheDocument();
        expect(
            screen.getAllByRole("button", { name: t("patient.startVisit") }),
        ).toHaveLength(2);
    });

    it("marks the search control as loading while the query is in flight", async () => {
        let resolveSearch;
        const findPatients = vi.fn(
            () =>
                new Promise((resolve) => {
                    resolveSearch = resolve;
                }),
        );
        const props = { ...baseProps, findPatients };
        renderModal(props);

        fireEvent.click(screen.getByRole("button", { name: /Search/ }));
        fireEvent.change(searchInput(), { target: { value: "UR7" } });
        fireEvent.submit(searchInput().closest("form"));

        await waitFor(() => expect(searchButton()).toBeDisabled());

        await act(async () => {
            resolveSearch([candidate]);
        });

        expect(
            await screen.findByRole("button", { name: t("patient.startVisit") }),
        ).toBeEnabled();
        expect(
            screen.queryByRole("button", {
                name: t("patient.findExistingPatient"),
            }),
        ).not.toBeInTheDocument();
    });

    it("toasts and stays in search when no patient matches", async () => {
        const props = {
            ...baseProps,
            findPatients: vi.fn().mockResolvedValue([]),
        };
        renderModal(props);

        await submitSearch("Nobody", props);

        await waitFor(() => expect(toaster.create).toHaveBeenCalledTimes(1));
        expect(toaster.create).toHaveBeenCalledWith({
            title: t("modal.newNote.noPatientTitle"),
            description: t("modal.newNote.noPatientDescription", {
                query: "Nobody",
            }),
            type: "info",
            duration: 3000,
        });
        expect(searchInput()).toBeInTheDocument();
    });

    it("toasts an error and stays in search when the search fails", async () => {
        const props = {
            ...baseProps,
            findPatients: vi.fn().mockRejectedValue(new Error("network")),
        };
        renderModal(props);

        await submitSearch("UR7", props);

        await waitFor(() => expect(toaster.create).toHaveBeenCalledTimes(1));
        expect(toaster.create).toHaveBeenCalledWith({
            title: t("modal.newNote.searchFailedTitle"),
            description: t("modal.newNote.searchFailedDescription"),
            type: "error",
            duration: 3000,
        });
        expect(searchInput()).toBeInTheDocument();
        expect(searchButton()).toBeEnabled();
    });
});

describe("NewNoteModal candidate confirmation", () => {
    it("loads the selected patient and completes the flow", async () => {
        renderModal();

        await submitSearch("UR7", baseProps);
        fireEvent.click(
            (await screen.findAllByRole("button", {
                name: t("patient.startVisit"),
            }))[0],
        );

        await waitFor(() =>
            expect(baseProps.loadSelectedPatient).toHaveBeenCalledWith(
                candidate,
                baseProps.selectedDate,
            ),
        );
        await waitFor(() =>
            expect(baseProps.onComplete).toHaveBeenCalledWith({
                cameFromSearch: true,
            }),
        );
    });

    it("toasts and releases the rows when loading the patient fails", async () => {
        const props = {
            ...baseProps,
            loadSelectedPatient: vi.fn().mockRejectedValue(new Error("db")),
        };
        renderModal(props);

        await submitSearch("UR7", props);
        const startButtons = await screen.findAllByRole("button", {
            name: t("patient.startVisit"),
        });
        fireEvent.click(startButtons[0]);

        await waitFor(() => expect(toaster.create).toHaveBeenCalledTimes(1));
        expect(toaster.create).toHaveBeenCalledWith({
            title: t("modal.newNote.loadFailedTitle"),
            description: t("modal.newNote.pleaseTryAgain"),
            type: "error",
            duration: 3000,
        });
        expect(props.onComplete).not.toHaveBeenCalled();
        await waitFor(() => {
            const buttons = screen.getAllByRole("button", {
                name: t("patient.startVisit"),
            });
            expect(buttons).toHaveLength(2);
            for (const button of buttons) {
                expect(button).toBeEnabled();
            }
        });
    });
});

describe("NewNoteModal new-patient flow", () => {
    it("shows the demographics form and returns to choose on cancel", async () => {
        renderModal();

        fireEvent.click(screen.getByRole("button", { name: /New patient/ }));

        expect(
            await screen.findByText(t("modal.newNote.subtitleNewPatient")),
        ).toBeInTheDocument();
        expect(
            screen.getByPlaceholderText(t("patient.firstName")),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: t("action.back") }));
        expect(
            await screen.findByText(t("modal.newNote.subtitleChoose")),
        ).toBeInTheDocument();
    });

    it("commits the drafted patient over the created base record", async () => {
        const props = {
            ...baseProps,
            createNewPatient: vi
                .fn()
                .mockResolvedValue({ id: 99, name: "Base" }),
        };
        renderModal(props);

        fireEvent.click(screen.getByRole("button", { name: /New patient/ }));
        await screen.findByPlaceholderText(t("patient.firstName"));
        fillNewPatientForm();
        fireEvent.click(screen.getByRole("button", { name: t("action.save") }));

        await waitFor(() => expect(props.setPatient).toHaveBeenCalledTimes(1));
        expect(props.setPatient).toHaveBeenCalledWith({
            id: 99,
            name: "Lovelace, Ada",
            first_name: "Ada",
            last_name: "Lovelace",
            dob: "1990-01-01",
            gender: "",
            ur_number: "UR42",
            address: "",
            phone: "",
            isNewEncounter: true,
        });
        await waitFor(() =>
            expect(props.onComplete).toHaveBeenCalledWith({
                cameFromSearch: false,
            }),
        );
    });

    it("toasts and keeps the form when creating the record fails", async () => {
        const props = {
            ...baseProps,
            createNewPatient: vi.fn().mockRejectedValue(new Error("db")),
        };
        renderModal(props);

        fireEvent.click(screen.getByRole("button", { name: /New patient/ }));
        await screen.findByPlaceholderText(t("patient.firstName"));
        fillNewPatientForm();
        fireEvent.click(screen.getByRole("button", { name: t("action.save") }));

        await waitFor(() => expect(toaster.create).toHaveBeenCalledTimes(1));
        expect(toaster.create).toHaveBeenCalledWith({
            title: t("modal.newNote.newPatientFailedTitle"),
            description: t("modal.newNote.pleaseTryAgain"),
            type: "error",
            duration: 3000,
        });
        expect(props.setPatient).not.toHaveBeenCalled();
        expect(props.onComplete).not.toHaveBeenCalled();
        expect(
            screen.getByPlaceholderText(t("patient.firstName")),
        ).toBeInTheDocument();
    });
});
