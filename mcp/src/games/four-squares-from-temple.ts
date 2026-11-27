/*
 * run_game_logic actions and saved-position reader for Four Squares From
 * Temple (Alexander Bogomolny's FourSquaresFromTemple applet, "Bottema
 * Shatters Japan's Seclusion").
 *
 * The real core is four-squares-from-temple/four-squares-from-temple-core.js,
 * copied into src/generated/cores/ at build time. It follows the applet's own
 * Compute(): UpperCenter gives the Bottema points U (on AB) and V (on BC),
 * K is the midpoint of UV, FormSquareOnDiagonal builds BEKH on diagonal BK,
 * FormSquare builds AESX and CHIY, and N = I + (S - K) completes KINS.
 *
 * Bottema's theorem applied twice makes triangles ABU, KSU, BCV and IKV
 * right isosceles, K the midpoint of UV, and UV = SI (a diagonal of KINS).
 * When A, B and C are exactly collinear, angle UBV is right, so by Thales'
 * theorem B lies on the circle about K with UV as diameter: KB = KV = UV/2.
 * Since BK is a diagonal of BEKH and SI = UV is a diagonal of KINS,
 * SI = 2 x BK and side(KINS) = 2 x side(BEKH). The applet's own "on a line"
 * test allows a one-pixel wobble, where the ratio is only close to 2.
 *
 * All numbers below are measured by the core on the 500 x 500 board (y down).
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circ = { c: Pt; r: number };
type Options = { names: boolean; hint: boolean };
type State = { A: Pt; B: Pt; C: Pt; options: Options; explored: boolean };
type Geom = {
  A: Pt; B: Pt; C: Pt; U: Pt; V: Pt; K: Pt; E: Pt; H: Pt;
  X: Pt; S: Pt; I: Pt; Y: Pt; N: Pt; circle: Circ; onLine: boolean;
};
type Core = {
  VIEW: { width: number; height: number };
  NAMES: string[];
  OPTION_NAMES: string[];
  start(options?: Json): State;
  move(s: State, name: string, p: Pt): State;
  setOption(s: State, name: string, value: boolean): State;
  reset(s: State): State;
  result(s: State): string | null;
  geometry(s: State): Geom;
  describe(s: State): string;
  distance(p: Pt, q: Pt): number;
  midpoint(p: Pt, q: Pt): Pt;
};

const core = (): Core =>
  cores["four-squares-from-temple"].FourSquaresFromTempleCore as unknown as Core;

const TOL = 1e-6;        // scaled residuals of the drawn constructions
const ANGLE_TOL = 1e-3;  // degrees

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
/** Keep the size of tiny residuals: rounding to six places would print 0. */
const fine = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toPrecision(6));
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const circleOut = (c: Circ | null | undefined) =>
  c ? { center: pt(c.c), radius: fine(c.r) } : null;
const ratio = (a: number, b: number): number | null =>
  b > 0 ? fine(a / b) : null;

