import { test, expect } from "@playwright/test";

test("homepage is reachable", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
});
