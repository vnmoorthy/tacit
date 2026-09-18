/**
 * Constellation: a 3D knowledge graph of everything the expert said, steered with your hands.
 * Point to explore, pinch to grab and drag, open palm to orbit, two hands to zoom. Ask by voice
 * and the cited atoms light up while the camera flies to them.
 */
import { ArrowLeft, Camera, CameraOff, Circle, Hand, Mic, MicOff, PictureInPicture2, RotateCcw, ScanFace, Sparkles, Square, Volume2 } from "lucide-react";
import { ATOM_TYPES, BM25 } from "@tacit/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AskResult, Capture, GraphData, GraphLink, GraphNode } from "@tacit/core";
import { ATOM_META } from "../components/AtomCard.js";
import { Markdown } from "../components/Markdown.js";
import { Badge, Button, cx } from "../components/ui.js";
import { useApi, useApp } from "../lib/store.js";
import { HandTracker, drawHands, type HandFrame } from "../lib/vision/handTracker.js";
import { BrowserVoice } from "../lib/voice/browserVoice.js";
import { BlobPlayer } from "../lib/voice/player.js";

type FGNode = GraphNode & { x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number };
type FGLink = GraphLink & { source: FGNode | string; target: FGNode | string };
type Mode = "off" | "none" | "point" | "pinch" | "grab" | "orbit" | "zoom" | "hold";

const COLORS: Record<string, string> = {
  domain: "#e8b36b",
  procedure: "#6aa0e6",
  rule: "#f6f1e9",
  gotcha: "#f0a54a",
  contact: "#7ec38f",
  tool: "#b18ae0",
  decision: "#4fc0c0",
  glossary: "#a8a29a",
  risk: "#e0584a",
  story: "#e08ab0",
  person: "#8fd4a0",
  team: "#5cc7c7",
  topic: "#9c968c",
};

const MODE_TEXT: Record<Mode, string> = {
  off: "Camera off",
  none: "Show me a hand",
  point: "Pointing · hover to reveal",
  pinch: "Pinch · dragging the view (pinch on a node to grab it)",
  grab: "Dragging node",
  orbit: "Open palm · orbiting",
  zoom: "Two hands · zooming",
  hold: "Fist · holding still",
};

