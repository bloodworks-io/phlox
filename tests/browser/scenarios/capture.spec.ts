import { expect, test } from "@playwright/test";
import { openSeededApp } from "../helpers/routeState";

test("capture pill and tool rail expose Folio state semantics", async ({ page }) => {
    await openSeededApp(page, "/note/1", { waitFor: ".pill-box-scribe" });

    const record = page.getByRole("button", { name: /^Record$/ });
    await expect(record).toHaveAttribute("data-capture-state", "idle");
    await expect(record).toHaveAccessibleName(/^Record$/i);

    const reasoning = page.locator("#fab-reasoning");
    await expect(reasoning).toHaveAttribute("aria-pressed", "false");
    await expect(reasoning).toHaveAccessibleName(
        /Open Reasoning, Critical reasoning available/i,
    );
    await expect(
        page.locator('#fab-reasoning + div[aria-hidden="true"]'),
    ).toHaveCount(1);

    const chat = page.locator("#fab-chat");
    await chat.click();
    await page.locator(".floating-panel").waitFor();
    await expect(chat).toHaveAttribute("aria-pressed", "true");

    const materials = await page.evaluate(() => {
        const root = document.documentElement;
        const panel = document.querySelector<HTMLElement>(".floating-panel");
        const arrow = document.querySelector<SVGPathElement>(
            'svg[viewBox="4 0 6 24"] path',
        );
        return {
            paper: getComputedStyle(root)
                .getPropertyValue("--chakra-colors-folio-paper")
                .trim(),
            line: getComputedStyle(root)
                .getPropertyValue("--chakra-colors-folio-line")
                .trim(),
            panelBackground: panel ? getComputedStyle(panel).backgroundColor : "",
            arrowFill: arrow?.getAttribute("fill") ?? "",
        };
    });

    expect(materials.arrowFill).toBe(materials.paper);
    expect(materials.panelBackground).toMatch(
        /^(rgb\(255, 253, 248\)|rgb\(48, 54, 45\))$/,
    );

    await chat.click();
    await expect(page.locator(".floating-panel")).toBeHidden();
    await expect(chat).toHaveAttribute("aria-pressed", "false");
});

test("transcript popover keeps categorical speaker identity", async ({ page }) => {
    await openSeededApp(page, "/note/1", { waitFor: ".pill-box-scribe" });

    const transcriptToggle = page.getByRole("button", { name: /^Transcript$/ });
    await transcriptToggle.click();
    await expect(transcriptToggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("[data-line]").first()).toBeAttached();
    await expect(page.locator('[data-speaker="S1"]').first()).toBeAttached();
    await expect(page.locator('[data-speaker="S2"]').first()).toBeAttached();

    const speakerMaterials = await page.evaluate(() => {
        const dots = Array.from(
            document.querySelectorAll<HTMLElement>("[data-speaker]"),
        );
        return {
            speakers: dots.map((dot) => dot.dataset.speaker),
            colors: dots.map((dot) => getComputedStyle(dot).backgroundColor),
        };
    });

    expect(new Set(speakerMaterials.speakers)).toEqual(
        new Set(["S1", "S2"]),
    );
    expect(new Set(speakerMaterials.colors).size).toBe(2);
});
