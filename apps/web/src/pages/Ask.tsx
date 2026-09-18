import { AlertCircle, Mic, MicOff, Send, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { AskResult, Atom, Capture, Question } from "@tacit/core";
import { AtomCard } from "../components/AtomCard.js";
import { Markdown } from "../components/Markdown.js";
import { Avatar, Badge, Button, Card, CardHeader, Input, PageHeader, cx } from "../components/ui.js";
import { fmtRelative } from "../lib/format.js";
import { useApi, useApp } from "../lib/store.js";
import { BrowserVoice } from "../lib/voice/browserVoice.js";
import { SpokenAudio } from "../lib/voice/spokenAudio.js";

interface Exchange {
  id: number;
  question: string;
  result?: AskResult;
  error?: string;
}

const SUGGESTIONS: Record<string, string[]> = {
  maria: ["The ACH file bounced on a Friday afternoon. What do I do?", "Who do I call at ADP when something is stuck?", "How do I handle two garnishment orders on one employee?", "What's the trick with retro pay at close?"],
  dev: ["Payments is paging about Postgres connections. First move?", "How do I deploy to production?", "Who holds the Vault unseal keys?"],
};

export function Ask() {
  const { id = "" } = useParams();
  const api = useApi();
  const health = useApp((s) => s.health);
  const toast = useApp((s) => s.toast);
  const speech = useRef<SpokenAudio | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [atoms, setAtoms] = useState<Record<string, Atom>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speakAnswers, setSpeakAnswers] = useState(true);
  const [listening, setListening] = useState(false);
  const [focusAtom, setFocusAtom] = useState<string | null>(null);
  const voice = useRef<BrowserVoice | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const speakRef = useRef(true);
  const playback = useRef(0);
  const askRef = useRef<(text: string) => Promise<void>>(async () => undefined);
  const micPending = useRef<Promise<BrowserVoice> | null>(null);
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const room = generation.current;
    const [c, a, q] = await Promise.all([api.getCapture(id), api.listAtoms(id), api.listQuestions(id)]);
    if (room !== generation.current) return;
    setCapture(c);
    setAtoms(Object.fromEntries(a.map((x) => [x.id, x])));
    setQuestions(q);
  }, [api, id]);

  useEffect(() => {
    setCapture(null);
    setExchanges([]);
    setInput("");
    setBusy(false);
    setListening(false);
    busyRef.current = false;
    load().catch((e) => toast((e as Error).message, "error"));
    return () => {
      generation.current++;
      playback.current++;
      voice.current?.destroy();
      voice.current = null;
      speech.current?.destroy();
      speech.current = null;
    };
  }, [load, toast]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [exchanges]);

  const stopSpeech = () => {
    playback.current++;
    speech.current?.stop();
    setSpeakingId(null);
  };

  const readAnswer = async (answer: string, exchangeId: number) => {
    stopSpeech();
    voice.current?.stopListening();
    const token = playback.current;
    const room = generation.current;
    const plain = answer.replace(/\[\d+\]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*#>_`]/g, "").replace(/\s+/g, " ").trim().slice(0, 3800);
    speech.current ??= new SpokenAudio(() => toast("Natural voice is unavailable. Using this browser's voice.", "info"), capture?.expert.language);
    setSpeakingId(exchangeId);
    try { await speech.current.speak(plain, health?.higgs ? () => api.speak(plain, id) : undefined); }
    catch (error) { if (room === generation.current) toast((error as Error).message, "error"); }
    finally { if (room === generation.current && token === playback.current) setSpeakingId(null); }
  };

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || !capture || busyRef.current) return;
    busyRef.current = true;
    const room = generation.current;
    voice.current?.stopListening();
    stopSpeech();
    setInput("");
    const exchange: Exchange = { id: ++seq.current, question };
    setExchanges((previous) => [...previous, exchange]);
    setBusy(true);
    try {
      const result = await api.ask(id, question, capture.successor?.name);
      if (room !== generation.current) return;
      setExchanges((previous) => previous.map((item) => item.id === exchange.id ? { ...item, result } : item));
      if (result.queuedQuestion) {
        toast(`Queued for ${capture.expert.name.split(" ")[0]}'s next interview`);
        void api.listQuestions(id).then((items) => { if (room === generation.current) setQuestions(items); }).catch(() => undefined);
      }
      // The response is available immediately; spoken playback can be interrupted.
      busyRef.current = false;
      setBusy(false);
      if (speakRef.current) void readAnswer(result.answer, exchange.id);
    } catch (error) {
      if (room === generation.current) {
        setExchanges((previous) => previous.map((item) => item.id === exchange.id ? { ...item, error: (error as Error).message } : item));
        setInput(question);
      }
    } finally {
      if (room === generation.current) { busyRef.current = false; setBusy(false); }
    }
  };
  askRef.current = ask;

  const ensureVoice = async () => {
    if (micPending.current) return micPending.current;
    if (voice.current) return voice.current;
    const room = generation.current;
    const current = new BrowserVoice({
      onPartial: setInput,
      onFinal: (text) => { setListening(false); void askRef.current(text); },
      onState: (state) => setListening(state === "listening"),
      onLevel() {},
      onError: (message) => toast(message, "error"),
    }, capture?.expert.language);
    voice.current = current;
    micPending.current = current.init().then(() => {
      if (room !== generation.current) throw new DOMException("Voice setup cancelled", "AbortError");
      return current;
    }).catch((error) => {
      current.destroy();
      if (voice.current === current) voice.current = null;
      throw error;
    }).finally(() => { micPending.current = null; });
    return micPending.current;
  };

  const toggleMic = async () => {
    if (busyRef.current) return;
    if (!BrowserVoice.recognitionSupported()) {
      toast("Speech recognition isn't available in this browser. Chrome works best. You can type below.", "error");
      return;
    }
    stopSpeech();
    try {
      const current = await ensureVoice();
      if (listening) current.stopListening();
      else { current.idle(); current.listen(); }
    } catch (error) { if ((error as Error).name !== "AbortError") toast((error as Error).message, "error"); }
  };

  const toggleSpeak = () => {
    speakRef.current = !speakRef.current;
    setSpeakAnswers(speakRef.current);
    if (!speakRef.current) stopSpeech();
  };

  const first = capture?.expert.name.split(" ")[0] ?? "the expert";
  const open = questions.filter((q) => q.status !== "answered" && q.source !== "plan");
  const sampleKey = capture?.id.replace(/^cap_/, "") ?? "";
  const suggestions = SUGGESTIONS[sampleKey] ?? [`What should I do first on my first day as ${capture?.expert.role ?? "this role"}?`, "Who do I call when something is stuck?", "What goes wrong most often?"];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="flex min-h-[70vh] flex-col">
        <PageHeader
          className="mb-4"
          eyebrow="Ask the twin"
          title={`Ask ${first}’s twin`}
          lede={
            <>
              Answers come only from what {first} actually said, with citations. If the twin doesn't know, the question goes to {first}'s next interview.
              {capture?.voiceId && health?.higgs && <span className="ml-1 text-accent">Spoken answers use {first}'s cloned voice.</span>}
            </>
          }
        />

        <div className="flex-1 space-y-5 overflow-y-auto pr-1 scrollbar-thin">
          {exchanges.length === 0 && (
            <Card className="p-5">
              <p className="text-[13px] text-muted mb-2">Try asking</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => ask(s)} disabled={busy || !capture} className="rounded-full border border-line-2 bg-paper-2 px-3 py-1.5 text-left text-[13px] hover:border-muted">
                    {s}
                  </button>
                ))}
              </div>
            </Card>
          )}
          {exchanges.map((ex) => (
            <div key={ex.id} className="space-y-3 rise-in">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md border border-line-2 bg-paper-3 px-4 py-2.5 text-[14px] text-ink">{ex.question}</div>
              </div>
              <div className="flex gap-3">
                {capture && <Avatar name={capture.expert.name} size={34} />}
                <div className="min-w-0 flex-1">
                  {!ex.result && !ex.error && (
                    <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Searching {first}'s knowledge…
                    </div>
                  )}
                  {ex.error && <p className="text-sm text-danger">{ex.error}</p>}
                  {ex.result && (
                    <Card className="p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge tone={ex.result.confidence === "high" ? "sage" : ex.result.confidence === "medium" ? "amber" : ex.result.confidence === "low" ? "danger" : "neutral"}>
                          {ex.result.confidence === "none" ? "Not in the knowledge base" : `${ex.result.confidence} confidence`}
                        </Badge>
                        <span className="font-mono text-[10.5px] text-muted">{ex.result.engine}</span>
                        {ex.result.queuedQuestion && (
                          <Badge tone="accent" icon={<AlertCircle className="h-3 w-3" />}>
                            Queued for {first}
                          </Badge>
                        )}
                      </div>
                      <div className="mb-2 flex justify-end">
                        <Button size="sm" variant="ghost" onClick={() => speakingId === ex.id ? stopSpeech() : void readAnswer(ex.result!.answer, ex.id)} icon={speakingId === ex.id ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}>
                          {speakingId === ex.id ? "Stop audio" : "Read answer aloud"}
                        </Button>
                      </div>
                      <span className="sr-only" role="status">Answer ready with {ex.result.citations.length} sources.</span>
                      <Markdown onCite={(n) => setFocusAtom(ex.result?.citations.find((c) => c.n === n)?.atomId ?? null)}>{ex.result.answer}</Markdown>
                      {ex.result.citations.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-line pt-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted font-semibold">Sources</p>
                          {ex.result.citations.map((c) => {
                            const a = atoms[c.atomId];
                            return a ? (
                              <AtomCard key={c.n} atom={a} citation={c.n} compact highlight={focusAtom === a.id} />
                            ) : (
                              <div key={c.n} className="text-[13px] text-muted">
                                [{c.n}] {c.title}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottom} />
        </div>

        <form
          className="mt-4 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          <Button type="button" variant={listening ? "accent" : "secondary"} onClick={toggleMic} disabled={busy} aria-pressed={listening} icon={listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} aria-label={listening ? "Stop microphone" : "Ask by voice"} />
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Listening…" : `Ask ${first} a question…`} aria-label="Your question" className={cx("h-11", listening && "border-accent")} />
          <Button
            type="button"
            className="shrink-0"
            aria-label={speakAnswers ? "Turn off spoken answers" : "Turn on spoken answers"}
            aria-pressed={speakAnswers}
            variant={speakAnswers ? "accent" : "ghost"}
            onClick={toggleSpeak}
            icon={speakAnswers ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            title={health?.higgs ? (capture?.voiceId ? `Read answers aloud in ${first}'s cloned voice (Higgs Audio)` : "Read answers aloud (Higgs Audio)") : "Read answers aloud"}
          />
          <Button type="submit" variant="primary" loading={busy} disabled={!input.trim() || !capture} icon={<Send className="h-4 w-4" />}>
            Ask
          </Button>
        </form>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader title="Waiting for the expert" subtitle={open.length ? `${open.length} question${open.length === 1 ? " goes" : "s go"} first next session` : "The queue is empty"} />
          <div className="px-5 pb-5 space-y-2">
            {open.map((q) => (
              <div key={q.id} className="rounded-lg border border-accent/40 bg-accent-3/60 px-3 py-2 text-[13px]">
                <p>{q.text}</p>
                <p className="text-[11px] text-muted mt-0.5">
                  {q.askedBy ?? "successor"} · {fmtRelative(q.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5 text-[13px] text-ink-2 leading-relaxed">
          <p className="font-medium text-ink mb-1">How the twin answers</p>
          <p>The twin finds relevant knowledge from {first}’s interviews and shows a source for each answer. When there is not enough evidence, your question goes to {first} for the next interview.</p>
        </Card>
      </aside>
    </div>
  );
}
