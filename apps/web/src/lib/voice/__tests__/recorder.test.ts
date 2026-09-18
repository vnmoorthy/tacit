import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceRecorder } from "../recorder.js";

class Recorder {
  static instance: Recorder;
  static isTypeSupported = () => true;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  state = "recording";
  start = vi.fn();
  stop = vi.fn();
  constructor() { Recorder.instance = this; }
}
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("MediaRecorder", Recorder); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("optional reference recorder", () => {
  it("settles if the browser never emits the stop event", async () => {
    const recorder = new ReferenceRecorder();
    recorder.start({} as MediaStream);
    const pending = recorder.stop();
    expect(recorder.stop()).toBe(pending);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await pending).toBeNull();
    expect(Recorder.instance.ondataavailable).toBeNull();
  });
  it("keeps the final chunk emitted before stop and clears event handlers", async () => {
    const recorder = new ReferenceRecorder();
    recorder.start({} as MediaStream);
    const pending = recorder.stop();
    Recorder.instance.ondataavailable?.({ data: new Blob([new Uint8Array(25000)]) });
    Recorder.instance.onstop?.();
    expect((await pending)?.size).toBe(25000);
    expect(Recorder.instance.onstop).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
