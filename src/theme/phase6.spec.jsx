import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const readSource = (relativePath) =>
    readFileSync(path.resolve(here, "../..", relativePath), "utf8");

const collectProductionSources = (dir, acc = []) => {
    for (const entry of readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        if (!existsSync(fullPath)) continue;
        if (statSync(fullPath).isDirectory()) {
            collectProductionSources(fullPath, acc);
            continue;
        }
        if (/\.(js|jsx|ts|tsx)$/.test(entry) && !/\.spec\./.test(entry)) {
            acc.push(fullPath);
        }
    }
    return acc;
};

const phaseSixSources = [
    "src/pages/Rag.jsx",
    "src/components/rag/Uploader.tsx",
    "src/components/rag/BulkUploader.tsx",
    "src/components/rag/DocumentExplorer.tsx",
    "src/components/rag/EditDocumentPopover.tsx",
    "src/components/pdf-forms/FormTemplatesPanel.tsx",
    "src/components/pdf-forms/FormTemplateList.tsx",
    "src/components/pdf-forms/FormBuilder.tsx",
    "src/components/pdf-forms/FieldEditor.tsx",
    "src/components/pdf-forms/FieldList.tsx",
    "src/components/pdf-forms/UploadTemplateModal.tsx",
    "src/components/pdf-forms/ReplacePdfModal.tsx",
    "src/components/pdf-forms/FillFormModal.tsx",
];

const legacyTokens = [
    "overlay0",
    "textPrimary",
    "textSecondary",
    "surfaceMuted",
    "primaryButton",
    "successButton",
    "dangerButton",
    "colorPalette",
    "hover-overlay",
    "yellow.500",
    "blue.400",
    "green.400",
    "orange.400",
    "purple.400",
];

const legacyClasses = [
    '"panels-bg"',
    '"floating-main"',
    '"collapse-toggle"',
    '"documentExplorer-style"',
    '"documentExplorer-button"',
    '"filelist-style"',
];

