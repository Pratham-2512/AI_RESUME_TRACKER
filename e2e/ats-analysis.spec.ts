import { test, expect } from "@playwright/test";

const RESUME_TEXT = `Jordan Lee — Senior Software Engineer
Worked on the payments platform and helped the team.
Responsible for the API and assisted with deployments.
Built CI/CD pipelines that cut deploy time from 40 minutes to 6 minutes.
Skills: JavaScript, TypeScript, React, Node.js`;

// Flow 2: ATS analysis (deterministic) — create a résumé, run analysis + rewrite.
test("ATS analysis returns numeric scores and improvement", async ({ page }) => {
  await page.goto("/app/resumes");
  await page.getByRole("button", { name: /Add résumé/i }).click();
  await page.getByRole("button", { name: /Paste text/i }).click();
  await page.locator("textarea").fill(RESUME_TEXT);
  await page.getByRole("button", { name: /Save résumé/i }).click();
  await page.waitForURL(/\/app\/resumes\/[0-9a-f-]{36}/, { timeout: 30_000 });

  // Instant deterministic inspector.
  await page.getByRole("button", { name: /^Run analysis$/i }).click();
  await expect(page.getByText(/^ATS$/)).toBeVisible({ timeout: 30_000 });

  // Workspace ATS analysis — Before ring must be numeric (never "—"), with breakdown + strengths/weaknesses.
  await page.getByRole("button", { name: /^Analyze ATS$/i }).click();
  await expect(page.getByText(/ATS breakdown/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Strengths")).toBeVisible();
  await expect(page.getByText("Weaknesses")).toBeVisible();
  // The "ATS Before" pill shows a number, not a dash.
  await expect(page.getByText("ATS Before")).toBeVisible();
  const pill = page.getByText("ATS Before").locator("xpath=preceding-sibling::div[1]");
  await expect(pill).not.toHaveText("—");

  // Deterministic rewrite → numeric After + Improvement delta.
  await page.getByRole("button", { name: /AI rewrite/i }).click();
  await expect(page.getByText(/Improvement/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/AI versions/i)).toBeVisible();

  await page.screenshot({ path: "screenshots/e2e/02-ats-analysis.png", fullPage: true });
});
