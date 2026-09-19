import type { Atom, Capture, Domain, Question, Turn } from "./types.js";
import { ATOM_TYPES } from "./types.js";

export const INTERVIEWER_PERSONA = `You are Tacit, an AI knowledge-capture interviewer (say "I'm Tacit" if asked — never claim to be the successor, a colleague, or a human). You interview experienced professionals who are leaving an organisation so their tacit knowledge — the procedures, rules of thumb, gotchas, contacts, and judgement calls that live only in their head — is preserved for their successor.

How you sound (this will be spoken aloud, so write the way a thoughtful person talks):
- Warm, curious, unhurried. You genuinely find their work interesting, and it shows.
- React to what they actually said before asking anything: pick out the specific detail that mattered ("Three-thirty, not five — that's exactly the kind of thing that never makes it into a manual.") One short reaction, then one question.
- Vary your acknowledgements. Never open two turns the same way. No "Great question", no "Thank you for sharing".
- Use their first name occasionally, not every turn.
- Follow the thread when they say "usually", "sometimes", "depends", "the trick is", "except when": that's where the real knowledge is.
- Prefer concrete over abstract: the last time it happened, the exact steps, the names of systems and people, the numbers, what went wrong.
- If they hesitate or the answer is thin, make it easy: offer a starting point ("Take last quarter, for example…") rather than repeating the question.
- If they go off on a tangent, let them finish, then bring it back with what you learned from the tangent.
- Contractions, plain words, short sentences. A little dry humour is fine; sarcasm is not.
- Never praise an answer that had nothing in it. Banned openers: "That's really useful", "Great", "That's helpful", "Thank you for sharing", "Good point". If the expert gives a thin, vague or "I don't know" answer, say so lightly and honestly ("Fair enough, that one's hard to pin down."), then make it easier: a smaller question, a concrete example, or move to a different topic. Praise only specific things, by naming them.
- If the transcript looks like noise or a fragment (a word or two, nothing to react to), don't pretend it was an answer: ask them to say it again, or simply repeat the question more simply.
- One question per turn. Keep each reply under 55 words.`

export const LANGUAGES: { code: string; name: string }[] = [
  { code: "en-US", name: "English (US)" },
  { code: "en-IN", name: "English (India)" },
  { code: "en-GB", name: "English (UK)" },
  { code: "es-ES", name: "Spanish" },
  { code: "es-MX", name: "Spanish (Mexico)" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "fr-FR", name: "French" },
  { code: "de-DE", name: "German" },
  { code: "it-IT", name: "Italian" },
  { code: "hi-IN", name: "Hindi" },
  { code: "ta-IN", name: "Tamil" },
  { code: "te-IN", name: "Telugu" },
  { code: "zh-CN", name: "Mandarin Chinese" },
  { code: "ja-JP", name: "Japanese" },
  { code: "ko-KR", name: "Korean" },
  { code: "ar-SA", name: "Arabic" },
  { code: "vi-VN", name: "Vietnamese" },
  { code: "tl-PH", name: "Filipino" },
  { code: "pl-PL", name: "Polish" },
  { code: "tr-TR", name: "Turkish" },
];

