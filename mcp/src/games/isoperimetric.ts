/*
 * run_game_logic actions and saved-position reader for Isoperimetric.
 *
 * The real core is isoperimetric/isoperimetric-core.js, copied into
 * src/generated/cores/ at build time. It holds the geometry of the three
 * families between A and B: one big semicircle / broken line / freehand curve
 * against n+1 small copies, one on each sub-interval that the break points cut
 * out of AB. Every number below is measured by that core, never re-derived
 * here. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Lengths = { red: number; blue: number };

interface State {
  width: number;
  height: number;
  mode: string;
  n: number;
  alternate: boolean;
  reflect: boolean;
  points: Pt[];
  apex: Pt;
  spline: Pt[];
}

/** Exactly the plain data Core.position(state) writes for Track.state. */
interface Saved {
  mode: string;
  n: number;
  alternate: boolean;
  reflect: boolean;
  width: number;
  height: number;
  points: number[];
  apex: Pt;
  spline: number[];
}

interface Core {
  WIDTH: number;
  HEIGHT: number;
  N_MIN: number;
  N_MAX: number;
  MODES: string[];
  endpoints(s: State): { A: Pt; B: Pt; L: number };
  start(o?: { width?: number; height?: number; mode?: string; n?: number }): State;
  setFlag(s: State, key: string, value: boolean): State;
  move(s: State, kind: string, index: number, p: Pt): State;
  cuts(s: State): number[];
  lengths(s: State): Lengths;
  result(s: State): null;
  position(s: State): Saved;
}

const core = (): Core => cores.isoperimetric.IsoperimetricCore as unknown as Core;

const round = (v: number, digits = 3): number => Number(v.toFixed(digits));
const pt = (p: Pt): Pt => ({ x: round(p.x), y: round(p.y) });
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const tolFor = (v: number): number => Math.max(1e-6, Math.abs(v) * 1e-9);
const equalLengths = (g: Lengths): boolean => Math.abs(g.red - g.blue) <= tolFor(g.red);
const diametersOf = (cuts: number[]): number[] =>
  cuts.slice(1).map((x, i) => round(x - cuts[i]));

/* --------------------------------------------------------------- validation */

function modeArg(C: Core, src: Json, fallback: string): string {
  const v = src.mode;
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "string" || C.MODES.indexOf(v) < 0) {
    throw new Error(`"mode" must be one of ${C.MODES.join(", ")}`);
  }
  return v;
}

function countArg(C: Core, src: Json, fallback: number): number {
  const v = Math.trunc(num(src, "n", fallback));
  if (v < C.N_MIN || v > C.N_MAX) {
    throw new Error(`"n" must be a whole number from ${C.N_MIN} to ${C.N_MAX}`);
  }
  return v;
}

function flagArg(src: Json, key: "alternate" | "reflect"): boolean {
  const v = src[key];
  if (v === undefined || v === null) return false;
  if (typeof v !== "boolean") throw new Error(`"${key}" must be true or false`);
  return v;
}

/** The applet's 600 x 400 board by default; keep it a sensible drawing size. */
function setup(C: Core, args: Json): State {
  const width = Math.trunc(num(args, "width", C.WIDTH));
  const height = Math.trunc(num(args, "height", C.HEIGHT));
  if (width < 120 || width > 2000) throw new Error('"width" must be a whole number from 120 to 2000');
  if (height < 120 || height > 2000) throw new Error('"height" must be a whole number from 120 to 2000');
  const mode = modeArg(C, args, "arcs");
  const n = countArg(C, args, 3);
  let s = C.start({ width, height, mode, n });
  s = C.setFlag(s, "alternate", flagArg(args, "alternate"));
  s = C.setFlag(s, "reflect", flagArg(args, "reflect"));
  return s;
}

/**
 * Track.state saved x-coordinates for the break points (they sit on AB) and
 * y-coordinates for the 21 freehand handles (their x is fixed). Rebuild the
 * full core state from those fields: the round trip through Core.position
 * reproduces the saved data exactly.
 */
