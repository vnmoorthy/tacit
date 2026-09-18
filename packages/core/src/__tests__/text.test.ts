import { describe, expect, it } from "vitest";
import { BM25, extractJson, rrf, splitSentences, stem, tokenize } from "../index.js";

describe("text utils", () => {
  it("tokenizes, drops stopwords and stems", () => {
    expect(tokenize("The ACH files were rejected on Fridays")).toEqual(["ach", "file", "reject", "friday"]);
    expect(stem("policies")).toBe("policy");
  });

  it("splits sentences on terminal punctuation", () => {
    const s = splitSentences("First I pull the register. Then I run the macro! Does it tie? Usually.");
    expect(s).toHaveLength(4);
  });

  it("BM25 ranks the relevant document first", () => {
    const bm = new BM25([
      { id: "a", text: "Run the reconciliation macro after the register posts" },
      { id: "b", text: "Call the JPMorgan ACH desk when a payment file is rejected" },
      { id: "c", text: "State notices go to Legal the same day" },
    ]);
    const hits = bm.search("what do I do when the ACH file is rejected");
    expect(hits[0].id).toBe("b");
  });

  it("fuses ranked lists with RRF", () => {
    const fused = rrf([[{ id: "x" }, { id: "y" }], [{ id: "y" }, { id: "x" }]]);
    expect(fused.get("x")).toBeCloseTo(fused.get("y")!);
  });

  it("extracts JSON from fenced or chatty replies", () => {
    expect(extractJson('Sure! ```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('<think>hmm</think> Here you go: {"say":"Hi \\"there\\"","n":[1,2]} thanks')).toEqual({ say: 'Hi "there"', n: [1, 2] });
  });
});
