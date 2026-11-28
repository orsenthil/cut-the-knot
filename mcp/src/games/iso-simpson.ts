/*
 * run_game_logic actions and saved-position reader for Iso Simpson, the port of
 * Alexander Bogomolny's IsoSimpson applet.
 *
 * Reflecting the cevians of P at two vertices of triangle ABC constructs its
 * isogonal conjugate Q. The perpendicular feet from P and Q onto the three
 * sides are six points on one circle, centred at the midpoint of PQ. When P
 * lies on the circumcircle of ABC the circle opens out into the Simson line:
 * the three feet of P become collinear and Q is no longer defined.
 *
 * Every number here is measured by the real core
 * (iso-simpson/iso-simpson-core.js, copied into src/generated/cores/ at build
 * time); coordinates are board units of the page's 400 x 250 SVG, y down.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Feet = { a: Pt; b: Pt; c: Pt };
type Circle = { center: Pt; radius: number };

type Geometry = {
  degenerate: boolean;
  outer: Pt;
  outerRadius: number;
  onCircumcircle: boolean;
  Q: Pt | null;
  feetP?: Feet;
  feetQ: Feet | null;
  circleP: Circle | null;
  circleQ: Circle | null;
  center: Pt | null;
  radius: number | null;
  rayA: Pt;
  rayB: Pt;
  rayC: Pt;
  simson?: { a: Pt; b: Pt };
};

type Residuals = { pedalError: number; centerError: number; radiusError: number } | null;

type State = {
  A: Pt; B: Pt; C: Pt; P: Pt;
  showPerps: boolean; showCircle: boolean; showAngles: boolean;
  moves: number; explored: boolean;
};

type Core = {
  WIDTH: number;
  HEIGHT: number;
  ON_CIRCLE_TOLERANCE: number;
  start(o?: Partial<State>): State;
  compute(s: State): Geometry;
  residuals(s: State, g: Geometry): Residuals;
  isogonal(a: Pt, b: Pt, c: Pt, p: Pt): {
    Q: Pt; rayA: Pt; rayB: Pt; rayC: Pt;
    angles: { A: number; B: number; C: number };
  };
  dist(a: Pt, b: Pt): number;
  cross(a: Pt, b: Pt, c: Pt): number;
};

const core = (): Core => cores["iso-simpson"].IsoSimpsonCore as unknown as Core;

/* The core keeps full precision; only what we print is rounded. */
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const feet = (f: Feet | null | undefined): { a: Pt | null; b: Pt | null; c: Pt | null } | null =>
  f ? { a: pt(f.a), b: pt(f.b), c: pt(f.c) } : null;
const circle = (c: Circle | null): { center: Pt | null; radius: number } | null =>
  c ? { center: pt(c.center), radius: round(c.radius) } : null;
const isPlain = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const coord = (v: unknown): number => (v === undefined || v === null || v === "" ? NaN : Number(v));

/** A point as {x, y} or [x, y], with finite coordinates. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or { x, y }`);
    x = coord(raw[0]);
    y = coord(raw[1]);
  } else if (isPlain(raw)) {
    x = coord(raw.x);
    y = coord(raw.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** The core's opening picture, with any supplied points and switches filled in. */
function buildState(C: Core, args: Json): State {
  const o: Partial<State> = {};
  for (const name of ["A", "B", "C", "P"] as const) {
    if (args[name] !== undefined && args[name] !== null) o[name] = readPoint(args[name], name);
  }
  for (const key of ["showPerps", "showCircle", "showAngles"] as const) {
    if (typeof args[key] === "boolean") o[key] = args[key];
  }
  const s = C.start(o);
  const g = C.compute(s);
  if (g.degenerate) {
    throw new Error("A, B and C must form a non-degenerate triangle with all sides at least 12 board units");
  }
  for (const name of ["A", "B", "C"] as const) {
    if (C.dist(s.P, s[name]) < 12) throw new Error(`P must be at least 12 board units from ${name}`);
  }
  return s;
}

function errorReading(r: Residuals) {
  return r && {
    largestDistanceError: round(r.pedalError, 12),
    centerError: round(r.centerError, 12),
    radiusError: round(r.radiusError, 12),
  };
}