function restore(C: Core, raw: Json): { state: State; saved: Saved } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("saved Isoperimetric position must be an object");
  }
  const mode = modeArg(C, raw, "arcs");
  const n = countArg(C, raw, 3);
  const width = Math.trunc(num(raw, "width", C.WIDTH));
  const height = Math.trunc(num(raw, "height", C.HEIGHT));
  if (width <= 60 || width > 5000 || height <= 0 || height > 5000) {
    throw new Error("saved width and height must be positive board sizes");
  }
  const base = C.start({ width, height, mode, n });
  const { A } = C.endpoints(base);

  const xs = numArray(raw, "points");
  if (xs.length !== n) throw new Error(`saved "points" must hold ${n} x-coordinates`);
  const ys = numArray(raw, "spline");
  if (ys.length !== base.spline.length) {
    throw new Error(`saved "spline" must hold ${base.spline.length} y-coordinates`);
  }
  const rawApex = raw.apex;
  if (!rawApex || typeof rawApex !== "object" || Array.isArray(rawApex)) {
    throw new Error('saved "apex" must be an object with x and y');
  }
  const apex: Pt = {
    x: num(rawApex as Json, "x"),
    y: num(rawApex as Json, "y"),
  };

  const state: State = {
    ...base,
    mode,
    n,
    width,
    height,
    alternate: flagArg(raw, "alternate"),
    reflect: flagArg(raw, "reflect"),
    points: xs.map((x) => ({ x, y: A.y })),
    apex,
    spline: base.spline.map((p, i) => ({ x: p.x, y: ys[i] })),
  };
  const saved: Saved = {
    mode,
    n,
    alternate: state.alternate,
    reflect: state.reflect,
    width,
    height,
    points: xs.map((x) => round(x)),
    apex: { x: round(apex.x), y: round(apex.y) },
    spline: ys.map((y) => round(y)),
  };
  return { state, saved };
}

/* ------------------------------------------------------------------ actions */

export function actions(): GameActions {
  return {
    families: {
      describe:
        "Build the isoperimetric picture from the applet's settings (mode arcs, lines or spline; n break points from 1 to 15; optional width, height, alternate and reflect) and measure it with the real core. It reports the red length, the total blue length and the diameters cut out of AB, then checks every family at every break-point count: each blue piece is a copy of the red curve scaled by its share of AB, so the two totals always agree.",
      args: '{ "mode": "arcs", "n": 3, "width": 600, "height": 400 }',
      run: (args) => {
        const C = core();
        const s = setup(C, args);
        const { A, B, L } = C.endpoints(s);
        const cuts = C.cuts(s);
        const ds = diametersOf(cuts);
        const measured = C.lengths(s);

        const byMode = C.MODES.map((m) => {
          let t = C.start({ width: s.width, height: s.height, mode: m, n: s.n });
          t = C.setFlag(t, "alternate", s.alternate);
          t = C.setFlag(t, "reflect", s.reflect);
          const g = C.lengths(t);
          return {
            mode: m,
            red: round(g.red, 6),
            blue: round(g.blue, 6),
            difference: round(g.red - g.blue, 9),
            lengthsEqual: equalLengths(g),
          };
        });

        let cases = 0;
        let failures = 0;
        for (const m of C.MODES) {
          for (let k = C.N_MIN; k <= C.N_MAX; k++) {
            cases++;
            const g = C.lengths(C.start({ width: s.width, height: s.height, mode: m, n: k }));
            if (!equalLengths(g)) failures++;
          }
        }

        return {
          settings: {
            mode: s.mode, n: s.n, width: s.width, height: s.height,
            alternate: s.alternate, reflect: s.reflect,
          },
          endpoints: { A: pt(A), B: pt(B), AB: round(L) },
          cuts: cuts.map((x) => round(x)),
          pieces: ds.length,
          diameters: ds,
          diametersSum: round(sum(ds)),
          lengths: {
            red: round(measured.red, 6),
            blue: round(measured.blue, 6),
            difference: round(measured.red - measured.blue, 9),
            equal: equalLengths(measured),
          },
          byMode,
          sweep: {
            families: C.MODES.length,
            countsPerFamily: C.N_MAX - C.N_MIN + 1,
            cases,
            failures,
            allEqual: failures === 0,
          },
          arcs: s.mode === "arcs" ? {
            bigSemicircleArc: round((Math.PI * L) / 2, 6),
            smallSemicirclesTotal: round((Math.PI * sum(ds)) / 2, 6),
            arcPerUnitDiameter: Math.PI / 2,
            diametersAddToAB: Math.abs(sum(ds) - L) < 0.01,
          } : null,
          note:
            "A semicircle on diameter d has arc (pi/2)d, and the small diameters tile AB, so their arcs add to the one big arc. The broken-line and freehand families are the same scaling argument: every blue piece is the whole red curve reduced by d/AB.",
        };
      },
    },

    drag: {
      describe:
        "Move one handle through the real core and re-measure: kind point (break point, with index 0..n-1 and a new x), apex (new x and y), or spline (freehand point 0..20 and a new y). The core clamps the handle to its neighbours or the board and recomputes both curves, showing that a drag only redistributes the blue copies along AB while their total still matches the red curve.",
      args: '{ "mode": "arcs", "n": 3, "kind": "point", "index": 0, "x": 300 }',
      run: (args) => {
        const C = core();
        const s = setup(C, args);
        const { A, B } = C.endpoints(s);
        const rawKind = args.kind;
        const kind = rawKind === undefined || rawKind === null ? "point" : String(rawKind);
        if (["point", "apex", "spline"].indexOf(kind) < 0) {
          throw new Error('"kind" must be "point", "apex" or "spline"');
        }
        const index = Math.trunc(num(args, "index", 0));
        if (kind === "point" && (index < 0 || index >= s.n)) {
          throw new Error(`"index" must be 0..${s.n - 1} for a break point`);
        }
        if (kind === "spline" && (index < 0 || index >= s.spline.length)) {
          throw new Error(`"index" must be 0..${s.spline.length - 1} for a freehand point`);
        }

        let requested: Pt;
        let moved: State;
        let placed: Pt;
        if (kind === "point") {
          requested = { x: num(args, "x", s.points[index].x + 8), y: A.y };
          moved = C.move(s, "point", index, requested);
          placed = moved.points[index];
        } else if (kind === "apex") {
          requested = { x: num(args, "x", s.apex.x), y: num(args, "y", s.apex.y) };
          moved = C.move(s, "apex", 0, requested);
          placed = moved.apex;
        } else {
          requested = { x: s.spline[index].x, y: num(args, "y", s.spline[index].y) };
          moved = C.move(s, "spline", index, requested);
          placed = moved.spline[index];
        }

        const before = C.lengths(s);
        const after = C.lengths(moved);
        const wasClamped = Math.abs(requested.x - placed.x) > 1e-9 ||
          Math.abs(requested.y - placed.y) > 1e-9;
        return {
          settings: {
            mode: s.mode, n: s.n, width: s.width, height: s.height,
            alternate: s.alternate, reflect: s.reflect,
          },
          endpoints: { A: pt(A), B: pt(B), AB: round(B.x - A.x) },
          handle: {
            kind,
            index: kind === "apex" ? null : index,
            requested: pt(requested),
            placed: pt(placed),
            clamped: wasClamped,
          },
          cutsBefore: C.cuts(s).map((x) => round(x)),
          cutsAfter: C.cuts(moved).map((x) => round(x)),
          diametersBefore: diametersOf(C.cuts(s)),
          diametersAfter: diametersOf(C.cuts(moved)),
          lengthsBefore: {
            red: round(before.red, 6), blue: round(before.blue, 6),
            difference: round(before.red - before.blue, 9), equal: equalLengths(before),
          },
          lengthsAfter: {
            red: round(after.red, 6), blue: round(after.blue, 6),
            difference: round(after.red - after.blue, 9), equal: equalLengths(after),
          },
          redChanged: Math.abs(after.red - before.red) > 1e-6,
          blueChanged: Math.abs(after.blue - before.blue) > 1e-6,
          note:
            "Moving a break point changes the individual pieces but not their total, because the diameters still add to AB. Moving the apex of the line family changes the red V and all its little copies together; moving a freehand handle reshapes the red curve and its copies together.",
        };
      },
    },
  };
}

