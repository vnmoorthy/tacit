/** Lightweight text utilities: tokenising, sentence splitting, BM25. */

const STOP = new Set(
  `a an the and or but if then else when while of to in on at by for with from as is are was were be been being am do does did doing have has had having it its this that these those there here i you he she we they me him her us them my your his our their mine yours ours theirs what which who whom whose where why how not no nor so than too very can will just should would could may might must shall also into onto over under again further once about above below between through during before after out off up down each few more most other some such only own same s t don t ll re ve d m o y okay ok yeah yes um uh like really actually basically kind sort thing things get got go going went gonna wanna lot lots way well`.split(/\s+/),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

/** Tiny suffix stemmer — good enough for retrieval over short atoms. */
export function stem(t: string): string {
  if (t.length <= 4) return t;
  if (t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.endsWith("ing") && t.length > 6) return t.slice(0, -3);
  if (t.endsWith("ed") && t.length > 5) return t.slice(0, -2);
  if (t.endsWith("es") && t.length > 5) return t.slice(0, -2);
  if (t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function truncate(text: string, n: number): string {
  const t = text.trim();
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
}

export function titleCase(s: string): string {
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/* ─────────────────────────────── BM25 ─────────────────────────────── */

export interface BM25Doc {
  id: string;
  text: string;
}

export interface BM25Hit {
  id: string;
  score: number;
}

export class BM25 {
  private docs: { id: string; tf: Map<string, number>; len: number }[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;
  private k1: number;
  private b: number;

  constructor(docs: BM25Doc[], k1 = 1.4, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    let total = 0;
    for (const d of docs) {
      const toks = tokenize(d.text);
      const tf = new Map<string, number>();
      for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.docs.push({ id: d.id, tf, len: toks.length });
      total += toks.length;
    }
    this.avgLen = this.docs.length ? total / this.docs.length : 0;
  }

  search(query: string, limit = 10): BM25Hit[] {
    const q = tokenize(query);
    if (!q.length || !this.docs.length) return [];
    const N = this.docs.length;
    const hits: BM25Hit[] = [];
    for (const d of this.docs) {
      let score = 0;
      for (const t of q) {
        const f = d.tf.get(t);
        if (!f) continue;
        const n = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        const denom = f + this.k1 * (1 - this.b + (this.b * d.len) / (this.avgLen || 1));
        score += idf * ((f * (this.k1 + 1)) / denom);
      }
      if (score > 0) hits.push({ id: d.id, score });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Reciprocal rank fusion of several ranked lists. */
export function rrf(lists: { id: string }[][], k = 60): Map<string, number> {
  const out = new Map<string, number>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      out.set(item.id, (out.get(item.id) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return out;
}
