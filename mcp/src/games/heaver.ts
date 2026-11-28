/*
 * run_game_logic actions and saved-position reader for Heaver.
 *
 * The core (heaver/heaver-core.js on the site, copied into
 * src/generated/cores/ at build time) owns the geometry: four kinds of fixed
 * covers, five turning shapes and the 200 animation steps. It also fixes the
 * two facts the page's maths section rests on: a rotation preserves every
 * centre-to-vertex distance, yet the slice of the shape seen through the
 * opening swells and shrinks. Every number below is computed by that core,
 * never restated from memory. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["heaver"].HeaverCore;

type Pt = { x: number; y: number };
const TAU = 2 * Math.PI;
const round = (v: number, digits = 3): number => Number(v.toFixed(digits));

/** Integer argument inside one of the applet's own option ranges. */
function intIn(args: Json, key: string, lo: number, hi: number, fallback: number): number {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  const n = num(args, key);
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`argument "${key}" must be an integer from ${lo} to ${hi}, got ${JSON.stringify(raw)}`);
  }
  return n;
}

/** The panel choices the actions share, validated before reaching the core. */
function panel(args: Json, withTiming = false): Json {
  const H = core();
  const out: Json = {
    fix: intIn(args, "fix", H.FIX.SQUARE, H.FIX.PENTAGON, H.FIX.SQUARE),
    rot: intIn(args, "rot", H.ROT.SQUARE, H.ROT.STAR, H.ROT.SQUARE),
    gap: intIn(args, "gap", H.GAP.MIN, H.GAP.MAX, H.GAP.START),
  };
  if (withTiming) {
    out.speed = intIn(args, "speed", H.SPEED.MIN, H.SPEED.MAX, H.SPEED.START);
    out.opacity = intIn(args, "opacity", H.OPACITY.MIN, H.OPACITY.MAX, H.OPACITY.START);
    out.frame = intIn(args, "frame", 0, H.N - 1, 0);
  }
  return out;
}

/* Sutherland-Hodgman clipping of the turning polygon against the open strip
   x >= lo and x <= hi — the gap the fixed covers leave, as in the logic test. */
function clipX(poly: Pt[], bound: number, keepGreater: boolean): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = keepGreater ? a.x - bound : bound - a.x;
    const db = keepGreater ? b.x - bound : bound - b.x;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** Height in pixels of the strip of the turning shape visible at one step. */
function visibleSpan(state: Json, frame: number, width: number, height: number): number {
  const H = core();
  const g = H.geometry(H.option(state, "frame", frame), width, height);
  const angle = frame * TAU / H.N;
  const turned: Pt[] = g.base.map((p: Pt) => H.rotate(g.center, p, angle, 1));
  let clipped = clipX(turned, g.center.x - g.hole / 2, true);
  clipped = clipX(clipped, g.center.x + g.hole / 2, false);
  if (!clipped.length) return 0;
  return Math.max(...clipped.map((p) => p.y)) - Math.min(...clipped.map((p) => p.y));
}

/** Centre-to-vertex distances before the applet's pixel round. */
function radii(state: Json, frame: number, width: number, height: number): number[] {
  const H = core();
  const g = H.geometry(H.option(state, "frame", frame), width, height);
  const angle = frame * TAU / H.N;
  return g.base.map((p: Pt) => H.distance(g.center, H.rotate(g.center, p, angle, 1)));
}

