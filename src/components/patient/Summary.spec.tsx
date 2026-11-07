import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { createRef } from "react";
import { screen, cleanup, fireEvent, act } from "@testing-library/react";
import Summary from "./Summary";
import type { SummaryHandle } from "./Summary";
import { renderWithProviders, emotionStylesFor } from "../../test/utils";
import { t } from "@/i18n";
import { toaster } from "@/components/ui/toaster";
import type { Patient } from "../../utils/patient/types";

const templateMock = vi.hoisted(() => ({ useTemplateSelection: vi.fn() }));

vi.mock("../../utils/templates/templateContext", () => ({
    useTemplateSelection: templateMock.useTemplateSelection,
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

type SummaryProps = ComponentProps<typeof Summary>;

const patient: Patient = {
    id: null,
    name: "Test Patient",
    dob: "1980-01-01",
    gender: "F",
    ur_number: "UR1",
    encounter_date: "2026-10-14",
    template_key: "tpl",
    template_data: { pmh: "• Hypertension", plan: "1. Review" },
    raw_transcription: null,
    transcription_duration: null,
    process_duration: null,
    reasoning_output: null,
};

const defaultTemplateContext = {
    currentTemplate: {
        template_key: "tpl",
        fields: [
            { field_key: "pmh", field_name: "Past Medical History", persistent: true },
            { field_key: "plan", field_name: "Plan", persistent: false },
        ],
    },
    templates: [] as Array<{ template_key: string; template_name: string }>,
    status: "success",
};

const markerLabel = () => t("patient.agentEditedPersistentField") as string;

function renderSummary(
    agentEdits: Record<string, string>,
    overrides: Partial<Patient> = {},
    props: Partial<SummaryProps> = {},
    templateContext: Partial<typeof defaultTemplateContext> = {},
) {
    templateMock.useTemplateSelection.mockReturnValue({
        ...defaultTemplateContext,
        ...templateContext,
    });
    return renderWithProviders(
        <Summary
            isSummaryCollapsed={false}
            patient={{ ...patient, ...overrides }}
            setPatient={vi.fn()}
            handleGenerateLetterClick={vi.fn()}
            handleSavePatientData={vi.fn()}
            onWrapUp={vi.fn()}
            setIsModified={vi.fn()}
            onCopy={vi.fn()}
            selectTemplate={vi.fn()}
            agentEdits={agentEdits}
            {...props}
        />,
    );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("Summary persistent-field agent-edit marker", () => {
    it("flags persistent fields last edited by the agent", () => {
        renderSummary({ pmh: "agent" });
        expect(screen.getAllByLabelText(markerLabel())).toHaveLength(1);
    });

    it("ignores non-persistent fields and clinician-edited fields", () => {
        renderSummary({ plan: "agent", pmh: "clinician" });
        expect(screen.queryByLabelText(markerLabel())).toBeNull();
    });

    it("clears the marker once the clinician edits the field locally", () => {
        renderSummary({ pmh: "agent" });
        const textareas = screen.getAllByPlaceholderText(
            t("patient.enterTextPlaceholder") as string,
        );
        fireEvent.change(textareas[0], { target: { value: "• Hypertension, reviewed" } });
        expect(screen.queryByLabelText(markerLabel())).toBeNull();
    });
});

describe("Summary citation grounding", () => {
    const raw = "S1: tired\nS2: plan bloods\nS1: fine otherwise";
    const grounded = (transcript_line_count: number): Patient => ({
        ...patient,
        raw_transcription: raw,
        note_citations: {
            transcript_line_count,
            resolved: [],
            fields: {
                plan: [
                    {
                        line_index: 0,
                        text: "1. Review",
                        sources: [1],
                        contradicts: [],
                        verdict: "supported",
                    },
                ],
                pmh: [
                    {
                        line_index: 0,
                        text: "• Hypertension",
                        sources: [],
                        contradicts: [],
                        verdict: "unverified",
                    },
                ],
            },
        },
    });

    it("shows the whole-field unverified banner instead of per-line noise", () => {
        renderSummary({}, grounded(raw.split("\n").length));
        expect(
            screen.getAllByLabelText(t("patient.fieldUnverifiedBanner") as string),
        ).toHaveLength(1);
        // pmh is fully unverified -> banner, no per-line overlay for it.
        // plan is supported -> one badge button rendered.
        const badges = screen.getAllByRole("button").filter(
            (el) => el.className.includes("citation-badge"),
        );
        expect(badges).toHaveLength(1);
    });

    it("suppresses all badges when the transcript line count guard fails", () => {
        renderSummary({}, grounded(raw.split("\n").length + 5));
        expect(
            screen.queryByLabelText(t("patient.fieldUnverifiedBanner") as string),
        ).toBeNull();
        expect(
            document.querySelectorAll(".citation-badge"),
        ).toHaveLength(0);
    });
});

describe("Summary template selector", () => {
    it("shows the template loading state instead of the note", () => {
        const { container } = renderSummary({}, {}, {}, { status: "loading" });
        expect(
            screen.getByText(t("patient.loadingTemplate") as string),
        ).toBeInTheDocument();
        expect(container.querySelector(".chakra-spinner")).toBeInTheDocument();
        expect(container.querySelector("select")).toBeNull();
        expect(container.querySelector("textarea")).toBeNull();
    });

    it("locks the selector and warns when viewing an existing encounter", () => {
        renderSummary({});
        const select = document.querySelector("select");
        expect(select).toBeDisabled();

        fireEvent.change(select!, { target: { value: "soap_01" } });
        expect(toaster.create).toHaveBeenCalledWith({
            title: t("patient.templateLocked"),
            description: t("patient.templateLockedDescription"),
            type: "warning",
            duration: 3000,
        });
        // No confirm dialog opens for a locked (historical) encounter.
        expect(
            screen.queryByText(t("patient.templateChangeTitle") as string),
        ).toBeNull();
    });

    it("offers a Historical Template option when the saved template is no longer active", () => {
        renderSummary({}, {}, {}, {
            templates: [{ template_key: "soap_01", template_name: "SOAP Note" }],
        });
        const historical = screen.getByText(
            t("patient.historicalTemplate") as string,
        ) as HTMLOptionElement;
        expect(historical.value).toBe("tpl");
        expect(screen.getByText("SOAP Note")).toBeInTheDocument();
        expect(document.querySelector("select")?.value).toBe("tpl");
    });

    it("lists the saved template directly when it is still active", () => {
        renderSummary({}, {}, {}, {
            templates: [
                { template_key: "tpl", template_name: "Standard Note" },
                { template_key: "soap_01", template_name: "SOAP Note" },
            ],
        });
        expect(
            screen.queryByText(t("patient.historicalTemplate") as string),
        ).toBeNull();
        expect(screen.getByText("Standard Note")).toBeInTheDocument();
    });
});

describe("Summary ungenerated note", () => {
    it("hides the Generate Note action once a note exists", () => {
        renderSummary({});
        expect(
            screen.queryByRole("button", { name: t("patient.generateNote") as string }),
        ).toBeNull();
    });

    it("unlocks the selector and runs Generate Note for ungenerated notes", () => {
        const onGenerateNote = vi.fn();
        renderSummary({}, {}, { isUngeneratedNote: true, onGenerateNote });

        expect(document.querySelector("select")).not.toBeDisabled();
        const generate = screen.getByRole("button", {
            name: t("patient.generateNote") as string,
        });
        fireEvent.click(generate);
        expect(onGenerateNote).toHaveBeenCalledTimes(1);
    });
});

describe("Summary toolbar actions", () => {
    it("keeps the letter action disabled until the encounter is saved", () => {
        const handleGenerateLetterClick = vi.fn();
        renderSummary({}, {}, { handleGenerateLetterClick });

        const letter = screen.getByRole("button", {
            name: t("patient.generateLetterLabel") as string,
        });
        expect(letter).toBeDisabled();
        fireEvent.click(letter);
        expect(handleGenerateLetterClick).not.toHaveBeenCalled();
    });

    it("generates a letter once the encounter is saved", () => {
        const handleGenerateLetterClick = vi.fn();
        renderSummary({}, {}, { isEncounterSaved: true, handleGenerateLetterClick });

        const letter = screen.getByRole("button", {
            name: t("patient.generateLetterLabel") as string,
        });
        expect(letter).toBeEnabled();
        fireEvent.click(letter);
        expect(handleGenerateLetterClick).toHaveBeenCalledWith(null);
    });

    it("disables the letter action again while the encounter is saving", () => {
        renderSummary({}, {}, { isEncounterSaved: true, saveLoading: true });
        expect(
            screen.getByRole("button", {
                name: t("patient.generateLetterLabel") as string,
            }),
        ).toBeDisabled();
    });

    it("renders Save as a secondary action and Wrap Up as the primary action", () => {
        renderSummary({});

        const save = screen.getByRole("button", { name: t("action.save") as string });
        expect(emotionStylesFor(save)).toContain("var(--chakra-colors-folio-line)");
        expect(emotionStylesFor(save)).toContain("var(--chakra-colors-folio-hover)");

        const wrapUp = screen.getByRole("button", {
            name: t("patient.wrapUp") as string,
        });
        expect(emotionStylesFor(wrapUp)).toContain("var(--chakra-colors-folio-accent)");
        expect(emotionStylesFor(wrapUp)).toContain(
            "var(--chakra-colors-folio-accent-ink)",
        );
    });

    it("uses the scoped Folio note surface and display title", () => {
        renderSummary({});

        expect(document.querySelector(".note-panel")).not.toBeNull();
        expect(document.querySelector(".note-header")).not.toBeNull();
        expect(document.querySelector(".note-footer")).not.toBeNull();
        expect(document.querySelector(".note-fields-container")).not.toBeNull();

        const title = screen.getByText(t("patient.noteHeading") as string);
        expect(emotionStylesFor(title)).toContain("var(--chakra-fonts-display)");
        expect(emotionStylesFor(title)).toContain("font-weight: 500");

        const label = document.querySelector(".note-field-label");
        expect(label).toHaveClass("cohesive-field-label");
        expect(label).toHaveClass("note-field-label");

        const textarea = screen.getAllByPlaceholderText(
            t("patient.enterTextPlaceholder") as string,
        )[0];
        expect(textarea).toHaveClass("cohesive-textarea");
        expect(textarea).toHaveClass("note-textarea");
    });
});

describe("Summary imperative handle", () => {
    it("rewrites every field textarea's height through resizeTextarea", () => {
        const ref = createRef<SummaryHandle>();
        renderSummary({}, {}, { ref });

        const textareas = screen.getAllByPlaceholderText(
            t("patient.enterTextPlaceholder") as string,
        );
        expect(textareas).toHaveLength(2);
        textareas.forEach((el) => {
            el.style.height = "40px";
        });

        act(() => ref.current?.resizeTextarea());
        // jsdom reports scrollHeight 0, pinning the auto-then-scrollHeight contract.
        textareas.forEach((el) => expect(el.style.height).toBe("0px"));
    });
});
