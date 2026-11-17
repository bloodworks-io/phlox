import { expect, test } from "@playwright/test";
import {
    expectNoUnhandledApiRequests,
    openSeededApp,
} from "../helpers/routeState";

test("system preference follows the project color scheme", async ({ page }) => {
    const mocks = await openSeededApp(page, "/", { waitFor: "textarea" });

    const state = await page.evaluate(() => ({
        preference: document.documentElement.dataset.themePreference,
        effective: document.documentElement.dataset.effectiveTheme,
        colorScheme: document.documentElement.style.colorScheme,
        themeColor: document
            .querySelector('meta[name="theme-color"]')
            ?.getAttribute("content"),
        className: document.documentElement.className,
    }));

    expect(state.preference).toBe("system");
    expect(["light", "dark"]).toContain(state.effective);
    expect(state.colorScheme).toBe(state.effective);
    expect(state.className).toContain(state.effective);
    expect(state.themeColor).toBe(
        state.effective === "dark" ? "#262b25" : "#f3f0e9",
    );

    await expectNoUnhandledApiRequests(mocks);
});

test("explicit light preference survives reload and dark system", async ({
    page,
}) => {
    await page.addInitScript(() => {
        window.localStorage.setItem("theme", "light");
    });

    const mocks = await openSeededApp(page, "/", { waitFor: "textarea" });

    const assertLight = async () => {
        const state = await page.evaluate(() => ({
            preference: document.documentElement.dataset.themePreference,
            effective: document.documentElement.dataset.effectiveTheme,
            colorScheme: document.documentElement.style.colorScheme,
            themeColor: document
                .querySelector('meta[name="theme-color"]')
                ?.getAttribute("content"),
        }));
        expect(state).toEqual({
            preference: "light",
            effective: "light",
            colorScheme: "light",
            themeColor: "#f3f0e9",
        });
    };

    await assertLight();
    await page.reload();
    await page.waitForSelector("textarea");
    await assertLight();

    await expectNoUnhandledApiRequests(mocks);
});

test("explicit dark preference survives reload and light system", async ({
    page,
}) => {
    await page.addInitScript(() => {
        window.localStorage.setItem("theme", "dark");
    });

    const mocks = await openSeededApp(page, "/", { waitFor: "textarea" });

    const assertDark = async () => {
        const state = await page.evaluate(() => ({
            preference: document.documentElement.dataset.themePreference,
            effective: document.documentElement.dataset.effectiveTheme,
            colorScheme: document.documentElement.style.colorScheme,
            themeColor: document
                .querySelector('meta[name="theme-color"]')
                ?.getAttribute("content"),
        }));
        expect(state).toEqual({
            preference: "dark",
            effective: "dark",
            colorScheme: "dark",
            themeColor: "#262b25",
        });
    };

    await assertDark();
    await page.reload();
    await page.waitForSelector("textarea");
    await assertDark();

    await expectNoUnhandledApiRequests(mocks);
});

test("system preference follows live OS theme changes", async ({ page }) => {
    const mocks = await openSeededApp(page, "/", { waitFor: "textarea" });

    await page.emulateMedia({ colorScheme: "dark" });
    await expect
        .poll(() =>
            page.evaluate(() => document.documentElement.dataset.effectiveTheme),
        )
        .toBe("dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect
        .poll(() =>
            page.evaluate(() => document.documentElement.dataset.effectiveTheme),
        )
        .toBe("light");

    await expectNoUnhandledApiRequests(mocks);
});

test("sidebar control returns an explicit theme to system", async ({
    page,
}) => {
    await page.addInitScript(() => {
        window.localStorage.setItem("theme", "dark");
    });

    const mocks = await openSeededApp(page, "/", { waitFor: "textarea" });

    await page
        .getByRole("button", { name: "Use system appearance" })
        .click();

    await expect
        .poll(() =>
            page.evaluate(() => document.documentElement.dataset.themePreference),
        )
        .toBe("system");
    await expect(page.evaluate(() => window.localStorage.getItem("theme"))).resolves.toBe(
        "system",
    );

    await page.emulateMedia({ colorScheme: "light" });
    await expect
        .poll(() =>
            page.evaluate(() => document.documentElement.dataset.effectiveTheme),
        )
        .toBe("light");

    await expectNoUnhandledApiRequests(mocks);
});

test("loads fonts from the application origin only", async ({ page }) => {
    const externalFontRequests: string[] = [];

    page.on("request", (request) => {
        const url = new URL(request.url());
        if (
            request.resourceType() === "font" &&
            url.origin !== new URL(page.url()).origin
        ) {
            externalFontRequests.push(request.url());
        }
    });

    const mocks = await openSeededApp(page, "/", { waitFor: "textarea" });
    await page.evaluate(() => document.fonts.ready);

    expect(externalFontRequests).toEqual([]);
    await expectNoUnhandledApiRequests(mocks);
});
