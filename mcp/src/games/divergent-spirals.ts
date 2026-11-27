/*
 * run_game_logic actions and saved-position reader for Divergent Spirals.
 *
 * The applet draws only circular arcs; the spirals are supplied by the eye.
 * Everything reported here comes from the game's real core (divergent-spirals/
 * in the site), copied into src/generated/cores/ at build time: the ring radii
 * and starts from DrawTop(), and the tick angle from run(). See _shared.ts for
 * the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

interface Arc {
  radius: number;
  start: number;
  sweep: number;
}

interface SpiralState {
  angle: number;
  clockwise: boolean;
  fast: boolean;
  running: boolean;
  opening: number;
  overlap: number;
  width: number;
  height: number;
  N: number;
  W: number;
}

interface SavedPosition {
  angle: number;
  clockwise: boolean;
  fast: boolean;
  running: boolean;
  opening: number;
  overlap: number;
  center: { x: number; y: number };
  radius: number;
  rings: number;
}

interface Range {
  min: number;
  max: number;
  step: number;
  initial: number;
}

/** The part of the generated core this reader uses. */
interface DivergentSpirals {
  N: number;
  W: number;
  MARGIN: number;
  CANVAS: { width: number; height: number };
  OPENING: Range;
  OVERLAP: Range;
  start(options?: Partial<SpiralState>): SpiralState;
  setOptions(state: SpiralState, options: Partial<SpiralState>): SpiralState;
  advance(state: SpiralState, frames?: number): SpiralState;
  snappedRadius(width: number, height: number, n?: number): number;
  radius(state: SpiralState): number;
  ringStep(r: number, opening: number, n?: number): number;
  arcs(state: SpiralState): Arc[];
  angleStep(fast: boolean): number;
  period(fast: boolean): number;
  angularSpeed(fast: boolean): number;
  position(state: SpiralState): SavedPosition;
}

const core = (): DivergentSpirals =>
  cores["divergent-spirals"].DivergentSpiralsCore as unknown as DivergentSpirals;

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
const deg = (radians: number): number => round((radians * 180) / Math.PI);
const near = (a: number, b: number, eps = 1e-9): boolean =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

/** The applet's spin controls only allow min, min+step, ..., max. */
function intOption(args: Json, key: string, range: Range, fallback: number): number {
  const v = num(args, key, fallback);
  if (!Number.isInteger(v) || v < range.min || v > range.max || (v - range.min) % range.step !== 0) {
    throw new Error(`"${key}" must be one of ${range.min}, ${range.min + range.step}, ..., ${range.max}`);
  }
  return v;
}

function boolOption(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`"${key}" must be true or false`);
  return v;
}

/** Board size is not a slider on the page, but the core's radius depends on it. */
function boardSize(C: DivergentSpirals, args: Json): { width: number; height: number } {
  const size = (key: "width" | "height"): number => {
    const v = num(args, key, C.CANVAS[key]);
    if (!Number.isInteger(v) || v < 1 || v > 4096) {
      throw new Error(`"${key}" must be an integer from 1 to 4096`);
    }
    return v;
  };
  return { width: size("width"), height: size("height") };
}

/** The ring radii, starts and sweeps the core actually draws. */
function geometry(C: DivergentSpirals, s: SpiralState) {
  const arcs = C.arcs(s);
  const snap = C.radius(s);
  const inc = C.ringStep(snap, s.opening, s.N);
  const sweep = s.overlap * s.opening;
  const arc = (a: Arc) => ({ radius: a.radius, startDeg: a.start, sweepDeg: a.sweep });
  return {
    canvas: { width: s.width, height: s.height, N: s.N, W: s.W },
    radius: snap,
    ringStep: inc,
    rings: arcs.length,
    openingDeg: s.opening,
    overlap: s.overlap,
    sweepDeg: sweep,
    fullCircle: sweep >= 360,
    arcsPerTurn: sweep / s.opening,
    firstArcs: arcs.slice(0, 5).map(arc),
    lastArc: arcs.length ? arc(arcs[arcs.length - 1]) : null,
    startsAdvanceByOpening: arcs.every((a, i) => i === 0 || a.start - arcs[i - 1].start === s.opening),
    radiiAdvanceByRingStep: arcs.every((a, i) => i === 0 || a.radius - arcs[i - 1].radius === inc),
    sweepsEqualOverlapTimesOpening: arcs.every((a) => a.sweep === sweep),
    spiralCurvesDrawn: 0,
  };
}

