/*
 * run_game_logic actions and saved-position reader for cw-star.
 *
 * The real core is cw-star/cw-star-core.js, copied into src/generated/cores/
 * at build time. Its verticesFor/arcs/boundary/widths are the applet's own
 * star construction and its rolling motion is startRoll/rollStep. Every
 * number below is measured by that core. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cw-star"].CwStarCore;
type Core = ReturnType<typeof core>;
type StarState = ReturnType<Core["start"]>;
type Slider = keyof Core["LIMITS"];
type Point = { x: number; y: number };

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const degrees = (radians: number): number => round((radians * 180) / Math.PI);

/** A slider value must be an integer inside the applet's own AWT range. */
function slider(args: Json, key: Slider, fallback: number): number {
  const value = num(args, key, fallback);
  if (!Number.isInteger(value)) {
    throw new Error(`argument "${key}" must be an integer, got ${value}`);
  }
  const { min, max } = core().LIMITS[key];
  if (value < min || value > max) {
    throw new Error(`argument "${key}" must be in ${min}..${max}, got ${value}`);
  }
  return value;
}

function options(args: Json) {
  const C = core();
  return {
    steps: slider(args, "steps", C.LIMITS.steps.initial),
    length: slider(args, "length", C.LIMITS.length.initial),
    addOn: slider(args, "addOn", C.LIMITS.addOn.initial),
    speed: slider(args, "speed", C.LIMITS.speed.initial),
  };
}

