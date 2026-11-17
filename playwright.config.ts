import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/browser",
    outputDir: "./test-results/e2e",
    timeout: 45_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [
        ["list"],
        ["html", { outputFolder: "./test-results/e2e-report", open: "never" }],
    ],
    snapshotPathTemplate:
        "{testDir}/baselines/{projectName}/{testFileName}-{arg}{ext}",
    use: {
        baseURL: "http://127.0.0.1:3000",
        viewport: { width: 1200, height: 800 },
        deviceScaleFactor: 1,
        actionTimeout: 5_000,
        navigationTimeout: 15_000,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "off",
    },
    projects: [
        {
            name: "chromium-light",
            use: {
                ...devices["Desktop Chrome"],
                colorScheme: "light",
                viewport: { width: 1200, height: 800 },
            },
        },
        {
            name: "chromium-dark",
            use: {
                ...devices["Desktop Chrome"],
                colorScheme: "dark",
                viewport: { width: 1200, height: 800 },
            },
        },
        {
            name: "webkit-light",
            use: {
                ...devices["Desktop Safari"],
                colorScheme: "light",
                viewport: { width: 1200, height: 800 },
            },
        },
        {
            name: "webkit-dark",
            use: {
                ...devices["Desktop Safari"],
                colorScheme: "dark",
                viewport: { width: 1200, height: 800 },
            },
        },
    ],
    webServer: {
        command: "npm run start-react",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 60_000,
        stdout: "ignore",
        stderr: "pipe",
    },
});
