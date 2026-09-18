#!/usr/bin/env node
/** Repeatable UI checks in a fresh, offline browser context; never touches server captures. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const base = (process.env.DEMO_URL || "http://localhost:5173").replace(/\/$/, "");
const output = resolve(process.env.DEMO_ARTIFACTS || "/tmp/tacit-demo-smoke");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
await context.addInitScript(() => {
  localStorage.setItem("tacit.mode", "local");
  localStorage.setItem("tacit.settings.v1", JSON.stringify({ provider: "none", apiKey: "" }));
});
// The fixture uses the real browser engine with no paid provider or server writes.
await context.route("**/api/**", (route) => route.abort());
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const results = { startedAt: new Date().toISOString(), base, browser: browser.version(), checks: [], errors };
const check = async (name, run) => {
  const start = Date.now();
  try {
    await run();
    results.checks.push({ name, status: "pass", milliseconds: Date.now() - start });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.checks.push({ name, status: "fail", error: error.message });
    await page.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => {});
    throw error;
  }
};
const go = (path) => page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
const screenshot = (name) => page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
const waitText = (text) => page.getByText(text, { exact: false }).first().waitFor();
let captureId;

try {
  await check("Landing page loads with working product images", async () => {
    await go("/");
    await page.getByRole("heading", { level: 1 }).waitFor();
    for (const img of await page.locator("img").all()) {
      await img.scrollIntoViewIfNeeded();
      await page.waitForFunction((element) => element.complete && element.naturalWidth > 0, await img.elementHandle());
      assert.ok(await img.getAttribute("alt"), "Product image needs alt text");
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshot("landing");
  });

  await check("Load all three sample captures", async () => {
    await go("/app");
    await page.getByRole("button", { name: "Load sample captures" }).first().click();
    for (const name of ["Maria Chen", "Dev Patel", "Luis Ortega"]) await page.getByRole("heading", { name }).waitFor();
    await screenshot("dashboard");
  });

  await check("Create a capture from the setup form", async () => {
    await go("/new");
    await page.getByLabel("Name", { exact: true }).first().fill("Avery Demo");
    await page.getByLabel("Role", { exact: true }).first().fill("Payroll Specialist");
    await page.getByPlaceholder("Jordan Reyes", { exact: true }).fill("Sam Demo");
    await page.getByLabel("What does this role own?").fill("Owns payroll, ACH funding and Workday reconciliation for a small operations team.");
    await page.getByRole("button", { name: /^(Plan the capture|Create capture)$/ }).click();
    await page.waitForURL(/\/c\/[^/]+$/);
    captureId = new URL(page.url()).pathname.split("/").pop();
    await page.getByRole("heading", { name: /Avery/ }).waitFor();
  });

  await check("Interview extracts knowledge and ends cleanly", async () => {
    await go(`/c/${captureId}/interview`);
    await page.getByRole("button", { name: /Type answers/ }).click();
    await page.getByRole("button", { name: /^(Begin session|Start interview)$/ }).click();
    const input = page.getByRole("textbox").last();
    await input.fill("The real ACH cut-off is 3:30pm, not 5pm. First call the Treasury desk if the file is rejected, then correct the record in Workday. Never resend a file until Treasury confirms the old file is cancelled.");
    await input.press("Enter");
    await waitText("The real ACH cut-off is 3:30pm");
    await page.getByRole("button", { name: /^(End session|End interview)$/ }).click();
    await waitText("Session captured");
    await screenshot("interview-complete");
  });

  await check("Knowledge survives page reload and can be edited by keyboard", async () => {
    await go(`/c/${captureId}/knowledge`);
    await page.locator("article").first().waitFor();
    await page.reload();
    await page.locator("article").first().waitFor();
    const edit = page.getByRole("button", { name: /^Edit\b/ }).first();
    await edit.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await edit.evaluate((element) => element === document.activeElement), true);
    await screenshot("knowledge");
  });

  await check("Twin answers with citations and keeps citation focus", async () => {
    await go(`/c/${captureId}/ask`);
    const input = page.locator("input[placeholder],textarea").last();
    await input.fill("What is the ACH cut-off time?");
    await input.press("Enter");
    await page.locator(".cite").first().waitFor();
    assert.match(await page.locator("main").innerText(), /3:30/);
    const cite = page.locator(".cite").first();
    await cite.focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement !== document.body), true);
    await screenshot("cited-answer");
  });

  await check("Unknown successor question returns in the next interview", async () => {
    const input = page.locator("input[placeholder],textarea").last();
    await input.fill("How do I renew the forklift certification?");
    await input.press("Enter");
    await waitText("queued");
    await go(`/c/${captureId}/interview`);
    await page.getByRole("button", { name: /Type answers/ }).click();
    await page.getByRole("button", { name: /^(Begin session|Start interview)$/ }).click();
    await waitText("forklift certification");
    const answer = page.getByRole("textbox").last();
    await answer.fill("First call Ramon in Facilities, then book the practical assessment with the approved training vendor before the card expires. Ramon keeps the renewal dates in the training register.");
    await answer.press("Enter");
    await waitText("Ramon keeps the renewal dates");
    await page.getByRole("button", { name: /^(End session|End interview)$/ }).click();
    await waitText("Session captured");
    await go(`/c/${captureId}/handover`);
    await waitText("Ramon");
    assert.match(await page.locator("main").innerText(), /3:30/);
    await screenshot("handover");
  });

  await check("Constellation renders without opening the camera automatically", async () => {
    let cameraRequested = false;
    await context.exposeBinding("recordCameraRequest", () => { cameraRequested = true; });
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (constraints) => {
        if (constraints.video) window.recordCameraRequest();
        return original(constraints);
      };
    });
    await go("/c/cap_maria/graph");
    await page.locator("canvas").first().waitFor();
    await page.waitForTimeout(1000);
    assert.equal(cameraRequested, false, "Camera should open only after an explicit action");
    await page.getByLabel("Ask a question", { exact: true }).fill("What is the ACH cut-off time?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await waitText("3:30");
    await page.waitForTimeout(700);
    await screenshot("constellation");
  });

  await check("Mobile dashboard fits the viewport", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await go("/app");
    await page.getByRole("heading", { name: "Maria Chen" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
    await screenshot("mobile");
  });
  assert.deepEqual(errors, [], "Unexpected browser errors");
  results.status = "pass";
} catch (error) {
  results.status = "fail";
  console.error(error);
  process.exitCode = 1;
} finally {
  results.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2));
  await context.close();
  await browser.close();
  console.log(`Evidence: ${output}`);
}
