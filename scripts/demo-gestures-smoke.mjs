#!/usr/bin/env node
/**
 * Real MediaPipe inference with a prerecorded image, never the presenter's camera.
 * DEMO_URL=http://localhost:5181 DEMO_HAND_FIXTURE=/tmp/woman_hands.jpg node scripts/demo-gestures-smoke.mjs
 * Official fixture: https://storage.googleapis.com/mediapipe-tasks/hand_landmarker/woman_hands.jpg
 * Download it separately. Requires Playwright Chromium and ffmpeg on PATH.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const base = (process.env.DEMO_URL || "http://localhost:5173").replace(/\/$/, "");
const fixture = process.env.DEMO_HAND_FIXTURE;
assert.ok(fixture, "Set DEMO_HAND_FIXTURE to the separately downloaded official two-hand image.");
await access(fixture);
const output = resolve(process.env.DEMO_ARTIFACTS || "/tmp/tacit-demo-gestures");
await mkdir(output, { recursive: true });
const results = { startedAt: new Date().toISOString(), checks: [], errors: [], visionRequests: [] };
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
await context.addInitScript(() => {
  localStorage.setItem("tacit.mode", "local");
  localStorage.setItem("tacit.settings.v1", JSON.stringify({ provider: "none", apiKey: "" }));
  window.__gestureTest = { requests: 0, streams: [], mode: "unexpected", makeCamera: null, resolveCamera: null };
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async (constraints) => {
    const test = window.__gestureTest;
    test.requests++;
    if (constraints.audio) throw new Error("Gesture test must never request a microphone");
    if (test.mode === "deny") throw new DOMException("Synthetic permission denial", "NotAllowedError");
    if (test.mode === "pending") return new Promise((resolve) => { test.resolveCamera = resolve; });
    if (test.mode !== "ready") throw new Error("Unexpected automatic camera request");
    return test.makeCamera();
  } });
});
await context.route("**/api/**", (route) => route.abort());
await context.route("**/__gesture-fixture.jpg", (route) => route.fulfill({ path: resolve(fixture), contentType: "image/jpeg" }));
const page = await context.newPage();
page.on("pageerror", (error) => results.errors.push(error.message));
page.on("request", (request) => { if (/\.wasm|hand_landmarker\.task/.test(request.url())) results.visionRequests.push(request.url()); });
const check = (name) => { results.checks.push({ name, status: "pass" }); console.log(`PASS ${name}`); };
const stopped = () => page.waitForFunction(() => window.__gestureTest.streams.every((s) => s.getTracks().every((t) => t.readyState === "ended")));
const tracking = () => page.getByText(/Two hands · zooming/).first().waitFor({ timeout: 90000 });
try {
  await page.goto(`${base}/app`);
  await page.getByRole("button", { name: "Load sample captures" }).first().click();
  await page.getByRole("heading", { name: "Maria Chen", exact: true }).waitFor();
  await page.goto(`${base}/c/cap_maria/graph`);
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Use my hands") && !b.disabled));
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => window.__gestureTest.requests), 0);
  check("Graph opens without requesting camera or microphone");
  await page.screenshot({ path: resolve(output, "constellation.png"), fullPage: true });

  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.waitForTimeout(1500);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  const download = await downloading;
  const clip = resolve(output, "constellation.webm");
  await download.saveAs(clip);
  const { stdout } = await promisify(execFile)(process.env.FFMPEG || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", clip, "-vf", "signalstats,metadata=print:file=-", "-frames:v", "2", "-f", "null", "-"]);
  const maxima = [...stdout.matchAll(/lavfi\.signalstats\.YMAX=(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(maxima.some((n) => n > 100), "Decoded recording must contain visible graph pixels, not a cleared WebGL buffer");
  check("Recording downloads a decodable, nonblank graph clip");

  await page.evaluate(async () => {
    const image = new Image(); image.src = "/__gesture-fixture.jpg";
    await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
    const ctx = canvas.getContext("2d");
    const draw = () => ctx.drawImage(image, 0, 0, 640, 480);
    draw(); window.__gestureTest.timer = setInterval(draw, 33);
    window.__gestureTest.makeCamera = () => {
      const stream = canvas.captureStream(30);
      window.__gestureTest.streams.push(stream);
      return stream;
    };
    window.__gestureTest.mode = "ready";
  });
  await page.getByRole("button", { name: "Use my hands", exact: true }).click();
  await tracking();
  check("Bundled real MediaPipe model detects two open hands and enters zoom");
  await page.screenshot({ path: resolve(output, "immersive-hands.png"), fullPage: true });
  await page.getByRole("button", { name: "Corner view", exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(output, "corner-hands.png"), fullPage: true });
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await stopped();
  assert.equal(await page.locator("video").evaluate((v) => v.srcObject === null), true);
  check("Camera view switches and Stop releases every camera track");

  await page.evaluate(() => { window.__gestureTest.mode = "pending"; });
  await page.getByRole("button", { name: "Use my hands", exact: true }).click();
  await page.waitForFunction(() => Boolean(window.__gestureTest.resolveCamera));
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await page.evaluate(() => window.__gestureTest.resolveCamera(window.__gestureTest.makeCamera()));
  await stopped();
  check("Cancelling camera startup closes a stream that arrives late");

  await page.evaluate(() => { window.__gestureTest.mode = "deny"; });
  await page.getByRole("button", { name: "Use my hands", exact: true }).click();
  await page.getByText(/Camera access was denied/).first().waitFor();
  await page.evaluate(() => { window.__gestureTest.mode = "ready"; });
  await page.getByRole("button", { name: "Use my hands", exact: true }).click();
  await tracking();
  await page.getByRole("link", { name: "Maria Chen", exact: true }).click();
  await stopped();
  check("Permission denial recovers on retry and navigation releases the camera");
  assert.deepEqual(results.errors, []);
  assert.ok(results.visionRequests.length > 0);
  assert.ok(results.visionRequests.every((url) => new URL(url).origin === new URL(base).origin));
  check("Vision assets stay on the application origin and no runtime errors occur");
  results.status = "pass";
} catch (error) {
  results.status = "fail"; results.failure = error.message;
  await page.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => {});
  console.error(error.message); process.exitCode = 1;
} finally {
  await context.close(); await browser.close();
  results.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2));
  console.log(`Evidence: ${output}`);
}
