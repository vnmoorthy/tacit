import { Hono } from "hono";
import { z } from "zod";
import { Engine, NotFoundError, SAMPLES, buildSample } from "@tacit/core";
import { env } from "./env.js";
import { createHiggsSession, higgsCloneVoice, higgsSpeech } from "./higgs.js";
import { phoneConfig, startPhoneInterview } from "./phone.js";

const ExpertSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().min(1).max(160),
  team: z.string().max(120).optional(),
  tenureYears: z.number().min(0).max(80).optional(),
  departureDate: z.string().max(20).optional(),
});
const SuccessorSchema = z.object({ name: z.string().min(1).max(120), role: z.string().max(160).optional() });
const CreateCaptureSchema = z.object({
  title: z.string().max(200).optional(),
  expert: ExpertSchema,
  successor: SuccessorSchema.optional(),
  context: z.string().min(1).max(8000),
});
const PatchCaptureSchema = CreateCaptureSchema.partial().extend({ status: z.enum(["planning", "active", "complete"]).optional(), voiceId: z.string().max(200).optional() });
const ModeSchema = z.enum(["voice-higgs", "voice-browser", "text"]);

export function buildRoutes(engine: Engine, meta: { version: string; notes: string[]; provider: string }) {
  const api = new Hono();

  api.onError((err, c) => {
    if (err instanceof NotFoundError) return c.json({ error: err.message }, 404);
    if (err instanceof z.ZodError) return c.json({ error: "validation failed", issues: err.issues }, 400);
    console.error(err);
    return c.json({ error: err.message || "internal error" }, 500);
  });

  const body = async <S extends z.ZodTypeAny>(c: { req: { json: () => Promise<unknown> } }, schema: S): Promise<z.infer<S>> => schema.parse(await c.req.json().catch(() => ({})));

  api.get("/health", (c) =>
    c.json({ ok: true, version: meta.version, engine: engine.info(), provider: meta.provider, notes: meta.notes, higgs: Boolean(env("BOSON_API_KEY")), phone: Boolean(phoneConfig()) }),
  );

  /* captures */
  api.get("/captures", async (c) => c.json(await engine.listCaptures()));
  api.post("/captures", async (c) => c.json(await engine.createCapture(await body(c, CreateCaptureSchema)), 201));
  api.get("/captures/:id", async (c) => c.json(await engine.getCapture(c.req.param("id"))));
  api.patch("/captures/:id", async (c) => c.json(await engine.updateCapture(c.req.param("id"), await body(c, PatchCaptureSchema))));
  api.delete("/captures/:id", async (c) => {
    await engine.deleteCapture(c.req.param("id"));
    return c.json({ ok: true });
  });
  api.get("/captures/:id/export", async (c) => c.json(await engine.exportCapture(c.req.param("id"))));
  api.get("/captures/:id/handover", async (c) => c.json({ markdown: await engine.handover(c.req.param("id")) }));
  api.get("/captures/:id/graph", async (c) => c.json(await engine.graph(c.req.param("id"))));
  api.get("/captures/:id/instructions", async (c) => c.json({ instructions: await engine.interviewerInstructions(c.req.param("id")) }));

  /* sessions */
  api.get("/captures/:id/sessions", async (c) => c.json(await engine.listSessions(c.req.param("id"))));
  api.post("/captures/:id/sessions", async (c) => {
    const { mode } = await body(c, z.object({ mode: ModeSchema.default("text") }));
    return c.json(await engine.startSession(c.req.param("id"), mode), 201);
  });
  api.get("/sessions/:id", async (c) => c.json(await engine.getSession(c.req.param("id"))));
  api.post("/sessions/:id/turns", async (c) => {
    const { text, generateNext } = await body(c, z.object({ text: z.string().min(1).max(20000), generateNext: z.boolean().optional() }));
    return c.json(await engine.expertTurn(c.req.param("id"), text, { generateNext }));
  });
  api.post("/sessions/:id/interviewer", async (c) => {
    const { text, kind, domainId } = await body(
      c,
      z.object({ text: z.string().min(1).max(4000), kind: z.enum(["opening", "new", "followup", "successor", "closing"]).optional(), domainId: z.string().optional() }),
    );
    return c.json(await engine.interviewerTurn(c.req.param("id"), text, { kind, domainId }));
  });
  api.post("/sessions/:id/end", async (c) => c.json(await engine.endSession(c.req.param("id"))));

  /* atoms */
  api.get("/captures/:id/atoms", async (c) => {
    const q = c.req.query();
    return c.json(
      await engine.listAtoms(c.req.param("id"), {
        q: q.q,
        type: q.type,
        domainId: q.domainId,
        verified: q.verified === undefined ? undefined : q.verified === "true",
      }),
    );
  });
  api.patch("/atoms/:id", async (c) => {
    const patch = await body(
      c,
      z.object({
        title: z.string().min(1).max(200).optional(),
        content: z.string().min(1).max(8000).optional(),
        type: z.enum(["procedure", "rule", "gotcha", "contact", "tool", "decision", "glossary", "risk", "story"]).optional(),
        tags: z.array(z.string().max(60)).max(12).optional(),
        verified: z.boolean().optional(),
        domainId: z.string().optional(),
      }),
    );
    return c.json(await engine.updateAtom(c.req.param("id"), patch));
  });
  api.delete("/atoms/:id", async (c) => {
    await engine.deleteAtom(c.req.param("id"));
    return c.json({ ok: true });
  });

  /* the successor twin */
  api.post("/captures/:id/ask", async (c) => {
    const { question, askedBy } = await body(c, z.object({ question: z.string().min(1).max(2000), askedBy: z.string().max(120).optional() }));
    return c.json(await engine.ask(c.req.param("id"), question, askedBy));
  });

  /* questions */
  api.get("/captures/:id/questions", async (c) => c.json(await engine.listQuestions(c.req.param("id"))));
  api.post("/captures/:id/questions", async (c) => {
    const { text, source, askedBy, domainId } = await body(
      c,
      z.object({ text: z.string().min(1).max(2000), source: z.enum(["plan", "successor", "gap", "followup"]).default("successor"), askedBy: z.string().max(120).optional(), domainId: z.string().optional() }),
    );
    return c.json(await engine.addQuestion(c.req.param("id"), text, source, askedBy, domainId), 201);
  });
  api.patch("/questions/:id", async (c) => {
    const patch = await body(c, z.object({ text: z.string().min(1).max(2000).optional(), status: z.enum(["open", "asked", "answered"]).optional(), domainId: z.string().optional() }));
    return c.json(await engine.updateQuestion(c.req.param("id"), patch));
  });

  /* samples */
  api.get("/samples", (c) => c.json(SAMPLES.map((s) => ({ key: s.key, title: s.title, expert: s.expert }))));
  api.post("/samples/load", async (c) => {
    const { key } = await body(c, z.object({ key: z.string().optional() }));
    const specs = key ? SAMPLES.filter((s) => s.key === key) : SAMPLES;
    const loaded = [];
    for (const spec of specs) loaded.push(await engine.importBundle(buildSample(spec)));
    return c.json(loaded, 201);
  });

  /* voice: Boson Higgs Realtime */
  api.post("/voice/higgs/session", async (c) => {
    const apiKey = env("BOSON_API_KEY");
    if (!apiKey) return c.json({ error: "BOSON_API_KEY is not configured on the server" }, 409);
    const { captureId } = await body(c, z.object({ captureId: z.string().min(1) }));
    const instructions = await engine.interviewerInstructions(captureId);
    const session = await createHiggsSession({ apiKey, instructions, voice: env("BOSON_VOICE", "default"), baseUrl: env("BOSON_BASE_URL") || undefined });
    return c.json(session);
  });

  /* voice: Higgs Audio TTS — the twin speaks, optionally in the expert's cloned voice */
  api.post("/voice/tts", async (c) => {
    const apiKey = env("BOSON_API_KEY");
    if (!apiKey) return c.json({ error: "BOSON_API_KEY is not configured on the server" }, 409);
    const { text, voice, captureId } = await body(c, z.object({ text: z.string().min(1).max(4000), voice: z.string().max(200).optional(), captureId: z.string().optional() }));
    let v = voice;
    if (!v && captureId) v = (await engine.getCapture(captureId)).voiceId;
    const { bytes, contentType } = await higgsSpeech({ apiKey, text, voice: v || env("BOSON_VOICE", "default"), baseUrl: env("BOSON_BASE_URL") || undefined });
    return new Response(bytes, { headers: { "content-type": contentType, "cache-control": "no-store", "x-tacit-voice": v || "default" } });
  });

  /* voice: clone the expert's voice from a reference clip recorded during an interview */
  api.post("/captures/:id/voice/clone", async (c) => {
    const apiKey = env("BOSON_API_KEY");
    if (!apiKey) return c.json({ error: "BOSON_API_KEY is not configured on the server" }, 409);
    const capture = await engine.getCapture(c.req.param("id"));
    const form = await c.req.formData();
    const audio = form.get("audio");
    const transcript = String(form.get("transcript") ?? "").trim();
    if (!(audio instanceof Blob) || !audio.size) return c.json({ error: "audio file is required" }, 400);
    if (audio.size > 10 * 1024 * 1024) return c.json({ error: "audio must be under 10 MB" }, 400);
    if (!transcript) return c.json({ error: "transcript is required" }, 400);
    const ext = audio.type.includes("wav") ? "wav" : audio.type.includes("mp4") || audio.type.includes("m4a") ? "m4a" : audio.type.includes("ogg") ? "ogg" : audio.type.includes("mpeg") ? "mp3" : "webm";
    const { voiceId } = await higgsCloneVoice({ apiKey, audio, filename: `${capture.id}.${ext}`, transcript, description: `Tacit clone of ${capture.expert.name}`, baseUrl: env("BOSON_BASE_URL") || undefined });
    const updated = await engine.updateCapture(capture.id, { voiceId });
    return c.json({ voiceId, capture: updated }, 201);
  });

  /* phone: call the expert (Twilio SIP → LiveKit → Higgs Realtime agent) */
  api.post("/phone/call", async (c) => {
    const cfg = phoneConfig();
    if (!cfg) return c.json({ error: "Phone interviews need LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_SIP_TRUNK_ID" }, 409);
    const { captureId, phone } = await body(c, z.object({ captureId: z.string().min(1), phone: z.string().regex(/^\+[1-9]\d{6,14}$/, "E.164 number like +14155551234") }));
    const capture = await engine.getCapture(captureId);
    const { session, interviewerTurn } = await engine.startSession(captureId, "voice-higgs");
    const apiUrl = env("PUBLIC_API_URL") || new URL(c.req.url).origin;
    const { roomName } = await startPhoneInterview(cfg, { captureId, sessionId: session.id, phone, expertName: capture.expert.name, apiUrl });
    return c.json({ session, roomName, opening: interviewerTurn.text }, 201);
  });

  return api;
}
