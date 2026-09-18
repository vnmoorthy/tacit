import { afterEach, describe, expect, it, vi } from "vitest";
import { createHiggsSession, higgsCloneVoice, higgsSpeech } from "../higgs.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Higgs provider boundary", () => {
  it("rejects a malformed client secret before a browser can connect", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ expires_at: 100 })));
    await expect(createHiggsSession({ apiKey: "fixture", instructions: "Interview", voice: "default" })).rejects.toThrow("invalid voice session");
  });
  it("sends a bounded stock-voice speech request and preserves its media type", async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetch);
    const result = await higgsSpeech({ apiKey: "fixture", text: "Welcome" });
    expect(result.bytes.byteLength).toBe(3);
    expect(result.contentType).toBe("audio/mpeg");
    const options = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(options[1].signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options[1].body as string)).toMatchObject({ model: "higgs-tts-3", voice: "default", input: "Welcome" });
  });
  it("rejects HTML or empty success responses as invalid audio", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("<html>error</html>", { headers: { "content-type": "text/html" } })).mockResolvedValueOnce(new Response(new Uint8Array(), { headers: { "content-type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetch);
    await expect(higgsSpeech({ apiKey: "fixture", text: "Welcome" })).rejects.toThrow("invalid audio");
    await expect(higgsSpeech({ apiKey: "fixture", text: "Welcome" })).rejects.toThrow("invalid audio");
  });
  it("never persists a missing cloned voice identifier", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));
    await expect(higgsCloneVoice({ apiKey: "fixture", audio: new Blob(["synthetic fixture"]), filename: "fixture.wav", transcript: "Synthetic fixture" })).rejects.toThrow("voice ID");
  });
});