/** Accept the page's { x, y } dots and the tutor's shorter [x, y] form. */
function readPoint(value: unknown, label: string, fallback?: Pt): Pt {
  if (value === undefined || value === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

/**
 * Build a core state from JSON args the way the page's drags do. Moving A or
 * C ties the other outer handle's height to it; absent handles keep the
 * opening diagram and points outside the board are clamped like a drag.
 */
function buildState(C: Core, args: Json): State {
  if (args === undefined || args === null) args = {};
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object holding optional A, B, C and options");
  }
  let s = C.start({});
  for (const name of ["A", "B", "C"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.move(s, name, readPoint(args[name], name));
    }
  }
  const o = args.options;
  if (o !== undefined && o !== null) {
    if (typeof o !== "object" || Array.isArray(o)) {
      throw new Error('argument "options" must be an object with boolean names/hint');
    }
    for (const key of ["names", "hint"] as const) {
      const v = (o as Json)[key];
      if (v !== undefined && v !== null) {
        if (typeof v !== "boolean") throw new Error(`argument "options.${key}" must be a boolean`);
        s = C.setOption(s, key, v);
      }
    }
  }
  return s;
}

/** Angle p-v-q in degrees, from the core's own distances and a dot product. */
function angleAt(C: Core, v: Pt, p: Pt, q: Pt): number {
  const a = C.distance(v, p), b = C.distance(v, q);
  if (!(a > 0) || !(b > 0)) return NaN;
  const dot = (p.x - v.x) * (q.x - v.x) + (p.y - v.y) * (q.y - v.y);
  return Math.acos(Math.max(-1, Math.min(1, dot / (a * b)))) * 180 / Math.PI;
}

/** A right isosceles triangle with its right angle at v, scaled residuals. */
function rightIsosceles(C: Core, v: Pt, p: Pt, q: Pt) {
  const leg1 = C.distance(v, p), leg2 = C.distance(v, q);
  const hyp = C.distance(p, q);
  const scale = Math.max(leg1, leg2, hyp, 1);
  const angle = angleAt(C, v, p, q);
  const equalLegs = Math.abs(leg1 - leg2) / scale;
  const hypotenuse = Math.abs(hyp - Math.SQRT2 * leg1) / scale;
  const rightAngle = Number.isFinite(angle) ? Math.abs(angle - 90) : Infinity;
  return {
    vertex: pt(v),
    legs: { vp: fine(leg1), vq: fine(leg2) },
    hypotenuse_pq: fine(hyp),
    angleAtVertexDegrees: fine(angle),
    residuals: { rightAngleDegrees: fine(rightAngle), equalLegs: fine(equalLegs), hypotenuse: fine(hypotenuse) },
    holds: rightAngle < ANGLE_TOL && equalLegs < TOL && hypotenuse < TOL,
  };
}

const spread = (xs: number[]): number =>
  (Math.max(...xs) - Math.min(...xs)) / Math.max(1, ...xs);

/** The whole construction, measured from one core geometry. */
function picture(C: Core, g: Geom) {
  const smallSide = C.distance(g.B, g.E), bigSide = C.distance(g.K, g.I);
  const smallDiag = C.distance(g.B, g.K), bigDiag = C.distance(g.S, g.I);
  const sidesSmall = [smallSide, C.distance(g.E, g.K), C.distance(g.K, g.H), C.distance(g.H, g.B)];
  const sidesBig = [bigSide, C.distance(g.I, g.N), C.distance(g.N, g.S), C.distance(g.S, g.K)];
  return {
    board: { width: C.VIEW.width, height: C.VIEW.height },
    points: {
      A: pt(g.A), B: pt(g.B), C: pt(g.C), U: pt(g.U), V: pt(g.V), K: pt(g.K),
      E: pt(g.E), H: pt(g.H), X: pt(g.X), S: pt(g.S), I: pt(g.I), Y: pt(g.Y), N: pt(g.N),
    },
    circle: circleOut(g.circle),
    onLine: g.onLine,
    exactlyCollinear: Math.abs(g.A.y - g.B.y) < 1e-9,
    squares: {
      small_BEKH: {
        vertices: ["B", "E", "K", "H"],
        sides: sidesSmall.map((v) => fine(v)),
        sidesEqualError: fine(spread(sidesSmall)),
        diagonals: { BK: fine(smallDiag), EH: fine(C.distance(g.E, g.H)) },
      },
      big_KINS: {
        vertices: ["K", "I", "N", "S"],
        sides: sidesBig.map((v) => fine(v)),
        sidesEqualError: fine(spread(sidesBig)),
        diagonals: { SI: fine(bigDiag), KN: fine(C.distance(g.K, g.N)) },
      },
      sideRatio_big_to_small: ratio(bigSide, smallSide),
      diagonalRatio_big_to_small: ratio(bigDiag, smallDiag),
    },
  };
}

/** Every claim on the page, checked against the core's geometry. */
function claims(C: Core, g: Geom) {
  const triangles = {
    ABU: rightIsosceles(C, g.U, g.A, g.B),
    KSU: rightIsosceles(C, g.U, g.K, g.S),
    BCV: rightIsosceles(C, g.V, g.B, g.C),
    IKV: rightIsosceles(C, g.V, g.K, g.I),
  };
  const uv = C.distance(g.U, g.V), si = C.distance(g.S, g.I);
  const mid = C.midpoint(g.U, g.V);
  const midError = C.distance(mid, g.K) / Math.max(1, uv);
  const uvError = Math.abs(uv - si) / Math.max(1, uv);

  const r = g.circle.r;
  const circleResiduals = [
    Math.abs(C.distance(g.K, g.B) - r),
    Math.abs(C.distance(g.K, g.U) - r),
    Math.abs(C.distance(g.K, g.V) - r),
    Math.abs(2 * r - uv),
  ].map((v) => v / Math.max(1, r));
  const angleUBV = angleAt(C, g.B, g.U, g.V);

  const smallDiag = C.distance(g.B, g.K), bigDiag = si;
  const smallSide = C.distance(g.B, g.E), bigSide = C.distance(g.K, g.I);
  const diagRatio = ratio(bigDiag, smallDiag), sideRatio = ratio(bigSide, smallSide);
  const exact = Math.abs(g.A.y - g.B.y) < 1e-9;
  const maxResidual = (xs: number[]) => Math.max(...xs);
  const drawnHinge = g.A.x < g.B.x && g.B.x < g.C.x && g.K.y < g.B.y;

  return {
    drawnHinge,
    rightIsosceles: {
      triangles,
      allHold: Object.values(triangles).every((t) => t.holds),
      note: "Bottema's theorem at B makes ABU, KSU, BCV and IKV right isosceles.",
    },
    midpointUV: { point: pt(mid), error: fine(midError), holds: midError < TOL },
    uvEqualsSI: { UV: fine(uv), SI: fine(si), error: fine(uvError), holds: uvError < TOL },
    circleAboutK: {
      radius: fine(r),
      residuals: { KB: fine(circleResiduals[0]), KU: fine(circleResiduals[1]),
        KV: fine(circleResiduals[2]), diameter_UV: fine(circleResiduals[3]) },
      maxResidual: fine(maxResidual(circleResiduals)),
      holds: maxResidual(circleResiduals) < TOL,
      appliesWhenCollinear: exact,
      note: "U and V always lie on the circle about K (its radius is KU and K is the midpoint of UV); B lies on it only when A, B and C are in a line.",
    },
    collinear: {
      onLine: g.onLine,
      exactlyCollinear: exact,
      angleUBVDegrees: fine(angleUBV),
      rightAngleAtB: Number.isFinite(angleUBV) && Math.abs(angleUBV - 90) < ANGLE_TOL,
      diagonalRatio_big_to_small: diagRatio,
      sideRatio_big_to_small: sideRatio,
      doublingApplies: exact,
      doublingHolds: exact && diagRatio !== null && sideRatio !== null
        && Math.abs(diagRatio - 2) < TOL && Math.abs(sideRatio - 2) < TOL,
      note: exact
        ? "A, B and C are exactly in line: angle UBV is right, B lies on the circle about K, and SI = 2 x BK with side(KINS) = 2 x side(BEKH)."
        : "A, B and C are not exactly in line, so the doubling does not apply. The applet's one-pixel test can still call a near miss 'lined up', where the ratio is only close to 2.",
    },
    // The Bottema identities hold for the drawn hinge at any height; the
    // circle and doubling claims are only asserted on an exact line-up.
    allHold: Object.values(triangles).every((t) => t.holds) && midError < TOL && uvError < TOL
      && (!exact || (maxResidual(circleResiduals) < TOL && diagRatio !== null
        && sideRatio !== null && Math.abs(diagRatio - 2) < TOL
        && Math.abs(sideRatio - 2) < TOL)),
    mirroredCaveat: "Outside the drawn hinge (B between A and C, K above B) the applet's mirrored sign choices can break UV = SI and the intermediate identities; the page does not draw those cases.",
  };
}

const EXAMPLE_ARGS = '{ "A": [125, 375], "B": [250, 375], "C": [400, 375] }';

export function actions(): GameActions {
  return {
    four_squares: {
      describe:
        "For draggable points A, B and C on the 500 x 500 board ([x, y] or { x, y }, y down; omit for the opening diagram, optionally set options.names/options.hint), the real core rebuilds the four hinged squares and reports every corner, the circle about K, and the sides and diagonals of BEKH and KINS with their ratios. Moving A or C ties the other outer handle to the same height; when A, B and C are exactly in line the big square's side and diagonal are twice the small one's.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = C.geometry(s);
        return {
          ...picture(C, g),
          handles: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          options: s.options,
          coreDescription: C.describe(s),
          note: "The core follows the applet's Compute(): U and V are the centres of the squares on AB and BC, K is their midpoint, BEKH is built on diagonal BK, AESX and CHIY on AE and CH, and N = I + (S - K). When A, B and C share a height exactly, side(KINS) = 2 x side(BEKH) and diagonal SI = 2 x diagonal BK; a one-pixel near miss is only close to 2.",
        };
      },
    },
    check_claims: {
      describe:
        "For the same A, B and C, check with the real core that ABU, KSU, BCV and IKV are right isosceles, that K is the midpoint of UV and UV = SI, and that BEKH and KINS are squares, each with measured residuals. On an exact line-up also check that angle UBV is right, B lies on the circle about K, and both the side and diagonal ratios equal 2; these identities can fail in mirrored hinge configurations the page does not draw.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = C.geometry(s);
        const c = claims(C, g);
        const squares = picture(C, g).squares;
        const isSquare = (error: number | null): boolean =>
          error !== null && Number.isFinite(error) && error < TOL;
        return {
          ...c,
          squareChecks: {
            small_BEKH_isSquare: isSquare(squares.small_BEKH.sidesEqualError),
            big_KINS_isSquare: isSquare(squares.big_KINS.sidesEqualError),
            diagonalsEqual: {
              BEKH: ratio(C.distance(g.E, g.H), C.distance(g.B, g.K)),
              KINS: ratio(C.distance(g.K, g.N), C.distance(g.S, g.I)),
            },
          },
          coreDescription: C.describe(s),
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure them with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Squares From Temple state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four Squares From Temple position must be an object");
  }
  const C = core();
  const seed = C.start({});
  const A = readPoint(state.A, "saved A", seed.A);
  const B = readPoint(state.B, "saved B", seed.B);
  const Cp = readPoint(state.C, "saved C", seed.C);
  const optPoint = (v: unknown, label: string): Pt | null => {
    try { return readPoint(v, label); } catch { return null; }
  };
  const derived = ["U", "V", "K", "E", "H", "X", "S", "I", "Y", "N"] as const;
  const savedDerived: Record<string, Pt | null> = {};
  for (const name of derived) savedDerived[name] = pt(optPoint(state[name], `saved ${name}`));
  const savedCircle = state.circle && typeof state.circle === "object" && !Array.isArray(state.circle)
    ? {
        center: pt(optPoint((state.circle as Json).c, "saved circle.c")),
        radius: fine(Number((state.circle as Json).r)),
      }
    : null;
  const o = state.options && typeof state.options === "object" && !Array.isArray(state.options)
    ? state.options as Json : {};
  const options: Options = { names: o.names === true, hint: o.hint === true };
  const saved = {
    A: pt(A), B: pt(B), C: pt(Cp),
    ...savedDerived,
    circle: savedCircle,
    onLine: state.onLine === true,
    options,
  };

  const here: State = { A, B, C: Cp, options, explored: true };
  const g = C.geometry(here);
  const measured = picture(C, g);
  const differences: Array<{ field: string; saved: number; core: number; diff: number }> = [];
  const compare = (field: string, savedValue: number | null, coreValue: number): void => {
    if (savedValue !== null && Number.isFinite(savedValue)) {
      differences.push({ field, saved: round(savedValue), core: round(coreValue),
        diff: round(Math.abs(savedValue - coreValue), 9) });
    }
  };
  const comparePoint = (field: string, savedPoint: Pt | null, corePoint: Pt): void => {
    if (savedPoint) {
      compare(`${field}.x`, savedPoint.x, corePoint.x);
      compare(`${field}.y`, savedPoint.y, corePoint.y);
    }
  };
  for (const name of derived) comparePoint(name, savedDerived[name], g[name]);
  comparePoint("circle.c", savedCircle && savedCircle.center, g.circle.c);
  if (savedCircle) compare("circle.r", savedCircle.radius, g.circle.r);
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  ) && saved.onLine === g.onLine;

  return {
    ...state,
    stateVersion,
    saved,
    reading: measured,
    claimChecks: claims(C, g),
    coreDescription: C.describe(here),
    savedMatchesCore,
    differences,
    note:
      "Track.state saved the three draggable points A, B, C, the derived Bottema centres K and the other corners, the circle about K, the applet's onLine flag and the two Show options. The core rebuilds all of them from A, B and C (which the page keeps at a common height): the four right-isosceles Bottema triangles, K as the midpoint of UV, UV = SI, and, on an exact line-up, the doubled sides and diagonals. This is a demonstration with no win or loss." +
      (savedMatchesCore
        ? " The saved numbers agree with a fresh core construction."
        : " Some saved numbers differ from the core rebuild; see `differences` and trust `reading` for the true position."),
  };
}
