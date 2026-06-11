import { test, expect } from "@playwright/test";

const JD = `Senior Full-Stack Engineer at Acme Corp.
We need 4+ years of experience with JavaScript, TypeScript, React, Node.js and SQL.
You will build scalable APIs, own CI/CD, and work with AWS and Docker.`;

// Flow 5: the connected pipeline — select job → analyze → tailor → cover letter → track.
test("application studio runs the full pipeline", async ({ page }) => {
  await page.goto("/app/studio");
  await expect(page.getByRole("heading", { name: /Application Studio/i })).toBeVisible();

  // Step 1 — fill job details (resume defaults to primary).
  await page.getByPlaceholder(/Job title/i).fill("Senior Full-Stack Engineer");
  await page.getByPlaceholder(/^Company$/i).fill("Acme Corp");
  await page.getByPlaceholder(/Paste the full job description/i).fill(JD);
  await page.getByRole("button", { name: /Analyze JD/i }).click();

  // Step 2 — match analysis with explanation.
  await expect(page.getByText(/Why matched:/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Interview probability/i)).toBeVisible();

  // Step 3 — tailored résumé (deterministic, always numeric ATS).
  await page.getByRole("button", { name: /Generate tailored résumé/i }).click();
  await expect(page.getByText(/Tailored résumé/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/ATS \d+/)).toBeVisible();

  // Step 4 — cover letter generated from real data.
  await page.getByRole("button", { name: /Generate cover letter/i }).click();
  await expect(page.getByText(/Dear Hiring Manager/i)).toBeVisible({ timeout: 30_000 });

  // Step 5 — apply assistant checklist + tracking.
  await page.getByRole("button", { name: /Apply & track/i }).click();
  await expect(page.getByText(/Apply assistant/i)).toBeVisible();
  await expect(page.getByText(/Mirror the job's exact keywords/i)).toBeVisible();
  await page.getByRole("button", { name: /Track this application/i }).click();
  await expect(page.getByRole("link", { name: /Tracked — view pipeline/i })).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: "screenshots/e2e/05-application-studio.png", fullPage: true });
});
