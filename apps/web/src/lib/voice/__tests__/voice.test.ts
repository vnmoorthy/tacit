import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlobPlayer } from "../player.js";
import { BrowserVoice } from "../browserVoice.js";
import { HiggsVoice } from "../higgsVoice.js";
import { MicLevel } from "../mic.js";
import { SpokenAudio } from "../spokenAudio.js";

const defer = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

class FakeAudio {
  static instances: FakeAudio[] = [];
  static failure: Error | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pause = vi.fn();
  removeAttribute = vi.fn();
  constructor(public src: string) { FakeAudio.instances.push(this); }
  play() { return FakeAudio.failure ? Promise.reject(FakeAudio.failure) : Promise.resolve(); }
}
class Recognition {
  static instances: Recognition[] = [];
  onstart: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  abort = vi.fn();
  constructor() { Recognition.instances.push(this); }
  result(text: string, isFinal = true) { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] }); }
}
class Utterance {
  onend: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  constructor(public text: string) {}
}
class Context {
  static instances: Context[] = [];
  state = "running";
  sampleRate = 24000;
  currentTime = 0;
  destination = {};
  close = vi.fn(async () => undefined);
  resume = vi.fn(async () => undefined);
  audioWorklet = { addModule: vi.fn(async () => undefined) };
  constructor() { Context.instances.push(this); }
  createMediaStreamSource() { return { connect: vi.fn() }; }
  createAnalyser() { return { fftSize: 0, frequencyBinCount: 8, getByteTimeDomainData: (buffer: Uint8Array) => buffer.fill(128) }; }
  createGain() { return { gain: { value: 0 }, connect: vi.fn() }; }
}
class Worklet {
  port = { onmessage: null };
  connect(target: any) { return target; }
  disconnect = vi.fn();
}
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor() { Socket.instances.push(this); }
  event(event: unknown) { this.onmessage?.({ data: JSON.stringify(event) }); }
  sent() { return this.send.mock.calls.map(([data]) => JSON.parse(data)); }
}
const events = () => ({ onState: vi.fn(), onLevel: vi.fn(), onError: vi.fn(), onPartial: vi.fn(), onFinal: vi.fn(), onUserTranscript: vi.fn(), onAssistantTranscript: vi.fn(), onAssistantPartial: vi.fn(), onDisconnect: vi.fn() });
let synth: { speak: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; getVoices: ReturnType<typeof vi.fn>; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
let track: { stop: ReturnType<typeof vi.fn>; enabled: boolean };
let stream: MediaStream;
let getUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  FakeAudio.instances = []; FakeAudio.failure = null; Recognition.instances = []; Context.instances = []; Socket.instances = [];
  synth = { speak: vi.fn(), cancel: vi.fn(), resume: vi.fn(), getVoices: vi.fn(() => []), addEventListener: vi.fn(), removeEventListener: vi.fn() };
  track = { stop: vi.fn(), enabled: true };
  stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal("window", { SpeechRecognition: Recognition, speechSynthesis: synth, setTimeout, clearTimeout });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal("AudioWorkletNode", Worklet);
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("audio playback lifecycle", () => {
  it("settles interrupted playback and releases its URL", async () => {
    const player = new BlobPlayer();
    const playing = player.play(new Blob(["audio"]));
    player.stop();
    await expect(playing).resolves.toBeUndefined();
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    player.stop();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it("reports blocked playback instead of claiming it played", async () => {
    FakeAudio.failure = new DOMException("Denied", "NotAllowedError");
    await expect(new BlobPlayer().play(new Blob(["audio"]))).rejects.toThrow("Press Replay");
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it("surfaces decode errors and frees the failed audio", async () => {
    const pending = new BlobPlayer().play(new Blob(["not an mp3"]));
    FakeAudio.instances[0].onerror?.();
    await expect(pending).rejects.toThrow("decode");
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it("rejects empty responses before constructing audio", async () => {
    await expect(new BlobPlayer().play(new Blob())).rejects.toThrow("empty audio");
    expect(FakeAudio.instances).toHaveLength(0);
  });
  it("does not play a download that finishes after stop", async () => {
    const audio = defer<Blob>();
    const voice = new SpokenAudio();
    const pending = voice.speak("Hello", () => audio.promise);
    voice.stop();
    audio.resolve(new Blob(["audio"]));
    await pending;
    expect(FakeAudio.instances).toHaveLength(0);
    expect(synth.speak).not.toHaveBeenCalled();
  });
  it("immediately settles a stopped TTS request without waiting for the network", async () => {
    const neverFinishes = defer<Blob>();
    const voice = new SpokenAudio();
    const pending = voice.speak("Hello", () => neverFinishes.promise);
    voice.stop();
    await expect(pending).resolves.toBeUndefined();
    expect(FakeAudio.instances).toHaveLength(0);
    neverFinishes.reject(new Error("late network failure"));
    await tick();
  });
  it("falls back to speech synthesis without opening the microphone", async () => {
    const fallback = vi.fn();
    const voice = new SpokenAudio(fallback);
    const pending = voice.speak("Hello", async () => { throw new Error("unavailable"); });
    await tick();
    expect(fallback).toHaveBeenCalledOnce();
    expect(getUserMedia).not.toHaveBeenCalled();
    (synth.speak.mock.calls[0][0] as Utterance).onend?.();
    await pending;
    voice.destroy();
  });
});

describe("browser speech lifecycle", () => {
  it("discards recognition callbacks from a muted or replaced instance", () => {
    const ev = events(); const voice = new BrowserVoice(ev);
    voice.listen();
    const stale = Recognition.instances[0].onresult!;
    voice.stopListening(); voice.listen();
    stale({ resultIndex: 0, results: [Object.assign([{ transcript: "stale words" }], { isFinal: true })] });
    vi.advanceTimersByTime(2000);
    expect(ev.onFinal).not.toHaveBeenCalled();
    expect(Recognition.instances).toHaveLength(2);
    voice.destroy();
  });
  it("does not commit while an interim sentence is still being spoken", () => {
    const ev = events(); const voice = new BrowserVoice(ev);
    voice.listen(); Recognition.instances[0].result("The first step");
    vi.advanceTimersByTime(1000);
    Recognition.instances[0].result("is to call", false);
    vi.advanceTimersByTime(2000);
    expect(ev.onFinal).not.toHaveBeenCalled();
    Recognition.instances[0].result("is to call Maria");
    vi.advanceTimersByTime(1600);
    expect(ev.onFinal).toHaveBeenCalledExactlyOnceWith("The first step is to call Maria");
    voice.destroy();
  });
  it("stops restarting after network errors", () => {
    const ev = events(); const voice = new BrowserVoice(ev);
    voice.listen();
    const onend = Recognition.instances[0].onend!;
    Recognition.instances[0].onerror?.({ error: "network" });
    onend(); vi.advanceTimersByTime(2000);
    expect(Recognition.instances).toHaveLength(1);
    expect(ev.onError).toHaveBeenCalledOnce();
    voice.destroy();
  });
  it("settles speech immediately on destroy and removes voice listeners", async () => {
    const voice = new BrowserVoice(events());
    const pending = voice.speak("An unfinished answer");
    voice.destroy();
    await pending;
    expect(synth.cancel).toHaveBeenCalledOnce();
    expect(synth.removeEventListener).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("reports actual synthesis errors", async () => {
    const voice = new BrowserVoice(events());
    const pending = voice.speak("Hello");
    (synth.speak.mock.calls[0][0] as Utterance).onerror?.({ error: "not-allowed" });
    await expect(pending).rejects.toThrow("not-allowed");
    voice.destroy();
  });
  it("does not reopen recognition while thinking", () => {
    const voice = new BrowserVoice(events());
    voice.thinking(); voice.listen();
    expect(Recognition.instances).toHaveLength(0);
    voice.idle(); voice.listen();
    expect(Recognition.instances).toHaveLength(1);
    voice.destroy();
  });
  it("stops late microphone streams after navigation cancels setup", async () => {
    const delayed = defer<MediaStream>(); getUserMedia.mockReturnValueOnce(delayed.promise);
    const mic = new MicLevel();
    const pending = mic.start(vi.fn());
    mic.stop(); delayed.resolve(stream);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(track.stop).toHaveBeenCalledOnce();
    expect(Context.instances).toHaveLength(0);
  });
});

const info = { clientSecret: "test", expiresAt: 1, wsUrl: "wss://example.test", model: "higgs-realtime", voice: "default", instructions: "Interview", transcriptionModel: "higgs-stt-3.1" };
async function ready(voice: HiggsVoice) {
  const connecting = voice.connect(info); await tick();
  const socket = Socket.instances[0]; socket.onopen?.(); socket.event({ type: "session.updated" });
  await connecting;
  return socket;
}
describe("Higgs protocol and lifecycle (mock transport)", () => {
  it("requires configuration acknowledgement before beginning the interview", async () => {
    const voice = new HiggsVoice(events()); const connecting = voice.connect(info); await tick();
    const socket = Socket.instances[0]; socket.onopen?.();
    expect(socket.sent().map((event) => event.type)).toEqual(["session.update"]);
    socket.event({ type: "session.updated" }); await connecting;
    expect(socket.sent().at(-1).type).toBe("response.create");
    voice.disconnect(); expect(track.stop).toHaveBeenCalledOnce();
  });
  it("accepts Boson's live session.created handshake without requiring session.updated", async () => {
    const voice = new HiggsVoice(events());
    const connecting = voice.connect(info); await tick();
    const socket = Socket.instances[0]; socket.onopen?.();
    socket.event({ type: "session.created", session: { type: "realtime", model: "higgs-realtime" } });
    await connecting;
    expect(socket.sent().map((event) => event.type)).toEqual(["session.update", "response.create"]);
    expect(vi.getTimerCount()).toBe(0);
    voice.disconnect();
  });
  it("times out a silent server and releases microphone and context", async () => {
    const voice = new HiggsVoice(events()); const connecting = voice.connect(info); await tick();
    const outcome = expect(connecting).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(15000); await outcome;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(Context.instances[0].close).toHaveBeenCalledOnce();
  });
  it("stops late microphone permission results after realtime setup is cancelled", async () => {
    const delayed = defer<MediaStream>(); getUserMedia.mockReturnValueOnce(delayed.promise);
    const voice = new HiggsVoice(events()); const connecting = voice.connect(info); await tick();
    const outcome = expect(connecting).rejects.toMatchObject({ name: "AbortError" });
    voice.disconnect(); delayed.resolve(stream); await outcome;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(Context.instances[0].close).toHaveBeenCalledOnce();
    expect(Socket.instances).toHaveLength(0);
  });
  it("ignores cancelled response completion after a new response starts", async () => {
    const ev = events(); const voice = new HiggsVoice(ev); const socket = await ready(voice);
    socket.event({ type: "response.created", response: { id: "old" } });
    voice.sendText("Please repeat the question.");
    socket.event({ type: "response.created", response: { id: "new" } });
    socket.event({ type: "response.done", response: { id: "old", status: "cancelled" } });
    expect(ev.onState).toHaveBeenLastCalledWith("thinking");
    voice.disconnect();
  });
  it("does not discard one-word answers or repeats from distinct turns", async () => {
    const ev = events(); const voice = new HiggsVoice(ev); const socket = await ready(voice);
    const event = { type: "conversation.item.input_audio_transcription.completed", item_id: "one", transcript: "Yes" };
    socket.event(event); socket.event(event); socket.event({ ...event, item_id: "two" });
    voice.flushTranscripts();
    expect(ev.onUserTranscript.mock.calls).toEqual([["Yes"], ["Yes"]]);
    voice.disconnect();
  });
  it("commits revised cumulative Boson transcripts once as a complete answer", async () => {
    const ev = events(); const voice = new HiggsVoice(ev); const socket = await ready(voice);
    const revisions = ["The ACH cutoff is 3:30.", "The ACH cutoff is 3:30, not five.", "The ACH cutoff is 3:30, not 5. Call Treasury first."];
    for (const transcript of revisions) {
      socket.event({ type: "response.created", response: { id: "reused-response" } });
      socket.event({ type: "conversation.item.input_audio_transcription.completed", item_id: "same-utterance", transcript });
      socket.event({ type: "input_audio_buffer.speech_started", item_id: "same-utterance" });
    }
    expect(ev.onUserTranscript).not.toHaveBeenCalled();
    expect(socket.sent().filter((event) => event.type === "response.cancel")).toHaveLength(0);
    socket.event({ type: "response.created", response: { id: "reused-response" } });
    socket.event({ type: "response.output_audio_transcript.done", response_id: "reused-response", item_id: "question", transcript: "Who should I contact?" });
    expect(ev.onUserTranscript).toHaveBeenCalledExactlyOnceWith(revisions.at(-1));
    expect(ev.onAssistantTranscript).toHaveBeenCalledExactlyOnceWith("Who should I contact?");
    voice.disconnect();
    expect(ev.onUserTranscript).toHaveBeenCalledOnce();
  });
  it("flushes a transcribed answer on disconnect even if the assistant never responds", async () => {
    const ev = events(); const voice = new HiggsVoice(ev); const socket = await ready(voice);
    socket.event({ type: "conversation.item.input_audio_transcription.completed", item_id: "answer", transcript: "Call Treasury first." });
    voice.disconnect();
    expect(ev.onUserTranscript).toHaveBeenCalledExactlyOnceWith("Call Treasury first.");
  });
  it("sends typed answers into the same realtime conversation", async () => {
    const voice = new HiggsVoice(events()); const socket = await ready(voice);
    voice.sendText("Call the on-call lead first.");
    expect(socket.sent()).toContainEqual({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: "Call the on-call lead first." }] } });
    expect(socket.sent().at(-1).type).toBe("response.create");
    voice.disconnect();
    expect(() => voice.sendText("Hello")).toThrow("disconnected");
  });
  it("mutes hardware input and reports an idle microphone", async () => {
    const ev = events(); const voice = new HiggsVoice(ev); const socket = await ready(voice);
    voice.setMuted(true);
    expect(track.enabled).toBe(false);
    expect(ev.onLevel).toHaveBeenLastCalledWith(0);
    expect(ev.onState).toHaveBeenLastCalledWith("idle");
    expect(socket.sent().at(-1).type).toBe("input_audio_buffer.clear");
    voice.setMuted(false); expect(track.enabled).toBe(true);
    voice.disconnect();
  });
  it("notifies recovery and releases resources after unexpected disconnect", async () => {
    const ev = events(); const voice = new HiggsVoice(ev); const socket = await ready(voice);
    socket.onclose?.();
    expect(ev.onDisconnect).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(ev.onState).toHaveBeenLastCalledWith("off");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("leaves thinking state if a response completes without audio", async () => {
    const ev = events(); const voice = new HiggsVoice(ev); const socket = await ready(voice);
    socket.event({ type: "response.created", response: { id: "answer" } });
    socket.event({ type: "response.done", response: { id: "answer", status: "completed" } });
    expect(ev.onState).toHaveBeenLastCalledWith("listening");
    voice.disconnect();
  });
});