function finite(value: unknown, name: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a finite number`);
  return n;
}

/** Saved/dragged vertices may be objects or [x, y] pairs, in viewBox units. */
function readPoints(value: unknown, name: string): Point[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new Error(`argument "${name}" must be an array of points`);
  return value.map((p, i): Point => {
    if (Array.isArray(p) && p.length === 2) {
      return { x: finite(p[0], `${name}[${i}][0]`), y: finite(p[1], `${name}[${i}][1]`) };
    }
    if (p && typeof p === "object") {
      const o = p as Json;
      if (o.x === undefined || o.x === null || o.y === undefined || o.y === null) {
        throw new Error(`${name}[${i}] must have finite x and y`);
      }
      return { x: finite(o.x, `${name}[${i}].x`), y: finite(o.y, `${name}[${i}].y`) };
    }
    throw new Error(`${name}[${i}] must be { "x": ..., "y": ... } or [x, y]`);
  });
}

/** Build the core position, optionally replacing the fresh star with saved vertices. */
function build(args: Json): StarState {
  const C = core();
  const state = C.start(options(args));
  const saved = readPoints(args.points, "points");
  if (!saved) return state;
  const n = C.stepsToN(state.steps);
  if (saved.length !== n) {
    throw new Error(`points must have ${n} vertices for steps=${state.steps}, got ${saved.length}`);
  }
  return { ...state, points: saved };
}

/** Every geometric reading comes from the core's arcs, boundary and widths. */
function readings(s: StarState) {
  const C = core();
  const n = s.points.length;
  const d = Math.floor(n / 2);
  const base = C.widths(C.boundary(s, false), 72);
  const wide = C.widths(C.boundary(s, true), 72);
  const edges = s.points.map((p: Point, i: number) => {
    const q = s.points[(i + 1) % n];
    return round(Math.hypot(p.x - q.x, p.y - q.y));
  });
  return {
    star: {
      vertices: n,
      odd: n % 2 === 1,
      starPolygon: `{${n}/${d}}`,
      sideLength: s.length,
    },
    widths: {
      base: s.length,
      widened: s.length + 2 * s.addOn,
      measuredBase: { min: round(base.min), max: round(base.max) },
      measuredWidened: { min: round(wide.min), max: round(wide.max) },
      sampledDirections: 72,
    },
    arcRadii: { base: s.length, outer: s.length + s.addOn, gap: s.addOn },
    arcs: C.arcs(s).slice(0, 5).map((a: { index: number; start: number; sweep: number; radius: number; outerRadius: number; gapRadius: number }) => ({
      index: a.index,
      startDeg: a.start,
      sweepDeg: a.sweep,
      radius: a.radius,
      outerRadius: a.outerRadius,
      gapRadius: a.gapRadius,
    })),
    starEdgeLengths: edges.slice(0, 5),
    status: C.describe(s),
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "Build the constant-width star from the four sliders: `steps` gives n = 3 + 2*steps odd vertices, `length` L is both the star's side and the base width, `addOn` a makes the wider curve L + 2a, and `speed` only matters when rolling. Reports the {n/d} star, both widths (target and measured in 72 directions), the arc radii L, L + a and a, a sample of arc angles in whole degrees, and the core's status line.",
      args: '{ "steps": 1, "length": 100, "addOn": 40 }',
      run: (args) => {
        const C = core();
        const s = C.start(options(args));
        return {
          sliders: { steps: s.steps, length: s.length, addOn: s.addOn, speed: s.speed },
          ...readings(s),
          vertexSample: s.points.slice(0, 5).map(pt),
          note:
            "Odd n and crossing star sides make the arcs about the vertices enclose a curve of width L; widening each arc by a and filling each vertex gap with an arc of radius a gives width L + 2a. Measured widths can exceed the target by a little because the core rounds arc angles to whole Java degrees and nudges one vertex by one unit.",
        };
      },
    },
    roll: {
      describe:
        "Roll the curve `rolls` steps: each step turns every vertex except the pivot by `speed` degrees about that vertex, then slides the figure back between the same guide lines. An optional `points` array of {x,y} pairs (or [x,y]) starts from a dragged position; reports the pivot, the angle still to turn, the guide lines and the status line.",
      args: '{ "steps": 1, "length": 100, "addOn": 40, "speed": 5, "rolls": 3 }',
      run: (args) => {
        const C = core();
        const rolls = num(args, "rolls", 3);
        if (!Number.isInteger(rolls) || rolls < 0 || rolls > 200) {
          throw new Error(`argument "rolls" must be an integer in 0..200, got ${rolls}`);
        }
        let s = C.startRoll(build(args));
        for (let i = 0; i < rolls; i++) s = C.rollStep(s);
        return {
          rolls,
          pivotVertex: s.currentIndex,
          angleLeftDeg: degrees(s.angleToGo),
          guideLines: { x: s.xFixed, y: s.yFixed },
          pointSample: s.points.slice(0, 5).map(pt),
          status: C.describe(s),
          note:
            "Rolling never changes the shape: it only turns the vertices about the current contact vertex and translates back, so the widths stay L (or L + 2a) at every step.",
        };
      },
    },
  };
}

/**
 * Track.state saves the four sliders and the vertex coordinates in viewBox
 * units. The core re-measures the saved figure itself, so a dragged star is
 * reported as it stands rather than as the fresh star the sliders would make.
 */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported cw-star state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved cw-star position must be an object");
  }

  const C = core();
  const steps = slider(state, "steps", C.LIMITS.steps.initial);
  const length = slider(state, "length", C.LIMITS.length.initial);
  const addOn = slider(state, "addOn", C.LIMITS.addOn.initial);
  const speed = slider(state, "speed", C.LIMITS.speed.initial);
  const saved = readPoints(state.points, "points");
  if (!saved || saved.length === 0) {
    throw new Error("saved cw-star position must include a non-empty points array");
  }

  const fresh = C.start({ steps, length, addOn, speed });
  const here = { ...fresh, points: saved };
  const n = C.stepsToN(steps);
  const unchanged = saved.length === n && saved.every((p, i) => {
    const q = fresh.points[i];
    return Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6;
  });

  return {
    stateVersion,
    saved: {
      steps,
      length,
      addOn,
      speed,
      vertices: saved.length,
      points: saved.map(pt),
    },
    ...readings(here),
    freshStarComparison: {
      expectedVertices: n,
      countMatches: saved.length === n,
      pointsUnchanged: unchanged,
    },
    note:
      "Track.state saved the sliders and the vertices; the core reads arcs, widths and status from those saved vertices, so a dragged position is measured as drawn. The base curve has width L and the wider one L + 2a, with small overshoots only from whole-degree arc rounding.",
  };
}