export function actions(): GameActions {
  return {
    pedal_circle: {
      describe:
        "Reflect the cevians of P at A and B to find its isogonal conjugate Q, then drop perpendiculars from P and Q to all three sides: the six feet lie on one circle centred at the midpoint of PQ. Reports Q, the reflected rays and their signed angles, the six feet, the circle through each triple, the largest errors in the claim, and the Simson degeneration when P is on the circumcircle.",
      args: JSON.stringify({
        A: { x: 200.567, y: 41.702 },
        B: { x: 145.52969826136567, y: 188.066874608994 },
        C: { x: 281.6722148201035, y: 108.4442224337449 },
        P: { x: 200, y: 100 },
      }),
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = C.compute(s);
        const iso = C.isogonal(s.A, s.B, s.C, s.P);
        const reflectedCevians = {
          rayFromA: pt(iso.rayA), rayFromB: pt(iso.rayB), rayFromC: pt(iso.rayC),
          signedAnglesRadians: {
            A: round(iso.angles.A), B: round(iso.angles.B), C: round(iso.angles.C),
          },
          meetsAt: pt(iso.Q),
        };
        const common = {
          A: pt(s.A), B: pt(s.B), C: pt(s.C), P: pt(s.P),
          onCircumcircle: g.onCircumcircle,
          reflectedCevians,
          feetP: feet(g.feetP),
        };
        if (g.onCircumcircle || !g.center) {
          return {
            ...common,
            reflectedCevians: g.onCircumcircle
              ? { ...reflectedCevians, meetsAt: null }
              : reflectedCevians,
            Q: null,
            circleCenter: null,
            radius: null,
            feetQ: null,
            simsonLine: g.simson ? { through: pt(g.simson.a), and: pt(g.simson.b) } : null,
            note:
              "P is on the circumcircle (or its reflected cevians do not meet), so there is no isogonal partner Q and the pedal circle opens into the Simson line; the three feet of P are collinear. Use simson_line to measure that line.",
          };
        }
        const r = C.residuals(s, g);
        const concyclic = !!r
          && r.pedalError < 1e-6 && r.centerError < 1e-6 && r.radiusError < 1e-6;
        return {
          ...common,
          Q: pt(g.Q),
          feetQ: feet(g.feetQ),
          circleCenter: pt(g.center),
          radius: round(g.radius as number),
          circleThroughPFeet: circle(g.circleP),
          circleThroughQFeet: circle(g.circleQ),
          errors: errorReading(r),
          concyclic,
          note:
            `The reflected rays at A and B meet at Q = ${JSON.stringify(pt(g.Q))}. All six feet are ${round(g.radius as number)} units from the midpoint of PQ; the largest distance, centre and radius errors are ${round(r ? r.pedalError : NaN, 12)}, ${round(r ? r.centerError : NaN, 12)} and ${round(r ? r.radiusError : NaN, 12)} board units.`,
        };
      },
    },

    simson_line: {
      describe:
        "Put P exactly on the circumcircle of ABC (at the point opposite A by default, or by projecting a supplied P onto the circle) and show how the six-foot circle degenerates: Q disappears and the three feet of P fall on one straight line, the Simson line. Reports the circumcircle, the three feet, the line through two of them and the signed area that measures their collinearity.",
      args: JSON.stringify({
        A: { x: 200.567, y: 41.702 },
        B: { x: 145.52969826136567, y: 188.066874608994 },
        C: { x: 281.6722148201035, y: 108.4442224337449 },
      }),
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const first = C.compute(s);
        const O = first.outer;
        if (!O || !Number.isFinite(O.x) || !Number.isFinite(O.y)) {
          throw new Error("the circumcentre is undefined for this triangle");
        }
        let P: Pt;
        let placedP: string;
        if (args.P === undefined || args.P === null) {
          P = { x: 2 * O.x - s.A.x, y: 2 * O.y - s.A.y };
          placedP = "the antipode of A on the circumcircle, found from the core's circumcentre";
        } else {
          const dx = s.P.x - O.x, dy = s.P.y - O.y;
          const len = C.dist(s.P, O);
          if (!(len > 1e-9)) throw new Error("P coincides with the circumcentre and cannot be projected onto the circle");
          P = { x: O.x + first.outerRadius * dx / len, y: O.y + first.outerRadius * dy / len };
          placedP = "the radial projection of the supplied P onto the circumcircle";
        }
        const onCircle = { ...s, P };
        const g = C.compute(onCircle);
        if (g.degenerate || !g.feetP || !g.simson) {
          throw new Error("the Simson feet could not be constructed at this position");
        }
        const twiceArea = C.cross(g.feetP.a, g.feetP.b, g.feetP.c);
        const scale = Math.max(1, C.dist(s.A, s.B) ** 2);
        return {
          A: pt(s.A), B: pt(s.B), C: pt(s.C), P: pt(P),
          placedP,
          circumcenter: pt(g.outer),
          circumradius: round(g.outerRadius),
          onCircumcircle: g.onCircumcircle,
          Q: g.Q ? pt(g.Q) : null,
          feetP: feet(g.feetP),
          simsonLine: { through: pt(g.simson.a), and: pt(g.simson.b) },
          twiceSignedArea: round(twiceArea, 12),
          relativeArea: round(Math.abs(twiceArea) / scale, 12),
          collinear: Math.abs(twiceArea) < 1e-6 * scale,
          pedalCircleSurvives: g.circleP !== null,
          note:
            `P is ${round(C.dist(P, g.outer))} units from the circumcentre against a radius of ${round(g.outerRadius)}, so the core puts it on the circumcircle. The three feet have twice signed area ${round(twiceArea, 12)}, i.e. they lie on the Simson line through ${JSON.stringify(pt(g.simson.a))} and ${JSON.stringify(pt(g.simson.b))}; no circle through three distinct feet remains.`,
        };
      },
    },
  };
}

