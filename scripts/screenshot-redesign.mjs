// Capture redesign screenshots at desktop + mobile widths.
// Usage: node scripts/screenshot-redesign.mjs [baseUrl]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const pages = [
  ["dashboard", "/app/dashboard"],
  ["studio", "/app/studio"],
  ["copilot", "/app/copilot"],
  ["tailor", "/app/tailor"],
  ["coach", "/app/coach"],
  ["analytics", "/app/analytics"],
  ["pipeline", "/app/applications"],
  ["interview", "/app/interview"],
];

const browser = await chromium.launch();
for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "mobile"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const [name, path] of pages) {
    if (tag === "mobile" && !["dashboard", "studio"].includes(name)) continue;
    try {
      await page.goto(base + path, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `screenshots/redesign-${name}-${tag}.png` });
      console.log(`ok ${name} ${tag}`);
    } catch (e) {
      console.log(`FAIL ${name} ${tag}: ${e.message}`);
    }
  }
  await page.close();
}
await browser.close();
