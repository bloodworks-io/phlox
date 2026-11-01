import { expect, test } from "@playwright/test";
import {
    expectNoUnhandledApiRequests,
    expectStableScreenshot,
    openSeededApp,
} from "../helpers/routeState";

test("consultation core uses Folio patient context and note typography", async ({
    page,
}) => {
    const mocks = await openSeededApp(page, "/note/1", {
        waitFor: ".pill-box-scribe",
    });
    await expectNoUnhandledApiRequests(mocks);

    const contextBar = page.locator(".patient-context-bar");
    await expect(contextBar).toHaveCount(1);
    await expect(contextBar).toContainText("Smith, John");
    await expect(contextBar.getByText("Smith, John")).toHaveCSS(
        "font-family",
        /Source Serif 4/,
    );

    const noteTitle = page.getByRole("heading", { name: "Note" });
    await expect(noteTitle).toHaveCSS("font-family", /Source Serif 4/);
    await expect(page.locator(".note-panel")).toHaveCount(1);
    await expect(page.locator(".note-header")).toHaveCount(1);
    await expect(page.locator(".note-footer")).toHaveCount(1);
});

test("citation verdicts and popover use the Folio status language", async ({
    page,
}) => {
    const mocks = await openSeededApp(page, "/note/1", {
        waitFor: ".pill-box-scribe",
    });
    await expectNoUnhandledApiRequests(mocks);

    await expect(page.locator(".citation-badge")).toHaveCount(9);
    await expect(
        page.locator(".citation-badge[data-verdict='supported']"),
    ).toHaveCount(7);
    await expect(
        page.locator(".citation-badge[data-verdict='unverified']"),
    ).toHaveCount(1);
    await expect(
        page.locator(".citation-badge[data-verdict='conflict']"),
    ).toHaveCount(1);

    await page.locator(".citation-badge[data-verdict='conflict']").click();
    const popover = page
        .getByRole("dialog")
        .filter({ hasText: "The transcript says the opposite:" });
    await expect(popover).toBeVisible();
    await expect(
        popover.getByText("I have noticed some bruising on my arms lately."),
    ).toBeVisible();

    await expectStableScreenshot(page, "consultation-citation-popover");
});

test("demographics modal inherits the Folio consultation foundation", async ({
    page,
}) => {
    const mocks = await openSeededApp(page, "/note/1", {
        waitFor: ".pill-box-scribe",
    });
    await expectNoUnhandledApiRequests(mocks);

    await page.getByRole("button", { name: /Edit patient details/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder("First name")).toBeVisible();
    await expect(dialog.locator(".input-style").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
});

test("agent diff popover keeps non-color add and remove cues", async ({
    page,
}) => {
    await page.goto("/tests/browser/harnesses/agent-diff.html");
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(() => document.fonts.ready);

    const marker = page.getByRole("button", {
        name: /live agent modified this persistent field/i,
    });
    await expect(marker).toBeVisible();
    await marker.click();

    await expect(page.getByText("Agent edit — Past Medical History")).toBeVisible();
    await expect(page.locator(".agent-diff-line--add")).toContainText(
        "+ New line",
    );
    await expect(page.locator(".agent-diff-line--remove")).toContainText(
        "- Old line",
    );

    await expectStableScreenshot(page, "consultation-agent-diff");
});
