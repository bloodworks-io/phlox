import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { openSeededApp } from "../helpers/routeState";

type MotionInventory = {
    reducedMotion: string;
    animated: Array<{ selector: string; name: string; duration: string; iteration: string }>;
    transitions: Array<{ selector: string; property: string; duration: string }>;
};

const motionInventory = (): MotionInventory => {
    const animated: MotionInventory["animated"] = [];
    const transitions: MotionInventory["transitions"] = [];
    for (const element of Array.from(document.querySelectorAll("*"))) {
        const styles = window.getComputedStyle(element);
        if (styles.animationName !== "none") {
            animated.push({
                selector: element.tagName.toLowerCase(),
                name: styles.animationName,
                duration: styles.animationDuration,
                iteration: styles.animationIterationCount,
            });
        }
        if (styles.transitionProperty !== "none" && styles.transitionDuration !== "0s") {
            transitions.push({
                selector: element.tagName.toLowerCase(),
                property: styles.transitionProperty,
                duration: styles.transitionDuration,
            });
        }
    }
    return {
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "reduce"
            : "no-preference",
        animated,
        transitions,
    };
};

test("current motion inventory", async ({ page }, testInfo) => {
    await openSeededApp(page, "/note/1", { waitFor: ".pill-box-scribe" });

    const normal = await page.evaluate(motionInventory);

    expect(normal.animated).toBeInstanceOf(Array);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(100);

    const reduced = await page.evaluate(motionInventory);

    expect(reduced.reducedMotion).toBe("reduce");

    await testInfo.attach("motion-inventory", {
        body: JSON.stringify({ normal, reduced }, null, 2),
        contentType: "application/json",
    });

    const motionPath = testInfo.outputPath("motion-inventory.json");
    await mkdir(dirname(motionPath), { recursive: true });
    await writeFile(
        motionPath,
        `${JSON.stringify({ normal, reduced }, null, 2)}\n`,
        "utf8",
    );
});
