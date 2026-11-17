import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import PatientInfoBar from "./PatientInfoBar";
import { emotionStylesFor, renderWithProviders } from "../../test/utils";
import { getAvatarColor, getInitials } from "../sidebar/SidebarHelpers";
import { t } from "@/i18n";

afterEach(cleanup);

const renderBar = (patient, onEdit = vi.fn()) =>
    renderWithProviders(<PatientInfoBar patient={patient} onEdit={onEdit} />);

const patient = {
    name: "Smith, John",
    gender: "M",
    dob: "1975-03-15",
    ur_number: "UR12345",
};

describe("PatientInfoBar", () => {
    it("renders the name and joined demographic meta with a UR badge", () => {
        renderBar(patient);

        expect(screen.getByText("Smith, John")).toBeInTheDocument();

        const meta = screen.getByText(/1975-03-15/);
        expect(meta.textContent).toBe(
            [
                "M",
                "1975-03-15",
                t("patient.urBadge", { ur: "UR12345" }),
            ].join("  ·  "),
        );
    });

    it("falls back to the new-patient name and placeholder meta", () => {
        renderBar({});

        expect(screen.getByText(t("patient.newPatient"))).toBeInTheDocument();
        expect(
            screen.getByText(t("patient.noDemographicsYet")),
        ).toBeInTheDocument();
        // No name to derive initials from — the avatar shows a bare "?".
        expect(screen.getByText("?")).toBeInTheDocument();
    });

    it("shows the no-demographics hint when only a name is known", () => {
        renderBar({ name: "Madonna" });

        expect(screen.getByText("Madonna")).toBeInTheDocument();
        expect(
            screen.getByText(t("patient.noDemographicsYet")),
        ).toBeInTheDocument();
    });

    it("omits missing meta segments instead of leaving dangling separators", () => {
        renderBar({ name: "Roe, Jane", gender: "F" });
        expect(screen.getByText("F").textContent).toBe("F");

        cleanup();

        renderBar({ name: "Doe, Jane", ur_number: "UR9" });
        expect(
            screen.getByText(t("patient.urBadge", { ur: "UR9" })).textContent,
        ).toBe(t("patient.urBadge", { ur: "UR9" }));
    });

    it("derives initials for Last, First and single-word names", () => {
        renderBar(patient);
        expect(screen.getByText(getInitials("Smith, John"))).toHaveTextContent(
            "JS",
        );

        cleanup();

        renderBar({ name: "Madonna" });
        expect(screen.getByText("MA")).toBeInTheDocument();
    });

    it("colors the avatar deterministically from the patient name", () => {
        renderBar(patient);

        const avatar = screen.getByText("JS");
        const styles = emotionStylesFor(avatar);
        expect(styles).toContain(getAvatarColor("Smith, John"));

        cleanup();

        renderBar({});
        expect(emotionStylesFor(screen.getByText("?"))).toContain(
            getAvatarColor(undefined),
        );
    });

    it("invokes the edit callback from the edit button", () => {
        const onEdit = vi.fn();
        renderBar(patient, onEdit);

        fireEvent.click(
            screen.getByRole("button", {
                name: t("patient.editPatientDetails"),
            }),
        );
        expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it("styles the patient name as Folio display type and meta as muted", () => {
        renderBar(patient);

        const nameStyles = emotionStylesFor(screen.getByText("Smith, John"));
        expect(nameStyles).toContain("var(--chakra-fonts-display)");
        expect(nameStyles).toContain("var(--chakra-colors-folio-ink)");
        expect(emotionStylesFor(screen.getByText(/1975-03-15/))).toContain(
            "var(--chakra-colors-folio-muted)",
        );
        expect(
            emotionStylesFor(
                screen.getByRole("button", {
                    name: t("patient.editPatientDetails"),
                }),
            ),
        ).toContain("var(--chakra-colors-folio-muted)");
    });
});