/** The sign and speed of the tick, and where `frames` ticks put the angle. */
function turn(C: DivergentSpirals, s: SpiralState, frames: number) {
  const describe = (fast: boolean) => ({
    stepRad: C.angleStep(fast),
    stepDeg: deg(C.angleStep(fast)),
    periodMs: C.period(fast),
    radiansPerMs: round(C.angularSpeed(fast)),
    degreesPerSecond: round((C.angularSpeed(fast) * 180 * 1000) / Math.PI),
  });
  const slow = describe(false);
  const fast = describe(true);
  const sign = s.clockwise ? 1 : -1;
  const start = s.angle;
  const end = C.advance(s, frames).angle;
  const one = C.advance(s, 1).angle;
  return {
    direction: s.clockwise ? "clockwise" : "counterclockwise",
    sign,
    frames,
    startAngleRad: round(start),
    endAngleRad: round(end),
    endAngleDeg: deg(end),
    expectedEndAngleRad: round(start + sign * frames * C.angleStep(s.fast)),
    stepIsSigned: near(one - start, sign * C.angleStep(s.fast)),
    slow,
    fast,
    fastOverSlowSpeed: round(fast.degreesPerSecond / slow.degreesPerSecond),
    matches34over9: near(fast.degreesPerSecond / slow.degreesPerSecond, 34 / 9),
  };
}

/** Rebuild a core state from the fields the page saved with Track.state. */
function savedState(C: DivergentSpirals, state: Json): SpiralState {
  const patch: Partial<SpiralState> = {};
  patch.angle = num(state, "angle", 0);
  for (const key of ["clockwise", "fast", "running"] as const) {
    patch[key] = boolOption(state, key, core().start()[key]);
  }
  patch.opening = intOption(state, "opening", C.OPENING, C.OPENING.initial);
  patch.overlap = intOption(state, "overlap", C.OVERLAP, C.OVERLAP.initial);

  // The page saves center = trunc(width/2), trunc(height/2), not the size.
  let width = C.CANVAS.width;
  let height = C.CANVAS.height;
  const savedCenter = state.center;
  if (savedCenter !== undefined && savedCenter !== null) {
    if (typeof savedCenter !== "object" || Array.isArray(savedCenter)) {
      throw new Error('saved "center" must be an object with x and y');
    }
    const c = savedCenter as Json;
    const x = num(c, "x");
    const y = num(c, "y");
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
      throw new Error('saved "center" needs non-negative integer x and y');
    }
    width = 2 * x;
    height = 2 * y;
  }
  patch.width = width;
  patch.height = height;
  return C.setOptions(C.start({ width, height }), patch);
}

