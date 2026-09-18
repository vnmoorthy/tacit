#!/usr/bin/env node
/** Live-provider check. Point ONLY at an isolated demo API/database; this creates a test session. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const base = process.env.DEMO_URL?.replace(/\/$/, "");
const api = process.env.DEMO_API_URL?.replace(/\/$/, "");
if (!base || !api || process.env.DEMO_LIVE_TEST !== "1") {
  throw new Error("Set DEMO_URL, DEMO_API_URL and DEMO_LIVE_TEST=1 for an isolated seeded test database.");
}
const output = resolve(process.env.DEMO_ARTIFACTS || "/tmp/tacit-demo-live");
await mkdir(output, { recursive: true });
const results = { startedAt: new Date().toISOString(), checks: [], errors: [], events: {}, audioChunks: 0, expertTranscripts: [], expertItems: [], assistantTranscripts: [] };
const request = async (path, data) => {
  const response = await fetch(`${api}/api${path}`, { method: data ? "POST" : "GET", headers: data ? { "content-type": "application/json" } : undefined, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
  return response;
};
let browser;
let context;
let page;
try {
  const health = await (await request("/health")).json();
  assert.ok(health.higgs, "Higgs must be configured for the live voice test");
  assert.notEqual(health.provider, "demo", "A configured model is required for live retrieval");
  results.provider = health.provider;
  const answer = await (await request("/captures/cap_maria/ask", { question: "The ACH file bounced on a Friday afternoon. What should I do?", askedBy: "Demo verification" })).json();
  assert.ok(answer.citations.length > 0);
  assert.match(answer.answer, /wire|treasury|cut.?off|ACH/i);
  results.checks.push({ name: "Live model produces a grounded answer", status: "pass", citations: answer.citations.length, confidence: answer.confidence });
  console.log("PASS Live model answer with citations");

  const speech = "The real ACH cut-off is three thirty in the afternoon, not five. First call the Treasury desk if the file is rejected. Never resend a file until Treasury confirms the old file is cancelled.";
  const tts = await request("/voice/tts", { text: speech });
  assert.match(tts.headers.get("content-type") || "", /audio/);
  const mp3 = resolve(output, "synthetic-expert.mp3");
  const wav = resolve(output, "synthetic-microphone.wav");
  const bytes = Buffer.from(await tts.arrayBuffer());
  assert.ok(bytes.length > 1000);
  await writeFile(mp3, bytes);
  await promisify(execFile)(process.env.FFMPEG || "ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", mp3, "-af", "adelay=18000,apad=pad_dur=120", "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
  results.checks.push({ name: "Stock Higgs speech returns decodable audio", status: "pass", bytes: bytes.length });
  console.log("PASS Higgs TTS and synthetic microphone fixture");

  const previousSessions = new Set((await (await request("/captures/cap_maria/sessions")).json()).map((session) => session.id));

  browser = await chromium.launch({ headless: true, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`, "--autoplay-policy=no-user-gesture-required"] });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["microphone"] });
  await context.addInitScript(() => localStorage.setItem("tacit.mode", "server"));
  page = await context.newPage();
  page.on("pageerror", (error) => results.errors.push(error.message));
  page.on("websocket", (socket) => {
    if (!new URL(socket.url()).pathname.includes("/realtime")) return;
    socket.on("framereceived", ({ payload }) => {
      try {
        const event = JSON.parse(String(payload));
        results.events[event.type] = (results.events[event.type] || 0) + 1;
        if (/^response\.(output_audio|audio)\.delta$/.test(event.type)) results.audioChunks++;
        if (event.type === "conversation.item.input_audio_transcription.completed") {
          results.expertTranscripts.push(event.transcript);
          results.expertItems.push({ itemId: event.item_id, transcript: event.transcript });
        }
        if (/^response\.(output_audio_transcript|audio_transcript)\.done$/.test(event.type)) results.assistantTranscripts.push(event.transcript);
        if (event.type === "error") results.errors.push(event.error?.message || event.message || "Realtime protocol error");
      } catch { /* Ignore non-JSON frames, never log credential-bearing frames. */ }
    });
  });
  await page.goto(`${base}/c/cap_maria/interview`);
  await page.getByRole("button", { name: /Higgs Realtime/ }).click();
  await page.getByRole("button", { name: /^(Begin session|Start interview)$/ }).click();
  console.log("RUNNING Real microphone fixture → Higgs → transcript → knowledge");
  await page.waitForFunction(() => /Treasury confirms/i.test(document.body.innerText), null, { timeout: 100000 });
  console.log("PASS Realtime microphone transcription appears in the interview");
  await page.waitForFunction(() => document.querySelectorAll("article").length > 0, null, { timeout: 60000 });
  assert.ok(results.audioChunks > 0, "Realtime reply must include audio");
  assert.ok(results.expertTranscripts.length > 0, "Provider must transcribe the synthetic microphone");
  await page.screenshot({ path: resolve(output, "realtime-interview.png"), fullPage: true });
  const sessions = await (await request("/captures/cap_maria/sessions")).json();
  const active = sessions.find((session) => !previousSessions.has(session.id) && !session.endedAt);
  assert.ok(active, "A live interview session should be saved");
  await page.getByRole("button", { name: /^(End session|End interview)$/ }).click();
  await page.getByText("Session captured", { exact: true }).waitFor({ timeout: 60000 });
  const session = await (await request(`/sessions/${active.id}`)).json();
  assert.ok(session.session.endedAt);
  assert.ok(session.atoms.length > 0, "The spoken answer must create saved atoms");
  assert.ok(session.turns.some((turn) => turn.role === "expert" && /Treasury|cut.off/i.test(turn.text)));
  const expertTurns = session.turns.filter((turn) => turn.role === "expert");
  assert.equal(expertTurns.length, new Set(results.expertItems.map((item) => item.itemId)).size, "Provider transcript revisions must not create duplicate expert turns");
  results.checks.push({ name: "Real microphone fixture reaches saved transcript and atoms", status: "pass", sessionId: active.id, atoms: session.atoms.length, audioChunks: results.audioChunks });
  assert.deepEqual(results.errors, []);
  results.status = "pass";
  console.log("PASS Realtime audio, transcription, extraction, and session completion");
} catch (error) {
  results.status = "fail";
  results.failure = error.message;
  await page?.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await context?.close();
  await browser?.close();
  results.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2));
  console.log(`Evidence: ${output}`);
}
