import { ArrowLeft, Keyboard, Mic, MicOff, Radio, Send, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Atom, Capture, Session, Turn } from "@tacit/core";
import { AtomCard } from "../components/AtomCard.js";
import { Orb, type OrbState } from "../components/Orb.js";
import { Badge, Button, Card, Input, Modal, ProgressBar, cx } from "../components/ui.js";
import { pct } from "../lib/format.js";
import { useApi, useApp } from "../lib/store.js";
import { BrowserVoice } from "../lib/voice/browserVoice.js";
import { HiggsVoice } from "../lib/voice/higgsVoice.js";
import { SpokenAudio } from "../lib/voice/spokenAudio.js";
import { ReferenceRecorder } from "../lib/voice/recorder.js";

type EngineKind = "higgs" | "browser" | "text";

function useTimer(running: boolean) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** True when two spoken lines are the same utterance up to punctuation or a rephrased opening. */
const sameLine = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  const head = Math.min(48, x.length, y.length);
  return x.slice(0, head) === y.slice(0, head) || x.includes(y.slice(0, Math.min(60, y.length))) || y.includes(x.slice(0, Math.min(60, x.length)));
};

export function InterviewRoom() {
  const { id = "" } = useParams();
  const api = useApi();
  const health = useApp((s) => s.health);
  const toast = useApp((s) => s.toast);
  const nav = useNavigate();

  const [capture, setCapture] = useState<Capture | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const [atoms, setAtoms] = useState<Atom[]>([]);
  const [engine, setEngine] = useState<EngineKind>(() => (health?.higgs ? "higgs" : BrowserVoice.supported() ? "browser" : "text"));
  const [voiceState, setVoiceState] = useState<OrbState>("off");
  const [level, setLevel] = useState(0);
  const [partial, setPartial] = useState("");
  const [assistantPartial, setAssistantPartial] = useState("");
  const [typed, setTyped] = useState("");
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [ended, setEnded] = useState<Session | null>(null);
  const [newestAtom, setNewestAtom] = useState<string | null>(null);

  const bv = useRef<BrowserVoice | null>(null);
  const hv = useRef<HiggsVoice | null>(null);
  const recorder = useRef<ReferenceRecorder | null>(null);
  const [reference, setReference] = useState<{ blob: Blob; transcript: string } | null>(null);
  const [recordConsent, setRecordConsent] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [clonedVoice, setClonedVoice] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const mutedRef = useRef(false);
  const endingRef = useRef(false);
  const startingRef = useRef(false);
  const generation = useRef(0);
  const pending = useRef(Promise.resolve());
  const pendingCount = useRef(0);
  const speech = useRef<SpokenAudio | null>(null);
  const playback = useRef(0);
  const playbackBusy = useRef(false);
  const atomTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submitRef = useRef<(text: string, source?: "voice" | "text") => void>(() => undefined);
  const skipFirstAssistant = useRef(false);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const timer = useTimer(Boolean(session) && !ended);

  useEffect(() => {
    api
      .getCapture(id)
      .then(setCapture)
      .catch((e) => {
        toast((e as Error).message, "error");
        nav("/app");
      });
  }, [api, id, nav, toast]);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, partial, assistantPartial]);

  // Async setup, speech downloads and pending turns must not survive navigation.
  useEffect(() => () => {
    hv.current?.flushTranscripts();
    generation.current++;
    endingRef.current = true;
    playback.current++;
    clearTimeout(atomTimer.current);
    bv.current?.destroy();
    hv.current?.disconnect();
    speech.current?.destroy();
    void recorder.current?.stop();
    const current = sessionRef.current;
    if (current && !current.endedAt) void pending.current.then(() => api.endSession(current.id)).catch(() => undefined);
  }, [api]);

  const pushAtoms = (list: Atom[]) => {
    if (!list.length) return;
    setAtoms((previous) => [...list, ...previous]);
    setNewestAtom(list[0].id);
    clearTimeout(atomTimer.current);
    atomTimer.current = setTimeout(() => setNewestAtom(null), 2500);
  };

  const stopAudio = () => {
    playback.current++;
    playbackBusy.current = false;
    speech.current?.stop();
    bv.current?.stopSpeaking();
  };

  const speakLine = async (text: string) => {
    stopAudio();
    const token = playback.current;
    playbackBusy.current = true;
    const room = generation.current;
    bv.current?.thinking();
    speech.current ??= new SpokenAudio(
      () => toast("Natural voice is unavailable. Using this browser's voice.", "info"),
      capture?.expert.language,
      setVoiceState,
    );
    try { await speech.current.speak(text, health?.higgs ? () => api.speak(text) : undefined); }
    catch (error) { if (room === generation.current) toast((error as Error).message, "error"); }
    if (token !== playback.current || room !== generation.current || endingRef.current) return;
    playbackBusy.current = false;
    bv.current?.idle();
    if (engineRef.current === "browser" && !mutedRef.current) bv.current?.listen();
    else setVoiceState("idle");
  };

  /** Serialize persistence so fast realtime transcripts cannot overwrite each other. */
  const submitExpert = (text: string, source: "voice" | "text" = "text") => {
    const current = sessionRef.current;
    const value = text.trim();
    if (!current || !value || current.endedAt || endingRef.current || startingRef.current) return;
    if (source === "text" && pendingCount.current) return;
    const room = generation.current;
    const mode = engineRef.current;
    const optimistic: Turn = { id: `tmp_${crypto.randomUUID()}`, sessionId: current.id, captureId: id, role: "expert", text: value, at: new Date().toISOString() };
    setTurns((previous) => [...previous, optimistic]);
    setPartial("");
    setTyped("");
    pendingCount.current++;
    setBusy(true);
    if (mode !== "higgs") { stopAudio(); bv.current?.thinking(); setVoiceState("thinking"); }
    pending.current = pending.current.then(async () => {
      let saved = false;
      try {
        const result = await api.expertTurn(current.id, value, mode !== "higgs");
        saved = true;
        if (room !== generation.current) return;
        setTurns((previous) => previous.map((turn) => turn.id === optimistic.id ? result.expertTurn : turn).concat(result.interviewerTurn ? [result.interviewerTurn] : []));
        pushAtoms(result.atoms);
        setCapture(result.capture);
        if (endingRef.current) return;
        if (mode === "higgs" && hv.current) {
          const instructions = await api.instructions(id).catch(() => null);
          if (room !== generation.current || endingRef.current) return;
          if (instructions) hv.current?.updateInstructions(instructions);
          if (source === "text") hv.current?.sendText(value);
        } else if (result.interviewerTurn && mode === "browser" && engineRef.current === "browser") {
          await speakLine(result.interviewerTurn.text);
        } else { setVoiceState("idle"); }
      } catch (error) {
        if (room !== generation.current) return;
        toast((error as Error).message, "error");
        if (saved) {
          useTextMode();
          toast("Your answer was saved. Voice could not continue; retry voice or keep typing.", "info");
        } else {
          // Keep the answer recoverable if saving failed.
          setTyped(value);
          setTurns((previous) => previous.filter((turn) => turn.id !== optimistic.id));
        }
        bv.current?.idle();
        setVoiceState("idle");
        if (mode === "browser" && !mutedRef.current && !endingRef.current) bv.current?.listen();
      } finally {
        pendingCount.current--;
        if (room === generation.current) setBusy(pendingCount.current > 0 || endingRef.current);
      }
    });
  };
  submitRef.current = submitExpert;

  const useTextMode = () => {
    stopAudio();
    bv.current?.destroy();
    hv.current?.disconnect();
    bv.current = null;
    hv.current = null;
    engineRef.current = "text";
    mutedRef.current = false;
    setMuted(false);
    setEngine("text");
    setAssistantPartial("");
    setPartial("");
    setVoiceState("idle");
  };

  const start = async () => {
    if (!capture || startingRef.current || pendingCount.current) return;
    const activeEngine = engineRef.current;
    startingRef.current = true;
    endingRef.current = false;
    const room = generation.current;
    setStarting(true);
    try {
      const mode = activeEngine === "higgs" ? "voice-higgs" : activeEngine === "browser" ? "voice-browser" : "text";
      const existing = sessionRef.current;
      const lastQuestion = [...turns].reverse().find((turn) => turn.role === "interviewer");
      const rejoining = Boolean(existing && !existing.endedAt && lastQuestion);
      const result = rejoining ? { session: existing!, capture, interviewerTurn: lastQuestion! } : await api.startSession(id, mode);
      if (room !== generation.current) { void api.endSession(result.session.id).catch(() => undefined); return; }
      sessionRef.current = result.session;
      setSession(result.session);
      setCapture(result.capture);
      if (!rejoining) setTurns([result.interviewerTurn]);

      if (activeEngine === "browser") {
        const voice = new BrowserVoice({
          onPartial: setPartial,
          onFinal: (text) => submitRef.current(text, "voice"),
          onState: setVoiceState,
          onLevel: setLevel,
          onError: (message) => { toast(message, "error"); mutedRef.current = true; setMuted(true); },
        }, capture.expert.language);
        bv.current = voice;
        await voice.init();
        if (room !== generation.current) return;
        if (recordConsent && health?.higgs && voice.stream && ReferenceRecorder.supported()) {
          recorder.current = new ReferenceRecorder();
          recorder.current.start(voice.stream);
        }
        await speakLine(result.interviewerTurn.text);
      } else if (activeEngine === "higgs") {
        const info = await api.higgsSession(id);
        if (room !== generation.current) return;
        skipFirstAssistant.current = true;
        const voice = new HiggsVoice({
          onState: setVoiceState,
          onLevel: setLevel,
          onError: (message) => toast(message, "error"),
          onDisconnect: () => { if (room === generation.current && !endingRef.current) useTextMode(); },
          onUserTranscript: (text) => submitRef.current(text, "voice"),
          onUserPartial: setPartial,
          onAssistantPartial: setAssistantPartial,
          onAssistantTranscript: (text) => {
            {
              const last = [...turnsRef.current].reverse().find((x) => x.role === "interviewer");
              if (last && sameLine(last.text, text)) return; // Higgs re-spoke the planned line; don't log it twice
            }
            if (room !== generation.current || endingRef.current) return;
            setAssistantPartial("");
            if (skipFirstAssistant.current) {
              skipFirstAssistant.current = false;
              const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
              if (normalize(text) === normalize(result.interviewerTurn.text)) return;
            }
            const current = sessionRef.current;
            if (!current) return;
            // Keep the transcript order visible even while the API is saving.
            const turn: Turn = { id: `tmp_${crypto.randomUUID()}`, sessionId: current.id, captureId: id, role: "interviewer", text, at: new Date().toISOString() };
            setTurns((previous) => [...previous, turn]);
            pending.current = pending.current.then(async () => {
              try {
                const saved = await api.interviewerTurn(current.id, text);
                if (room === generation.current) setTurns((previous) => previous.map((item) => item.id === turn.id ? saved : item));
              } catch { if (room === generation.current) toast("The spoken question could not be saved. Your answers are still available.", "error"); }
            });
          },
        });
        hv.current = voice;
        await voice.connect({ ...info, instructions: `${info.instructions}\n\nBegin the session by saying exactly this, then wait for the answer: "${result.interviewerTurn.text}"` });
      } else { setVoiceState("idle"); }
    } catch (error) {
      if (room !== generation.current) return;
      toast((error as Error).message, "error");
      useTextMode();
      if (sessionRef.current) toast("Your session is ready. Continue by typing below.", "info");
    } finally {
      startingRef.current = false;
      if (room === generation.current) setStarting(false);
    }
  };

  const toggleMute = () => {
    const value = !mutedRef.current;
    mutedRef.current = value;
    setMuted(value);
    if (engineRef.current === "browser") {
      if (value) bv.current?.stopListening();
      else if (!pendingCount.current && !startingRef.current && !playbackBusy.current) { bv.current?.idle(); bv.current?.listen(); }
    }
    hv.current?.setMuted(value || playbackBusy.current);
  };

  const replay = (text: string) => {
    if (endingRef.current || startingRef.current || pendingCount.current) return;
    if (engineRef.current === "higgs") {
      hv.current?.interrupt();
      hv.current?.setMuted(true);
      void speakLine(text).then(() => { if (!endingRef.current && !playbackBusy.current) hv.current?.setMuted(mutedRef.current); });
    } else { void speakLine(text); }
  };

  const end = async () => {
    const current = sessionRef.current;
    if (!current || endingRef.current || startingRef.current) return;
    hv.current?.flushTranscripts();
    endingRef.current = true;
    setEnding(true);
    setBusy(true);
    stopAudio();
    bv.current?.stopListening();
    hv.current?.disconnect();
    if (recorder.current) {
      const blob = await recorder.current.stop();
      recorder.current = null;
      const said = turns.filter((turn) => turn.role === "expert").map((turn) => turn.text).join(" ");
      if (blob && said.split(/\s+/).length >= 12) setReference({ blob, transcript: said.slice(0, 1200) });
    }
    bv.current?.destroy();
    bv.current = null;
    hv.current = null;
    setVoiceState("off");
    try {
      await pending.current;
      const done = await api.endSession(current.id);
      sessionRef.current = done;
      setEnded(done);
      setCapture(await api.getCapture(id));
    } catch (error) {
      toast((error as Error).message, "error");
      endingRef.current = false;
      useTextMode();
    } finally { setBusy(false); setEnding(false); }
  };

  const cloneVoice = async () => {
    if (!reference) return;
    setCloning(true);
    try {
      const r = await api.cloneVoice(id, reference.blob, reference.transcript);
      setClonedVoice(r.voiceId);
      setCapture(r.capture);
      toast(`The twin can now speak in ${capture?.expert.name.split(" ")[0]}'s voice`, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setCloning(false);
    }
  };

  const domainName = (did?: string) => capture?.domains.find((d) => d.id === did)?.name;
  const first = capture?.expert.name.split(" ")[0] ?? "";
  const statusLine =
    ending ? "Saving your session…" : starting ? "Connecting voice…" : muted && engine !== "text" && voiceState !== "speaking" ? "Microphone muted" : voiceState === "listening" ? `Listening to ${first}…` : voiceState === "thinking" ? "Tacit is thinking…" : voiceState === "speaking" ? "Tacit is speaking" : session ? (engine === "text" ? "Your turn — type below" : "Ready") : "";

  if (!capture) return <div className="h-screen grid place-items-center text-muted">Loading…</div>;

  /* ────────────────────────── pre-flight ────────────────────────── */
  if (!session) {
    const options: { k: EngineKind; title: string; body: string; ok: boolean; why?: string }[] = [
      { k: "higgs", title: "Higgs Realtime", body: "Natural speech with live turn-taking. Speak freely or type your answer.", ok: Boolean(health?.higgs), why: "Natural voice is not connected for this workspace" },
      { k: "browser", title: "Browser voice", body: "Speech recognition with natural spoken questions when connected. Chrome works best.", ok: BrowserVoice.supported(), why: "Speech APIs unavailable in this browser" },
      { k: "text", title: "Type answers", body: "Same interviewer, no microphone. Handy in a noisy room.", ok: true },
    ];
    return (
      <div className="min-h-screen bg-paper">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <Link to={`/c/${id}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Back to {capture.expert.name}
          </Link>
          <p className="mt-6 text-[12px] uppercase tracking-[0.16em] text-muted font-semibold">Interview session</p>
          <h1 className="font-display text-[38px] leading-tight mt-1">Ready when you are, {first}.</h1>
          <p className="text-ink-2 mt-2 max-w-xl">
            Tacit will ask one question at a time and follow the thread. Talk the way you'd talk to a colleague — the specifics are the point. Coverage so far: <span className="font-mono text-ink">{pct(capture.stats.coverage)}</span>.
          </p>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {options.map((o) => (
              <button
                key={o.k}
                disabled={!o.ok}
                onClick={() => { engineRef.current = o.k; setEngine(o.k); }}
                aria-pressed={engine === o.k}
                className={cx(
                  "rounded-2xl border p-4 text-left transition",
                  engine === o.k ? "border-accent bg-paper-2 shadow-lift" : "border-line bg-paper-2/50 hover:border-line-2",
                  !o.ok && "opacity-50 cursor-not-allowed",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-[18px]">{o.title}</span>
                  {o.k === "higgs" && <Badge tone="accent">Partner</Badge>}
                </div>
                <p className="mt-1.5 text-[13px] text-ink-2 leading-relaxed">{o.body}</p>
                {!o.ok && o.why && <p className="mt-2 text-[11.5px] text-muted">{o.why}</p>}
              </button>
            ))}
          </div>

          {engine === "browser" && health?.higgs && ReferenceRecorder.supported() && (
            <label className="mt-5 flex items-start gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={recordConsent} onChange={(event) => setRecordConsent(event.target.checked)} className="mt-1" />
              <span>Save a voice sample for optional voice cloning. I am the speaker, or I have their permission to record and use their voice.</span>
            </label>
          )}
          <div className="mt-8 flex items-center gap-3">
            <Button variant="accent" size="lg" onClick={start} loading={starting} icon={<Mic className="h-4 w-4" />}>
              {starting ? "Connecting…" : "Begin session"}
            </Button>
            <span className="text-[13px] text-muted">{engine === "text" ? "No microphone needed." : "Your browser will ask for microphone access."}</span>
          </div>
        </div>
      </div>
    );
  }

  /* ────────────────────────── the room ────────────────────────── */
  return (
    <div className="flex h-screen flex-col bg-paper">
      <header className="flex items-center gap-4 border-b border-line bg-paper-2/60 px-5 py-3">
        <Link to={`/c/${id}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> {capture.expert.name}
        </Link>
        <span className="hidden text-[13px] text-muted md:inline">· {capture.expert.role}</span>
        <div className="ml-auto flex items-center gap-2">
          <Badge tone="neutral" icon={<Radio className={cx("h-3 w-3", !ended && "text-danger")} />}>
            {ended ? "Ended" : "Live"} · {timer}
          </Badge>
          <Badge tone={engine === "higgs" ? "accent" : "neutral"}>{engine === "higgs" ? "Higgs Realtime" : engine === "browser" ? "Browser voice" : "Text"}</Badge>
          <Badge tone="sage">{pct(capture.stats.coverage)} covered</Badge>
          {!ended && (
            <Button variant="danger" size="sm" onClick={end} loading={ending} disabled={starting} icon={<Square className="h-3.5 w-3.5" />}>
              {ending ? "Saving session…" : "End session"}
            </Button>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_300px_360px]">
        {/* transcript */}
        <section className="min-h-0 overflow-y-auto scrollbar-thin px-6 py-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {turns.map((t) => (
              <div key={t.id} className={cx("rise-in flex", t.role === "expert" ? "justify-end" : "justify-start")}>
                <div className={cx("max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed", t.role === "expert" ? "rounded-br-md border border-line-2 bg-paper-3 text-ink" : "rounded-bl-md border border-line bg-paper-2 shadow-soft")}>
                  {t.role === "interviewer" && (
                    <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted font-semibold">
                      Tacit
                      {t.kind && t.kind !== "opening" && <span className="rounded bg-paper-3 px-1.5 py-0.5 normal-case tracking-normal">{t.kind === "successor" ? "from the queue" : t.kind === "followup" ? "follow-up" : t.domainId ? domainName(t.domainId) : ""}</span>}
                      {!ended && (
                        <button disabled={busy || starting} onClick={() => replay(t.text)} className="ml-auto text-muted hover:text-ink" title="Replay question" aria-label="Replay question">
                          <Volume2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  <p className={t.role === "interviewer" ? "font-display text-[17px] font-medium" : ""}>{t.text}</p>
                  {t.role === "expert" && t.extractedAtomIds && t.extractedAtomIds.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-accent-2">↳ {t.extractedAtomIds.length} atom{t.extractedAtomIds.length === 1 ? "" : "s"} captured</p>
                  )}
                </div>
              </div>
            ))}
            {assistantPartial && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-paper-2/70 px-4 py-3 font-display text-[17px] text-ink-2">{assistantPartial}…</div>
              </div>
            )}
            {partial && (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md border border-line-2 bg-paper-3/60 px-4 py-3 text-[15px] text-ink-2">{partial}…</div>
              </div>
            )}
            {busy && !partial && (
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Distilling what {first} said…
              </div>
            )}
            <div ref={transcriptEnd} />
          </div>
        </section>

        {/* orb + controls */}
        <section className="flex flex-col items-center justify-center gap-4 border-l border-r border-line bg-paper-2/40 px-5 py-6">
          <Orb state={ended ? "off" : voiceState} level={level} size={230} />
          <p className="h-5 text-[13px] text-ink-2">{ended ? "Session ended" : statusLine}</p>
          {!ended && engine !== "text" && (
            <div className="flex items-center gap-2">
              <Button variant={muted ? "danger" : "secondary"} onClick={toggleMute} disabled={starting} aria-pressed={muted} icon={muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}>
                {muted ? "Unmute" : "Mute"}
              </Button>
              <Button size="sm" onClick={useTextMode} disabled={starting} icon={<Keyboard className="h-4 w-4" />}>Use text</Button>
            </div>
          )}
          {!ended && engine === "text" && (health?.higgs || BrowserVoice.supported()) && (
            <Button size="sm" disabled={busy || starting} loading={starting} onClick={() => {
              engineRef.current = health?.higgs ? "higgs" : "browser";
              setEngine(engineRef.current);
              void start();
            }} icon={<Mic className="h-4 w-4" />}>Retry voice</Button>
          )}
          {!ended && (
            <form
              className="mt-2 flex w-full items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submitExpert(typed);
              }}
            >
              <Keyboard className="h-4 w-4 shrink-0 text-muted" />
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={engine === "text" ? "Type your answer…" : "Or type instead…"} disabled={busy || starting} aria-label="Your answer" />
              <Button type="submit" variant="primary" size="sm" disabled={busy || starting || !typed.trim()} icon={<Send className="h-3.5 w-3.5" />} aria-label="Send" />
            </form>
          )}
          <p className="text-center text-[11.5px] text-muted leading-relaxed">
            {engine === "higgs" ? "Interrupt any time — Higgs handles turn-taking." : engine === "browser" ? "Pause for a moment when you finish a thought." : "Press Enter to send."}
          </p>
        </section>

        {/* live knowledge feed */}
        <aside className="min-h-0 overflow-y-auto scrollbar-thin px-5 py-6">
          <div className="mb-4">
            <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.14em] text-muted font-semibold">
              <span>Coverage</span>
              <span className="font-mono text-ink">{pct(capture.stats.coverage)}</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {[...capture.domains]
                .sort((a, b) => a.priority - b.priority || b.coverage - a.coverage)
                .slice(0, 6)
                .map((d) => (
                  <div key={d.id}>
                    <div className="flex justify-between text-[11.5px] text-ink-2">
                      <span className="truncate">{d.name}</span>
                      <span className="font-mono text-muted">{pct(d.coverage)}</span>
                    </div>
                    <ProgressBar value={d.coverage} tone={d.coverage > 0.66 ? "sage" : "accent"} className="mt-0.5" />
                  </div>
                ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.14em] text-muted font-semibold">
            <span>Captured this session</span>
            <span className="font-mono text-ink">{atoms.length}</span>
          </div>
          <div className="mt-2 space-y-2.5">
            {atoms.length === 0 && (
              <Card className="p-4 text-[13px] text-muted">Knowledge atoms will appear here as {first} talks: procedures, rules, gotchas, contacts, tools, risks…</Card>
            )}
            {atoms.map((a) => (
              <div key={a.id} className="rise-in">
                <AtomCard atom={a} domainName={domainName(a.domainId)} compact highlight={newestAtom === a.id} />
              </div>
            ))}
          </div>
        </aside>
      </div>

      <Modal
        open={Boolean(ended)}
        onClose={() => nav(`/c/${id}`)}
        title="Session captured"
        footer={
          <>
            <Button onClick={() => nav(`/c/${id}/knowledge`)}>Review atoms</Button>
            <Button variant="primary" onClick={() => nav(`/c/${id}`)}>
              Back to overview
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[14px] text-ink-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-paper-2 p-3 text-center">
              <div className="font-display text-2xl text-ink">{atoms.length}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted">atoms</div>
            </div>
            <div className="rounded-xl bg-paper-2 p-3 text-center">
              <div className="font-display text-2xl text-ink">{turns.filter((t) => t.role === "expert").length}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted">answers</div>
            </div>
            <div className="rounded-xl bg-paper-2 p-3 text-center">
              <div className="font-display text-2xl text-ink">{pct(capture.stats.coverage)}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted">coverage</div>
            </div>
          </div>
          {ended?.summary && <p className="leading-relaxed">{ended.summary}</p>}
          {reference && (
            <div className="rounded-xl border border-accent-2/60 bg-accent-3/40 p-3">
              <p className="text-[13px] text-ink">
                <span className="font-medium">Let the twin speak in {first}'s voice.</span> Your permitted voice sample is ready. Higgs Audio can clone it so the successor hears answers the way {first} would say them.
              </p>
              <div className="mt-2 flex items-center gap-2">
                {clonedVoice ? (
                  <Badge tone="sage">Voice cloned</Badge>
                ) : (
                  <Button size="sm" variant="accent" onClick={cloneVoice} loading={cloning} icon={<Volume2 className="h-3.5 w-3.5" />}>
                    Clone {first}'s voice
                  </Button>
                )}
                <span className="text-[11.5px] text-muted">Boson AI · Higgs Audio</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
