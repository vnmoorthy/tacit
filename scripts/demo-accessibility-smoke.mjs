#!/usr/bin/env node
/** Keyboard, recovery and responsive regressions; fresh fictional data, no real microphone. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const base = (process.env.DEMO_URL || "http://localhost:5173").replace(/\/$/, "");
const output = resolve(process.env.DEMO_ARTIFACTS || "/tmp/tacit-demo-accessibility");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
await context.addInitScript(() => {
  localStorage.setItem("tacit.mode", "local");
  localStorage.setItem("tacit.settings.v1", JSON.stringify({ provider: "none", apiKey: "" }));
  // These assertions test playback lifecycle, not acoustic voice quality.
  window.__speech = [];
  window.__mic = 0;
  window.__cancelled = false;
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  Object.defineProperty(window, "speechSynthesis", { value: {
    getVoices: () => [], addEventListener() {}, removeEventListener() {}, resume() {},
    speak(utterance) { window.__speech.push(utterance.text); },
    cancel() { window.__cancelled = true; },
  } });
  Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("Clipboard denied by fixture"); } } });
  navigator.mediaDevices.getUserMedia = async () => { window.__mic++; throw new Error("Unexpected microphone access"); };
});
await context.route("**/api/**", (route) => route.abort());
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const results = { startedAt: new Date().toISOString(), browser: browser.version(), checks: [], errors };
const go = (path) => page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
const check = async (name, run) => {
  try {
    await run();
    results.checks.push({ name, status: "pass" });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.checks.push({ name, status: "fail", error: error.message });
    await page.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => {});
    throw error;
  }
};

try {
  await check("Landing CTAs have one focus target; sample results are announced", async () => {
    await go("/");
    await page.getByRole("link", { name: "Try it now — no sign-up" }).waitFor();
    assert.equal(await page.locator("a button").count(), 0);
    await go("/app");
    await page.getByRole("button", { name: "Load sample captures" }).first().click();
    await page.getByRole("status").filter({ hasText: "Loaded 3 sample captures" }).waitFor();
    await page.getByRole("button", { name: "Dismiss notification" }).click();
  });

  await check("Atom editor traps keyboard focus, validates content and restores its trigger", async () => {
    await go("/c/cap_maria/knowledge");
    const edit = page.getByRole("button", { name: /^Edit / }).first();
    await edit.waitFor();
    await page.mouse.move(0, 0);
    await edit.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Edit atom" });
    await dialog.waitFor();
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press(key);
        assert(await dialog.evaluate((element) => element.contains(document.activeElement)), `Focus escaped on ${key}`);
      }
    }
    await dialog.getByLabel("Title", { exact: true }).fill("");
    assert(await dialog.getByRole("button", { name: "Save", exact: true }).isDisabled());
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert(await edit.evaluate((element) => element === document.activeElement));
    await page.getByRole("button", { name: /^Delete / }).first().click();
    await page.getByRole("dialog", { name: "Delete this atom?" }).waitFor();
    assert.equal(await page.locator(":focus").innerText(), "Cancel");
    await page.keyboard.press("Escape");
  });

  await check("Empty filtered knowledge can be recovered; amber text passes contrast", async () => {
    await page.getByRole("combobox", { name: "Filter by domain" }).waitFor();
    await page.getByRole("textbox", { name: "Search knowledge" }).fill("no_result_abcdef");
    await page.getByText("No matching knowledge").waitFor();
    await page.getByRole("button", { name: "Clear filters" }).click();
    const badge = page.locator("article span").filter({ hasText: /^Gotcha$/ }).first();
    await badge.waitFor();
    const ratio = await badge.evaluate((element) => {
      const style = getComputedStyle(element);
      const luminance = (color) => {
        const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => {
          const channel = value / 255;
          return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
        });
        return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
      };
      const fg = luminance(style.color), bg = luminance(style.backgroundColor);
      return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
    });
    assert(ratio >= 4.5, `Amber contrast was ${ratio.toFixed(2)}:1`);
    results.amberContrast = ratio;
  });

  await check("Failed saves stay visible inside the modal and can be retried", async () => {
    await page.getByRole("button", { name: /^Edit / }).first().click();
    const dialog = page.getByRole("dialog", { name: "Edit atom" });
    await dialog.waitFor();
    await page.evaluate(() => {
      window.__originalStorageWrite = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "tacit.db.v1") throw new DOMException("Simulated storage full", "QuotaExceededError");
        return window.__originalStorageWrite.call(this, key, value);
      };
    });
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await dialog.getByRole("alert").filter({ hasText: "could not save" }).waitFor();
    await page.evaluate(() => { Storage.prototype.setItem = window.__originalStorageWrite; });
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
  });

  await check("Deleting local data requires confirmation and Cancel preserves samples", async () => {
    await go("/settings");
    await page.getByRole("button", { name: "Delete local captures", exact: true }).click();
    await page.getByRole("dialog", { name: "Delete local captures?" }).waitFor();
    assert.equal(await page.locator(":focus").innerText(), "Cancel");
    await page.keyboard.press("Escape");
    await go("/c/cap_maria/knowledge");
    await page.getByRole("button", { name: /^Edit / }).first().waitFor();
    assert.equal(await page.locator("article").count(), 29);
  });

  await check("Voice preview starts and stops without microphone access (simulated synthesis)", async () => {
    await go("/c/cap_maria");
    await page.getByRole("button", { name: "Hear the twin" }).click();
    await page.getByRole("button", { name: "Stop preview" }).waitFor();
    assert.equal(await page.evaluate(() => window.__mic), 0);
    assert.equal(await page.evaluate(() => window.__speech.length), 1);
    await page.getByRole("button", { name: "Stop preview" }).click();
    await page.getByRole("button", { name: "Hear the twin" }).waitFor();
    assert.equal(await page.evaluate(() => window.__cancelled), true);
    await page.getByRole("button", { name: "Capture actions" }).click();
    await page.getByRole("button", { name: "Delete capture", exact: true }).click();
    await page.getByRole("dialog", { name: "Delete this capture?" }).waitFor();
    assert.equal(await page.locator(":focus").innerText(), "Cancel");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(":focus").getAttribute("id"), "capture-actions");
  });

  await check("Clipboard failure has a working Markdown download fallback", async () => {
    await go("/c/cap_maria/handover");
    await page.getByRole("button", { name: "Copy Markdown" }).click();
    await page.getByRole("alert").filter({ hasText: "Clipboard access is unavailable" }).waitFor();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download .md" }).click();
    assert((await downloadPromise).suggestedFilename().endsWith(".md"));
  });

  await check("Selecting a cited answer preserves keyboard focus", async () => {
    await go("/c/cap_maria/ask");
    await page.getByRole("button", { name: "Turn off spoken answers" }).click();
    await page.getByRole("button", { name: "The ACH file bounced on a Friday afternoon. What do I do?" }).click();
    const cite = page.getByRole("button", { name: "View source 1", exact: true }).first();
    await cite.waitFor();
    await cite.focus();
    await page.keyboard.press("Enter");
    assert(await cite.evaluate((element) => element === document.activeElement));
  });

  await check("Mobile knowledge and editor fit390px; backdrop closes the dialog", async () => {
    await go("/c/cap_maria/knowledge");
    await page.getByRole("button", { name: /^Edit / }).first().waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: resolve(output, "knowledge-mobile.png"), fullPage: false });
    await page.getByRole("button", { name: /^Edit / }).first().click();
    const dialog = page.getByRole("dialog", { name: "Edit atom" });
    await dialog.waitFor();
    assert(await dialog.evaluate((element) => element.getBoundingClientRect().width <= innerWidth - 20));
    await page.screenshot({ path: resolve(output, "dialog-mobile.png"), fullPage: false });
    await page.mouse.click(2, 2);
    await dialog.waitFor({ state: "hidden" });
  });
  assert.deepEqual(errors, []);
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
