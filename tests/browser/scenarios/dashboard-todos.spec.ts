import { expect, test, type Locator, type Page } from "@playwright/test";
import { openSeededApp } from "../helpers/routeState";

async function expectNoCardScrollbox(page: Page) {
    // Only the dashboard page may scroll around the card. In particular, no
    // intermediate wrapper may clip it or create another scrolling viewport.
    const wrappers = await page.getByTestId("dashboard-todo-panel").evaluate((panel) => {
        const constrained: string[] = [];
        for (
            let element: Element | null = panel;
            element && !element.classList.contains("main-bg");
            element = element.parentElement
        ) {
            const overflow = getComputedStyle(element).overflowY;
            if (["auto", "scroll", "hidden", "clip"].includes(overflow)) {
                constrained.push(overflow);
            }
        }
        return constrained;
    });
    expect(wrappers).toEqual([]);
}

// Visibility assertions alone don't catch an ancestor clipping a painted task.
async function expectTaskReachable(task: Locator) {
    await expect.poll(() => task.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
        );
        return hit !== null && element.contains(hit);
    })).toBe(true);
}

async function waitForTodoExpansion(page: Page) {
    await expect.poll(() => page.getByTestId("dashboard-todo-panel").evaluate(
        (element) => element.getAnimations({ subtree: true })
            .some((animation) => animation.playState === "running"),
    )).toBe(false);
}

async function scrollDashboardToBottom(page: Page) {
    const dashboard = page.locator(".main-bg");
    const rect = (await dashboard.boundingBox())!;
    // Scroll on the page's empty right gutter, outside the task list's own
    // scroll area, to exercise normal page scrolling rather than auto-scroll.
    await page.mouse.move(rect.x + rect.width - 24, rect.y + rect.height / 2);
    await page.mouse.wheel(0, 10000);
    await expect.poll(() => dashboard.evaluate((element) =>
        element.scrollHeight - element.clientHeight - element.scrollTop,
    )).toBeLessThanOrEqual(1);
}

async function expectWholeCardInView(page: Page) {
    await expect.poll(async () => {
        const dashboard = (await page.locator(".main-bg").boundingBox())!;
        const card = (await page.getByTestId("dashboard-todo-panel").boundingBox())!;
        return card.y >= dashboard.y - 1
            && card.y + card.height <= dashboard.y + dashboard.height - 23;
    }).toBe(true);
}

test("empty todos expand fully with no enclosing scrollbox", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 1000 });
    await openSeededApp(page, "/", {
        variant: { todos: "empty" },
        waitFor: "textarea",
    });
    const composer = page.locator(".dashboard-chat-input-container");
    const beforeExpansion = (await composer.boundingBox())!;
    await page.getByRole("button", { name: "Todo list" }).click();
    await waitForTodoExpansion(page);

    await expectNoCardScrollbox(page);
    await expectWholeCardInView(page);
    await expectTaskReachable(page.getByText("No tasks yet.", { exact: true }));
    const afterExpansion = (await composer.boundingBox())!;
    expect(afterExpansion.y).toBe(beforeExpansion.y);
    const card = (await page.getByTestId("dashboard-todo-panel").boundingBox())!;
    expect(Math.abs(card.x + card.width / 2 - (afterExpansion.x + afterExpansion.width / 2)))
        .toBeLessThanOrEqual(1);
});

test("short windows scroll the page to expose the whole todo card", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 600 });
    await openSeededApp(page, "/", {
        variant: { todos: "empty" },
        waitFor: "textarea",
    });
    await page.getByRole("button", { name: "Todo list" }).click();
    await waitForTodoExpansion(page);
    await expectNoCardScrollbox(page);
    await expect.poll(() => page.locator(".main-bg").evaluate((element) =>
        element.scrollHeight - element.clientHeight,
    )).toBeGreaterThan(0);
    await scrollDashboardToBottom(page);
    await expectWholeCardInView(page);
    await expectTaskReachable(page.getByText("No tasks yet.", { exact: true }));

    await page.setViewportSize({ width: 900, height: 550 });
    await scrollDashboardToBottom(page);
    await expectWholeCardInView(page);
    await expectTaskReachable(page.getByText("No tasks yet.", { exact: true }));
});

test("long task lists still scroll after resizing and growing the composer", async ({ page }) => {
    const todos = Array.from({ length: 30 }, (_, index) => ({
        id: index + 1,
        task: `Layout task ${index + 1}`,
        completed: false,
    }));
    await openSeededApp(page, "/", { variant: { todos }, waitFor: "textarea" });
    const composer = page.getByPlaceholder("Message Phlox...");
    const beforeExpansion = (await composer.boundingBox())!;
    await page.getByRole("button", { name: "Todo list" }).click();
    await waitForTodoExpansion(page);
    expect((await composer.boundingBox())!.y).toBe(beforeExpansion.y);

    await page.setViewportSize({ width: 1200, height: 650 });
    await composer.fill("First line");
    await expect(page.locator(".dashboard-chat-suggestions")).toHaveCount(0);
    await composer.fill(Array.from({ length: 8 }, (_, index) => `Line ${index}`).join("\n"));
    await scrollDashboardToBottom(page);
    await expectNoCardScrollbox(page);
    await expectWholeCardInView(page);

    const items = page.getByTestId("dashboard-todo-items");
    const rect = (await items.boundingBox())!;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.wheel(0, 10000);
    await expect.poll(() => items.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expectTaskReachable(page.getByText("Layout task 30", { exact: true }));
});
