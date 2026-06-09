import { test, expect } from "@playwright/test";

// Flow 4: Application pipeline — funnel + stage board render from real data.
test("application pipeline renders funnel and stages", async ({ page }) => {
  await page.goto("/app/applications");

  await expect(page.getByRole("heading", { name: /Application Pipeline/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Conversion funnel/i })).toBeVisible();

  // Funnel stages + key metrics are present.
  await expect(page.getByText(/Applied/).first()).toBeVisible();
  await expect(page.getByText(/Interview Rate/i)).toBeVisible();
  await expect(page.getByText(/Offer Rate/i)).toBeVisible();

  await page.screenshot({ path: "screenshots/e2e/04-application-pipeline.png", fullPage: true });
});
