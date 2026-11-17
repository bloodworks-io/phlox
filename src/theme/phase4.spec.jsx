import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const readSource = (relativePath) =>
    readFileSync(path.resolve(here, "../..", relativePath), "utf8");

const phaseFourSources = [
    "src/components/common/PillBox.jsx",
    "src/components/common/FloatingActionMenu.jsx",
    "src/components/common/FloatingPanel.jsx",
    "src/components/patient/ScribePillBox.jsx",
    "src/components/patient/scribeButtons.jsx",
    "src/components/patient/scribeVisuals.jsx",
    "src/components/panels/chat/ChatPanel.jsx",
    "src/components/panels/chat/ChatInput.jsx",
    "src/components/panels/letter/LetterEditor.jsx",
    "src/components/panels/letter/RefinementPanel.jsx",
    "src/components/panels/letter/DictationWidget.jsx",
    "src/components/panels/reasoning/components/ReasoningItem.jsx",
    "src/components/panels/reasoning/components/ReasoningContent.jsx",
    "src/components/panels/document/DocumentPanel.jsx",
    "src/components/panels/previous-visit/PreviousVisitPanel.jsx",
    "src/components/panels/transcription/TranscriptionPanel.tsx",
    "src/components/transcript/SpeakerText.tsx",
    "src/components/panels/agent/components/agentStatus.js",
    "src/components/panels/agent/components/ActivityList.jsx",
    "src/components/common/MarkdownRenderer.jsx",
    "src/components/common/ArtifactCard.jsx",
    "src/components/pdf-forms/FormFillArtifact.tsx",
    "src/components/modals/WrapUpModal.jsx",
];

describe("Clinical Folio Phase 4 theme mapping", () => {
    it("maps the shared floating surface, scribe capsule, and rail to Folio material", () => {
        const floating = readSource("src/theme/styles/floating.jsx");

        expect(floating).toContain('".floating-panel"');
        expect(floating).toContain('backgroundColor: "folio.paper"');
        expect(floating).toContain('borderColor: "folio.line"');
        expect(floating).toContain('".pill-box-scribe"');
        expect(floating).toContain('backgroundColor: "folio.sidebar"');
        expect(floating).toContain('".floating-action-menu"');
        expect(floating).toContain('backgroundColor: "folio.paper"');
        expect(floating).not.toContain("linear-gradient(to bottom, rgba(45");
        expect(floating).not.toContain("backdropFilter");
    });

    it("keeps FloatingPanel arrows on the same Folio paper and hairline material", () => {
        const panel = readSource("src/components/common/FloatingPanel.jsx");

        expect(panel).toContain("folioColors.light.paper");
        expect(panel).toContain("folioColors.dark.paper");
        expect(panel).toContain("folioColors.light.line");
        expect(panel).toContain("folioColors.dark.line");
        expect(panel).not.toContain("colors.light.secondary");
        expect(panel).not.toContain("animationend");
        expect(panel).not.toContain("transitionend");
        expect(panel).toContain("ResizeObserver");
        expect(panel).toContain("requestAnimationFrame");
    });

    it("maps capture and rail states to semantic Folio roles", () => {
        const scribe = readSource("src/components/patient/scribeButtons.jsx");
        const visuals = readSource("src/components/patient/scribeVisuals.jsx");
        const rail = readSource(
            "src/components/common/FloatingActionMenu.jsx",
        );

        for (const source of [scribe, visuals, rail]) {
            expect(source).not.toContain("hue-rotate");
            expect(source).not.toMatch(/scale\(\d/);
            expect(source).not.toContain("#45c0b2");
            expect(source).not.toContain("#179299");
        }

        for (const token of [
            "folio.brand",
            "folio.brandInk",
            "folio.danger",
            "folio.dangerInk",
            "folio.warning",
            "folio.warningInk",
            "folio.info",
            "folio.infoInk",
            "folio.accentSoft",
        ]) {
            expect(scribe).toContain(token);
        }

        expect(rail).toContain("aria-pressed");
        expect(rail).toContain("folio.accentSoft");
        expect(rail).toContain("folio.danger");
        expect(rail).toContain("folio-rail-button");
    });

    it("preserves non-color status semantics across attached panels and agent surfaces", () => {
        const reasoningItem = readSource(
            "src/components/panels/reasoning/components/ReasoningItem.jsx",
        );
        const agentStatus = readSource(
            "src/components/panels/agent/components/agentStatus.js",
        );
        const activity = readSource(
            "src/components/panels/agent/components/ActivityList.jsx",
        );

        expect(reasoningItem).toContain('"folio.info"');
        expect(reasoningItem).toContain('"folio.success"');
        expect(reasoningItem).toContain('"folio.warning"');
        expect(reasoningItem).toContain('"folio.danger"');

        expect(agentStatus).toContain('"folio.info"');
        expect(agentStatus).toContain('"folio.warning"');
        expect(agentStatus).toContain('"folio.danger"');
        expect(activity).toContain('"folio.success"');
        expect(activity).toContain('"folio.warning"');
    });

    it("keeps Compact Studio olive and legacy lava material out of Phase 4", () => {
        for (const relativePath of [
            ...phaseFourSources,
            "src/theme/index.jsx",
            "src/theme/styles/floating.jsx",
            "src/theme/styles/input.jsx",
            "src/utils/chat/toolPresentation.ts",
        ]) {
            const source = readSource(relativePath);
            expect(source, relativePath).not.toContain("#52633e");
            expect(source, relativePath).not.toContain("#bdce9b");
            expect(source, relativePath).not.toContain("#BF360C");
            expect(source, relativePath).not.toContain("#FF6B35");
        }
    });
});
