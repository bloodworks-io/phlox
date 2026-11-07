import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { openSeededApp } from "../helpers/routeState";

type Box = {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
};

const readBox = (selector: string) =>
    `
        (() => {
            const element = document.querySelector(${JSON.stringify(selector)});
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left,
            };
        })()
    `;

test("consultation geometry contract", async ({ page }, testInfo) => {
    await openSeededApp(page, "/note/1", { waitFor: ".pill-box-scribe" });

    const sidebar = (await page.evaluate(readBox("nav"))) as Box;
    const rail = (await page.evaluate(readBox(".floating-action-menu"))) as Box;
    const scribe = (await page.evaluate(readBox(".pill-box-scribe"))) as Box;

    expect(Math.round(sidebar.width)).toBe(220);
    expect(Math.round(scribe.width)).toBe(182);
    expect(Math.round(scribe.height)).toBeGreaterThanOrEqual(65);
    expect(Math.round(rail.width)).toBeGreaterThan(40);
    expect(Math.round(rail.height)).toBeGreaterThan(150);

    const toolIds = await page.evaluate(() =>
        Array.from(document.querySelectorAll("[id^='fab-']")).map(
            (element) => element.id,
        ),
    );
    expect(toolIds).toEqual([
        "fab-document",
        "fab-previous-visit",
        "fab-chat",
        "fab-reasoning",
        "fab-letter",
    ]);

    const citationCount = await page.locator(".citation-badge").count();
    const mirrorMarkerCount = await page.locator("[data-line-end]").count();
    const supportedCitationCount = await page
        .locator(".citation-badge[data-verdict='supported']")
        .count();
    const unverifiedCitationCount = await page
        .locator(".citation-badge[data-verdict='unverified']")
        .count();
    const conflictCitationCount = await page
        .locator(".citation-badge[data-verdict='conflict']")
        .count();
    expect(citationCount).toBeGreaterThan(0);
    expect(mirrorMarkerCount).toBeGreaterThan(0);
    expect(citationCount).toBe(9);
    expect(mirrorMarkerCount).toBe(9);
    expect(supportedCitationCount).toBe(7);
    expect(unverifiedCitationCount).toBe(1);
    expect(conflictCitationCount).toBe(1);

    await page.locator("#fab-chat").click();
    await page.locator(".floating-panel").waitFor();
    const chatPanel = (await page.evaluate(readBox(".floating-panel"))) as Box;
    expect(Math.round(chatPanel.width)).toBeGreaterThanOrEqual(470);
    expect(Math.round(chatPanel.height)).toBeGreaterThanOrEqual(300);

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.locator("nav")).toHaveCSS("width", "80px");
    const collapsedSidebar = (await page.evaluate(readBox("nav"))) as Box;
    expect(Math.round(collapsedSidebar.width)).toBe(80);

    const metrics = {
        project: testInfo.project.name,
        viewport: page.viewportSize(),
        sidebar,
        collapsedSidebar,
        rail,
        scribe,
        chatPanel,
        toolIds,
        citationCount,
        supportedCitationCount,
        unverifiedCitationCount,
        conflictCitationCount,
        mirrorMarkerCount,
    };

    await testInfo.attach("geometry", {
        body: JSON.stringify(metrics, null, 2),
        contentType: "application/json",
    });

    const geometryPath = testInfo.outputPath("geometry.json");
    await mkdir(dirname(geometryPath), { recursive: true });
    await writeFile(
        geometryPath,
        `${JSON.stringify(metrics, null, 2)}\n`,
        "utf8",
    );
});
