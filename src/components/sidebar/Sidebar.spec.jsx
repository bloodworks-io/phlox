import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "./Sidebar";
import { MemoryRouter } from "react-router";
import { ApiToastProvider } from "../../utils/helpers/apiToastContext";
import { renderWithProviders } from "../../test/utils";

const patientApiMock = vi.hoisted(() => ({
    fetchNoteList: vi.fn(),
    fetchIncompleteJobsCount: vi.fn(),
    deletePatient: vi.fn(),
}));

const settingsApiMock = vi.hoisted(() => ({
    fetchServerStatus: vi.fn(),
}));

const authApiMock = vi.hoisted(() => ({
    logout: vi.fn(),
    fetchMe: vi.fn(),
}));

vi.mock("../../utils/api/patientApi", () => ({
    patientApi: patientApiMock,
}));

vi.mock("../../utils/api/settingsApi", () => ({
    settingsApi: settingsApiMock,
}));

vi.mock("../../utils/api/authApi", () => ({
    authApi: authApiMock,
}));

const patients = [
    { id: 1, name: "Smith, John", ur_number: "UR00001" },
    { id: 2, name: "Johnson, Emily", ur_number: "UR00002" },
];

const baseProps = {
    onNewPatient: vi.fn(),
    onSelectPatient: vi.fn(),
    selectedPatientId: 1,
    selectedDate: "2026-07-23",
    setSelectedDate: vi.fn(),
    handleNavigation: vi.fn(),
    isCollapsed: false,
    toggleSidebar: vi.fn(),
    isSmallScreen: false,
    colorMode: "light",
    toggleColorMode: vi.fn(),
    isAdmin: false,
    patientScope: "mine",
    setPatientScope: vi.fn(),
};

const renderSidebar = (overrides = {}) =>
    renderWithProviders(
        <MemoryRouter>
            <ApiToastProvider>
                <Sidebar {...baseProps} {...overrides} />
            </ApiToastProvider>
        </MemoryRouter>,
    );

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    patientApiMock.fetchNoteList.mockResolvedValue(patients);
    patientApiMock.fetchIncompleteJobsCount.mockResolvedValue({
        incomplete_jobs_count: 2,
    });
    patientApiMock.deletePatient.mockResolvedValue({ message: "deleted" });
    settingsApiMock.fetchServerStatus.mockResolvedValue({
        llm: true,
        whisper: true,
        embedding: null,
    });
});

describe("Sidebar", () => {
    it("loads patients and the outstanding-jobs badge", async () => {
        renderSidebar();

        expect(await screen.findByText("Smith, John")).toBeInTheDocument();
        expect(screen.getByText("Johnson, Emily")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(patientApiMock.fetchNoteList).toHaveBeenCalledWith({
            date: "2026-07-23",
            scope: "mine",
        });
    });

    it("selects a patient and changes the clinic date", async () => {
        renderSidebar();

        const patient = await screen.findByText("Smith, John");
        fireEvent.click(patient);
        expect(baseProps.onSelectPatient).toHaveBeenCalledWith(patients[0]);

        const date = screen.getByDisplayValue("2026-07-23");
        fireEvent.change(date, { target: { value: "2026-07-24" } });
        expect(baseProps.setSelectedDate).toHaveBeenCalledWith("2026-07-24");
    });

    it("confirms patient deletion and removes the encounter", async () => {
        renderSidebar();
        const patient = await screen.findByText("Johnson, Emily");
        fireEvent.mouseEnter(patient);

        const deleteButton = await screen.findByRole("button", {
            name: "Delete patient",
        });
        fireEvent.click(deleteButton);
        expect(
            await screen.findByText(
                "Are you sure you want to delete Johnson, Emily?",
            ),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        await waitFor(() =>
            expect(patientApiMock.deletePatient).toHaveBeenCalledWith(2),
        );
    });

    it("requests navigation collapse while retaining the collapsed jobs badge", async () => {
        renderSidebar();
        expect(await screen.findByText("Smith, John")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
        expect(baseProps.toggleSidebar).toHaveBeenCalledTimes(1);
        expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("offers the small-screen close control", async () => {
        renderSidebar({ isSmallScreen: true });
        expect(await screen.findByText("Smith, John")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Close sidebar" }));
        expect(baseProps.toggleSidebar).toHaveBeenCalledTimes(1);
    });

    it("exposes the admin patient-scope switch", async () => {
        renderSidebar({ isAdmin: true });
        expect(await screen.findByText("Smith, John")).toBeInTheDocument();

        const scopeControl = screen.getByRole("checkbox", {
            name: /toggle between all users' patients/i,
        });
        const user = userEvent.setup();
        await user.click(scopeControl.closest("label") ?? scopeControl);
        expect(baseProps.setPatientScope).toHaveBeenCalledTimes(1);
    });
});
