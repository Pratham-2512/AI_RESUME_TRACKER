import { test, expect } from "@playwright/test";

const JD = `Senior Full-Stack Engineer at Acme Corp.
We need 4+ years of experience with JavaScript, TypeScript, React, Node.js and SQL.
You will build scalable APIs, own CI/CD, and work with AWS and Docker.`;

// Flow 5: the connected pipeline — select job → compatibility → honest tailoring →
// report → cover letter → track.
test("application studio runs the full pipeline", async ({ page }) => {
  await page.goto("/app/studio");
  await expect(page.getByRole("heading", { name: /Application Studio/i })).toBeVisible();

  // Step 1 — fill job details (resume defaults to primary).
  await page.getByPlaceholder(/Job title/i).fill("Senior Full-Stack Engineer");
  await page.getByPlaceholder(/^Company$/i).fill("Acme Corp");
  await page.getByPlaceholder(/Paste the full job description/i).fill(JD);
  await page.getByRole("button", { name: /Analyze Compatibility/i }).click();

  // Step 2 — compatibility analysis with current-match score and decision cards.
  await expect(page.getByText(/JD compatibility analysis/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Current match/i)).toBeVisible();
  await expect(page.getByText(/How would you like to proceed/i)).toBeVisible();

  // Step 3 — honest tailoring path (no skill confirmation needed).
  await page.getByRole("button", { name: /Honest Tailoring/i }).click();

  // Step 4 — tailoring report with before/after scores + integrity verification.
  await expect(page.getByText(/Tailoring report/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Match after", { exact: true })).toBeVisible();
  await expect(page.getByText(/Integrity verification/i)).toBeVisible();

  // Step 5 — cover letter generated from real data.
  await page.getByRole("button", { name: /Generate Cover Letter/i }).click();
  await expect(page.getByText(/Dear Hiring Manager/i)).toBeVisible({ timeout: 30_000 });

  // Step 6 — apply assistant checklist + tracking.
  await page.getByRole("button", { name: /Apply & Track/i }).click();
  await expect(page.getByText(/Apply assistant/i)).toBeVisible();
  await page.getByRole("button", { name: /Track this application/i }).click();
  await expect(page.getByRole("link", { name: /Tracked — view pipeline/i })).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: "screenshots/e2e/05-application-studio.png", fullPage: true });
});
