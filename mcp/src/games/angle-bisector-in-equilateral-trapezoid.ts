/*
 * run_game_logic actions and saved-position reader for Angle Bisector in an
 * Equilateral Trapezoid (USAMO 2009/5).
 *
 * ABCD is an isosceles trapezoid with AB || CD inscribed in a circle. G is
 * inside triangle BCD; rays AG and BG meet the circle again at P and Q, and
 * the line through G parallel to AB meets BD and BC at R and S. The theorem
 * says PQRS is cyclic exactly when BG bisects angle CBD. All numbers below
 * come from the real core in angle-bisector-in-equilateral-trapezoid/,
 * copied into src/generated/cores/ at build time.
 *
 * Coordinates are board units from the page's 400 x 280 viewBox, y down.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["angle-bisector-in-equilateral-trapezoid"].AngleBisectorInEquilateralTrapezoidCore;

type Point = { x: number; y: number };
type State = ReturnType<ReturnType<typeof core>["start"]>;

const round = (v: number, digits = 4): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const deg = (radians: number): number => round((radians * 180) / Math.PI, 3);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;

/** Tool args and the page both use {x, y}; accept [x, y] too. */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value) && value.length === 2) {
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`${label} must be a point [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} needs finite x and y`);
  return { x, y };
}

function savedPoint(value: unknown): { x: number; y: number } | null {
  try { return pt(readPoint(value, "saved point")); } catch { return null; }
}

function readOptions(input: Json) {
  const defaults = core().start({}).options as Json;
  const given = input.options && typeof input.options === "object" ? input.options as Json : {};
  return {
    names: given.names === undefined ? defaults.names !== false : Boolean(given.names),
    hint: given.hint === undefined ? defaults.hint === true : Boolean(given.hint),
    mode: given.mode === "free" || given.mode === "circle" ? given.mode : String(defaults.mode || "circle"),
  };
}

/** Rebuild a full core state: omitted vertices use the page's opening one. */
function readState(input: Json): State {
  const home = core().start({});
  const s = {
    A: input.A === undefined ? home.A : readPoint(input.A, "A"),
    B: input.B === undefined ? home.B : readPoint(input.B, "B"),
    C: input.C === undefined ? home.C : readPoint(input.C, "C"),
    D: input.D === undefined ? home.D : readPoint(input.D, "D"),
    G: input.G === undefined ? home.G : readPoint(input.G, "G"),
    options: readOptions(input),
    explored: input.explored === true,
  };
  return s as State;
}

function geometry(input: Json) {
  const K = core();
  const state = readState(input);
  const g = K.geometry(state);
  if (!g.valid) {
    throw new Error(
      `those points do not make a drawable trapezoid (${String(g.reason)}): ` +
      "keep A, B, C, D, G at least 2 units apart and A, B, C off one line",
    );
  }
  return { K, state, g };
}

/** The whole labelled construction, with the page's own names for everything. */
function construction(input: Json) {
  const { K, g } = geometry(input);
  const m = K.measurements(g) as Json;
  const cl = K.claims(g) as Json;
  const circle = g.circle as { c: Point; r: number };
  return {
    valid: true,
    vertices: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D), G: pt(g.G) },
    circle: { center: pt(circle.c), radius: round(circle.r) },
    points: { P: pt(g.P), Q: pt(g.Q), R: pt(g.R), S: pt(g.S), T: pt(g.T) },
    anglesDegrees: {
      CBD: deg(Number(m.angleCBG) + Number(m.angleGBD)),
      CBG: deg(Number(m.angleCBG)),
      GBD: deg(Number(m.angleGBD)),
      difference: deg(Number(m.diff)),
    },
    bisectsAngleCBD: cl.bisects === true,
    cyclicPQRS: cl.cyclic === true,
    cyclicResidual: round(Number(m.cyclicResidual), 8),
    bisectorFoot: pt(K.bisectorFoot(g) as Point),
    note: "Rays AG and BG meet the circumcircle again at P and Q; the horizontal through G meets BD at R and BC at S, and T = CD ∩ BQ is the hint point. The circle through P, Q, R is drawn only when S lies on it too.",
  };
}

