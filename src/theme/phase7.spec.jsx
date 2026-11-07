import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const readSource = (relativePath) =>
    readFileSync(path.join(repoRoot, relativePath), "utf8");

const collectProductionSources = (dir, acc = []) => {
    for (const entry of readdirSync(dir)) {
        if (entry === ".DS_Store") continue;
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

describe("Clinical Folio Phase 7 final compatibility cleanup", () => {
    it("keeps only Folio semantic color tokens and concrete Folio values", () => {
        const colors = readSource("src/theme/colors.jsx");

        expect(colors).not.toContain("const palette = {");
        expect(colors).not.toContain("export const colors");
        expect(colors).not.toContain("lightenColor");
        for (const legacyHex of [
            "#eff1f5",
            "#24273a",
            "#179299",
            "#8bd5ca",
            "#232634",
            "#1e2030",
            "#ccd0da",
            "#363a4f",
        ]) {
            expect(colors).not.toContain(legacyHex);
        }
        expect(colors).toContain("export const folioColors");
        expect(colors).toContain("Concrete values for genuine SVG/canvas consumers");
    });

    it("removes the retired color manipulation utility", () => {
        expect(existsSync(path.join(repoRoot, "src/theme/utils.jsx"))).toBe(false);
    });

    it("converts the remaining global style consumers to Folio roles", () => {
        const base = readSource("src/theme/styles/base.jsx");
        const input = readSource("src/theme/styles/input.jsx");
        const toggle = readSource("src/theme/styles/toggle.jsx");

        for (const source of [base, input, toggle]) {
            expect(source).not.toContain("colors.light");
            expect(source).not.toContain("colors.dark");
            expect(source).not.toContain("colors[colorMode]");
            expect(source).not.toContain("textPrimary");
            expect(source).not.toContain("textSecondary");
            expect(source).not.toContain("textTertiary");
            expect(source).not.toContain("overlay0");
        }

        expect(base).toContain("folio.ink");
        expect(base).toContain("folio.muted");
        expect(base).toContain("folio.sidebarInk");
        expect(input).toContain('".cohesive-fields-container"');
        expect(input).toContain("folio.canvas !important");
        expect(toggle).not.toContain('".transcript-mode"');
        expect(toggle).toContain('".switch-mode"');
    });

    it("uses one full-height sidebar geometry contract on web and every Tauri platform", () => {
        const dimensions = readSource("src/theme/dimensions.jsx");
        const sidebar = readSource("src/components/sidebar/Sidebar.jsx");
        const layout = readSource("src/components/layout/AppLayout.jsx");

        expect(dimensions).toContain('width: "220px"');
        expect(dimensions).toContain('collapsedWidth: "80px"');
        expect(dimensions).not.toContain("tauriOffset");
        expect(dimensions).not.toContain("sidebarOffset");
        expect(dimensions).not.toContain("236px");
        expect(dimensions).not.toContain("96px");

        expect(sidebar).toContain('h: "100dvh"');
        expect(sidebar).toContain("my: 0");
        expect(sidebar).toContain("mx: 0");
        expect(sidebar).not.toContain("calc(100dvh - 18px)");
        expect(sidebar).not.toContain('boxShadow: "overlay"');
        expect(sidebar).toContain("isMacTauri");
        expect(sidebar).toContain('mt={isMacTauri ? "30px" : "0px"}');

        expect(layout).toContain("sidebarWidth(isCollapsed)");
        expect(layout).not.toContain("sidebarOffset");
        expect(layout).toContain("isMacTauri");
    });

    it("keeps frontend drag regions macOS-only under native Windows and GNOME titlebars", () => {
        const dragConsumers = collectProductionSources(
            path.join(repoRoot, "src"),
        ).filter((filePath) => {
            const source = readFileSync(filePath, "utf8");
            return source.includes("data-tauri-drag-region");
        });

        expect(dragConsumers.map((filePath) => path.relative(repoRoot, filePath))).toEqual([
            "src/components/common/SplashScreen.jsx",
            "src/components/layout/AppLayout.jsx",
            "src/components/setup/EncryptionSetup.jsx",
            "src/components/setup/EncryptionUnlock.jsx",
            "src/components/setup/ServerStartupLoader.jsx",
            "src/components/sidebar/Sidebar.jsx",
        ]);

        for (const filePath of dragConsumers) {
            const source = readFileSync(filePath, "utf8");
            expect(source, path.relative(repoRoot, filePath)).toContain(
                "isTauri() && isMacOS()",
            );
            expect(source, path.relative(repoRoot, filePath)).toContain(
                'from "../../utils/helpers/platform"',
            );
        }
    });

    it("does not reintroduce Compact Studio values or legacy production colors", () => {
        for (const filePath of collectProductionSources(
            path.join(repoRoot, "src"),
        )) {
            const source = readFileSync(filePath, "utf8");
            expect(source, path.relative(repoRoot, filePath)).not.toContain(
                "#52633e",
            );
            expect(source, path.relative(repoRoot, filePath)).not.toContain(
                "#bdce9b",
            );
        }
    });
});
