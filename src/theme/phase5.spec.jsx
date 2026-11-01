import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const readSource = (relativePath) =>
    readFileSync(path.resolve(here, "../..", relativePath), "utf8");

const phaseFiveSources = [
    "src/components/dashboard/DashboardChat.jsx",
    "src/components/dashboard/DashboardChatInput.jsx",
    "src/components/dashboard/DashboardMessageList.jsx",
    "src/components/dashboard/DashboardTodoPanel.jsx",
    "src/components/patient/PatientTable.jsx",
    "src/components/settings/AdminSettingsPanel.jsx",
    "src/components/settings/ChatSettingsPanel.jsx",
    "src/components/settings/CompanionUserSettings.jsx",
    "src/components/settings/LetterTemplatesPanel.jsx",
    "src/components/settings/LlmTab.jsx",
    "src/components/settings/LocalModelManager.jsx",
    "src/components/settings/PromptEditorTab.jsx",
    "src/components/settings/RagTab.jsx",
    "src/components/settings/TemplateSettingsPanel.jsx",
    "src/components/settings/ToolsSettingsTab.jsx",
    "src/components/settings/UserSettingsPanel.jsx",
    "src/components/settings/UsersTab.jsx",
    "src/components/settings/WhisperTab.jsx",
    "src/components/modals/CompanionImportModal.jsx",
    "src/components/modals/FieldEditor.jsx",
    "src/components/modals/FieldPreview.jsx",
    "src/components/modals/NewTemplateFromExampleModal.jsx",
    "src/components/modals/TemplateEditor.jsx",
    "src/components/companion/CompanionSessionList.jsx",
    "src/components/companion/sessionUi.jsx",
];

const legacyTokens = [
    "overlay0",
    "textPrimary",
    "textSecondary",
    "textTertiary",
    "textQuaternary",
    "surfaceMuted",
    "surfaceInset",
    "primaryButtonFaint",
    "sendButton",
    "successButton",
    "dangerButton",
    "secondaryButton",
    "neutralButton",
    "whiteAlpha",
    "colorPalette",
    "surfaceQuartile",
    "hoverOverlay",
];

describe("Clinical Folio Phase 5 theme mapping", () => {
    it("keeps every converted Phase 5 surface on Folio semantic roles", () => {
        for (const relativePath of phaseFiveSources) {
            const source = readSource(relativePath);
            for (const token of legacyTokens) {
                expect(source, `${relativePath}: ${token}`).not.toContain(token);
            }
            expect(source, relativePath).not.toMatch(/scale\(\d/);
            expect(source, relativePath).not.toContain("#52633e");
            expect(source, relativePath).not.toContain("#bdce9b");
        }
    });

    it("maps dashboard material and capture controls to Folio", () => {
        const floating = readSource("src/theme/styles/floating.jsx");
        const input = readSource(
            "src/components/dashboard/DashboardChatInput.jsx",
        );
        const todo = readSource("src/components/dashboard/DashboardTodoPanel.jsx");

        expect(floating).toContain('".dashboard-chat-input-container"');
        expect(floating).toContain("folio.paper");
        expect(floating).toContain('".dashboard-chat-suggestions"');
        expect(floating).not.toContain("translateY(-1px)");
        expect(input).toContain("folio.accentSoft");
        expect(input).toContain("variant=\"folioPrimary\"");
        expect(input).not.toContain("sendButton");
        expect(todo).toContain("folio.paper");
        expect(todo).toContain("folio.success");
    });

    it("maps clinical table categories and completion states without opacity-only cues", () => {
        const table = readSource("src/components/patient/PatientTable.jsx");
        const inputStyles = readSource("src/theme/styles/input.jsx");

        for (const token of [
            "folio.infoSoft",
            "folio.successSoft",
            "folio.warningSoft",
            "folio.paperAlt",
            "folio.hover",
            "folio.muted",
        ]) {
            expect(table).toContain(token);
        }
        expect(table).not.toContain("colors[colorMode]");
        expect(table).not.toContain("opacity: 0.5");
        expect(table).not.toContain('opacity={0.5}');
        expect(inputStyles).toContain('".reason-button"');
        expect(inputStyles).toContain("folio.accentSoft");
    });

    it("uses scoped Settings surfaces without narrowing legacy global classes", () => {
        const settingsSources = phaseFiveSources.filter((source) =>
            source.startsWith("src/components/settings/") ||
            source.startsWith("src/components/modals/"),
        );
        const floating = readSource("src/theme/styles/floating.jsx");
        const panel = readSource("src/theme/styles/panel.jsx");
        const patientInfo = readSource("src/theme/styles/patientInfo.jsx");

        for (const relativePath of settingsSources) {
            const source = readSource(relativePath);
            expect(source, relativePath).not.toContain("panels-bg");
            expect(source, relativePath).not.toContain("floating-main");
            expect(source, relativePath).not.toContain("collapse-toggle\" className");
        }

        expect(panel).toContain('".settings-panel"');
        expect(floating).toContain('".settings-tab-body"');
        expect(floating).toContain('".settings-collapse-toggle"');
        expect(patientInfo).toContain('".settings-meta"');
        expect(panel).toContain('".panels-bg"');
        expect(floating).toContain('".floating-main"');
        expect(floating).toContain('".collapse-toggle"');
    });

    it("maps companion status meaning to Folio roles", () => {
        const sessionUi = readSource("src/components/companion/sessionUi.jsx");
        const sessions = readSource(
            "src/components/companion/CompanionSessionList.jsx",
        );
        const modal = readSource(
            "src/components/modals/CompanionImportModal.jsx",
        );

        for (const token of [
            "folio.success",
            "folio.info",
            "folio.danger",
        ]) {
            expect(sessionUi).toContain(token);
        }
        expect(sessions).toContain("folio.paper");
        expect(sessions).toContain("folio.paperAlt");
        expect(modal).toContain("folio.success");
        expect(modal).toContain("folio.danger");
        expect(modal).not.toContain("surfaceMuted");
    });
});