/** The USAMO iff: BG halves angle CBD precisely when P, Q, R, S are cyclic. */
function equivalence(input: Json) {
  const { K, state } = geometry(input);
  let s = state;
  const t = input.t === undefined ? null : num(input, "t");
  if (t !== null) {
    if (!Number.isFinite(t) || t < 0 || t > 1) throw new Error('"t" must be a number from 0 to 1');
    s = K.placeOnBisector(s, t) as State; // fraction of the way from B to CD
  }
  const m = K.measurements(s) as Json;
  const cl = K.claims(s) as Json;
  const bisects = cl.bisects === true;
  const cyclic = cl.cyclic === true;
  return {
    valid: true,
    G: pt(s.G),
    t: t === null ? null : Math.max(0.02, Math.min(0.98, t)),
    anglesDegrees: {
      CBG: deg(Number(m.angleCBG)),
      GBD: deg(Number(m.angleGBD)),
      difference: deg(Number(m.diff)),
    },
    bisects,
    cyclic,
    equivalenceHolds: cl.iff === true,
    cyclicResidual: round(Number(m.cyclicResidual), 8),
    qOffsetToCentre: round(Number(m.qOffset), 4),
    hintUnlocked: cl.finished === true,
    note: bisects
      ? "BG bisects angle CBD and P, Q, R, S are concyclic: both sides of the USAMO 2009/5 equivalence hold, and Q sits over the circle's centre so the applet's hint is available."
      : cyclic
        ? "P, Q, R, S are concyclic while BG does not bisect angle CBD — this cannot happen for a valid configuration; check the points."
        : "Neither condition holds: BG misses the bisector and S is off the circle through P, Q, R. Pass t (e.g. 0.55) to put G on the bisector and watch both become true together.",
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For an isosceles trapezoid A, B, C, D (AB parallel to CD) and a point G inside triangle BCD, in board units (400 x 280, y down), report the circumcircle, P (ray AG meets it again), Q (ray BG meets it again), R = BD ∩ (line through G parallel to AB), S = BC ∩ that line, the hint point T, the angles at B, whether BG bisects angle CBD, the cyclic residual of P, Q, R, S and the bisector foot on CD. Omit any point to use the illustration's opening position.",
      args: '{ "A": [120, 168], "B": [280, 168], "C": [240, 93], "D": [160, 93], "G": [227, 118] }',
      run: (args) => construction(args),
    },
    usamo_equivalence: {
      describe:
        "Check USAMO 2009/5 for the trapezoid and G: report the two halves of angle CBD, whether BG bisects it, whether P, Q, R, S are cyclic (the residual of S from the circle through P, Q, R), and whether the two agree. Pass t from 0 to 1 to put G that fraction of the way from B to the bisector's foot on CD (0.55 is the page's button).",
      args: '{ "A": [120, 168], "B": [280, 168], "C": [240, 93], "D": [160, 93], "t": 0.55 }',
      run: (args) => equivalence(args),
    },
  };
}

/** The page's saved fields, plus a fresh core reading of the same position. */
export function position(state: Json, stateVersion: number): unknown {
  const K = core();
  if (stateVersion !== 1) {
    throw new Error(`unsupported Angle Bisector in an Equilateral Trapezoid state version ${stateVersion}`);
  }
  const saved = {
    A: savedPoint(state.A), B: savedPoint(state.B), C: savedPoint(state.C),
    D: savedPoint(state.D), G: savedPoint(state.G),
    P: savedPoint(state.P), Q: savedPoint(state.Q), R: savedPoint(state.R),
    S: savedPoint(state.S), T: savedPoint(state.T),
    circle: state.circle && typeof state.circle === "object"
      ? { c: savedPoint((state.circle as Json).c), r: round(Number((state.circle as Json).r)) }
      : null,
    options: readOptions(state),
  };
  const s = readState(state);
  const g = K.geometry(s);
  if (!g.valid) {
    return {
      stateVersion,
      ...saved,
      valid: false,
      note: "The saved points cannot be drawn: keep them apart and A, B, C off one line.",
    };
  }
  const built = construction(state);
  const cl = K.claims(s) as Json;
  const check = equivalence(state);
  const derived = built as Json & { points: Record<string, { x: number; y: number } | null> };
  const deviations = ["P", "Q", "R", "S"]
    .map((name) => {
      const a = savedPoint(state[name]), b = derived.points[name];
      return a && b ? (K.dist(a, b) as number) : null;
    })
    .filter((d): d is number => d !== null);
  return {
    stateVersion,
    ...saved,
    valid: true,
    reading: {
      ...built,
      ...check,
      bisects: cl.bisects === true,
      cyclic: cl.cyclic === true,
      equivalenceHolds: cl.iff === true,
    },
    savedDerivedPointsMatchCore: deviations.length === 4 && deviations.every((d) => d < 0.01),
    largestSavedPointDeviation: deviations.length ? round(Math.max(...deviations), 6) : null,
    note: cl.bisects === true
      ? "The saved G lies on the bisector of angle CBD, so P, Q, R, S lie on one circle and the hint is unlocked."
      : "The saved G is off the bisector of angle CBD, so S is off the circle through P, Q, R; the core recomputes all four constructed points from A, B, C, D, G.",
  };
}
