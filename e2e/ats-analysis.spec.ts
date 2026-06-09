import { test, expect } from "@playwright/test";

const RESUME_TEXT = `Jordan Lee — Senior Software Engineer
Reduced API latency by 45% by introducing Redis caching across 4 services.
Led a team of 6 engineers to ship a payments platform processing $2M/month.
Built CI/CD pipelines that cut deploy time from 40 minutes to 6 minutes.
Skills: JavaScript, TypeScript, React, Node.js, PostgreSQL, AWS, Docker.`;

// Flow 2: ATS analysis — create a résumé (paste) → run deterministic analysis.
test("ATS analysis returns scores", async ({ page }) => {
  await page.goto("/app/resumes");
  await page.getByRole("button", { name: /Add résumé/i }).click();
  await page.getByRole("button", { name: /Paste text/i }).click();
  await page.locator("textarea").fill(RESUME_TEXT);
  await page.getByRole("button", { name: /Save résumé/i }).click();

  // Lands on the detail page.
  await page.waitForURL(/\/app\/resumes\/[0-9a-f-]{36}/, { timeout: 30_000 });

  // Run the instant (deterministic) analysis.
  await page.getByRole("button", { name: /^Run analysis$/i }).click();
  await expect(page.getByText(/^ATS$/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Quality/)).toBeVisible();

  await page.screenshot({ path: "screenshots/e2e/02-ats-analysis.png", fullPage: true });
});