describe("Clinical Folio Phase 6 theme mapping", () => {
    it("sources every production icon from the Lucide family (react-icons/lu)", () => {
        const srcRoot = path.resolve(here, "../..", "src");
        // Only react-icons/lu is allowed in production source.
        const forbidden = /from\s+["']react-icons\/(?!lu["'])[a-z0-9-]+["']/;
        for (const filePath of collectProductionSources(srcRoot)) {
            const source = readFileSync(filePath, "utf8");
            const relative = path.relative(srcRoot, filePath);
            expect(
                source,
                `${relative} must import react-icons only from react-icons/lu`,
            ).not.toMatch(forbidden);
        }
    });

    it("keeps every converted Phase 6 RAG/PDF surface on Folio semantic roles", () => {
        for (const relativePath of phaseSixSources) {
            const source = readSource(relativePath);
            for (const token of legacyTokens) {
                expect(source, `${relativePath}: ${token}`).not.toContain(token);
            }
            for (const legacyClass of legacyClasses) {
                expect(
                    source,
                    `${relativePath}: ${legacyClass}`,
                ).not.toContain(legacyClass);
            }
            expect(source, relativePath).not.toContain(
                'borderColor="border"',
            );
            expect(
                source,
                relativePath,
            ).not.toMatch(/style=\{\{[^}]*color:/);
        }
    });

    it("documents the only raw hex values: canvas constants in formBuilderUtils", () => {
        const utils = readSource(
            "src/components/pdf-forms/formBuilderUtils.ts",
        );
        for (const hex of [
            "#3d6391",
            "#35644b",
            "#8a5a12",
            "#854127",
            "#b42318",
        ]) {
            expect(utils).toContain(hex);
        }

        for (const relativePath of phaseSixSources) {
            if (relativePath.endsWith("formBuilderUtils.ts")) continue;
            const source = readSource(relativePath);
            expect(source, relativePath).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        }
    });

    it("scopes RAG/PDF chrome to Folio classes without narrowing legacy globals", () => {
        const styles = readSource("src/theme/styles/documentExplorer.jsx");
        const rag = readSource("src/pages/Rag.jsx");
        const uploader = readSource("src/components/rag/Uploader.tsx");
        const explorer = readSource(
            "src/components/rag/DocumentExplorer.tsx",
        );
        const panel = readSource("src/components/pdf-forms/FormTemplatesPanel.tsx");

        for (const scopedClass of [
            '".rag-workspace"',
            '".rag-panel"',
            '".rag-tab-body"',
            '".rag-collapse-toggle"',
            '".rag-row"',
            '".rag-file-list"',
        ]) {
            expect(styles).toContain(scopedClass);
        }
        for (const folioToken of [
            "folio.paper",
            "folio.canvas",
            "folio.line",
            "folio.paperAlt",
        ]) {
            expect(styles).toContain(folioToken);
        }
        // Compact tab density survives the conversion.
        expect(styles).toContain("0.7rem");

        expect(rag).toContain('className="rag-workspace"');
        expect(rag).toContain('className="rag-tab-body"');
        expect(uploader).toContain('className="rag-panel"');
        expect(uploader).toContain('className="rag-collapse-toggle"');
        expect(uploader).toContain('className="rag-tab-body"');
        expect(explorer).toContain('className="rag-panel"');
        expect(explorer).toContain('className="rag-collapse-toggle"');
        expect(explorer).toContain('className="rag-row"');
        expect(explorer).toContain('className="rag-file-list"');
        expect(panel).toContain('className="rag-panel"');
        expect(panel).toContain('w="240px"');

        // Legacy RAG/PDF global selectors are gone now that every consumer
        // is scoped.
        for (const legacyClass of [
            '".documentExplorer-style"',
            '".documentExplorer-button"',
            '".filelist-style"',
        ]) {
            expect(styles).not.toContain(legacyClass);
        }
    });

    it("removes retired legacy shared selectors and button wrappers", () => {
        const themeIndex = readSource("src/theme/index.jsx");
        const floating = readSource("src/theme/styles/floating.jsx");
        const panel = readSource("src/theme/styles/panel.jsx");
        const patientInfo = readSource("src/theme/styles/patientInfo.jsx");
        const buttons = readSource("src/components/common/Buttons.jsx");

        for (const legacyClass of [
            '".panels-bg"',
            '".floating-main"',
            '".collapse-toggle"',
            '".documentExplorer-style"',
            '".documentExplorer-button"',
            '".filelist-style"',
            '".pill-box"',
            '".pill-box-icons"',
            '".panel"',
            '".panel-content"',
            '".summary-panels"',
            '".summary-checkboxes"',
            '".landing-items"',
            '".green-icon"',
            '".red-icon"',
            '".yellow-icon"',
            '".blue-icon"',
        ]) {
            for (const [name, source] of [
                ["index", themeIndex],
                ["floating", floating],
                ["panel", panel],
                ["patientInfo", patientInfo],
            ]) {
                expect(source, `${name}: ${legacyClass}`).not.toContain(
                    legacyClass,
                );
            }
        }

        // The legacy button stylesheet module is deleted entirely.
        expect(existsSync(path.resolve(here, "../..", "src/theme/styles/button.jsx"))).toBe(
            false,
        );
        expect(themeIndex).not.toContain("buttonGlobalCss");

        // Legacy color-named wrappers/classes are gone; the scribe capsule
        // and local SidebarNavigation NavButton stay untouched.
        for (const legacy of [
            "GreenButton",
            "RedButton",
            "GreyButton",
            "SettingsButton",
            "green-button",
            "red-button",
            "orange-button",
            "grey-button",
            "nav-button",
            "small-nav-button",
            "summary-buttons",
            "chat-send-button",
        ]) {
            expect(buttons, legacy).not.toContain(legacy);
        }
        expect(patientInfo).not.toContain("colors.light");
        expect(floating).toContain('".pill-box-scribe"');
    });

    it("maps RAG status and icon meaning to Folio roles", () => {
        const bulk = readSource("src/components/rag/BulkUploader.tsx");
        const explorer = readSource(
            "src/components/rag/DocumentExplorer.tsx",
        );
        const popover = readSource(
            "src/components/rag/EditDocumentPopover.tsx",
        );
        const list = readSource(
            "src/components/pdf-forms/FormTemplateList.tsx",
        );

        // Bulk queue statuses keep success/danger meaning and text labels.
        expect(bulk).toContain('"folio.success"');
        expect(bulk).toContain('"folio.danger"');
        expect(bulk).toContain("statusLabel");
        // Drop zone: idle dashed line/faint, drag accent/accentSoft.
        expect(bulk).toContain(
            'borderColor={isDragOver ? "folio.accent" : "folio.line"}',
        );
        expect(bulk).toContain(
            'bg={isDragOver ? "folio.accentSoft" : "transparent"}',
        );
        expect(bulk).toContain('"folio.muted"');
        expect(bulk).toContain('"folio.info"');

        // Folders are accent; files/PDFs are info; destructive stays danger.
        expect(explorer).toContain('color="folio.accent"');
        expect(explorer).toContain('color="folio.info"');
        expect(explorer).toContain('color="folio.danger"');
        expect(popover).toContain('color="folio.ink"');
        expect(popover).toContain('color="folio.muted"');
        expect(popover).toContain('w="340px"');
        expect(list).toContain('"folio.selection"');
        expect(list).toContain('"folio.hover"');
    });

    it("sources form-field category colors from one shared mapping", () => {
        const utils = readSource("src/components/pdf-forms/formBuilderUtils.ts");
        const editor = readSource("src/components/pdf-forms/FieldEditor.tsx");
        const fieldList = readSource("src/components/pdf-forms/FieldList.tsx");

        expect(utils).toContain("FIELD_SEMANTIC_COLORS");
        for (const role of [
            '"folio.info"',
            '"folio.success"',
            '"folio.warning"',
            '"folio.accent"',
        ]) {
            expect(utils).toContain(role);
        }
        // Canvas fills derive .10/.20 alphas from the documented strokes.
        expect(utils).toContain("rgbaFromHex(stroke, 0.1)");
        expect(utils).toContain("rgbaFromHex(stroke, 0.2)");

        for (const consumer of [editor, fieldList]) {
            expect(consumer).toContain("FIELD_SEMANTIC_COLORS");
            expect(consumer).toContain('from "./formBuilderUtils"');
            expect(consumer).not.toContain("FIELD_COLORS");
            expect(consumer).not.toContain('from "./FieldEditor"');
        }
        // Helvetica preview metrics stay in the canvas path.
        expect(utils).toContain("Helvetica, Arial, sans-serif");
        expect(fieldList).toContain('maxH="170px"');
    });

    it("uses the Folio scrim, shared file input, and modal chrome", () => {
        const builder = readSource("src/components/pdf-forms/FormBuilder.tsx");
        const patientStyles = readSource("src/theme/styles/patientInfo.jsx");
        const upload = readSource(
            "src/components/pdf-forms/UploadTemplateModal.tsx",
        );
        const replace = readSource(
            "src/components/pdf-forms/ReplacePdfModal.tsx",
        );
        const fill = readSource("src/components/pdf-forms/FillFormModal.tsx");

        expect(builder).toContain('bg="folio.paperAlt/90"');
        expect(builder).toContain('color="folio.accent"');
        expect(builder).not.toContain("hover-overlay");

        expect(patientStyles).toContain('".file-input-style"');
        expect(patientStyles).toContain("folio.canvas");
        expect(patientStyles).toContain("folio.line");
        for (const modal of [upload, replace]) {
            expect(modal).toContain('className="file-input-style"');
            expect(modal).not.toContain("display: \"block\"");
        }
        for (const modal of [upload, replace, fill]) {
            expect(modal).toContain('className="modal-style"');
        }
        for (const modal of [upload, replace]) {
            expect(modal).toContain('type="file"');
        }
        expect(fill).toContain('color="folio.danger"');
    });
});