/* ------------------------------------------------------------------ position */

/** What the core can say about the saved position the page sent with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Isoperimetric state version ${stateVersion}`);
  }
  const C = core();
  const { state: s, saved } = restore(C, state);
  const { A, B, L } = C.endpoints(s);
  const cuts = C.cuts(s);
  const ds = diametersOf(cuts);
  const g = C.lengths(s);

  const reading: Record<string, unknown> = {
    ...saved,
    stateVersion,
    valid: true,
    board: { A: pt(A), B: pt(B), AB: round(L) },
    cuts: cuts.map((x) => round(x)),
    pieces: ds.length,
    diameters: ds,
    diametersSum: round(sum(ds)),
    redLength: round(g.red, 6),
    blueLength: round(g.blue, 6),
    difference: round(g.red - g.blue, 9),
    lengthsEqual: equalLengths(g),
    finished: false,
    outcome: C.result(s),
    note:
      "Track.state saved the mode, n, the break-point x-coordinates on AB, the apex and the 21 freehand y-coordinates. The core rebuilds that picture and measures both curves; points are x-only because they lie on the baseline and spline entries are y-only because those handles move vertically. This is a demonstration with no win or loss.",
  };
  if (s.mode === "arcs") {
    reading.semicircles = {
      bigArc: round((Math.PI * L) / 2, 6),
      smallArcsTotal: round((Math.PI * sum(ds)) / 2, 6),
      arcPerUnitDiameter: Math.PI / 2,
      diametersAddToAB: Math.abs(sum(ds) - L) < 0.01,
    };
  }
  return reading;
}
