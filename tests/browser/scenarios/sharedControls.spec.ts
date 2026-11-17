import { expect, test } from "@playwright/test";
import { expectStableScreenshot, openSeededApp } from "../helpers/routeState";

test("shared confirm dialog", async ({ page }) => {
    await openSeededApp(page, "/", { waitFor: "textarea" });

    const patient = page.getByText("Smith, John");
    await patient.hover();
    await page
        .getByRole("button", { name: "Delete patient", exact: true })
        .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByRole("button", { name: "Delete" }),
    ).toBeVisible();
    await expect(
        dialog.getByRole("button", { name: "Cancel" }),
    ).toBeVisible();

    await expectStableScreenshot(page, "shared-controls-confirm-dialog");
});
