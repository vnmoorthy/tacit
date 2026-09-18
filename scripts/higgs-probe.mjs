#!/usr/bin/env node
/**
 * Diagnostic: stream a 24 kHz mono 16-bit WAV into Boson Higgs Realtime exactly the way the
 * browser client does, and print the events that come back. No dependencies (Node ≥ 22).
 *
 *   BOSON_API_KEY=... node scripts/higgs-probe.mjs path/to/clip.wav
 *
 * Expect: speech_started → speech_stopped → committed → input_audio_transcription.completed → response.*
 */
import fs from "node:fs";

const apiKey = process.env.BOSON_API_KEY;
const file = process.argv[2];
if (!apiKey || !file) {
  console.error("usage: BOSON_API_KEY=... node scripts/higgs-probe.mjs clip.wav");
  process.exit(1);
}
const pcm = fs.readFileSync(file).subarray(44); // skip the RIFF header (24 kHz mono PCM16 expected)
const secret = await (
  await fetch("https://api.boson.ai/v1/realtime/client_secrets", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ expires_after: { seconds: 120 } }),
  })
).json();

const ws = new WebSocket("wss://api.boson.ai/v1/realtime?model=higgs-realtime", ["realtime", `bai-client-secret.${secret.value}`]);
const order = [];
const user = [];
const assistant = [];
ws.onmessage = (m) => {
  const e = JSON.parse(m.data);
  if (!/delta/.test(e.type)) order.push(e.type);
  if (e.type === "error") console.log("ERROR", JSON.stringify(e).slice(0, 300));
  if (e.type === "conversation.item.input_audio_transcription.completed") user.push(e.transcript);
  if (e.type === "response.output_audio_transcript.done") assistant.push(e.transcript);
};
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});
ws.send(
  JSON.stringify({
    type: "session.update",
    session: {
      model: "higgs-realtime",
      instructions: "You are Tacit, a knowledge-capture interviewer. Ask one short follow-up question. Under 25 words.",
      audio: {
        input: { format: { type: "audio/pcm", rate: 24000 }, turn_detection: { type: "semantic_vad" }, transcription: { model: "higgs-stt-3.1" } },
        output: { format: { type: "audio/pcm", rate: 24000 }, voice: "default" },
      },
    },
  }),
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(500);
const CHUNK = 4800; // 100 ms
for (let i = 0; i < pcm.length; i += CHUNK) {
  ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: pcm.subarray(i, i + CHUNK).toString("base64") }));
  await sleep(100);
}
const silence = Buffer.alloc(CHUNK).toString("base64");
for (let i = 0; i < 30; i++) {
  ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: silence }));
  await sleep(100);
}
await sleep(12000);
console.log("events:", order.join(" → "));
console.log("expert said:", JSON.stringify(user));
console.log("tacit said:", JSON.stringify(assistant));
ws.close();
