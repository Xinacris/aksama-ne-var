import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** `npm run screenshots` — every screen at 390 and 1440, light and dark, into screenshots/. */
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: ["**/screenshots.spec.ts"],
  timeout: 180_000,
  projects: [
    { name: "390-light", use: { viewport: { width: 390, height: 844 }, colorScheme: "light", hasTouch: true } },
    { name: "390-dark", use: { viewport: { width: 390, height: 844 }, colorScheme: "dark", hasTouch: true } },
    { name: "1440-light", use: { viewport: { width: 1440, height: 900 }, colorScheme: "light" } },
    { name: "1440-dark", use: { viewport: { width: 1440, height: 900 }, colorScheme: "dark" } },
  ],
});
