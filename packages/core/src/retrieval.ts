import type { Embedder } from "./llm.js";
import type { Store } from "./store.js";
import type { Atom, ID } from "./types.js";
import { BM25, cosine, rrf } from "./text.js";

export interface RetrievedAtom {
  atom: Atom;
  bm25: number;
  cos: number;
  /** 0..1 blended relevance used for confidence. */
  strength: number;
}

export function atomText(a: Atom): string {
  return `${a.title}\n${a.content}\n${a.tags.join(" ")}\n${a.sourceQuote ?? ""}`;
}

/** Hybrid retrieval: BM25 always; dense cosine when an embedder + stored vectors exist; fused with RRF. */
export async function retrieve(
  store: Store,
  embedder: Embedder | null | undefined,
  captureId: ID,
  query: string,
  limit = 6,
): Promise<RetrievedAtom[]> {
  const atoms = await store.listAtoms(captureId);
  if (!atoms.length) return [];
  const byId = new Map(atoms.map((a) => [a.id, a]));
  const bm = new BM25(atoms.map((a) => ({ id: a.id, text: atomText(a) })));
  const lexical = bm.search(query, Math.max(limit * 3, 12));
  const bmScore = new Map(lexical.map((h) => [h.id, h.score]));

  let dense: { id: string; score: number }[] = [];
  if (embedder) {
    try {
      const [qv] = await embedder.embed([query]);
      const scored: { id: string; score: number }[] = [];
      for (const a of atoms) {
        const v = await store.getEmbedding(a.id);
        if (v) scored.push({ id: a.id, score: cosine(qv, v) });
      }
      scored.sort((a, b) => b.score - a.score);
      dense = scored.slice(0, Math.max(limit * 3, 12));
    } catch {
      dense = [];
    }
  }
  const cosScore = new Map(dense.map((h) => [h.id, h.score]));
  const fused = dense.length ? rrf([lexical, dense]) : rrf([lexical]);
  const ranked = [...fused.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

  return ranked.map(([id]) => {
    const b = bmScore.get(id) ?? 0;
    const c = cosScore.get(id) ?? 0;
    const strength = Math.max(Math.min(1, b / 3.2), Math.min(1, Math.max(0, (c - 0.35) / 0.4)));
    return { atom: byId.get(id)!, bm25: b, cos: c, strength };
  });
}

/** Embed any atoms that don't have vectors yet. Best effort. */
export async function ensureEmbeddings(store: Store, embedder: Embedder | null | undefined, atoms: Atom[]): Promise<number> {
  if (!embedder || !atoms.length) return 0;
  const missing: Atom[] = [];
  for (const a of atoms) if (!(await store.getEmbedding(a.id))) missing.push(a);
  if (!missing.length) return 0;
  try {
    const vecs = await embedder.embed(missing.map(atomText));
    for (let i = 0; i < missing.length; i++) await store.putEmbedding(missing[i].id, vecs[i]);
    return missing.length;
  } catch {
    return 0;
  }
}
