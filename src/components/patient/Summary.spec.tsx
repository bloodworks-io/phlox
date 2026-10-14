import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import Summary from "./Summary";
import { renderWithProviders } from "../../test/utils";
import { t } from "@/i18n";
import type { Patient } from "../../utils/patient/types";

vi.mock("../../utils/templates/templateContext", () => ({
    useTemplateSelection: () => ({
        currentTemplate: {
            template_key: "tpl",
            fields: [
                { field_key: "pmh", field_name: "Past Medical History", persistent: true },
                { field_key: "plan", field_name: "Plan", persistent: false },
            ],
        },
        templates: [],
        status: "success",
    }),
}));

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

const markerLabel = () => t("patient.agentEditedPersistentField") as string;

function renderSummary(agentEdits: Record<string, string>) {
    return renderWithProviders(
        <Summary
            isSummaryCollapsed={false}
            patient={patient}
            setPatient={vi.fn()}
            handleGenerateLetterClick={vi.fn()}
            handleSavePatientData={vi.fn()}
            onWrapUp={vi.fn()}
            setIsModified={vi.fn()}
            onCopy={vi.fn()}
            selectTemplate={vi.fn()}
            agentEdits={agentEdits}
        />,
    );
}

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
