import { test, expect } from "@playwright/test";
import path from "node:path";

// Flow 1: Resume upload — drag/click upload of a TXT file → text extracted.
test("resume upload extracts text", async ({ page }) => {
  await page.goto("/app/resumes");
  await expect(page.getByRole("heading", { name: /Résumés/i })).toBeVisible();

  await page.getByRole("button", { name: /Add résumé/i }).click();
  // Upload mode is the default; set the file on the hidden input.
  const fixture = path.join(__dirname, "fixtures", "sample-resume.txt");
  await page.locator('input[type="file"]').setInputFiles(fixture);

  // Status card confirms extraction.
  await expect(page.getByText(/characters extracted/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("✓ Uploaded")).toBeVisible();
  await expect(page.getByText("✓ Parsed")).toBeVisible();

  // Extracted text lands in the editable textarea.
  await expect(page.locator("textarea")).toContainText("Senior Software Engineer");

  await page.screenshot({ path: "screenshots/e2e/01-resume-upload.png", fullPage: true });
});