export function actions(): GameActions {
  return {
    arc_geometry: {
      describe:
        "Report the exact arcs the applet draws at `opening` (10-90°, step 5) and `overlap` (1-11): the radius snapped to a multiple of 4×(N+1), the gap between rings, and that each ring starts Opening degrees after the last and spans Overlap×Opening degrees (a whole circle from 360° on). Every drawn curve has a constant radius, so the core draws no spiral at all — the spirals are the eye joining overlapping arcs.",
      args: '{ "opening": 45, "overlap": 4 }',
      run: (args) => {
        const C = core();
        const opening = intOption(args, "opening", C.OPENING, C.OPENING.initial);
        const overlap = intOption(args, "overlap", C.OVERLAP, C.OVERLAP.initial);
        const { width, height } = boardSize(C, args);
        const s = C.start({ opening, overlap, width, height });
        return {
          openingDeg: opening,
          overlap,
          geometry: geometry(C, s),
          note:
            `The core draws ${C.arcs(s).length} circular arcs of radius inc = ${C.ringStep(C.radius(s), opening, s.N)}, ` +
            `each swept ${overlap * opening}° and started ${opening}° after the previous one. ` +
            "No spiral curve is ever drawn; turning the stack is what makes two spirals seem to appear.",
        };
      },
    },
    rotation: {
      describe:
        "Compare the two turn directions and speeds over `frames` ticks (default 10): clockwise adds and counterclockwise subtracts π/9 radians per fast tick or π/17 per slow tick, waiting 10 ms or 20 ms, so fast turns 34/9 times as quickly. The arcs themselves are unchanged by the rotation — only the angle given to the whole picture changes.",
      args: '{ "clockwise": true, "fast": false, "frames": 10 }',
      run: (args) => {
        const C = core();
        const clockwise = boolOption(args, "clockwise", true);
        const fast = boolOption(args, "fast", false);
        const frames = num(args, "frames", 10);
        if (!Number.isInteger(frames) || frames < 0 || frames > 100000) {
          throw new Error('"frames" must be an integer from 0 to 100000');
        }
        const s = C.start({ clockwise, fast });
        const before = JSON.stringify(C.arcs(s));
        const after = JSON.stringify(C.arcs(C.advance(s, frames)));
        return {
          clockwise,
          fast,
          turn: turn(C, s, frames),
          arcsUnchangedByRotation: before === after,
          note:
            "One tick adds or subtracts π/9 (fast) or π/17 (slow) radians, then the whole stack is redrawn; " +
            "the arc radii, starts and sweeps stay exactly the same. The apparent inward and outward spirals " +
            "are a perception of that fixed drawing turning, not a change in the picture.",
        };
      },
    },
  };
}

/** The fields the page saved, plus the core's reading of the same picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Divergent Spirals state version ${stateVersion}`);
  const C = core();
  let s: SpiralState;
  let saved: SavedPosition;
  try {
    s = savedState(C, state);
    saved = C.position(s);
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note:
        "A saved Divergent Spirals position needs angle, clockwise, fast, running, opening (10-90° step 5), " +
        "overlap (1-11), and a center with x and y.",
    };
  }

  const g = geometry(C, s);
  const next = turn(C, s, 1);
  const speed = s.fast ? next.fast : next.slow;
  return {
    ...state,
    stateVersion,
    valid: true,
    reading: {
      ...saved,
      sweepDeg: g.sweepDeg,
      ringStep: g.ringStep,
      fullCircle: g.fullCircle,
      spiralCurvesDrawn: 0,
      rotation: {
        direction: next.direction,
        sign: next.sign,
        stepDeg: speed.stepDeg,
        periodMs: speed.periodMs,
        degreesPerSecond: speed.degreesPerSecond,
        nextTickDeg: deg(s.angle + next.sign * C.angleStep(s.fast)),
      },
    },
    savedMatchesCore: {
      angle: near(num(state, "angle", 0), saved.angle),
      center:
        state.center !== undefined &&
        typeof state.center === "object" &&
        (state.center as Json).x === saved.center.x &&
        (state.center as Json).y === saved.center.y,
      radius: state.radius === saved.radius,
      rings: state.rings === saved.rings,
    },
    geometry: g,
    note:
      `Track.state saved ${saved.rings} arcs on radii stepping by ${g.ringStep}, each starting ${s.opening}° ` +
      `after the last and spanning ${g.sweepDeg}°. The picture turns ${next.direction} by ` +
      `${speed.stepDeg}° every ${speed.periodMs} ms; no spiral is drawn, so the effect is entirely in the eye.`,
  };
}