export function actions(): GameActions {
  return {
    rotation_radii: {
      describe:
        "Centre-to-vertex distances of the turning shape at one animation step, before the applet's pixel round. Rotation keeps each distance exactly, so the shape itself never expands or shrinks; the drawn, rounded edges can wobble by about a pixel.",
      args: '{ "rot": 0, "fix": 0, "frame": 25 }',
      run: (args) => {
        const H = core();
        const base = H.start(panel(args));
        const frame = intIn(args, "frame", 0, H.N - 1, 0);
        const state = H.option(base, "frame", frame);
        const g = H.geometry(state, H.WIDTH, H.HEIGHT);
        const original: number[] = g.base.map((p: Pt) => H.distance(g.center, p));
        const turned: number[] = radii(state, frame, H.WIDTH, H.HEIGHT);
        const drawn: number[] = g.spinning.map((p: Pt) => H.distance(g.center, p));
        const wobble = Math.max(...drawn.map((r, i) => Math.abs(r - turned[i])));
        return {
          cover: H.FIX_NAMES[state.fix],
          turningShape: H.ROT_NAMES[state.rot],
          step: frame,
          ofSteps: H.N,
          angleTurns: round(frame / H.N, 4),
          canvas: { width: H.WIDTH, height: H.HEIGHT },
          centre: g.center,
          holePx: g.hole,
          vertexCount: g.base.length,
          radiiUnrotatedPx: original.map((r) => round(r, 4)),
          radiiAtStepPx: turned.map((r) => round(r, 4)),
          radiiAsDrawnPx: drawn.map((r) => round(r, 3)),
          rotationKeepsEveryRadius: original.every((r, i) => Math.abs(r - turned[i]) < 1e-9),
          largestPixelWobblePx: round(wobble, 3),
          note:
            "Rotation is an isometry: every vertex stays the same distance from the centre, so nothing really grows. The visible height changes because the fixed covers only let a thin strip through, not because the shape changes size.",
        };
      },
    },
    visible_span: {
      describe:
        "Height in pixels of the turning shape seen through the opening at given animation steps, with the smallest and largest heights over a full turn and how many steps the swell repeats after. The shape keeps its size; only the slice the covers reveal grows and shrinks.",
      args: '{ "rot": 0, "fix": 0, "gap": 5, "frames": [0, 25, 50, 75] }',
      run: (args) => {
        const H = core();
        const state = H.start(panel(args));
        let frames: number[];
        if (args.frames === undefined || args.frames === null) {
          frames = [0, 1, 2, 3, 4].map((q) => Math.round(q * H.N / 8));
        } else {
          const raw = numArray(args, "frames");
          if (!raw.length) throw new Error('argument "frames" must be a non-empty array of step numbers');
          frames = raw.map((f) => ((Math.round(f) % H.N) + H.N) % H.N);
        }
        const sweep = Array.from({ length: H.N }, (_, f) => visibleSpan(state, f, H.WIDTH, H.HEIGHT));
        const smallest = Math.min(...sweep);
        const largest = Math.max(...sweep);
        let repeatsEverySteps: number | null = null;
        for (let p = 1; p <= H.N; p++) {
          let same = true;
          for (let f = 0; f < H.N; f++) {
            if (Math.abs(sweep[f] - sweep[(f + p) % H.N]) > 1e-7) { same = false; break; }
          }
          if (same) { repeatsEverySteps = p; break; }
        }
        return {
          cover: H.FIX_NAMES[state.fix],
          turningShape: H.ROT_NAMES[state.rot],
          holePx: H.holeSize(state),
          totalSteps: H.N,
          atSteps: frames.map((f) => ({
            step: f,
            angleTurns: round(f / H.N, 4),
            visibleHeightPx: round(visibleSpan(state, f, H.WIDTH, H.HEIGHT), 3),
          })),
          smallestVisibleHeightPx: round(smallest, 3),
          largestVisibleHeightPx: round(largest, 3),
          repeatsEverySteps,
          swellsByFactor: largest > 0 ? round(largest / smallest, 3) : null,
          note:
            "The opening fixes a vertical strip of the turning polygon; its top-to-bottom extent is what the eye reads as the shape's height. That extent rises and falls periodically even though every vertex keeps its distance from the centre.",
        };
      },
    },
  };
}

/**
 * What the core says about a position the page saved with Track.state: the
 * four choices and three slider values, plus the opening, the turning step,
 * the preserved vertex radii and the visible height at that step.
 */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Heaver state version ${stateVersion}`);
  const H = core();
  const s = H.start(panel(state, true));
  const g = H.geometry(s, H.WIDTH, H.HEIGHT);
  const angleTurns = s.frame / H.N;
  const preserved: number[] = g.base.map((p: Pt) => H.distance(g.center, p));
  const turned: number[] = radii(s, s.frame, H.WIDTH, H.HEIGHT);
  const drawn: number[] = g.spinning.map((p: Pt) => H.distance(g.center, p));
  const wobble = Math.max(...drawn.map((r, i) => Math.abs(r - turned[i])));

  return {
    stateVersion,
    fix: s.fix,
    rot: s.rot,
    gap: s.gap,
    speed: s.speed,
    opacity: s.opacity,
    frame: s.frame,
    core: {
      description: H.describe(s, H.WIDTH, H.HEIGHT),
      cover: H.FIX_NAMES[s.fix],
      turningShape: H.ROT_NAMES[s.rot],
      canvas: { width: H.WIDTH, height: H.HEIGHT },
      centre: g.center,
      sidePx: round(g.side, 3),
      holePx: g.hole,
      coverCount: g.fixed.length,
      vertexCount: g.spinning.length,
      angleTurns: round(angleTurns, 4),
      angleDegrees: round(angleTurns * 360, 2),
      vertexRadiiPx: preserved.map((r) => round(r, 4)),
      rotationKeepsEveryRadius: preserved.every((r, i) => Math.abs(r - turned[i]) < 1e-9),
      largestPixelWobblePx: round(wobble, 3),
      visibleHeightPx: round(visibleSpan(s, s.frame, H.WIDTH, H.HEIGHT), 3),
    },
    note:
      "The saved position is one of the applet's 200 steps. Rotation leaves every vertex the same distance from the centre; the part seen through the opening is what appears to swell and shrink.",
  };
}
