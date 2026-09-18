import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalData, createLocalClient, DEFAULT_SETTINGS, saveSettings } from "../local.js";

let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("standalone persistence", () => {
  it("restores a newly created capture immediately without a debounce window", async () => {
    const client = createLocalClient();
    const capture = await client.createCapture({ expert: { name: "Avery", role: "Payroll Specialist" }, context: "Owns ACH funding." });
    const reloaded = createLocalClient();
    expect((await reloaded.getCapture(capture.id)).expert.name).toBe("Avery");
  });

  it("persists loaded samples, edits and successor questions before returning", async () => {
    const client = createLocalClient();
    await client.loadSamples();
    expect(await createLocalClient().listCaptures()).toHaveLength(3);
    const atom = (await client.listAtoms("cap_maria"))[0];
    await client.updateAtom(atom.id, { title: "Reviewed payroll guidance" });
    await client.addQuestion("cap_maria", "Who approves an emergency wire?", "Avery");
    const reloaded = createLocalClient();
    expect((await reloaded.listAtoms("cap_maria")).find((item) => item.id === atom.id)?.title).toBe("Reviewed payroll guidance");
    expect((await reloaded.listQuestions("cap_maria")).some((question) => question.text === "Who approves an emergency wire?")).toBe(true);
  });

  it("reports storage failure instead of claiming the capture was saved", async () => {
    const client = createLocalClient();
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => { throw new Error("quota exceeded"); } });
    await expect(client.createCapture({ expert: { name: "Avery", role: "Payroll Specialist" }, context: "Owns payroll." })).rejects.toThrow("could not save your changes");
  });

  it("surfaces settings and deletion failures without claiming success", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => { throw new Error("quota exceeded"); },
      removeItem: () => { throw new Error("storage blocked"); },
    });
    expect(() => saveSettings(DEFAULT_SETTINGS)).toThrow("could not save your settings");
    expect(() => clearLocalData()).toThrow("could not delete its saved captures");
  });
});
