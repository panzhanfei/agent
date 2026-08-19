import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const root = path.resolve(__dirname, "../..");
const reportDir = path.join(root, "reports/playwright");

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  outputDir: path.join(reportDir, "test-results"),
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: path.join(reportDir, "html") }],
    ["json", { outputFile: path.join(reportDir, "results.json") }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
