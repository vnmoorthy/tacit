import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { HandTracker } from "../handTracker.js";

vi.mock("@mediapipe/tasks-vision", () => ({ FilesetResolver: { isSimdSupported: vi.fn() }, HandLandmarker: { createFromOptions: vi.fn() } }));
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  return { promise: new Promise<T>((a, b) => { resolve = a; reject = b; }), resolve, reject };
};
const media = () => {
  const track = { stop: vi.fn(), onended: null as null | (() => void) };
  return { track, stream: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream };
};
const model = () => ({ close: vi.fn(), detectForVideo: vi.fn(() => ({ landmarks: [], handedness: [] })) });

describe("camera lifecycle", () => {
  let video: HTMLVideoElement;
  let getUserMedia: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.resetAllMocks();
    video = { srcObject: null, pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined), readyState: 4, currentTime: 1, videoWidth: 640, videoHeight: 480 } as unknown as HTMLVideoElement;
    getUserMedia = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.mocked(FilesetResolver.isSimdSupported).mockResolvedValue(true);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("closes a camera that arrives after the user cancels permission/startup", async () => {
    const pending = deferred<MediaStream>();
    getUserMedia.mockReturnValue(pending.promise);
    const tracker = new HandTracker(video, vi.fn());
    const start = tracker.start();
    tracker.stop();
    const camera = media();
    pending.resolve(camera.stream);
    expect(await start).toBe(false);
    expect(camera.track.stop).toHaveBeenCalledOnce();
    expect(HandLandmarker.createFromOptions).not.toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
  });
  it("closes a late model and never resumes after stop", async () => {
    const camera = media(), pending = deferred<any>(), engine = model();
    getUserMedia.mockResolvedValue(camera.stream);
    vi.mocked(HandLandmarker.createFromOptions).mockReturnValue(pending.promise);
    const tracker = new HandTracker(video, vi.fn());
    const start = tracker.start();
    await vi.waitFor(() => expect(HandLandmarker.createFromOptions).toHaveBeenCalledOnce());
    tracker.stop();
    pending.resolve(engine);
    expect(await start).toBe(false);
    expect(engine.close).toHaveBeenCalledOnce();
    expect(camera.track.stop).toHaveBeenCalledOnce();
    expect(tracker.running).toBe(false);
  });
  it("releases camera and model when inference fails, and reports a retryable error", async () => {
    const camera = media(), engine = model(), onError = vi.fn();
    engine.detectForVideo.mockImplementation(() => { throw new Error("GPU context lost"); });
    getUserMedia.mockResolvedValue(camera.stream);
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(engine as any);
    const tracker = new HandTracker(video, vi.fn(), onError);
    expect(await tracker.start()).toBe(false);
    expect(engine.close).toHaveBeenCalledOnce();
    expect(camera.track.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("GPU context lost"));
  });
  it("falls back to CPU, stops on device loss, then can restart", async () => {
    const camera = media(), engine = model(), onError = vi.fn();
    getUserMedia.mockResolvedValue(camera.stream);
    vi.mocked(HandLandmarker.createFromOptions).mockRejectedValueOnce(new Error("GPU unavailable")).mockResolvedValue(engine as any);
    const tracker = new HandTracker(video, vi.fn(), onError);
    expect(await tracker.start()).toBe(true);
    expect(vi.mocked(HandLandmarker.createFromOptions).mock.calls[1][1].baseOptions?.delegate).toBe("CPU");
    camera.track.onended?.();
    expect(tracker.running).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("disconnected"));
    expect(await tracker.start()).toBe(true);
    tracker.stop();
    expect(video.srcObject).toBeNull();
  });
  it("reports camera denial without fetching a model and can retry", async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    const tracker = new HandTracker(video, vi.fn());
    await expect(tracker.start()).rejects.toThrow("Allow camera access");
    expect(HandLandmarker.createFromOptions).not.toHaveBeenCalled();
    getUserMedia.mockResolvedValue(media().stream);
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(model() as any);
    expect(await tracker.start()).toBe(true);
    tracker.stop();
  });
  it("releases gesture state when the camera stops delivering frames", async () => {
    const engine = model(), onFrame = vi.fn();
    getUserMedia.mockResolvedValue(media().stream);
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(engine as any);
    const now = vi.spyOn(performance, "now").mockReturnValue(100);
    const tracker = new HandTracker(video, onFrame);
    await tracker.start();
    now.mockReturnValue(900);
    vi.mocked(requestAnimationFrame).mock.calls[0][0](900);
    expect(onFrame).toHaveBeenLastCalledWith({ hands: [], t: 900, fps: 0 });
    expect(engine.detectForVideo).toHaveBeenCalledOnce();
    tracker.stop();
  });
  it("processes each camera frame once even on a faster display", async () => {
    const engine = model();
    getUserMedia.mockResolvedValue(media().stream);
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(engine as any);
    const tracker = new HandTracker(video, vi.fn());
    await tracker.start();
    const callback = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    callback(1000);
    callback(2000);
    expect(engine.detectForVideo).toHaveBeenCalledOnce();
    tracker.stop();
  });
});
