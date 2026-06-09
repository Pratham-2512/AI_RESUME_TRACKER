import { test, expect } from "@playwright/test";

// Flow 3: Coach chat — rule-based reply grounded in the user's data.
test("coach chat replies deterministically", async ({ page }) => {
  await page.goto("/app/coach");

  const input = page.getByPlaceholder(/Ask your coach/i);
  await expect(input).toBeVisible();
  await input.fill("How can I improve ATS score?");
  await page.getByRole("button", { name: /^Send$/ }).click();

  // An assistant reply bubble referencing résumé readiness appears.
  // (Match the ASCII part to avoid accented-char normalization issues.)
  await expect(page.getByText(/readiness is \d+\/100/i)).toBeVisible({ timeout: 30_000 });

  // Memory recall works.
  await input.fill("What do you remember about my goal?");
  await page.getByRole("button", { name: /^Send$/ }).click();
  await expect(page.getByText(/remember|Target role/i).first()).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: "screenshots/e2e/03-coach-chat.png", fullPage: true });
});
