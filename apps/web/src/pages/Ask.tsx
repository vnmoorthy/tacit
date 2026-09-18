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
import { BlobPlayer } from "../lib/voice/player.js";

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
  const player = useRef(new BlobPlayer());
  const [capture, setCapture] = useState<Capture | null>(null);
  const [atoms, setAtoms] = useState<Record<string, Atom>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speakAnswers, setSpeakAnswers] = useState(false);
  const [listening, setListening] = useState(false);
  const [focusAtom, setFocusAtom] = useState<string | null>(null);
  const voice = useRef<BrowserVoice | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const [c, a, q] = await Promise.all([api.getCapture(id), api.listAtoms(id), api.listQuestions(id)]);
    setCapture(c);
    setAtoms(Object.fromEntries(a.map((x) => [x.id, x])));
    setQuestions(q);
  }, [api, id]);

  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
    return () => voice.current?.destroy();
  }, [load, toast]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [exchanges]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || !capture) return;
    setInput("");
    const ex: Exchange = { id: ++seq.current, question: q };
    setExchanges((xs) => [...xs, ex]);
    setBusy(true);
    try {
      const result = await api.ask(id, q, capture.successor?.name);
      setExchanges((xs) => xs.map((x) => (x.id === ex.id ? { ...x, result } : x)));
      if (result.queuedQuestion) {
        toast(`Queued for ${capture.expert.name.split(" ")[0]}'s next interview`);
        setQuestions(await api.listQuestions(id));
      }
      if (speakAnswers) {
        const plain = result.answer.replace(/\[\d+\]/g, "").replace(/[*#>_`]/g, "").replace(/\s+/g, " ").trim().slice(0, 700);
        if (health?.higgs) {
          try {
            await player.current.play(await api.speak(plain, id));
          } catch (e) {
            toast(`Higgs voice unavailable (${(e as Error).message}); using browser voice.`, "info");
            await voice.current?.speak(plain);
          }
        } else {
          await voice.current?.speak(plain);
        }
      }
    } catch (e) {
      setExchanges((xs) => xs.map((x) => (x.id === ex.id ? { ...x, error: (e as Error).message } : x)));
    } finally {
      setBusy(false);
    }
  };

  const ensureVoice = async () => {
    if (voice.current) return voice.current;
    const v = new BrowserVoice({
      onPartial: (t) => setInput(t),
      onFinal: (t) => {
        setListening(false);
        void ask(t);
      },
      onState: (s) => setListening(s === "listening"),
      onLevel: () => undefined,
      onError: (m) => toast(m, "error"),
    });
    await v.init();
    voice.current = v;
    return v;
  };

  const toggleMic = async () => {
    if (!BrowserVoice.recognitionSupported()) {
      toast("Speech recognition isn't available in this browser. Chrome works best.", "error");
      return;
    }
    try {
      const v = await ensureVoice();
      if (listening) v.stopListening();
      else v.listen();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const toggleSpeak = async () => {
    if (!speakAnswers && !health?.higgs) await ensureVoice().catch(() => undefined);
    if (speakAnswers) player.current.stop();
    setSpeakAnswers(!speakAnswers);
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
          title={`Ask ${first} anything`}
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
                  <button key={s} onClick={() => ask(s)} className="rounded-full border border-line-2 bg-paper-2 px-3 py-1.5 text-left text-[13px] hover:border-muted">
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
                    <div className="flex items-center gap-2 text-sm text-muted">
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
          <Button type="button" variant={listening ? "accent" : "secondary"} onClick={toggleMic} icon={listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} aria-label="Ask by voice" />
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Listening…" : `Ask ${first} a question…`} className={cx("h-11", listening && "border-accent")} />
          <Button
            type="button"
            className="hidden sm:inline-flex"
            variant={speakAnswers ? "accent" : "ghost"}
            onClick={toggleSpeak}
            icon={speakAnswers ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            title={health?.higgs ? (capture?.voiceId ? `Read answers aloud in ${first}'s cloned voice (Higgs Audio)` : "Read answers aloud (Higgs Audio)") : "Read answers aloud"}
          />
          <Button type="submit" variant="primary" loading={busy} icon={<Send className="h-4 w-4" />}>
            Ask
          </Button>
        </form>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader title="Waiting for the expert" subtitle={open.length ? `${open.length} question${open.length === 1 ? "" : "s"} go first next session` : "The queue is empty"} />
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
          <p>Hybrid retrieval (BM25 + embeddings when available) finds the most relevant atoms; the model answers only from those and cites each one. Low-confidence answers automatically queue the question for {first}.</p>
        </Card>
      </aside>
    </div>
  );
}
