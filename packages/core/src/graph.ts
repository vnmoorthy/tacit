/**
 * Knowledge graph: atoms, domains and the people/tools they mention, plus
 * similarity links between atoms. Pure and isomorphic — used by the API and
 * the browser's standalone mode.
 */
import { KNOWN_TOOLS } from "./templates.js";
import { BM25 } from "./text.js";
import type { Atom, AtomType, Capture } from "./types.js";

export type GraphNodeKind = "domain" | "atom" | "entity";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  /** Atom type for atom nodes; "person" | "tool" | "team" | "topic" for entities. */
  group: AtomType | "domain" | "person" | "tool" | "team" | "topic";
  /** Relative size hint. */
  val: number;
  domainId?: string;
  verified?: boolean;
  confidence?: number;
  /** Short preview for atoms. */
  snippet?: string;
}

export type GraphLinkKind = "in" | "mentions" | "related";

export interface GraphLink {
  source: string;
  target: string;
  kind: GraphLinkKind;
  /** 0..1 */
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  stats: { atoms: number; domains: number; entities: number; links: number };
}

const NON_ENTITY = new Set(["month-end", "year-end", "single point of failure", "lesson", "audit", "sign-off", "cut-off", "on-call", "state notices", "registered address"]);

const MONTHS = new Set(["january","february","march","april","may","june","july","august","september","october","november","december","monday","tuesday","wednesday","thursday","friday","saturday","sunday"]);
const PLACES = new Set(["california","new york","texas","florida","illinois","washington","oregon","nevada","arizona","colorado","georgia","ohio","pennsylvania","massachusetts","new jersey","virginia","north carolina","michigan","us","usa","uk","eu","europe","asia"]);
const TEAMS = new Set(["hr","it","legal","treasury","accounting","finance","security","ops","operations","qa","cfo","ceo","cto","coo","payroll","facilities","sales","marketing","support","platform","sre","devops","engineering","dol","irs","sec","state agency","bank","vendor","carrier"]);

function classifyEntity(tag: string): "person" | "tool" | "team" | "topic" {
  const t = tag.trim();
  const low = t.toLowerCase();
  if (MONTHS.has(low)) return "topic";
  if (PLACES.has(low)) return "topic";
  if (TEAMS.has(low)) return "team";
  if (KNOWN_TOOLS.some((k) => k.toLowerCase() === t.toLowerCase())) return "tool";
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(t)) return "person"; // "Dan Okafor", "Kevin Tran"
  if (/^[A-Z][a-z]+$/.test(t) && t.length <= 12) return "person"; // "Priya", "Rosa"
  if (/^[A-Z0-9_]{2,}[A-Za-z0-9_.-]*$/.test(t) || /^[A-Z][a-z]+[A-Z]/.test(t)) return "tool"; // RECON_v7, PgBouncer, W-2
  return "topic";
}

export function buildGraph(capture: Capture, atoms: Atom[], opts: { relatedPerAtom?: number; minEntityMentions?: number } = {}): GraphData {
  const relatedPerAtom = opts.relatedPerAtom ?? 2;
  const minMentions = opts.minEntityMentions ?? 1;
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  for (const d of capture.domains) {
    nodes.push({ id: d.id, kind: "domain", label: d.name, group: "domain", val: 4 + Math.min(8, d.atomCount) * 0.7, domainId: d.id });
  }

  for (const a of atoms) {
    nodes.push({
      id: a.id,
      kind: "atom",
      label: a.title,
      group: a.type,
      val: 2 + a.confidence * 2 + (a.verified ? 1 : 0),
      domainId: a.domainId,
      verified: a.verified,
      confidence: a.confidence,
      snippet: a.content.replace(/\s+/g, " ").slice(0, 160),
    });
    if (a.domainId && capture.domains.some((d) => d.id === a.domainId)) {
      links.push({ source: a.id, target: a.domainId, kind: "in", weight: 1 });
    }
  }

  // Entities from tags (people, tools, systems), merged case-insensitively.
  const mentions = new Map<string, { label: string; kind: "person" | "tool" | "team" | "topic"; atoms: Set<string> }>();
  for (const a of atoms) {
    for (const raw of a.tags) {
      const tag = raw.trim();
      if (!tag || tag.length < 2 || NON_ENTITY.has(tag.toLowerCase()) || /^[\d$%.:apm\s-]+$/i.test(tag)) continue;
      const kind = classifyEntity(tag);
      if (MONTHS.has(tag.toLowerCase())) continue;
      if (kind === "topic" && !/^[A-Z]/.test(tag)) continue; // lowercase generic tags stay out of the graph
      const key = tag.toLowerCase();
      const e = mentions.get(key) ?? { label: tag, kind, atoms: new Set<string>() };
      e.atoms.add(a.id);
      mentions.set(key, e);
    }
  }
  let entities = 0;
  for (const [key, e] of mentions) {
    if (e.atoms.size < minMentions) continue;
    const id = `ent_${key.replace(/[^a-z0-9]+/g, "_")}`;
    nodes.push({ id, kind: "entity", label: e.label, group: e.kind, val: 1.5 + e.atoms.size * 0.8 });
    entities++;
    for (const atomId of e.atoms) links.push({ source: atomId, target: id, kind: "mentions", weight: 0.6 });
  }

  // Similarity links between atoms (lexical; symmetric, de-duplicated).
  if (atoms.length > 2 && relatedPerAtom > 0) {
    const bm = new BM25(atoms.map((a) => ({ id: a.id, text: `${a.title}\n${a.content}\n${a.tags.join(" ")}` })));
    const seen = new Set<string>();
    for (const a of atoms) {
      const hits = bm.search(`${a.title} ${a.tags.join(" ")}`, relatedPerAtom + 1).filter((h) => h.id !== a.id).slice(0, relatedPerAtom);
      const top = hits[0]?.score ?? 0;
      for (const h of hits) {
        const key = [a.id, h.id].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({ source: a.id, target: h.id, kind: "related", weight: top ? Math.max(0.15, Math.min(1, h.score / top)) * 0.5 : 0.2 });
      }
    }
  }

  return { nodes, links, stats: { atoms: atoms.length, domains: capture.domains.length, entities, links: links.length } };
}
