import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PatientTable from "./PatientTable";
import { renderWithProviders } from "../../test/utils";

const handlersMock = vi.hoisted(() => ({
    resetJobsItems: vi.fn(),
    debouncedUpdateJobsList: vi.fn(),
    flushPendingJobsUpdate: vi.fn(),
}));

vi.mock("../../utils/patient/patientHandlers", () => handlersMock);

const patients = [
    {
        id: 1,
        name: "Smith, John",
        dob: "1975-03-15",
        ur_number: "UR00001",
        encounter_summary: "Improving iron-deficiency anaemia.",
        jobs_list: [
            { id: 1, job: "Repeat FBE", completed: false },
            { id: 2, job: "Review in four months", completed: true },
        ],
        reasoning: {
            summary: "Improving iron-deficiency anaemia.",
            differentials: [{ suggestion: "Stable iron deficiency" }],
            investigations: [{ suggestion: "Repeat FBE" }],
            clinical_considerations: [{ suggestion: "Confirm adherence" }],
        },
    },
    {
        id: 2,
        name: "Johnson, Emily",
        dob: "1988-11-22",
        ur_number: "UR00002",
        encounter_summary: "Stable thrombocytopenia.",
        jobs_list: [],
    },
];

const baseProps = {
    patients,
    handleSelectPatient: vi.fn(),
    setPatients: vi.fn(),
    refreshSidebar: vi.fn(),
    title: "Clinic Summary",
};

const renderTable = (overrides = {}) =>
    renderWithProviders(
        <PatientTable summaryOnly groupByDate={false} {...baseProps} {...overrides} />,
    );

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
});

describe("PatientTable", () => {
    it("renders patient details, summaries, and jobs", () => {
        renderTable();

        expect(screen.getByText("J. Smith")).toBeInTheDocument();
        expect(screen.getByText("UR00001")).toBeInTheDocument();
        expect(screen.getByText("Improving iron-deficiency anaemia.")).toBeInTheDocument();
        expect(screen.getByText("Repeat FBE")).toBeInTheDocument();
        expect(screen.getByText("Review in four months")).toBeInTheDocument();
        expect(screen.getByText("No tasks")).toBeInTheDocument();
    });

    it("navigates to the selected encounter", () => {
        renderTable();

        fireEvent.click(
            screen.getAllByRole("button", { name: /go to encounter/i })[0],
        );
        expect(baseProps.handleSelectPatient).toHaveBeenCalledWith(patients[0]);
    });

    it("marks completed jobs without relying on color alone", () => {
        renderTable();

        expect(screen.getByText("Review in four months")).toHaveStyle({
            textDecoration: "line-through",
        });
        expect(screen.getByText("Review in four months")).not.toHaveStyle({
            opacity: "0.5",
        });
    });

    it("queues a job completion through the debounced update path", async () => {
        renderTable();
        const user = userEvent.setup();

        await user.click(screen.getByText("Repeat FBE"));

        expect(baseProps.setPatients).toHaveBeenCalledTimes(1);
        expect(handlersMock.debouncedUpdateJobsList).toHaveBeenCalledWith(
            1,
            [
                { id: 1, job: "Repeat FBE", completed: true },
                { id: 2, job: "Review in four months", completed: true },
            ],
            baseProps.refreshSidebar,
        );
    });

    it("requests a job reset for the selected row", () => {
        renderTable();

        const unnamedButtons = screen.getAllByRole("button", { name: "" });
        fireEvent.click(unnamedButtons[0]);
        expect(handlersMock.resetJobsItems).toHaveBeenCalledWith(
            patients[0].id,
            patients,
            baseProps.setPatients,
            baseProps.refreshSidebar,
        );
    });

    it("renders skeleton rows while loading", () => {
        renderTable({ isLoading: true });

        expect(screen.queryByText("J. Smith")).not.toBeInTheDocument();
        expect(screen.getAllByRole("row").length).toBeGreaterThan(4);
    });

    it("renders reasoning sections and keeps unavailable sections disabled", () => {
        renderTable({ summaryOnly: false });

        const reasonButtons = document.querySelectorAll(".reason-button");
        expect(reasonButtons).toHaveLength(8);
        expect([...reasonButtons].filter((button) => button.disabled)).toHaveLength(
            3,
        );

        fireEvent.click(reasonButtons[1]);
        expect(baseProps.setPatients).toHaveBeenCalledWith([
            expect.objectContaining({
                id: 1,
                activeSection: "differentials",
            }),
            expect.objectContaining({ id: 2 }),
        ]);
    });

    it("renders semantic reasoning category tags for the active section", () => {
        renderTable({
            summaryOnly: false,
            patients: [
                {
                    ...patients[0],
                    activeSection: "differentials",
                },
            ],
        });

        expect(screen.getByText("Stable iron deficiency")).toBeInTheDocument();
    });

    it("groups Outstanding Jobs by descending encounter date", () => {
        renderTable({
            groupByDate: true,
            patients: [
                {
                    ...patients[0],
                    id: 2,
                    encounter_date: "2026-07-22",
                },
                {
                    ...patients[1],
                    id: 1,
                    encounter_date: "2026-07-23",
                },
            ],
        });

        const headings = screen.getAllByRole("heading", { level: 3 });
        expect(headings).toHaveLength(2);
        expect(headings[0].textContent).not.toBe(headings[1].textContent);
        expect(headings[0].textContent).toMatch(/23/);
        expect(headings[1].textContent).toMatch(/22/);
    });

    it("renders a subdued row when every summary job is complete", () => {
        renderTable({
            patients: [
                {
                    ...patients[0],
                    jobs_list: [
                        { id: 1, job: "Repeat FBE", completed: true },
                        { id: 2, job: "Review in four months", completed: true },
                    ],
                },
            ],
        });

        const row = screen.getByRole("row", { name: /J\. Smith/ });
        expect(row).not.toHaveStyle({ opacity: "0.5" });
        expect(row).toHaveTextContent(/improving iron-deficiency anaemia/i);
    });
});
