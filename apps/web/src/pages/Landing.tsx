/** Product website served at the root. The app lives under /app. */
import { ArrowRight, Brain, Building2, Factory, FileText, Github, GitFork, Globe2, HeartHandshake, Hospital, Landmark, Mic, Orbit, Phone, Play, Quote, ShieldCheck, Sparkles, Users, Volume2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { OrbArt } from "../components/OrbArt.js";
import { buttonClass, cx } from "../components/ui.js";

const REPO = "https://github.com/vnmoorthy/tacit";
const VIDEO = "https://github.com/vnmoorthy/tacit/releases/download/v0.1.0-hackathon/tacit-demo.mp4";

function Eyebrow({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return <p className={cx("font-mono text-[12px] font-medium uppercase tracking-[0.16em]", light ? "text-accent-2" : "text-accent")}>{children}</p>;
}

function H2({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cx("font-display mt-3 text-[32px] leading-[1.08] md:text-[44px]", className)}>{children}</h2>;
}

export function Landing() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ── nav ── */}
      <header className={cx("sticky top-0 z-40 transition", scrolled ? "border-b border-line bg-paper/85 backdrop-blur" : "")}>
        <div className="mx-auto flex max-w-[1180px] items-center gap-6 px-5 py-4 md:px-8">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-line-2 bg-paper-2">
              <svg viewBox="0 0 64 64" className="h-5 w-5">
                <circle cx="32" cy="32" r="17" fill="none" stroke="#E8B36B" strokeWidth="4" />
                <circle cx="32" cy="32" r="9" fill="none" stroke="#E8B36B" strokeWidth="4" opacity=".7" />
                <circle cx="32" cy="32" r="3" fill="#E8B36B" />
              </svg>
            </span>
            <span className="font-display text-[22px]">Tacit</span>
          </a>
          <nav className="ml-4 hidden items-center gap-6 text-[14px] text-ink-2 md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#product" className="hover:text-ink">Product</a>
            <a href="#uses" className="hover:text-ink">Use cases</a>
            <a href="#demo" className="hover:text-ink">Demo</a>
            <a href="#open" className="hover:text-ink">Open source</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a href={REPO} target="_blank" rel="noreferrer" className={buttonClass({ size: "sm", variant: "ghost", className: "hidden md:inline-flex" })}>
              <Github className="h-4 w-4" /> GitHub
            </a>
            <Link to="/app" className={buttonClass({ size: "sm", variant: "primary" })}>
              <ArrowRight className="h-4 w-4" /> Open the app
            </Link>
          </div>
        </div>
      </header>

      {/* ── hero ── */}
      <section id="top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full" style={{ background: "radial-gradient(circle, rgba(232,163,61,.10), transparent 62%)" }} />
        <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 pb-16 pt-12 md:grid-cols-[1.2fr_1fr] md:px-8 md:pb-24 md:pt-20">
          <div className="rise-in">
            <Eyebrow>Institutional memory, captured by conversation</Eyebrow>
            <h1 className="font-display mt-4 text-[44px] leading-[1.02] md:text-[66px]">
              Every expert who leaves takes a library with them. <span className="italic text-accent">Tacit interviews them first.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2 md:text-[19px]">
              A voice AI that interviews your departing experts and turns what's in their head into a living, cited knowledge base their successor can talk to. Grounded in the expert's own words.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/app" className={buttonClass({ variant: "accent", size: "lg" })}>
                <Sparkles className="h-4 w-4" /> Try it now — no sign-up
              </Link>
              <a href="#demo" className={buttonClass({ size: "lg" })}>
                <Play className="h-4 w-4" /> Watch the demo
              </a>
            </div>
            <p className="mt-4 text-[13px] text-muted">Try the browser demo without API keys. Connect Boson and Nebius for Higgs voice and AI-powered interviewing.</p>
          </div>
          <div className="hidden md:block">
            <OrbArt size={380} />
          </div>
        </div>
        <div className="border-y border-line bg-paper-2/60">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 py-4 text-[12.5px] font-medium uppercase tracking-[0.14em] text-muted md:px-8">
            <span className="text-ink-2">Built with</span>
            <span>Boson AI · Higgs Realtime</span>
            <span>Higgs Audio</span>
            <span>Nebius Token Factory</span>
            <span>MediaPipe</span>
            <span>LiveKit · Twilio</span>
          </div>
        </div>
      </section>

      {/* ── problem ── */}
      <section className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
        <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-end">
          <div>
            <Eyebrow>The problem</Eyebrow>
            <H2>The runbook they never wrote leaves with them.</H2>
          </div>
          <p className="text-[17px] leading-relaxed text-ink-2">
            The real cut-off time. The vendor rep who actually answers. The macro on their desktop. The rule that exists because of an incident nobody remembers. Companies ask experts to "write the documentation". Experts don't. <span className="text-ink">But they will talk for an hour.</span>
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["The exception", "The official deadline is five. The bank file needs to leave by half past three.", "Capture the detail a runbook misses."],
            ["The contact", "When a payment fails, knowing who answers is as useful as knowing the procedure.", "Keep relationships with the knowledge."],
            ["The judgment", "A seasoned expert knows when to follow the checklist and when to escalate.", "Preserve the reason behind a decision."],
          ].map(([n, t, detail]) => (
            <div key={n} className="rounded-xl border border-line bg-paper-2/70 p-6">
              <div className="font-display text-[27px] leading-tight text-accent">{n}</div>
              <p className="mt-3 text-[15px] leading-snug text-ink-2">{t}</p>
              <p className="mt-3 text-[12px] text-muted">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── how it works ── */}
      <section id="how" className="border-y border-line bg-paper-2 text-ink">
        <div className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
          <Eyebrow light>How it works</Eyebrow>
          <H2 className="max-w-3xl">Make the talking the documentation.</H2>
          <p className="mt-4 max-w-2xl text-[16px] text-ink-2">A closed loop: every conversation becomes cited knowledge, and every gap becomes the next question.</p>
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {[
              { n: "01", icon: <Mic className="h-5 w-5" />, t: "Interview", b: "A voice agent asks one question at a time and follows the thread: the hedges, the names, the exceptions. Real-time speech-to-speech with interruptions on Boson Higgs Realtime." },
              { n: "02", icon: <Sparkles className="h-5 w-5" />, t: "Distil", b: "While the expert is still talking, every answer becomes typed knowledge atoms with the expert's own words attached: procedures, rules, gotchas, contacts, tools, decisions, risks." },
              { n: "03", icon: <Quote className="h-5 w-5" />, t: "Ask", b: "The successor talks to the expert's twin. Answers cite the atoms they came from and can be spoken in the expert's cloned voice." },
              { n: "04", icon: <ArrowRight className="h-5 w-5" />, t: "Close the gap", b: "Questions the twin can't answer enter the next interview queue. The coverage map highlights topics that need more interviewing." },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border border-line-2 bg-paper-3/50 p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-accent text-[#0e1013]">{s.icon}</span>
                  <span className="font-mono text-[12px] text-muted">{s.n}</span>
                </div>
                <h3 className="font-display mt-5 text-[22px]">{s.t}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── product ── */}
      <section id="product" className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
        <Eyebrow>The product</Eyebrow>
        <H2 className="max-w-3xl">Built for the room where the knowledge is.</H2>
        <div className="mt-12 space-y-20">
          {[
            {
              img: "/img/interview-demo.png",
              alt: "An interview with Maria beside three captured knowledge atoms and a live coverage map",
              t: "The interview room",
              b: "One question at a time. Captured knowledge appears beside the conversation and the coverage map guides the next question. Choose Higgs Realtime, browser voice or typed answers.",
              pts: ["Natural turn-taking with Higgs Realtime", "Follow-ups on \"usually\", \"depends\", \"the trick is\"", "Multilingual interviews with English summaries when using an AI model"],
            },
            {
              img: "/img/ask-demo.png",
              alt: "Maria's twin answers a payroll question with numbered citations and source cards",
              t: "Ask the twin",
              b: "The successor asks. The twin answers from captured knowledge and cites its source atoms. With permission and voice cloning enabled, answers can be read aloud in the expert's voice. Low-confidence questions return to the interview queue.",
              pts: ["Hybrid retrieval: BM25 + embeddings", "Every claim cited to an atom", "Unanswered questions feed the next interview"],
              flip: true,
            },
            {
              img: "/img/graph-answer-demo.png",
              alt: "The Constellation highlights connected payroll knowledge beside a cited answer",
              t: "The Constellation",
              b: "The same knowledge as a living 3D graph. Your camera is the backdrop: point, pinch and orbit with your hands, or say \"show me the risks\" and watch the cited atoms light up.",
              pts: ["On-device hand tracking (MediaPipe)", "Voice commands and questions", "Record a clip with you inside the graph"],
            },
          ].map((f) => (
            <div key={f.t} className={cx("grid items-center gap-8 md:grid-cols-2 md:gap-14", f.flip && "md:[&>*:first-child]:order-2")}>
              <img src={f.img} alt={f.alt} width={1440} height={1000} className="w-full rounded-xl border border-line-2 shadow-lift" loading="lazy" />
              <div>
                <h3 className="font-display text-[30px] leading-tight">{f.t}</h3>
                <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{f.b}</p>
                <ul className="mt-5 space-y-2">
                  {f.pts.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[14.5px] text-ink-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [<Mic className="h-4 w-4" />, "Real-time voice interviews", "Speech-to-speech on Higgs Realtime, with natural turn-taking and interruptions."],
            [<Brain className="h-4 w-4" />, "Live extraction", "Nine atom types with confidence and source quotes, while the expert talks."],
            [<ShieldCheck className="h-4 w-4" />, "Coverage map", "Track planned questions and captured knowledge by topic and priority."],
            [<Volume2 className="h-4 w-4" />, "The expert's own voice", "Higgs Audio clones the voice from the interview, with consent."],
            [<Globe2 className="h-4 w-4" />, "Multilingual interviews", "Interview in Spanish, Tamil or Mandarin, with English summaries when using an AI model."],
            [<Orbit className="h-4 w-4" />, "Constellation", "3D knowledge graph steered by hand gestures and voice."],
            [<FileText className="h-4 w-4" />, "Handover document", "One click compiles a runbook for Confluence, Notion or PDF."],
            [<Phone className="h-4 w-4" />, "Phone interviews", "Tacit can call the expert: Twilio SIP → LiveKit → Higgs agent."],
            [<Wand2 className="h-4 w-4" />, "Works with zero keys", "Offline demo brain + browser voice. Add keys when you have them."],
          ].map(([icon, t, b], i) => (
            <div key={i} className="rounded-xl border border-line bg-paper-2/70 p-5">
              <div className="flex items-center gap-2 text-accent">
                {icon}
                <span className="font-display text-[18px] text-ink">{t}</span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── use cases ── */}
      <section id="uses" className="border-y border-line bg-paper-2/60">
        <div className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
          <Eyebrow>Use cases</Eyebrow>
          <H2 className="max-w-3xl">Wherever knowledge lives in one person's head.</H2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [<Users className="h-5 w-5" />, "Retirement handovers", "Capture the 20-year veteran's experience before their last day, and give their successor a searchable record of how the work gets done."],
              [<Building2 className="h-5 w-5" />, "Resignations, layoffs, contractor exits", "Two weeks' notice is enough for three interviews. HR offboarding becomes a knowledge capture, not a checklist."],
              [<Sparkles className="h-5 w-5" />, "Onboarding the successor", "New hires ask the twin of the person they replaced: who to call, what breaks, what the real deadlines are. Gaps become interview questions."],
              [<GitFork className="h-5 w-5" />, "Open-source maintainers stepping down", "Release rituals, the flaky test nobody touches, the sponsor who answers email. Interview the maintainer; give the next one a cited runbook."],
              [<Hospital className="h-5 w-5" />, "Clinical and care teams", "Charge nurses, lab managers and clinic coordinators hold years of operational knowledge. Capture shift routines, equipment quirks and escalation contacts for review."],
              [<Factory className="h-5 w-5" />, "Plants, utilities and field service", "The 1998 filler's quirks, the supplier who ships in a day, the safety rule from an incident. Phone interviews for people who don't sit at desks."],
              [<Landmark className="h-5 w-5" />, "Regulated and public sector", "Preserve key-person knowledge with editable records, source quotes and a handover document for internal review."],
              [<HeartHandshake className="h-5 w-5" />, "Founders and family businesses", "Second-generation handovers and acquisitions: capture the founder's judgement calls, relationships and stories before the deal closes."],
              [<Quote className="h-5 w-5" />, "Family memory", "Interview a grandparent. Recipes, stories and rules of thumb become a searchable archive that answers in their own voice."],
            ].map(([icon, t, b], i) => (
              <div key={i} className="rounded-xl border border-line bg-paper p-6 transition hover:border-line-2 hover:shadow-lift">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-accent-3 text-accent">{icon}</span>
                <h3 className="font-display mt-4 text-[21px] leading-tight">{t}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── demo ── */}
      <section id="demo" className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
        <div className="grid gap-8 md:grid-cols-[1fr_1.6fr] md:items-center">
          <div>
            <Eyebrow>Demo</Eyebrow>
            <H2>Two minutes, end to end.</H2>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-2">Meet Maria, a fictional payroll lead. Watch an interview become searchable knowledge and her successor ask the twin. Choose “Load sample captures” in the app to explore her interviews.</p>
            <Link to="/app" className={buttonClass({ variant: "primary", size: "lg", className: "mt-6" })}>
              <ArrowRight className="h-4 w-4" /> Open the app
            </Link>
          </div>
          <video controls preload="metadata" poster="/img/graph-answer-demo.png" className="w-full rounded-xl border border-line-2 bg-black shadow-lift" src={VIDEO} />
        </div>
      </section>

      {/* ── open source ── */}
      <section id="open" className="border-t border-line bg-paper-2 text-ink">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-16 md:grid-cols-2 md:px-8 md:py-24">
          <div>
            <Eyebrow light>Open source · MIT</Eyebrow>
            <H2>One engine. Runs anywhere.</H2>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
              The same TypeScript engine runs on a Node server with SQLite or entirely in your browser. Bring any model: Nebius, OpenAI, Anthropic, local Ollama, or nothing at all. Voice on Boson Higgs, phone through Twilio and LiveKit, hands through MediaPipe.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={REPO} target="_blank" rel="noreferrer" className={buttonClass({ variant: "accent", size: "lg" })}>
                <Github className="h-4 w-4" /> Star on GitHub
              </a>
              <Link to="/app" className={buttonClass({ size: "lg" })}>
                <ArrowRight className="h-4 w-4" /> Open the app
              </Link>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-line-2 bg-paper p-6 font-mono text-[13px] leading-relaxed text-ink">
{`git clone https://github.com/vnmoorthy/tacit.git && cd tacit
pnpm install
pnpm dev            # http://localhost:5173 — click "Load sample captures"

# Optional: before starting, add these to .env in the repository root
BOSON_API_KEY=...   # Higgs Realtime · Higgs Audio · voice cloning
NEBIUS_API_KEY=...  # Qwen3 on Nebius Token Factory`}
          </pre>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-3 px-5 py-8 text-[13px] text-muted md:flex-row md:px-8">
        <span>Tacit — institutional memory, captured by conversation.</span>
        <span>
          Built at OSS4AI's "Build an AI Startup in One Day" and the Boson Higgs Audio Hackathon 2026 ·{" "}
          <a className="text-ink hover:underline" href={REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </span>
      </footer>
    </div>
  );
}