/** The saved fields from Track.state plus the core's reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Iso Simpson state version ${stateVersion}`);
  const C = core();
  const src: Json = isPlain(state) ? state : {};
  let s: State;
  let valid = true;
  try {
    s = {
      A: readPoint(src.A, "A"),
      B: readPoint(src.B, "B"),
      C: readPoint(src.C, "C"),
      P: readPoint(src.P, "P"),
      showPerps: src.showPerps === true,
      showCircle: src.showCircle === true,
      showAngles: src.showAngles === true,
      moves: num(src, "moves", 0),
      explored: src.explored === true,
    };
    if (C.compute(s).degenerate) throw new Error("saved triangle is degenerate");
  } catch {
    s = C.start({});
    valid = false;
  }
  const g = C.compute(s);
  const r = C.residuals(s, g);
  return {
    ...src,
    stateVersion,
    valid,
    A: pt(s.A), B: pt(s.B), C: pt(s.C), P: pt(s.P),
    showPerps: s.showPerps, showCircle: s.showCircle, showAngles: s.showAngles,
    moves: s.moves, explored: s.explored,
    degenerate: g.degenerate,
    onCircumcircle: g.onCircumcircle,
    circumcenter: pt(g.outer),
    circumradius: round(g.outerRadius),
    Q: g.Q ? pt(g.Q) : null,
    feetP: feet(g.feetP),
    feetQ: feet(g.feetQ),
    circleCenter: g.center ? pt(g.center) : null,
    radius: g.center ? round(g.radius as number) : null,
    errors: errorReading(r),
    simsonLine: g.simson ? { through: pt(g.simson.a), and: pt(g.simson.b) } : null,
    note: !valid
      ? "Some saved fields could not be read, so the core's opening picture is shown below. "
        + (g.onCircumcircle ? "Here P is on the circumcircle and the feet of P lie on the Simson line."
          : g.center ? `Here Q is ${JSON.stringify(pt(g.Q))} and the six feet share a circle centred at ${JSON.stringify(pt(g.center))}.`
            : "Here the isogonal partner could not be constructed.")
      : g.onCircumcircle
        ? "Track.state saved the four draggable points and the three switches. This P is on the circumcircle, so the core replaces Q and the six-foot circle with the Simson line."
        : g.center
          ? `Track.state saved the four draggable points and the three switches. The reflected cevians meet at Q = ${JSON.stringify(pt(g.Q))}, and all six feet lie on a circle of radius ${round(g.radius as number)} centred at the midpoint of PQ.`
          : "Track.state saved the four draggable points and the three switches, but the isogonal partner could not be constructed here.",
  };
}
