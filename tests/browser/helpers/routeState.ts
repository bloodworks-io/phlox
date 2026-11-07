import { expect, type Page } from "@playwright/test";
import { installApiMocks, type ApiMockController, type SeedVariant } from "./mockApi";
import { SEED_DATE } from "../fixtures/seed";

type OpenOptions = {
    variant?: SeedVariant;
    waitFor?: string;
    disclaimer?: boolean;
    waitMs?: number;
};

export async function openSeededApp(
    page: Page,
    route: string,
    options: OpenOptions = {},
): Promise<ApiMockController> {
    const mocks = await installApiMocks(page, options.variant);

    await page.clock.install({
        time: new Date(`${SEED_DATE}T09:30:00`),
    });

    await page.addInitScript(
        ({ showDisclaimer }) => {
            localStorage.setItem("phlox_api_token", "seed-token");
            localStorage.setItem("phlox-patient-scope", "mine");
            if (!showDisclaimer) {
                sessionStorage.setItem("disclaimerShown", "true");
            }

            let seed = 0x50484c58;
            Math.random = () => {
                seed = (seed * 1664525 + 1013904223) % 4294967296;
                return seed / 4294967296;
            };
        },
        { showDisclaimer: options.disclaimer ?? false },
    );

    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");

    if (options.waitFor) {
        await expect(page.locator(options.waitFor).first()).toBeVisible();
    }

    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(options.waitMs ?? 350);
    return mocks;
}

export async function expectStableScreenshot(
    page: Page,
    name: string,
    options: { clip?: { x: number; y: number; width: number; height: number } } = {},
) {
    await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: false,
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.02,
        clip: options.clip,
    });
}

export async function expectNoUnhandledApiRequests(mocks: ApiMockController) {
    await expect
        .poll(() => mocks.unmatchedRequests, { timeout: 1000 })
        .toEqual([]);
}
