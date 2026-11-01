import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const readSource = (relativePath) =>
    readFileSync(path.resolve(here, "../..", relativePath), "utf8");

const phaseThreeComponents = [
    "src/components/patient/PatientInfoBar.jsx",
    "src/components/patient/DemographicsForm.jsx",
    "src/components/patient/NewNoteStartCard.jsx",
    "src/components/modals/NewNoteModal.jsx",
    "src/components/patient/Summary.tsx",
    "src/components/patient/GroundedTextarea.tsx",
    "src/components/patient/AgentEditDiffMarker.tsx",
    "src/components/patient/UrSearchField.jsx",
];

const selectorBlock = (source, selector) => {
    const match = source.match(
        new RegExp(`"${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}":\\s*\\{([\\s\\S]*?)\\n    \\}`),
    );
    expect(match, `Expected selector block: ${selector}`).toBeDefined();
    return match?.[1] ?? "";
};

describe("Clinical Folio consultation-core theme mapping", () => {
    it("adds scoped Folio surfaces without replacing broad shared panel classes", () => {
        const patientInfo = readSource("src/theme/styles/patientInfo.jsx");
        const panel = readSource("src/theme/styles/panel.jsx");

        for (const selector of [
            ".patient-context-bar",
            ".new-note-card",
            ".entry-path",
            ".entry-candidate-row",
        ]) {
            expect(patientInfo).toContain(`"${selector}"`);
        }

        expect(patientInfo).toContain('".pill-box-icons"');
        expect(panel).toContain('".panels-bg"');
    });

    it("maps the consultation note to Folio paper, hairlines, and flat fields", () => {
        const input = readSource("src/theme/styles/input.jsx");

        expect(selectorBlock(input, ".note-panel")).toContain(
            'backgroundColor: "folio.paper"',
        );
        expect(selectorBlock(input, ".note-panel")).toContain(
            'borderColor: "folio.line"',
        );
        expect(selectorBlock(input, ".note-panel")).toContain(
            'borderRadius: "folioPanel"',
        );
        expect(selectorBlock(input, ".note-header")).toContain(
            'borderBottomColor: "folio.line"',
        );
        expect(selectorBlock(input, ".note-footer")).toContain(
            'borderTopColor: "folio.line"',
        );
        expect(selectorBlock(input, ".note-fields-container")).toContain(
            'backgroundColor: "transparent"',
        );
        expect(selectorBlock(input, ".note-field-label")).toContain(
            'color: "folio.ink"',
        );
        expect(selectorBlock(input, ".note-textarea")).toContain(
            'color: "folio.faint"',
        );
    });

    it("maps review markers and agent diffs to Folio status roles", () => {
        const input = readSource("src/theme/styles/input.jsx");

        expect(selectorBlock(input, ".cohesive-agent-edit-marker")).toContain(
            'color: "folio.warning',
        );
        expect(selectorBlock(input, ".cohesive-persistent-marker")).toContain(
            'color: "folio.faint',
        );
        expect(selectorBlock(input, ".agent-diff-line--same")).toContain(
            'color: "folio.muted',
        );
        expect(selectorBlock(input, ".agent-diff-line--add")).toContain(
            'backgroundColor: "folio.successSoft',
        );
        expect(selectorBlock(input, ".agent-diff-line--add")).toContain(
            'color: "folio.success',
        );
        expect(selectorBlock(input, ".agent-diff-line--remove")).toContain(
            'backgroundColor: "folio.dangerSoft',
        );
        expect(selectorBlock(input, ".agent-diff-line--remove")).toContain(
            'color: "folio.danger',
        );
        expect(selectorBlock(input, ".agent-diff-line--remove")).toContain(
            'textDecoration: "line-through',
        );
    });

    it("maps citation opacity, conflict halo, and live-field flash to Folio roles", () => {
        const theme = readSource("src/theme/index.jsx");

        expect(theme).toContain(
            "globalCss[\".citation-badge[data-verdict='supported']\"] = { opacity: 0.7 }",
        );
        expect(theme).toContain(
            "globalCss[\".citation-badge[data-verdict='unverified']\"] = { opacity: 0.7 }",
        );
        expect(theme).toContain("folioColors.light.danger}26");
        expect(theme).toContain("folioColors.dark.danger}26");
        expect(theme).toContain(
            "backgroundColor: \"var(--chakra-colors-folio-info-soft)\"",
        );
        expect(theme).toContain(
            "boxShadow: \"inset 2px 0 0 0 var(--chakra-colors-folio-info)\"",
        );
    });

    it("keeps Compact Studio olive out of the consultation core", () => {
        const sources = [
            "src/theme/index.jsx",
            "src/theme/styles/input.jsx",
            "src/theme/styles/patientInfo.jsx",
            ...phaseThreeComponents,
        ].map(readSource);

        for (const source of sources) {
            expect(source).not.toContain("#52633e");
            expect(source).not.toContain("#bdce9b");
        }
    });

    it("removes legacy font families and legacy color call sites from Phase 3 components", () => {
        for (const relativePath of phaseThreeComponents) {
            const source = readSource(relativePath);
            expect(source, relativePath).not.toMatch(/Space Grotesk/);
            expect(source, relativePath).not.toMatch(/Roboto/);
            expect(source, relativePath).not.toMatch(
                /color=["'](textPrimary|textSecondary|dangerButton)["']/,
            );
            expect(source, relativePath).not.toMatch(
                /borderColor=["'](surface|accent)["']/,
            );
            expect(source, relativePath).not.toMatch(
                /bg=["'](tile|surface)["']/,
            );
        }
    });
});
