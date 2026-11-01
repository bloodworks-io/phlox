import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test } from "@playwright/test";
import { openSeededApp } from "../helpers/routeState";

const scenarios = [
    {
        name: "dashboard",
        route: "/",
        waitFor: "textarea",
    },
    {
        name: "consultation",
        route: "/note/1",
        waitFor: ".pill-box-scribe",
    },
    {
        name: "settings",
        route: "/settings",
        waitFor: "[role=tablist]",
    },
    {
        name: "clinic-summary",
        route: "/clinic-summary",
        waitFor: "table",
    },
    {
        name: "outstanding-jobs",
        route: "/outstanding-jobs",
        waitFor: "table",
    },
    {
        name: "rag",
        route: "/rag",
        waitFor: "[role=tablist]",
    },
    {
        name: "login",
        route: "/",
        waitFor: "input",
        variant: { auth: "login" as const },
    },
];

test("current accessibility baseline", async ({ page }, testInfo) => {
    const summary: Array<{ name: string; impact: string; help: string; nodes: number }> = [];

    for (const scenario of scenarios) {
        await openSeededApp(page, scenario.route, {
            waitFor: scenario.waitFor,
            variant: scenario.variant,
        });

        const results = await new AxeBuilder({ page }).analyze();
        expect(Array.isArray(results.violations)).toBe(true);

        for (const violation of results.violations) {
            summary.push({
                name: `${scenario.name}:${violation.id}`,
                impact: violation.impact ?? "unknown",
                help: violation.help,
                nodes: violation.nodes.length,
            });
        }

        await testInfo.attach(`axe-${scenario.name}`, {
            body: JSON.stringify(results, null, 2),
            contentType: "application/json",
        });
    }

    await testInfo.attach("axe-summary", {
        body: JSON.stringify(summary, null, 2),
        contentType: "application/json",
    });

    const summaryPath = testInfo.outputPath("axe-summary.json");
    await mkdir(dirname(summaryPath), { recursive: true });
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
});
