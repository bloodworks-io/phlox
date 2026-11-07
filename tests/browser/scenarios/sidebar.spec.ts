import { expect, test } from "@playwright/test";
import { expectStableScreenshot, openSeededApp } from "../helpers/routeState";

test("sidebar expanded state", async ({ page }) => {
    await openSeededApp(page, "/", { waitFor: "textarea" });

    const sidebar = page.locator("nav");
    await expect(sidebar).toHaveCSS("width", "220px");
    await expectStableScreenshot(page, "sidebar-expanded");
});

test("sidebar collapsed state", async ({ page }) => {
    await openSeededApp(page, "/", { waitFor: "textarea" });

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    const sidebar = page.locator("nav");
    await expect(sidebar).toHaveCSS("width", "80px");
    await expect(page.getByText("Smith, John")).toBeHidden();
    await expectStableScreenshot(page, "sidebar-collapsed");
});

test("small-screen sidebar overlay", async ({ page }, testInfo) => {
    test.skip(
        testInfo.project.name !== "chromium-light",
        "Small-screen overlay is captured once in the primary Chromium project",
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await openSeededApp(page, "/", { waitFor: "textarea" });

    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await expect(page.getByText("Smith, John")).toBeVisible();
    await expectStableScreenshot(page, "sidebar-small-overlay");

    await page.mouse.click(350, 700);
    await expect(page.getByText("Smith, John")).toBeHidden();
});
