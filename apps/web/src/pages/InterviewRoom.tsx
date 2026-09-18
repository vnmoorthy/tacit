import { ArrowLeft, Keyboard, Mic, MicOff, Radio, Send, Square, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Atom, Capture, Session, Turn } from "@tacit/core";
import { AtomCard } from "../components/AtomCard.js";
import { Orb, type OrbState } from "../components/Orb.js";
import { Badge, Button, Card, Input, Modal, ProgressBar, cx } from "../components/ui.js";
import { pct } from "../lib/format.js";
import { useApi, useApp } from "../lib/store.js";
import { BrowserVoice } from "../lib/voice/browserVoice.js";
import { HiggsVoice } from "../lib/voice/higgsVoice.js";
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

export function InterviewRoom() {
  const { id = "" } = useParams();
  const api = useApi();
  const health = useApp((s) => s.health);
  const toast = useApp((s) => s.toast);
  const nav = useNavigate();

  const [capture, setCapture] = useState<Capture | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
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
  const [ended, setEnded] = useState<Session | null>(null);
  const [newestAtom, setNewestAtom] = useState<string | null>(null);

  const bv = useRef<BrowserVoice | null>(null);
  const hv = useRef<HiggsVoice | null>(null);
  const recorder = useRef<ReferenceRecorder | null>(null);
  const [reference, setReference] = useState<{ blob: Blob; transcript: string } | null>(null);
  const [cloning, setCloning] = useState(false);
  const [clonedVoice, setClonedVoice] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
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

  // Tear down voice engines (and close the session) when leaving the room.
  useEffect(() => {
    return () => {
      bv.current?.destroy();
      hv.current?.disconnect();
      const s = sessionRef.current;
      if (s && !s.endedAt) void api.endSession(s.id).catch(() => undefined);
    };
  }, [api]);

  const pushAtoms = (list: Atom[]) => {
    if (!list.length) return;
    setAtoms((prev) => [...list, ...prev]);
    setNewestAtom(list[0].id);
    setTimeout(() => setNewestAtom(null), 2500);
  };

  /** Expert said something (voice or typed). Browser/text engines: Tacit thinks and replies. */
  const submitExpert = useCallback(
    async (text: string) => {
      const s = sessionRef.current;
      const t = text.trim();
      if (!s || !t || ended) return;
      const optimistic: Turn = { id: `tmp_${Date.now()}`, sessionId: s.id, captureId: id, role: "expert", text: t, at: new Date().toISOString() };
      setTurns((xs) => [...xs, optimistic]);
      setPartial("");
      setBusy(true);
      bv.current?.thinking();
      setVoiceState("thinking");
      try {
        const generateNext = engine !== "higgs";
        const r = await api.expertTurn(s.id, t, generateNext);
        setTurns((xs) => xs.map((x) => (x.id === optimistic.id ? r.expertTurn : x)).concat(r.interviewerTurn ? [r.interviewerTurn] : []));
        pushAtoms(r.atoms);
        setCapture(r.capture);
        if (engine === "higgs" && hv.current) {
          // Refresh the interviewer's agenda with the new coverage state.
          api.instructions(id).then((ins) => hv.current?.updateInstructions(ins)).catch(() => undefined);
          setVoiceState("listening");
        } else if (r.interviewerTurn && engine === "browser" && bv.current) {
          await bv.current.speak(r.interviewerTurn.text);
          if (!muted) bv.current.listen();
          else setVoiceState("idle");
        } else {
          setVoiceState("idle");
        }
      } catch (e) {
        toast((e as Error).message, "error");
        setTurns((xs) => xs.filter((x) => x.id !== optimistic.id));
        if (engine === "browser" && !muted) bv.current?.listen();
      } finally {
        setBusy(false);
      }
    },
    [api, engine, ended, id, muted, toast],
  );

  const start = async () => {
    if (!capture) return;
    setStarting(true);
    try {
      const mode = engine === "higgs" ? "voice-higgs" : engine === "browser" ? "voice-browser" : "text";
      const r = await api.startSession(id, mode);
      sessionRef.current = r.session;
      setSession(r.session);
      setCapture(r.capture);
      setTurns([r.interviewerTurn]);

      if (engine === "browser") {
        const v = new BrowserVoice(
          {
            onPartial: setPartial,
            onFinal: (t) => void submitExpert(t),
            onState: setVoiceState,
            onLevel: setLevel,
            onError: (m) => toast(m, "error"),
          },
          capture.expert.language,
        );
        bv.current = v;
        await v.init();
        if (health?.higgs && v.stream && ReferenceRecorder.supported()) {
          recorder.current = new ReferenceRecorder();
          recorder.current.start(v.stream);
        }
        await v.speak(r.interviewerTurn.text);
        v.listen();
      } else if (engine === "higgs") {
        const info = await api.higgsSession(id);
        skipFirstAssistant.current = true;
        const v = new HiggsVoice({
          onState: setVoiceState,
          onLevel: setLevel,
          onError: (m) => toast(m, "error"),
          onUserTranscript: (t) => void submitExpert(t),
          onAssistantPartial: setAssistantPartial,
          onAssistantTranscript: (t) => {
            setAssistantPartial("");
            if (skipFirstAssistant.current) {
              skipFirstAssistant.current = false;
              return;
            }
            const s = sessionRef.current;
            if (!s) return;
            api
              .interviewerTurn(s.id, t)
              .then((turn) => setTurns((xs) => [...xs, turn]))
              .catch(() => setTurns((xs) => [...xs, { id: `tmp_${Date.now()}`, sessionId: s.id, captureId: id, role: "interviewer", text: t, at: new Date().toISOString() }]));
          },
        });
        hv.current = v;
        await v.connect({ ...info, instructions: `${info.instructions}\n\nBegin the session by saying exactly this, then wait for the answer: "${r.interviewerTurn.text}"` });
      } else {
        setVoiceState("idle");
      }
    } catch (e) {
      toast((e as Error).message, "error");
      bv.current?.destroy();
      hv.current?.disconnect();
      bv.current = null;
      hv.current = null;
      if (engine !== "text") {
        toast("Falling back to text mode.", "info");
        setEngine("text");
      }
    } finally {
      setStarting(false);
    }
  };

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    if (engine === "browser" && bv.current) {
      if (m) bv.current.stopListening();
      else bv.current.listen();
    }
    if (engine === "higgs" && hv.current) hv.current.setMuted(m);
  };

  const replay = (text: string) => {
    if (engine === "browser" && bv.current) {
      bv.current.speak(text).then(() => !muted && bv.current?.listen());
    }
  };

  const end = async () => {
    const s = sessionRef.current;
    if (!s) return;
    if (recorder.current) {
      const blob = await recorder.current.stop();
      recorder.current = null;
      const said = turns.filter((t) => t.role === "expert").map((t) => t.text).join(" ");
      if (blob && said.split(/\s+/).length >= 12) setReference({ blob, transcript: said.slice(0, 1200) });
    }
    bv.current?.destroy();
    hv.current?.disconnect();
    setVoiceState("off");
    setBusy(true);
    try {
      const done = await api.endSession(s.id);
      sessionRef.current = done;
      setEnded(done);
      setCapture(await api.getCapture(id));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
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
    voiceState === "listening" ? `Listening to ${first}…` : voiceState === "thinking" ? "Tacit is thinking…" : voiceState === "speaking" ? "Tacit is speaking" : session ? (engine === "text" ? "Your turn — type below" : "Ready") : "";

  if (!capture) return <div className="h-screen grid place-items-center text-muted">Loading…</div>;

  /* ────────────────────────── pre-flight ────────────────────────── */
  if (!session) {
    const options: { k: EngineKind; title: string; body: string; ok: boolean; why?: string }[] = [
      { k: "higgs", title: "Higgs Realtime", body: "Speech-to-speech by Boson AI. Natural turn-taking, interruptions, ~0.7s latency.", ok: Boolean(health?.higgs), why: "Needs BOSON_API_KEY on the server" },
      { k: "browser", title: "Browser voice", body: "Your browser's speech recognition and voice. No keys. Chrome works best.", ok: BrowserVoice.supported(), why: "Speech APIs unavailable in this browser" },
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
                onClick={() => setEngine(o.k)}
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
            <Button variant="danger" size="sm" onClick={end} loading={busy} icon={<Square className="h-3.5 w-3.5" />}>
              End session
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
                      {engine === "browser" && (
                        <button onClick={() => replay(t.text)} className="ml-auto text-muted hover:text-ink" title="Replay">
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
              <Button variant={muted ? "danger" : "secondary"} onClick={toggleMute} icon={muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}>
                {muted ? "Unmute" : "Mute"}
              </Button>
            </div>
          )}
          {!ended && (
            <form
              className="mt-2 flex w-full items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (engine === "higgs") {
                  toast("Typed answers aren't wired into Higgs mode yet — just say it.", "info");
                  return;
                }
                void submitExpert(typed);
                setTyped("");
              }}
            >
              <Keyboard className="h-4 w-4 shrink-0 text-muted" />
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={engine === "text" ? "Type your answer…" : "Or type instead…"} disabled={busy} />
              <Button type="submit" variant="primary" size="sm" disabled={busy || !typed.trim()} icon={<Send className="h-3.5 w-3.5" />} aria-label="Send" />
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
                <span className="font-medium">Let the twin speak in {first}'s voice.</span> Tacit recorded {Math.round(reference.blob.size / 8000)}s of {first} during this session. Higgs Audio can clone it so the successor hears answers the way {first} would say them.
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