export function languageName(code?: string): string {
  if (!code) return "English";
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

export function isEnglish(code?: string): boolean {
  return !code || code.toLowerCase().startsWith("en");
}

export function captureBrief(c: Capture): string {
  const e = c.expert;
  const lines = [
    `Expert: ${e.name}, ${e.role}${e.team ? ` (${e.team})` : ""}${e.tenureYears ? `, ${e.tenureYears} years in role` : ""}.`,
    e.departureDate ? `Leaves on ${e.departureDate}.` : "",
    !isEnglish(e.language) ? `Interview language: ${languageName(e.language)}. Speak ${languageName(e.language)} to the expert; they may mix languages.` : "",
    c.successor ? `Successor: ${c.successor.name}${c.successor.role ? ` (${c.successor.role})` : ""}.` : "",
    `Context: ${c.context}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function coverageBrief(domains: Domain[]): string {
  return domains
    .map(
      (d) =>
        `- [${d.id}] ${d.name} (priority ${d.priority}, coverage ${Math.round(d.coverage * 100)}%, ${d.atomCount} atoms). Unasked: ${d.targetQuestions.slice(d.askedCount).map((q) => `"${q}"`).join(" | ") || "none"}`,
    )
    .join("\n");
}

export function planPrompt(input: { expert: Capture["expert"]; context: string }) {
  return [
    {
      role: "system" as const,
      content: `You design knowledge-capture interview plans. Given an expert's role and context, produce 6–8 knowledge domains that, if captured, would let a successor do the job. Favour the operational, the fragile, and the undocumented. Reply with JSON only:
{"domains":[{"name":"...","description":"one sentence","priority":1|2|3,"questions":["open question 1","open question 2","open question 3"]}]}
Priorities: 1 critical, 2 important, 3 nice-to-have. Questions must be open, concrete, and spoken-language friendly, written in English.`,
    },
    {
      role: "user" as const,
      content: `Expert: ${input.expert.name}, ${input.expert.role}${input.expert.team ? ` (${input.expert.team})` : ""}.\nContext:\n${input.context}`,
    },
  ];
}

export function memoryBrief(atoms: Atom[], limit = 8): string {
  if (!atoms.length) return "";
  const recent = [...atoms].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  return `Things the expert has already told you (you may refer back to them naturally, e.g. "last time you mentioned…"):\n${recent.map((a) => `- (${a.type}) ${a.title}`).join("\n")}`;
}

export function nextQuestionPrompt(args: {
  capture: Capture;
  recentTurns: Turn[];
  lastAtoms: Atom[];
  successorQuestions: Question[];
  suggestedDomain: Domain | null;
  suggestedQuestion?: string | null;
  isOpening?: boolean;
  memory?: Atom[];
}) {
  const { capture, recentTurns, lastAtoms, successorQuestions, suggestedDomain, suggestedQuestion, isOpening, memory } = args;
  const transcript = recentTurns.map((t) => `${t.role === "expert" ? capture.expert.name.split(" ")[0] : "Tacit"}: ${t.text}`).join("\n");
  return [
    { role: "system" as const, content: INTERVIEWER_PERSONA },
    {
      role: "user" as const,
      content: `${captureBrief(capture)}

Coverage map:
${coverageBrief(capture.domains)}

${successorQuestions.length ? `Questions the successor has already asked the knowledge base and could not get answered (ask these first, in the expert's language):\n${successorQuestions.map((q) => `- [${q.id}] ${q.text}`).join("\n")}\n` : ""}
${lastAtoms.length ? `Knowledge just captured from the last answer:\n${lastAtoms.map((a) => `- (${a.type}) ${a.title}`).join("\n")}\n` : ""}
${memory?.length ? `${memoryBrief(memory)}\n` : ""}
Recent transcript:
${transcript || "(session just started)"}

${suggestedDomain ? `The planner suggests domain [${suggestedDomain.id}] "${suggestedDomain.name}"${suggestedQuestion ? ` with the question: "${suggestedQuestion}"` : ""} if the current thread is exhausted.` : ""}
${isOpening ? `This is the very first turn of the session: greet ${capture.expert.name.split(" ")[0]} warmly in one short sentence as Tacit (you are the AI interviewer, not ${capture.successor?.name ?? "the successor"})${memory?.length ? `, mention in a few words that you remember what they covered last time` : `, say in a few words that you're capturing what they know${capture.successor ? ` for ${capture.successor.name}` : ""}`}, then ask the first question${suggestedQuestion ? ` — use the planner's suggested question, in your own words` : ""}.` : ""}
Decide the single best next thing to say.${!isEnglish(capture.expert.language) ? ` Write "say" in ${languageName(capture.expert.language)}.` : ""} Reply with JSON only:
{"say":"<a short reaction to what they said, then one question; under 55 words; spoken language>","kind":"followup"|"new"|"successor","domainId":"<domain id>","questionId":"<successor question id if kind=successor, else null>"}`,
    },
  ];
}

export function extractPrompt(args: { capture: Capture; question: string; answer: string }) {
  const { capture, question, answer } = args;
  return [
    {
      role: "system" as const,
      content: `You distil an expert's spoken answer into reusable knowledge atoms for their successor.
OUTPUT LANGUAGE: always write "title", "content" and "tags" in ENGLISH, even when the answer is in another language (translate faithfully). Only "sourceQuote" stays verbatim in the original language.
Atom types: ${ATOM_TYPES.join(", ")}.
- procedure: ordered steps. Write content as a numbered markdown list.
- rule: an always/never/if-then that governs decisions.
- gotcha: a trap, quirk or non-obvious failure and how to avoid it.
- contact: a person/team/vendor and what they're good for.
- tool: a system, report, script or spreadsheet and what it's used for.
- decision: a judgement call and the factors weighed.
- glossary: a term or acronym and its meaning.
- risk: something that can go badly wrong, its trigger and impact.
- story: an illustrative anecdote worth keeping.
Rules: Only extract what the expert actually said. Be thorough: every distinct reusable fact — each person, threshold, number, tool, timing rule, workaround or warning — becomes its own atom (typically 2–6 per answer; never merge a contact into a procedure). Title under 10 words. Content is crisp markdown in the third person ("Run the X report…"). Include the expert's own words as sourceQuote (a short verbatim excerpt). Assign domainId from the coverage map, or null. confidence 0.3–0.95. If the answer contains nothing reusable, return {"atoms":[]}.
The expert may answer in any language: write title, content and tags in English so the knowledge base is uniform, and keep sourceQuote verbatim in the original language.
Reply with JSON only: {"atoms":[{"type":"...","title":"...","content":"...","tags":["..."],"confidence":0.8,"domainId":"...","sourceQuote":"..."}]}`,
    },
    {
      role: "user" as const,
      content: `${captureBrief(capture)}

Domains:
${capture.domains.map((d) => `- [${d.id}] ${d.name}: ${d.description}`).join("\n")}

Interviewer asked: ${question}
${capture.expert.name} answered: ${answer}

Remember: title/content/tags in English; sourceQuote verbatim.`,
    },
  ];
}

export function answerPrompt(args: { capture: Capture; question: string; atoms: Atom[]; askedBy?: string }) {
  const { capture, question, atoms, askedBy } = args;
  return [
    {
      role: "system" as const,
      content: `You are the knowledge twin of ${capture.expert.name} (${capture.expert.role}). You answer a successor's questions strictly from the captured knowledge atoms below. Cite atoms inline as [n]. Be practical and direct, in the second person ("Do X, then Y"). If the atoms don't contain the answer, say so plainly and do not invent anything.
Reply with JSON only: {"answer":"markdown answer with [n] citations","confidence":"high"|"medium"|"low"|"none","used":[1,2]}`,
    },
    {
      role: "user" as const,
      content: `${askedBy ? `${askedBy} asks` : "Question"}: ${question}

Knowledge atoms:
${atoms.map((a, i) => `[${i + 1}] (${a.type}) ${a.title}\n${a.content}${a.sourceQuote ? `\n> "${a.sourceQuote}"` : ""}`).join("\n\n")}`,
    },
  ];
}

export function summaryPrompt(args: { capture: Capture; turns: Turn[]; atoms: Atom[] }) {
  const { capture, turns, atoms } = args;
  return [
    {
      role: "system" as const,
      content: "Summarise an interview session in 3–5 sentences for a project log: what was covered, the most valuable things captured, and what remains open. Plain prose, no headings.",
    },
    {
      role: "user" as const,
      content: `Expert: ${capture.expert.name}, ${capture.expert.role}.
Transcript:
${turns.map((t) => `${t.role}: ${t.text}`).join("\n")}

Atoms captured (${atoms.length}):
${atoms.map((a) => `- (${a.type}) ${a.title}`).join("\n")}`,
    },
  ];
}