const idOf = (x: FGNode | string) => (typeof x === "object" ? x.id : x);
const linkKey = (l: FGLink) => `${idOf(l.source)}|${idOf(l.target)}`;
const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function Graph() {
  const { id = "" } = useParams();
  const api = useApi();
  const health = useApp((s) => s.health);
  const toast = useApp((s) => s.toast);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const nodesRef = useRef<FGNode[]>([]);
  const linksRef = useRef<FGLink[]>([]);
  const highlight = useRef<{ active: boolean; nodes: Set<string>; links: Set<string> }>({ active: false, nodes: new Set(), links: new Set() });
  const hoverRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const gesture = useRef<{ prevPalm: { x: number; y: number } | null; prevPair: number | null; grabbing: FGNode | null; depth: number }>({ prevPalm: null, prevPair: null, grabbing: null, depth: 100 });
  const tracker = useRef<HandTracker | null>(null);
  const fullOverlayRef = useRef<HTMLCanvasElement>(null);
  const immersiveRef = useRef<{ tex: any; plane: any; three: any } | null>(null);
  const smooth = useRef<{ x: number; y: number } | null>(null);
  const [immersive, setImmersive] = useState(true);
  const voice = useRef<BrowserVoice | null>(null);
  const player = useRef(new BlobPlayer());

  const [capture, setCapture] = useState<Capture | null>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<FGNode | null>(null);
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [camOn, setCamOn] = useState(false);
  const [camStatus, setCamStatus] = useState("");
  const [mode, setMode] = useState<Mode>("off");
  const [fps, setFps] = useState(0);
  const [typed, setTyped] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const voiceOnRef = useRef(false);
  const [hud, setHud] = useState<string | null>(null);
  const hudTimer = useRef(0);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const say = (text: string) => {
    setHud(text);
    window.clearTimeout(hudTimer.current);
    hudTimer.current = window.setTimeout(() => setHud(null), 2600);
  };
  const modeRef = useRef<Mode>("off");
  const setModeSafe = (m: Mode) => {
    if (modeRef.current !== m) {
      modeRef.current = m;
      setMode(m);
    }
  };

  /* ───────────────────────── data ───────────────────────── */
  useEffect(() => {
    Promise.all([api.getCapture(id), api.graph(id)])
      .then(([c, g]) => {
        setCapture(c);
        setData(g);
      })
      .catch((e) => toast((e as Error).message, "error"));
  }, [api, id, toast]);

  /* ───────────────────────── styling ───────────────────────── */
  const applyStyles = useCallback(async () => {
    const g = graphRef.current;
    if (!g) return;
    const hl = highlight.current;
    const SpriteText = (await import("three-spritetext")).default;
    g.nodeColor((n: FGNode) => {
      const c = COLORS[n.group] ?? "#cccccc";
      if (!hl.active) return c;
      return hl.nodes.has(n.id) ? c : alpha(c, 0.1);
    });
    g.linkColor((l: FGLink) => {
      const base = l.kind === "in" ? "#e8b36b" : l.kind === "mentions" ? "#8fd4a0" : "#d9c9a8";
      if (!hl.active) return alpha(base, l.kind === "related" ? 0.16 : 0.32);
      return hl.links.has(linkKey(l)) ? alpha(base, 0.75) : alpha(base, 0.035);
    });
    g.linkWidth((l: FGLink) => (hl.active && hl.links.has(linkKey(l)) ? 0.9 : l.kind === "in" ? 0.5 : 0.22));
    g.linkDirectionalParticles((l: FGLink) => (hl.active && hl.links.has(linkKey(l)) ? 3 : 0));
    g.nodeThreeObject((n: FGNode) => {
      const show = n.kind === "domain" || (n.kind === "entity" && n.group !== "topic") || hl.nodes.has(n.id) || selectedRef.current === n.id || hoverRef.current === n.id;
      if (!show) return false;
      const dimmed = hl.active && !hl.nodes.has(n.id) && selectedRef.current !== n.id && hoverRef.current !== n.id;
      if (dimmed) return false;
      const text = n.label.length > 36 ? `${n.label.slice(0, 35)}…` : n.label;
      const s = new SpriteText(text);
      s.color = n.kind === "domain" ? "#f6e3c3" : n.kind === "entity" ? COLORS[n.group] : "#f6f1e9";
      s.textHeight = n.kind === "domain" ? 3.8 : n.kind === "entity" ? 2.6 : 2.9;
      s.fontFace = n.kind === "domain" ? "Georgia, serif" : "Inter, sans-serif";
      s.backgroundColor = "rgba(14,13,11,0.6)";
      s.padding = 1.4;
      s.borderRadius = 2;
      s.position.y = -(Math.cbrt(n.val) * 4 + 5);
      return s;
    });
  }, []);

  const setHighlight = useCallback(
    (ids: string[] | null) => {
      const hl = highlight.current;
      if (!ids || !ids.length) {
        hl.active = false;
        hl.nodes = new Set();
        hl.links = new Set();
      } else {
        const core = new Set(ids);
        const nodes = new Set(ids);
        const links = new Set<string>();
        for (const l of linksRef.current) {
          const a = idOf(l.source);
          const b = idOf(l.target);
          if (core.has(a) || core.has(b)) {
            links.add(linkKey(l));
            nodes.add(a);
            nodes.add(b);
          }
        }
        hl.active = true;
        hl.nodes = nodes;
        hl.links = links;
      }
      void applyStyles();
    },
    [applyStyles],
  );

  const flyTo = useCallback((ids: string[], distance = 120, ms = 1300) => {
    const g = graphRef.current;
    if (!g) return;
    const pts = nodesRef.current.filter((n) => ids.includes(n.id) && n.x !== undefined);
    if (!pts.length) return;
    const c = { x: 0, y: 0, z: 0 };
    for (const p of pts) {
      c.x += p.x! / pts.length;
      c.y += p.y! / pts.length;
      c.z += p.z! / pts.length;
    }
    const cam = g.cameraPosition();
    const dx = cam.x - c.x;
    const dy = cam.y - c.y;
    const dz = cam.z - c.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    g.cameraPosition({ x: c.x + (dx / len) * distance, y: c.y + (dy / len) * distance, z: c.z + (dz / len) * distance }, c, ms);
  }, []);

  const select = useCallback(
    (n: FGNode | null) => {
      selectedRef.current = n?.id ?? null;
      setSelected(n);
      if (n) {
        setAnswer(null);
        setHighlight([n.id]);
        flyTo([n.id], n.kind === "domain" ? 160 : 90);
      } else setHighlight(null);
    },
    [flyTo, setHighlight],
  );

  /* ───────────────────────── graph ───────────────────────── */
  useEffect(() => {
    if (!data || !containerRef.current) return;
    let disposed = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const [{ default: ForceGraph3D }, THREE, { UnrealBloomPass }] = await Promise.all([
        import("3d-force-graph"),
        import("three"),
        import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
      ]);
      if (disposed || !containerRef.current) return;
      const el = containerRef.current;
      const nodes: FGNode[] = data.nodes.map((n) => ({ ...n }));
      const links: FGLink[] = data.links.map((l) => ({ ...l }));
      nodesRef.current = nodes;
      linksRef.current = links;
      const g = new (ForceGraph3D as any)(el, { controlType: "orbit" });
      graphRef.current = g;
      g.backgroundColor("#0e0d0b")
        .showNavInfo(false)
        .width(el.clientWidth)
        .height(el.clientHeight)
        .nodeId("id")
        .nodeVal("val")
        .nodeRelSize(2.8)
        .nodeOpacity(0.96)
        .nodeResolution(20)
        .nodeThreeObjectExtend(true)
        .nodeLabel(() => "")
        .linkOpacity(1)
        .linkDirectionalParticleWidth(1.5)
        .linkDirectionalParticleSpeed(0.008)
        .linkDirectionalParticleColor(() => "#f6e3c3")
        .onNodeClick((n: FGNode) => select(n))
        .onNodeHover((n: FGNode | null) => {
          hoverRef.current = n?.id ?? null;
          void applyStyles();
          el.style.cursor = n ? "pointer" : "default";
        })
        .onBackgroundClick(() => select(null))
        .graphData({ nodes, links });
      g.d3Force("charge").strength(-140);
      g.d3Force("link").distance((l: FGLink) => (l.kind === "in" ? 42 : l.kind === "mentions" ? 34 : 64));
      const bloom = new UnrealBloomPass(new THREE.Vector2(el.clientWidth, el.clientHeight), 0.9, 0.5, 0.28);
      g.postProcessingComposer().addPass(bloom);
      ro = new ResizeObserver(() => {
        g.width(el.clientWidth).height(el.clientHeight);
        bloom.setSize(el.clientWidth, el.clientHeight);
      });
      ro.observe(el);
      await applyStyles();
      let fitted = false;
      g.onEngineStop(() => {
        if (fitted) return;
        fitted = true;
        g.zoomToFit(1000, 40);
      });
      setTimeout(() => {
        if (!fitted) {
          fitted = true;
          g.zoomToFit(1000, 40);
        }
      }, 2500);
      setReady(true);
    })().catch((e) => toast(`Could not start the 3D view: ${(e as Error).message}`, "error"));
    return () => {
      disposed = true;
      ro?.disconnect();
      try {
        graphRef.current?._destructor?.();
      } catch {
        /* ignore */
      }
      graphRef.current = null;
    };
  }, [data, applyStyles, select, toast]);

  /* ───────────────────────── gestures ───────────────────────── */
  const nearestNode = (px: number, py: number, radius: number): FGNode | null => {
    const g = graphRef.current;
    if (!g) return null;
    let best: FGNode | null = null;
    let bestD = radius;
    for (const n of nodesRef.current) {
      if (n.x === undefined) continue;
      const s = g.graph2ScreenCoords(n.x, n.y, n.z);
      const d = Math.hypot(s.x - px, s.y - py) - Math.cbrt(n.val) * 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  };

  const orbit = (dAz: number, dPolar: number, scale = 1) => {
    const g = graphRef.current;
    if (!g) return;
    const pos = g.cameraPosition();
    const target = g.controls()?.target ?? { x: 0, y: 0, z: 0 };
    const dx = pos.x - target.x;
    const dy = pos.y - target.y;
    const dz = pos.z - target.z;
    const r0 = Math.hypot(dx, dy, dz) || 1;
    const r = clamp(r0 * scale, 30, 2000);
    let theta = Math.atan2(dx, dz) + dAz;
    let phi = clamp(Math.acos(clamp(dy / r0, -1, 1)) + dPolar, 0.12, Math.PI - 0.12);
    g.cameraPosition({ x: target.x + r * Math.sin(phi) * Math.sin(theta), y: target.y + r * Math.cos(phi), z: target.z + r * Math.sin(phi) * Math.cos(theta) }, target, 0);
  };

  const release = () => {
    const gs = gesture.current;
    if (gs.grabbing) {
      delete gs.grabbing.fx;
      delete gs.grabbing.fy;
      delete gs.grabbing.fz;
      gs.grabbing = null;
    }
  };

  /** Put the live camera behind the constellation (mirrored, dimmed) so the presenter stands inside the graph. */
  const enterImmersive = async () => {
    const g = graphRef.current;
    const video = videoRef.current;
    if (!g || !video || immersiveRef.current) return;
    const THREE = await import("three");
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1; // mirror, like a mirror
    const scene = g.scene();
    const cam = g.camera();
    scene.background = tex;
    // A dark, camera-locked veil far behind the nodes keeps the graph legible over the video.
    const D = 4000;
    cam.far = Math.max(cam.far, D + 1000);
    cam.updateProjectionMatrix();
    const h = 2 * D * Math.tan((cam.fov * Math.PI) / 360) * 1.15;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(h * cam.aspect, h), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.58, depthWrite: false }));
    plane.position.set(0, 0, -D);
    plane.renderOrder = -1;
    if (!cam.parent) scene.add(cam);
    cam.add(plane);
    immersiveRef.current = { tex, plane, three: THREE };
  };

  const exitImmersive = () => {
    const g = graphRef.current;
    const im = immersiveRef.current;
    if (!im) return;
    immersiveRef.current = null;
    try {
      im.plane.parent?.remove(im.plane);
      im.plane.geometry.dispose();
      im.plane.material.dispose();
      im.tex.dispose();
      g?.backgroundColor("#0e0d0b");
    } catch {
      /* ignore */
    }
    const cv = fullOverlayRef.current;
    if (cv) cv.getContext("2d")?.clearRect(0, 0, cv.width, cv.height);
  };

  const showCursor = (x: number | null, y = 0, kind: "point" | "pinch" = "point") => {
    const c = cursorRef.current;
    if (!c) return;
    if (x === null) {
      c.style.opacity = "0";
      return;
    }
    c.style.opacity = "1";
    c.style.transform = `translate(${x - 14}px, ${y - 14}px) scale(${kind === "pinch" ? 0.7 : 1})`;
    c.style.borderColor = kind === "pinch" ? "#e8b36b" : "#f6e3c3";
  };

  const onFrame = (f: HandFrame) => {
    const cv = overlayRef.current;
    if (cv) drawHands(cv.getContext("2d")!, f.hands, cv.width, cv.height);
    const full = fullOverlayRef.current;
    const el = containerRef.current;
    if (full && el) {
      if (full.width !== el.clientWidth || full.height !== el.clientHeight) {
        full.width = el.clientWidth;
        full.height = el.clientHeight;
      }
      if (immersiveRef.current) drawHands(full.getContext("2d")!, f.hands, full.width, full.height);
    }
    if (f.fps !== fps) setFps(f.fps);
    const g = graphRef.current;
    if (!el || !g) return;
    const W = el.clientWidth;
    const H = el.clientHeight;
    const gs = gesture.current;
    // Light exponential smoothing on the primary hand's key points to tame landmark jitter.
    const hands = f.hands.map((h, i) => {
      if (i !== 0) return h;
      const k = 0.55;
      const prev = smooth.current;
      const pointer = prev ? { x: prev.x + (h.pointer.x - prev.x) * k, y: prev.y + (h.pointer.y - prev.y) * k } : h.pointer;
      smooth.current = pointer;
      return { ...h, pointer };
    });
    if (!hands.length) smooth.current = null;

    if (hands.length === 2 && hands.every((h) => h.open || h.pointing)) {
      release();
      const d = Math.hypot(hands[0].palm.x - hands[1].palm.x, hands[0].palm.y - hands[1].palm.y);
      if (gs.prevPair) {
        const ratio = gs.prevPair / d;
        if (Math.abs(ratio - 1) > 0.004) orbit(0, 0, clamp(ratio, 0.94, 1.06));
      }
      gs.prevPair = d;
      gs.prevPalm = null;
      showCursor(null);
      setModeSafe("zoom");
      return;
    }
    gs.prevPair = null;
    const h = hands[0];
    if (!h) {
      release();
      gs.prevPalm = null;
      showCursor(null);
      setModeSafe("none");
      return;
    }
    if (h.pinch) {
      const px = h.pinchPoint.x * W;
      const py = h.pinchPoint.y * H;
      showCursor(px, py, "pinch");
      if (!gs.grabbing) {
        const n = nearestNode(px, py, 46);
        if (n) {
          gs.grabbing = n;
          const cam = g.cameraPosition();
          gs.depth = Math.hypot(cam.x - (n.x ?? 0), cam.y - (n.y ?? 0), cam.z - (n.z ?? 0));
          if (hoverRef.current !== n.id) {
            hoverRef.current = n.id;
            void applyStyles();
          }
        }
      }
      if (gs.grabbing) {
        const q = g.screen2GraphCoords(px, py, gs.depth);
        gs.grabbing.fx = q.x;
        gs.grabbing.fy = q.y;
        gs.grabbing.fz = q.z;
        g.d3ReheatSimulation();
        setModeSafe("grab");
        gs.prevPalm = null;
      } else {
        // Pinching empty space drags the view, like a mouse drag.
        if (gs.prevPalm) orbit(-(h.pinchPoint.x - gs.prevPalm.x) * 3.4, (h.pinchPoint.y - gs.prevPalm.y) * 2.6);
        gs.prevPalm = h.pinchPoint;
        setModeSafe("pinch");
      }
      return;
    }
    if (gs.grabbing) {
      const grabbed = gs.grabbing;
      release();
      select(grabbed);
    }
    if (h.pointing) {
      const px = h.pointer.x * W;
      const py = h.pointer.y * H;
      showCursor(px, py, "point");
      const n = nearestNode(px, py, 34);
      const nid = n?.id ?? null;
      if (hoverRef.current !== nid) {
        hoverRef.current = nid;
        void applyStyles();
      }
      gs.prevPalm = null;
      setModeSafe("point");
      return;
    }
    showCursor(null);
    if (h.open) {
      if (gs.prevPalm) {
        const dx = h.palm.x - gs.prevPalm.x;
        const dy = h.palm.y - gs.prevPalm.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.0015) orbit(-dx * 3.4, dy * 2.6);
      }
      gs.prevPalm = h.palm;
      setModeSafe("orbit");
      return;
    }
    gs.prevPalm = null;
    setModeSafe(h.fist ? "hold" : "none");
  };

  const toggleCamera = async () => {
    if (camOn) {
      exitImmersive();
      tracker.current?.stop();
      tracker.current = null;
      setCamOn(false);
      setModeSafe("off");
      showCursor(null);
      return;
    }
    if (!HandTracker.supported()) {
      toast("Camera hand tracking isn't available in this browser.", "error");
      return;
    }
    try {
      const t = new HandTracker(videoRef.current!, onFrame);
      tracker.current = t;
      setCamOn(true);
      await t.start(setCamStatus);
      setModeSafe("none");
      if (immersive) await enterImmersive();
    } catch (e) {
      toast(`Camera: ${(e as Error).message}`, "error");
      tracker.current = null;
      setCamOn(false);
      setModeSafe("off");
    }
  };

  /* ───────────────────────── voice ───────────────────────── */
  const ask = useCallback(
    async (q: string) => {
      if (!q.trim() || !capture) return;
      setAsking(true);
      setSelected(null);
      selectedRef.current = null;
      try {
        const r = await api.ask(id, q, capture.successor?.name);
        setAnswer(r);
        const cited = r.citations.map((c) => c.atomId);
        if (cited.length) {
          setHighlight(cited);
          flyTo(cited, 150, 1500);
        } else setHighlight(null);
        const plain = r.answer.replace(/\[\d+\]/g, "").replace(/[*#>_`]/g, "").replace(/\s+/g, " ").trim().slice(0, 600);
        voice.current?.stopListening();
        const resume = () => {
          if (voiceOnRef.current) voice.current?.listen();
        };
        if (health?.higgs) {
          api
            .speak(plain, id)
            .then((b) => player.current.play(b))
            .catch(() => voice.current?.speak(plain))
            .finally(resume);
        } else void voice.current?.speak(plain).finally(resume);
      } catch (e) {
        toast((e as Error).message, "error");
      } finally {
        setAsking(false);
      }
    },
    [api, capture, flyTo, health?.higgs, id, setHighlight, toast],
  );

  /* ───────────────────────── voice control ───────────────────────── */
  type Command =
    | { kind: "reset" }
    | { kind: "zoom"; factor: number }
    | { kind: "rotate"; dAz: number; dPolar: number }
    | { kind: "immersive"; on: boolean }
    | { kind: "camera"; on: boolean }
    | { kind: "show"; target: string }
    | { kind: "question"; text: string };

  const parseCommand = (raw: string): Command => {
    const t = raw.toLowerCase().replace(/[.,!?]+$/g, "").replace(/^(tacit|hey tacit|ok tacit)[,\s]+/, "").trim();
    if (/^(reset|start over|show everything|zoom to fit|fit)$/.test(t)) return { kind: "reset" };
    if (/^(zoom in|closer|come closer|move in|zoom)$/.test(t)) return { kind: "zoom", factor: 0.7 };
    if (/^(zoom out|farther|further|move out|back up|pull back)$/.test(t)) return { kind: "zoom", factor: 1.4 };
    const rot = t.match(/^(rotate|spin|turn|orbit)\s*(left|right|up|down)?$/);
    if (rot) {
      const d = rot[2] ?? "right";
      return { kind: "rotate", dAz: d === "left" ? 0.7 : d === "right" ? -0.7 : 0, dPolar: d === "up" ? -0.5 : d === "down" ? 0.5 : 0 };
    }
    if (/^(step inside|immersive|put me inside|go immersive)$/.test(t)) return { kind: "immersive", on: true };
    if (/^(corner view|shrink (the )?camera|small camera)$/.test(t)) return { kind: "immersive", on: false };
    if (/^(stop|turn off|disable)( the| my)? camera$/.test(t)) return { kind: "camera", on: false };
    if (/^(use|turn on|enable|start)( my| the)? (hands|camera)$/.test(t)) return { kind: "camera", on: true };
    const show = t.match(/^(?:show|highlight|find|light up|where (?:is|are)|go to|focus on|open|select)\s+(?:me\s+)?(?:the\s+|all\s+|all the\s+)?(.+)$/);
    if (show) return { kind: "show", target: show[1].trim() };
    return { kind: "question", text: raw };
  };

  const TYPE_WORDS: Record<string, string> = { risk: "risk", risks: "risk", gotcha: "gotcha", gotchas: "gotcha", trap: "gotcha", traps: "gotcha", contact: "contact", contacts: "contact", people: "contact", person: "person", tool: "tool", tools: "tool", system: "tool", systems: "tool", procedure: "procedure", procedures: "procedure", step: "procedure", steps: "procedure", rule: "rule", rules: "rule", decision: "decision", decisions: "decision", story: "story", stories: "story", glossary: "glossary", term: "glossary", terms: "glossary", domain: "domain", domains: "domain", team: "team", teams: "team" };

  const showTarget = (target: string) => {
    const nodes = nodesRef.current;
    const key = target.toLowerCase();
    // 1. an atom type / node group
    const group = TYPE_WORDS[key] ?? (ATOM_TYPES as string[]).find((x) => x === key);
    if (group) {
      const ids = nodes.filter((n) => n.group === group).map((n) => n.id);
      if (ids.length) {
        setSelected(null);
        selectedRef.current = null;
        setAnswer(null);
        setHighlight(ids);
        flyTo(ids, 190, 1200);
        say(`Showing ${ids.length} ${group}${ids.length === 1 ? "" : group === "glossary" ? " terms" : "s"}`);
        return;
      }
    }
    // 2. a domain by name
    const dom = nodes.find((n) => n.kind === "domain" && (n.label.toLowerCase().includes(key) || key.includes(n.label.toLowerCase().split(" ")[0])));
    if (dom) {
      select(dom);
      say(`Focusing on ${dom.label}`);
      return;
    }
    // 3. best node by label search
    const bm = new BM25(nodes.map((n) => ({ id: n.id, text: `${n.label} ${n.snippet ?? ""}` })));
    const hit = bm.search(key, 1)[0];
    const node = hit ? nodes.find((n) => n.id === hit.id) : undefined;
    if (node && hit.score > 0.5) {
      select(node);
      say(`Focusing on ${node.label}`);
      return;
    }
    say(`Nothing matched “${target}” — asking the twin`);
    void ask(target);
  };

  const runCommand = async (c: Command) => {
    switch (c.kind) {
      case "reset":
        reset();
        say("Reset");
        break;
      case "zoom":
        orbit(0, 0, c.factor);
        say(c.factor < 1 ? "Zooming in" : "Zooming out");
        break;
      case "rotate":
        for (let i = 0; i < 12; i++) {
          orbit(c.dAz / 12, c.dPolar / 12);
          await new Promise((r) => setTimeout(r, 30));
        }
        say("Rotating");
        break;
      case "immersive":
        if (immersive !== c.on) await toggleImmersive();
        say(c.on ? "Stepping inside" : "Corner view");
        break;
      case "camera":
        if (camOn !== c.on) await toggleCamera();
        break;
      case "show":
        showTarget(c.target);
        break;
      case "question":
        say(`Asking: “${c.text}”`);
        await ask(c.text);
        break;
    }
  };

  const handleUtterance = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    await runCommand(parseCommand(t));
  };

  const toggleMic = async () => {
    if (!BrowserVoice.recognitionSupported()) {
      toast("Speech recognition isn't available in this browser. Chrome works best.", "error");
      return;
    }
    try {
      if (!voice.current) {
        const v = new BrowserVoice({
          onPartial: setHeard,
          onFinal: (t) => {
            setHeard("");
            void handleUtterance(t).finally(() => {
              if (voiceOnRef.current) voice.current?.listen();
            });
          },
          onState: (s) => setListening(s === "listening"),
          onLevel: () => undefined,
          onError: (m) => toast(m, "error"),
        });
        await v.init();
        voice.current = v;
      }
      const next = !voiceOnRef.current;
      voiceOnRef.current = next;
      setVoiceOn(next);
      if (next) {
        voice.current.listen();
        say("Listening — say “show me the risks”, “zoom in”, or ask a question");
      } else voice.current.stopListening();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const toggleImmersive = async () => {
    const next = !immersive;
    setImmersive(next);
    if (!camOn) return;
    if (next) await enterImmersive();
    else exitImmersive();
  };

  useEffect(
    () => () => {
      exitImmersive();
      tracker.current?.stop();
      voice.current?.destroy();
      player.current.stop();
    },
    [],
  );

  const toggleRecording = () => {
    const g = graphRef.current;
    if (!g) return;
    if (recording) {
      recorder.current?.stop();
      return;
    }
    const canvas: HTMLCanvasElement = g.renderer().domElement;
    const stream = canvas.captureStream(30);
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
    recChunks.current = [];
    rec.ondataavailable = (e) => e.data.size && recChunks.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(recChunks.current, { type: mime || "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tacit-constellation-${Date.now()}.${mime.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setRecording(false);
      say("Clip saved to your downloads");
    };
    rec.start(500);
    recorder.current = rec;
    setRecording(true);
    say("Recording the constellation");
  };

  const reset = () => {
    select(null);
    setAnswer(null);
    graphRef.current?.zoomToFit(900, 60);
  };

  const first = capture?.expert.name.split(" ")[0] ?? "";
  const legend: [string, string][] = [
    ["domain", "Domain"],
    ["procedure", "Procedure"],
    ["rule", "Rule"],
    ["gotcha", "Gotcha"],
    ["risk", "Risk"],
    ["contact", "Contact"],
    ["tool", "Tool / system"],
    ["decision", "Decision"],
    ["person", "Person"],
    ["team", "Team"],
  ];

  return (
    <div className="relative flex h-screen flex-col bg-[#0e0d0b] text-paper">
      <header className="z-10 flex items-center gap-3 border-b border-white/10 px-5 py-3">
        <Link to={`/c/${id}`} className="inline-flex items-center gap-1.5 text-[13px] text-paper/60 hover:text-paper">
          <ArrowLeft className="h-4 w-4" /> {capture?.expert.name ?? "Back"}
        </Link>
        <span className="font-display text-[20px]">Constellation</span>
        {data && (
          <span className="hidden text-[12.5px] text-paper/50 md:inline">
            {data.stats.atoms} atoms · {data.stats.domains} domains · {data.stats.entities} people & systems · {data.stats.links} links
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Badge tone={camOn ? "accent" : "neutral"} icon={<Hand className="h-3 w-3" />}>
            {camOn ? (mode === "off" ? camStatus || "Starting…" : `${MODE_TEXT[mode]}${fps ? ` · ${fps} fps` : ""}`) : "Hand gestures off"}
          </Badge>
          <Button size="sm" variant={camOn ? "accent" : "secondary"} onClick={toggleCamera} icon={camOn ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}>
            {camOn ? "Stop camera" : "Use my hands"}
          </Button>
          {camOn && (
            <Button size="sm" variant="ghost" className="text-paper/80 hover:bg-white/10 hover:text-paper" onClick={toggleImmersive} icon={immersive ? <PictureInPicture2 className="h-3.5 w-3.5" /> : <ScanFace className="h-3.5 w-3.5" />} title={immersive ? "Shrink the camera to a corner tile" : "Put yourself inside the constellation"}>
              {immersive ? "Corner view" : "Step inside"}
            </Button>
          )}
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const q = typed.trim();
              if (!q) return;
              setTyped("");
              void handleUtterance(q);
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={`Ask ${first}…`}
              aria-label="Ask a question"
              className="h-8 w-44 rounded-full border border-white/15 bg-white/5 px-3 text-[13px] text-paper placeholder:text-paper/40 focus:outline-none focus:border-accent-2/60 md:w-56"
            />
            <Button type="button" size="sm" variant={voiceOn ? "accent" : "secondary"} onClick={toggleMic} loading={asking} icon={voiceOn ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />} title="Voice control: commands and questions">
              {voiceOn ? (listening ? "Listening…" : "Voice on") : "Voice"}
            </Button>
          </form>
          <Button type="button" size="sm" variant={recording ? "danger" : "ghost"} className={recording ? "" : "text-paper/80 hover:bg-white/10 hover:text-paper"} onClick={toggleRecording} icon={recording ? <Square className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5 text-danger" />} title="Record a clip of the constellation (with your camera backdrop when inside)">
            {recording ? "Stop" : "Record"}
          </Button>
          <Button size="sm" variant="ghost" className="text-paper/70 hover:text-paper hover:bg-white/10" onClick={reset} icon={<RotateCcw className="h-3.5 w-3.5" />}>
            Reset
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        <canvas ref={fullOverlayRef} className={cx("pointer-events-none absolute inset-0 h-full w-full", camOn && immersive ? "opacity-90" : "opacity-0")} />
        {!ready && (
          <div className="absolute inset-0 grid place-items-center text-paper/60">
            <div className="flex items-center gap-3">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-accent-2" /> Arranging {first ? `${first}'s` : "the"} knowledge…
            </div>
          </div>
        )}
        {/* gesture cursor */}
        <div ref={cursorRef} className="pointer-events-none absolute left-0 top-0 h-7 w-7 rounded-full border-2 opacity-0 transition-opacity" style={{ boxShadow: "0 0 18px 4px rgba(232,179,107,.45)", borderColor: "#f6e3c3" }} />

        {heard && <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-[14px] backdrop-blur">{heard}…</div>}
        {hud && !heard && <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-full border border-accent-2/40 bg-ink/80 px-4 py-2 text-[13.5px] text-accent-2 shadow-lift backdrop-blur rise-in">{hud}</div>}

        {/* details / answer panel */}
        {(selected || answer) && (
          <aside className="absolute right-4 top-4 w-[360px] max-h-[calc(100%-2rem)] overflow-y-auto scrollbar-thin rounded-2xl border border-white/10 bg-[#171512]/85 p-4 shadow-lift backdrop-blur rise-in">
            {answer && (
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-paper/50 font-semibold">
                  <Sparkles className="h-3.5 w-3.5 text-accent-2" /> {first}'s twin
                  <Badge tone={answer.confidence === "high" ? "sage" : answer.confidence === "medium" ? "amber" : "danger"} className="ml-auto">
                    {answer.confidence}
                  </Badge>
                </div>
                <p className="mt-2 text-[13px] text-paper/60 italic">“{answer.question}”</p>
                <div className="mt-2 text-[14px] text-paper [&_.prose-tacit]:text-paper [&_strong]:text-paper">
                  <Markdown onCite={(n) => {
                    const c = answer.citations.find((x) => x.n === n);
                    const node = nodesRef.current.find((x) => x.id === c?.atomId);
                    if (node) select(node);
                  }}>
                    {answer.answer}
                  </Markdown>
                </div>
                {answer.citations.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-white/10 pt-3">
                    {answer.citations.map((c) => (
                      <li key={c.n} className="flex items-start gap-2 text-[12.5px] text-paper/80">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-2 font-mono text-[10px] font-semibold text-ink">{c.n}</span>
                        <span>{c.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {answer.queuedQuestion && <p className="mt-3 text-[12.5px] text-accent-2">Queued for {first}'s next interview.</p>}
              </div>
            )}
            {selected && !answer && (
              <div>
                <div className="flex items-center gap-2">
                  {selected.kind === "atom" ? (
                    <Badge tone={ATOM_META[selected.group as keyof typeof ATOM_META]?.tone ?? "neutral"}>{selected.group}</Badge>
                  ) : (
                    <Badge tone="neutral">{selected.kind === "domain" ? "domain" : selected.group}</Badge>
                  )}
                  {selected.verified && <Badge tone="sage">verified</Badge>}
                  {selected.confidence !== undefined && <span className="ml-auto font-mono text-[11px] text-paper/50">{Math.round(selected.confidence * 100)}%</span>}
                </div>
                <h3 className="font-display mt-2 text-[19px] leading-snug">{selected.label}</h3>
                {selected.snippet && <p className="mt-2 text-[13.5px] text-paper/75 leading-relaxed">{selected.snippet}</p>}
                {selected.kind !== "atom" && (
                  <p className="mt-2 text-[13px] text-paper/60">
                    Connected to {linksRef.current.filter((l) => idOf(l.source) === selected.id || idOf(l.target) === selected.id).length} atoms.
                  </p>
                )}
                {selected.kind === "atom" && (
                  <Link to={`/c/${id}/knowledge`} className="mt-3 inline-block text-[12.5px] text-accent-2 hover:underline">
                    Open in knowledge base →
                  </Link>
                )}
              </div>
            )}
          </aside>
        )}

        {/* camera feed: drives hand tracking and (in immersive mode) the scene background */}
        <video ref={videoRef} className={cx("absolute bottom-4 left-4 h-[150px] w-[200px] rounded-xl object-cover", camOn && !immersive ? "block" : "hidden")} style={{ transform: "scaleX(-1)" }} />
        {/* camera PiP */}
        <div className={cx("absolute bottom-4 left-4 overflow-hidden rounded-xl border border-white/15 bg-black/60 shadow-lift", camOn && !immersive ? "block" : "hidden")} style={{ width: 200, height: 150 }}>
          <canvas ref={overlayRef} width={200} height={150} className="absolute inset-0 h-full w-full" />
          <div className="absolute bottom-1 left-2 text-[10.5px] text-paper/80">{MODE_TEXT[mode]}</div>
        </div>

        {/* legend + help */}
        <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 rounded-xl bg-black/40 px-3 py-2 text-[11px] text-paper/70 backdrop-blur">
            {legend.map(([k, label]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[k], boxShadow: `0 0 6px ${COLORS[k]}` }} />
                {label}
              </span>
            ))}
          </div>
          <div className="rounded-xl bg-black/40 px-3 py-2 text-[11px] text-paper/60 backdrop-blur">
            {camOn ? "☝️ point to reveal · 🤏 pinch a node to grab it, pinch space to turn · ✋ open palm to orbit · 🙌 two hands to zoom" : "Drag to orbit · scroll to zoom · click a node · or turn on your camera and use your hands"}
            <br />🎙 say “show me the risks”, “focus on Kevin Tran”, “zoom in”, “rotate left”, “step inside”, “reset”, or ask anything
          </div>
        </div>
      </div>
      <Volume2 className="hidden" />
    </div>
  );
}
