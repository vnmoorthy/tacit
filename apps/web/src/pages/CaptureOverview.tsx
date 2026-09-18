import { AlertCircle, Clock, FileText, MessageSquareText, Mic, MoreHorizontal, Orbit, Phone, Plus, Trash2, Volume2 } from "lucide-react";
import { BlobPlayer } from "../lib/voice/player.js";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { languageName, type Atom, type Capture, type Question, type Session } from "@tacit/core";
import { AtomCard } from "../components/AtomCard.js";
import { CoverageMap } from "../components/CoverageMap.js";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Input, Modal, SectionTitle, Stat, cx } from "../components/ui.js";
import { daysUntil, fmtDate, fmtDuration, fmtRelative, pct, plural } from "../lib/format.js";
import { useApi, useApp } from "../lib/store.js";

export function CaptureOverview() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useApp((s) => s.toast);
  const nav = useNavigate();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [atoms, setAtoms] = useState<Atom[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [newQ, setNewQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [calling, setCalling] = useState(false);
  const health = useApp((s) => s.health);

  const callExpert = async () => {
    if (!capture) return;
    setCalling(true);
    try {
      const r = await api.callExpert(id, phone.trim());
      toast(`Calling ${capture.expert.name}… room ${r.roomName}`, "success");
      setCallOpen(false);
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setCalling(false);
    }
  };

  const previewVoice = async () => {
    if (!capture) return;
    setPreviewing(true);
    try {
      const first = capture.expert.name.split(" ")[0];
      const line = `Hi, this is ${first}'s knowledge twin. Ask me anything about ${capture.expert.role.toLowerCase()} and I'll answer from what ${first} actually said.`;
      try {
        await new BlobPlayer().play(await api.speak(line, capture.id));
      } catch (e) {
        toast(`Higgs voice busy (${(e as Error).message.slice(0, 60)}…); using browser voice.`, "info");
        const u = new SpeechSynthesisUtterance(line);
        window.speechSynthesis?.speak(u);
      }
    } finally {
      setPreviewing(false);
    }
  };

  const load = useCallback(async () => {
    const [c, a, s, q] = await Promise.all([api.getCapture(id), api.listAtoms(id), api.listSessions(id), api.listQuestions(id)]);
    setCapture(c);
    setAtoms(a);
    setSessions(s);
    setQuestions(q);
  }, [api, id]);

  useEffect(() => {
    load().catch((e) => {
      toast((e as Error).message, "error");
      nav("/");
    });
  }, [load, nav, toast]);

  if (!capture) return <div className="h-64 rounded-2xl bg-paper-2 animate-pulse" />;

  const days = daysUntil(capture.expert.departureDate);
  const open = questions.filter((q) => q.status !== "answered" && q.source !== "plan");
  const domainName = (did?: string) => capture.domains.find((d) => d.id === did)?.name;
  const visibleAtoms = (selectedDomain ? atoms.filter((a) => a.domainId === selectedDomain) : atoms).slice(0, 6);

  const addQuestion = async () => {
    if (!newQ.trim()) return;
    try {
      await api.addQuestion(id, newQ.trim(), capture.successor?.name);
      setNewQ("");
      toast("Queued for the next interview", "success");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const del = async () => {
    await api.deleteCapture(id);
    toast("Capture deleted");
    nav("/");
  };

  return (
    <div className="space-y-7">
      <header className="rounded-[24px] border border-line bg-white/55 p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={capture.expert.name} size={60} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[32px] leading-none md:text-[36px]">{capture.expert.name}</h1>
                {capture.sample && <Badge tone="neutral">Sample</Badge>}
                {capture.voiceId && (
                  <Badge tone="accent" icon={<Volume2 className="h-3 w-3" />}>
                    Voice cloned
                  </Badge>
                )}
                {capture.expert.language && !capture.expert.language.toLowerCase().startsWith("en") && <Badge tone="info">{languageName(capture.expert.language)} interview</Badge>}
              </div>
              <p className="mt-1.5 text-[15px] text-ink-2">
                {capture.expert.role}
                {capture.expert.team ? ` · ${capture.expert.team}` : ""}
                {capture.expert.tenureYears ? ` · ${capture.expert.tenureYears} years` : ""}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
                {days !== null && (
                  <Badge tone={days <= 30 ? "danger" : days <= 90 ? "amber" : "neutral"} icon={<Clock className="h-3 w-3" />}>
                    {days < 0 ? `Left ${fmtDate(capture.expert.departureDate)}` : `${days} days until ${fmtDate(capture.expert.departureDate)}`}
                  </Badge>
                )}
                {capture.successor && (
                  <span>
                    Successor <span className="font-medium text-ink">{capture.successor.name}</span>
                    {capture.successor.role ? ` · ${capture.successor.role}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="accent" size="lg" icon={<Mic className="h-4 w-4" />} onClick={() => nav(`/c/${id}/interview`)}>
              {sessions.length ? "Continue interviewing" : "Start first interview"}
            </Button>
            <Button size="lg" icon={<MessageSquareText className="h-4 w-4" />} onClick={() => nav(`/c/${id}/ask`)}>
              Ask the twin
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Explore</span>
          <Button size="sm" variant="ghost" icon={<Orbit className="h-3.5 w-3.5" />} onClick={() => nav(`/c/${id}/graph`)} title="3D knowledge graph you can steer with your hands">
            Constellation
          </Button>
          <Button size="sm" variant="ghost" icon={<FileText className="h-3.5 w-3.5" />} onClick={() => nav(`/c/${id}/handover`)}>
            Handover doc
          </Button>
          {health?.higgs && (
            <Button size="sm" variant="ghost" icon={<Volume2 className="h-3.5 w-3.5" />} onClick={previewVoice} loading={previewing} title={capture.voiceId ? "Hear the twin in the expert's cloned voice" : "Hear the twin (default Higgs voice)"}>
              Hear the twin
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<Phone className="h-3.5 w-3.5" />}
            onClick={() => (health?.phone ? setCallOpen(true) : toast("Phone interviews need LiveKit + Twilio configured on the server (see docs/PHONE.md).", "info"))}
            title={health?.phone ? "Tacit calls the expert's phone" : "Configure LiveKit + Twilio to enable phone interviews"}
            className={health?.phone ? "" : "opacity-60"}
          >
            Call the expert
          </Button>
          <div className="relative ml-auto">
            <Button variant="ghost" size="sm" onClick={() => setMenu(!menu)} aria-label="More">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {menu && (
              <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-line bg-paper p-1 shadow-lift" onMouseLeave={() => setMenu(false)}>
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-2"
                  onClick={() => {
                    setMenu(false);
                    setConfirmDelete(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete capture
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Coverage" value={pct(capture.stats.coverage)} hint={`${capture.domains.length} domains, weighted by priority`} tone={capture.stats.coverage > 0.66 ? "sage" : "accent"} />
        <Stat label="Knowledge atoms" value={capture.stats.atoms} hint={`${capture.stats.verifiedAtoms} verified by ${capture.expert.name.split(" ")[0]}`} />
        <Stat label="Interview time" value={fmtDuration(capture.stats.minutes)} hint={plural(capture.stats.sessions, "session")} />
        <Stat label="Open questions" value={open.length} hint="asked first next session" tone={open.length ? "accent" : "neutral"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader title="Coverage map" subtitle="What a successor needs to know, and how much of it has been captured." />
          <div className="px-5 pb-5">
            <CoverageMap domains={capture.domains} coverage={capture.stats.coverage} selected={selectedDomain} onSelect={setSelectedDomain} />
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Question queue"
              subtitle={open.length ? `${open.length} waiting for ${capture.expert.name.split(" ")[0]}` : "Nothing waiting — the twin has answered everything asked so far."}
            />
            <div className="px-5 pb-5 space-y-2">
              {open.map((q) => (
                <div key={q.id} className="flex items-start gap-2 rounded-xl border border-accent-2/50 bg-accent-3/50 px-3 py-2.5 text-[13.5px]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p>{q.text}</p>
                    <p className="text-[11.5px] text-muted mt-0.5">
                      {q.askedBy ? `asked by ${q.askedBy}` : q.source} · {fmtRelative(q.createdAt)}
                      {q.status === "asked" ? " · being asked" : ""}
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Queue a question for the next interview…" onKeyDown={(e) => e.key === "Enter" && addQuestion()} />
                <Button onClick={addQuestion} icon={<Plus className="h-4 w-4" />} aria-label="Add question" />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Sessions" subtitle={sessions.length ? `${fmtDuration(capture.stats.minutes)} of interviews` : "No interviews yet"} />
            <div className="px-5 pb-5 space-y-2">
              {sessions.length === 0 && <p className="text-sm text-muted">Start the first interview to begin building the knowledge base.</p>}
              {sessions.map((s) => (
                <div key={s.id} className="rounded-xl border border-line bg-white/50 px-3.5 py-3">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-medium">{fmtDate(s.startedAt, { month: "short", day: "numeric" })} · {fmtRelative(s.startedAt)}</span>
                    <span className="text-muted">
                      {s.mode === "voice-higgs" ? "Higgs voice" : s.mode === "voice-browser" ? "Voice" : "Text"} · {s.turnCount} turns · {s.atomCount} atoms
                      {!s.endedAt && <span className="ml-1 text-accent">· live</span>}
                    </span>
                  </div>
                  {s.summary && <p className="mt-1.5 text-[13px] text-ink-2 leading-relaxed">{s.summary}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <section>
        <SectionTitle
          action={
            <Link to={`/c/${id}/knowledge`} className="text-[13px] font-medium text-accent hover:underline">
              All {atoms.length} atoms →
            </Link>
          }
        >
          {selectedDomain ? `Atoms · ${domainName(selectedDomain)}` : "Latest knowledge atoms"}
        </SectionTitle>
        {visibleAtoms.length === 0 ? (
          <EmptyState title={selectedDomain ? "Nothing captured in this domain yet" : "No atoms yet"} body="Atoms appear here as the expert talks." />
        ) : (
          <div className={cx("grid gap-3 md:grid-cols-2 lg:grid-cols-3")}>
            {visibleAtoms.map((a) => (
              <AtomCard key={a.id} atom={a} domainName={domainName(a.domainId)} compact />
            ))}
          </div>
        )}
      </section>

      <Modal
        open={callOpen}
        onClose={() => setCallOpen(false)}
        title={`Call ${capture.expert.name}`}
        footer={
          <>
            <Button onClick={() => setCallOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={callExpert} loading={calling} disabled={!/^\+[1-9]\d{6,14}$/.test(phone.trim())} icon={<Phone className="h-4 w-4" />}>
              Place call
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-ink-2">
          <p>Tacit will ring {capture.expert.name.split(" ")[0]}'s phone through Twilio and run the interview on Higgs Realtime. The transcript and atoms land here live.</p>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+14155551234" autoFocus />
          <p className="text-[12px] text-muted">E.164 format, with country code.</p>
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this capture?"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" onClick={del} icon={<Trash2 className="h-4 w-4" />}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          This removes {capture.expert.name}'s capture, {plural(atoms.length, "atom")}, {plural(sessions.length, "session")} and all transcripts. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
