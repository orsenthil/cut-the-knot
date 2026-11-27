/*
 * run_game_logic actions and saved-position reader for Crossed Lines of
 * Constant Width (Bogomolny's CWCrossedLines applet).
 *
 * The real core is cw-crossed-lines/cw-crossed-lines-core.js, copied into
 * src/generated/cores/ at build time. Three lines meet at A, B and C; a point
 * P on BC is swung six times about B, A, C, B, A, C, landing back on itself.
 * Each swing is an arc of a circle, so the six radii are the distances from
 * each centre to P, and the closing gap is zero for every triangle and every
 * coefficient. When P lies outside the segment BC the traced curve is convex
 * and has the same width in every direction; between B and C it bends inward
 * and the width changes. Every number below is measured by the real core.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cw-crossed-lines"].CwCrossedLinesCore;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;
type Point = { x: number; y: number };

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });

/** Read a point argument, falling back to the applet's default when absent. */
function readPoint(value: unknown, name: string, fallback: Point): Point {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be { "x": ..., "y": ... }`);
  }
  const o = value as Json;
  if (o.x === undefined || o.x === null || o.y === undefined || o.y === null) {
    throw new Error(`${name} must have finite x and y`);
  }
  const x = Number(o.x), y = Number(o.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${name} must have finite x and y`);
  }
  return { x, y };
}

/** Build the core state from arguments, checking the triangle is not degenerate. */
function buildState(args: Json): State {
  const C = core();
  const A = readPoint(args.A, "A", C.START_A);
  const B = readPoint(args.B, "B", C.START_B);
  const Cpt = readPoint(args.C, "C", C.START_C);
  const area2 = C.cross(C.sub(B, A), C.sub(Cpt, A));
  if (Math.abs(area2) < 1e-9) {
    throw new Error("A, B and C must form a non-degenerate triangle (not collinear or coincident)");
  }
  // The page offers P on the slider range [-1.5, 2.5]; the core enforces it.
  const coefP = C.clampCoef(num(args, "coefP", C.START_COEF));
  return C.start({ A, B, C: Cpt, coefP });
}

/** How many radii are genuinely different, with a tolerance for float noise. */
function distinctRadii(radii: number[]): number {
  const seen: number[] = [];
  for (const r of radii) {
    if (!seen.some((v) => Math.abs(v - r) < 1e-6)) seen.push(r);
  }
  return seen.length;
}

/** The page's own readout of where P sits relative to B and C. */
function placeOfP(t: number): string {
  if (t < 0) return "past C";
  if (t > 1) return "past B";
  if (Math.abs(t) < 0.025) return "at C";
  if (Math.abs(t - 1) < 0.025) return "at B";
  return "between B and C";
}

function controlsOf(s: State) {
  const C = core();
  return { A: pt(s.A), B: pt(s.B), C: pt(s.C), P: pt(C.controls(s).P), coefP: s.coefP, place: placeOfP(s.coefP) };
}

export function actions(): GameActions {
  return {
    "six-swings": {
      describe:
        "Take the three lines through A, B and C (defaults to the applet's starting triangle) and a point P on BC at `coefP`, then report the six swings about B, A, C, B, A, C. Each swing is an arc of a circle, so the six radii are listed with how many are distinct, together with the gap after the sixth swing: it is zero, confirming the curve closes for every triangle and every P ('may be six' radii).",
      args: '{ "A": { "x": 200, "y": 125 }, "B": { "x": 240, "y": 187.5 }, "C": { "x": 300, "y": 125 }, "coefP": -0.2 }',
      run: (args) => {
        const C = core();
        const s = buildState(args);
        const g = C.compute(s);
        return {
          controls: controlsOf(s),
          centres: g.arcs.map((a) => a.name),
          endpoints: [g.Q, g.R, g.Pp, g.Qp, g.Rp, g.P6].map(pt),
          radii: g.radii.map(round),
          distinctRadii: distinctRadii(g.radii),
          closureError: g.closureError,
          closes: g.closureError < 1e-8,
          note: "Six rotations about B, A, C, B, A, C carry P from line to line and land exactly back on it (closing gap " +
            g.closureError.toExponential(2) + " board units). Each arc has radius equal to its centre's distance from P, so " +
            distinctRadii(g.radii) + " different radii are possible — the page's 'may be six'.",
        };
      },
    },
    width: {
      describe:
        "For the curve drawn from A, B, C and `coefP`, measure its width in `samples` directions (default 360) and check with `perArc` points per arc (default 90) whether every turn bends the same way. A convex curve here has the same width in every direction while a curve that bends inward has a width that changes: the two cases are told apart by the reported spread. Move P between B and C to see the non-convex case.",
      args: '{ "A": { "x": 200, "y": 125 }, "B": { "x": 240, "y": 187.5 }, "C": { "x": 300, "y": 125 }, "coefP": -0.2, "samples": 360, "perArc": 90 }',
      run: (args) => {
        const C = core();
        const s = buildState(args);
        const samples = Math.trunc(num(args, "samples", 360));
        const perArc = Math.trunc(num(args, "perArc", 90));
        if (samples < 8 || samples > 5000) throw new Error("samples must be between 8 and 5000");
        if (perArc < 2 || perArc > 500) throw new Error("perArc must be between 2 and 500");
        const convex = C.isConvex(s, perArc);
        const w = C.widthRange(s, samples);
        const constantWidth = convex && w.spread < 1e-6;
        return {
          controls: controlsOf(s),
          convex,
          width: { min: round(w.min), max: round(w.max), spread: w.spread },
          constantWidth,
          samples,
          perArc,
          verdict: convex
            ? (constantWidth ? "convex and constant width" : "convex but the measured width varies")
            : "non-convex: the width changes with direction",
          note: "P is " + placeOfP(s.coefP) + ". " +
            (convex
              ? "The traced curve bends the same way throughout and its width is the same in every direction (spread " +
                w.spread.toExponential(2) + " units)."
              : "The curve bends inward somewhere, so its width ranges from " + round(w.min) + " to " +
                round(w.max) + " units (spread " + round(w.spread) + "), and it is not constant width."),
        };
      },
    },
  };
}

/** Track.state saves the controls and animation counters; the core rebuilds the curve from them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Crossed Lines state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Crossed Lines position must be an object");
  }
  const C = core();
  const A = readPoint(state.A, "A", C.START_A);
  const B = readPoint(state.B, "B", C.START_B);
  const Cpt = readPoint(state.C, "C", C.START_C);
  const coefP = C.clampCoef(num(state, "coefP", C.START_COEF));
  const s = C.start({ A, B, C: Cpt, coefP });
  const g = C.compute(s);
  const w = C.widthRange(s, 360);
  const convex = C.isConvex(s, 90);
  return {
    stateVersion,
    saved: { ...state },
    controls: controlsOf(s),
    core: {
      radii: g.radii.map(round),
      distinctRadii: distinctRadii(g.radii),
      closureError: g.closureError,
      closes: g.closureError < 1e-8,
      convex,
      width: { min: round(w.min), max: round(w.max), spread: w.spread },
      constantWidth: convex && w.spread < 1e-6,
    },
    result: C.result(s),
    note: "Track.state saved the three corners, P's coefficient and the view/animation counters in board units. " +
      "The core redraws the six arcs from those controls: P is " + placeOfP(s.coefP) + ", the curve " +
      (convex ? "is convex and has constant width" : "bends inward, so its width changes with direction") + ".",
  };
}
