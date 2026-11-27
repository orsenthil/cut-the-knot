/*
 * run_game_logic actions and saved-position reader for Forced Cyclic Quadrilateral.
 *
 * A, B, C and D slide around one circle. Turning ray AB at A by the add-on
 * angle in one direction, and ray DC at D by the same angle in the other
 * direction, gives two rays meeting the base line BC at E and F. The page
 * claims A, E, F and D are concyclic (so the inscribed angles EAF and EDF on
 * chord EF agree), and that subtracting the equal add-on angles gives
 * CAF = BDE; the inscribed angles BAC and BDC on chord BC also agree. In the
 * order E-B-C-F the angle sum
 *   ADF + AEF = (ADC + CDF) + (ABF - BAE) = (ADC + ABC) + (CDF - BAE) = 180°
 * because ABCD is cyclic and the add-on angles cancel. Both E and F can
 * instead fall beyond B or beyond C on the same side; then B and C are not on
 * the side EF of AEFD and the page's ordinary-angle conclusion can fail.
 *
 * Every number below is measured by the game's real core,
 * forced-cyclic-quad/forced-cyclic-quad-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * page's 400 x 300 viewBox, y down; angles are degrees unless stated. This is
 * an illustration with no win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type CircleData = { c: Pt; r: number };
type Name = "A" | "B" | "C" | "D";
type BaseName = Name | "E" | "F";
const NAMES: Name[] = ["A", "B", "C", "D"];

type Measures = {
  addedAngle: number;
  BAE: number; CDF: number;
  EAF: number; EDF: number;
  CAF: number; BDE: number;
  BAC: number; BDC: number;
  ADF: number; AEF: number; ADFplusAEF: number;
  tE: number; tF: number; circleFError: number;
};
type Claims = {
  premiseAnglesEqual: boolean;
  premiseAnglesEqualModPi: boolean;
  aefdCyclic: boolean;
  eafEqualsEdf: boolean;
  cafEqualsBde: boolean;
  cafEqualsBdeModPi: boolean;
  bacEqualsBdc: boolean;
  supplementary: boolean;
  eBeforeBBeforeCBeforeF: boolean;
  sameSideOutside: boolean;
};
type Geometry = {
  valid: boolean; reason?: string;
  A: Pt; B: Pt; C: Pt; D: Pt;
  E: Pt | null; F: Pt | null;
  A2?: Pt; D2?: Pt;
  circle: CircleData | null;
  measures: Measures | null;
  claims: Claims | null;
};
type State = {
  angles: Record<Name, number>;
  angle: number;
  options: { names: boolean; premise: boolean; statement: boolean };
  explored: boolean;
};
type Core = {
  VIEW: { x: number; y: number; width: number; height: number };
  CENTER: Pt;
  RADIUS: number;
  ANGLE_MIN: number;
  ANGLE_MAX: number;
  start(options?: Json): State;
  move(s: State, name: string, p: Pt): State;
  setAngle(s: State, value: number): State;
  angleOf(p: Pt): number;
  dist(a: Pt, b: Pt): number;
  compute(s: State): Geometry;
  geometry(s: State): Geometry;
  describe(s: State): string;
};

const core = (): Core =>
  cores["forced-cyclic-quad"].ForcedCyclicQuadCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. Keep tiny
 * residuals visible: a 1e-14 gap to the circle is the interesting result. */
const r6 = (v: number): number | null => (Number.isFinite(v) ? Number(v.toFixed(6)) : null);
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null
    : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toExponential(2))
      : r6(v);
const degOf = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : r6((v * 180) / Math.PI);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: r6(p.x)!, y: r6(p.y)! }
    : null;

/** Accept the page's { x, y } points and the tutor's [x, y] alike. */
function readPoint(raw: unknown, label: string): Pt {
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw && typeof raw === "object") {
    const o = raw as Json;
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
    }
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** A point from saved state that may be missing or degenerate. */
function maybePoint(raw: unknown): Pt | null {
  try {
    return readPoint(raw, "point");
  } catch {
    return null;
  }
}

/** The applet's add-on angle, a decimal number of degrees in [-45, 45]. */
function readAngle(C: Core, raw: unknown, fallback?: number): number {
  if (raw === undefined || raw === null) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing required argument "angle" (degrees in [${C.ANGLE_MIN}, ${C.ANGLE_MAX}])`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < C.ANGLE_MIN || n > C.ANGLE_MAX) {
    throw new Error(`argument "angle" must be a number in [${C.ANGLE_MIN}, ${C.ANGLE_MAX}], got ${JSON.stringify(raw)}`);
  }
  return n;
}

/** Four corner parameters, in degrees at the circle's centre, in A,B,C,D order. */
function readAnglesDegrees(raw: unknown): [number, number, number, number] {
  if (!Array.isArray(raw) || raw.length !== 4) {
    throw new Error('argument "anglesDegrees" must be an array of four numbers [A, B, C, D]');
  }
  const out = raw.map((v: unknown, i: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`anglesDegrees[${i}] is not a number`);
    return n;
  });
  return [out[0], out[1], out[2], out[3]];
}

/** The applet's opening picture with the caller's drags and angle applied. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C, D points, anglesDegrees and/or angle");
  }
  let s = C.start();
  if (args.anglesDegrees !== undefined && args.anglesDegrees !== null) {
    const [a, b, c, d] = readAnglesDegrees(args.anglesDegrees);
    const DEG = Math.PI / 180;
    s = { ...s, angles: { A: a * DEG, B: b * DEG, C: c * DEG, D: d * DEG } };
  }
  for (const name of NAMES) {
    if (args[name] !== undefined && args[name] !== null) {
      // move() clamps a dragged handle onto the circle, as the page does.
      s = C.move(s, name, readPoint(args[name], name));
    }
  }
  return C.setAngle(s, readAngle(C, args.angle, s.angle));
}

type Reading = {
  valid: boolean;
  reason: string | null;
  board: { width: number; height: number };
  center: Pt | null;
  radius: number | null;
  handlesDegrees: Record<Name, number | null>;
  addOnAngleDegrees: number;
  points: Record<BaseName, Pt | null>;
  turnedTo: { A2: Pt | null; D2: Pt | null };
  circle: { center: Pt | null; radius: number | null } | null;
  anglesDegrees: Record<string, number | null>;
  circleGap: number | null;
  baseLine: {
    parameterB: number; parameterC: number;
    tE: number | null; tF: number | null; order: string;
  };
  claims: Claims | null;
  angleSum: { ADF: number | null; AEF: number | null; total: number | null; is180: boolean };
  checks: {
    sameChordBC: boolean;
    addOnAnglesEqual: boolean;
    aefdCyclic: boolean;
    eafEqualsEdf: boolean;
    cafEqualsBde: boolean;
    pageSecondFormulationApplies: boolean;
  };
};

/** Everything the real core measures for one picture, in tutor-friendly units. */
function reading(C: Core, s: State): Reading {
  const g = C.geometry(s);
  const board = { width: C.VIEW.width, height: C.VIEW.height };
  const handlesDegrees = Object.fromEntries(
    NAMES.map((n) => [n, degOf(s.angles[n])]),
  ) as Record<Name, number | null>;
  const blank: Reading = {
    valid: false,
    reason: g.reason ?? "The core cannot draw this configuration.",
    board,
    center: pt(C.CENTER),
    radius: r6(C.RADIUS),
    handlesDegrees,
    addOnAngleDegrees: s.angle,
    points: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D), E: null, F: null },
    turnedTo: { A2: null, D2: null },
    circle: null,
    anglesDegrees: {},
    circleGap: null,
    baseLine: { parameterB: 0, parameterC: 1, tE: null, tF: null, order: "not drawn" },
    claims: null,
    angleSum: { ADF: null, AEF: null, total: null, is180: false },
    checks: {
      sameChordBC: false, addOnAnglesEqual: false, aefdCyclic: false,
      eafEqualsEdf: false, cafEqualsBde: false, pageSecondFormulationApplies: false,
    },
  };
  if (!g.valid || !g.E || !g.F || !g.circle || !g.measures || !g.claims) return blank;

  const m = g.measures, cl = g.claims;
  return {
    valid: true,
    reason: null,
    board,
    center: pt(C.CENTER),
    radius: r6(C.RADIUS),
    handlesDegrees,
    addOnAngleDegrees: m.addedAngle,
    points: {
      A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D), E: pt(g.E), F: pt(g.F),
    },
    turnedTo: { A2: pt(g.A2), D2: pt(g.D2) },
    circle: { center: pt(g.circle.c), radius: r6(g.circle.r) },
    anglesDegrees: {
      BAE: r6(m.BAE), CDF: r6(m.CDF),
      EAF: r6(m.EAF), EDF: r6(m.EDF),
      CAF: r6(m.CAF), BDE: r6(m.BDE),
      BAC: r6(m.BAC), BDC: r6(m.BDC),
      ADF: r6(m.ADF), AEF: r6(m.AEF),
    },
    circleGap: sig(m.circleFError),
    baseLine: {
      parameterB: 0, parameterC: 1, tE: r6(m.tE), tF: r6(m.tF),
      order: cl.eBeforeBBeforeCBeforeF ? "E-B-C-F"
        : cl.sameSideOutside ? "E and F both beyond B or both beyond C (same side)"
          : "neither named order",
    },
    claims: cl,
    angleSum: {
      ADF: r6(m.ADF), AEF: r6(m.AEF), total: r6(m.ADFplusAEF), is180: cl.supplementary,
    },
    checks: {
      sameChordBC: cl.bacEqualsBdc,
      addOnAnglesEqual: cl.premiseAnglesEqual,
      aefdCyclic: cl.aefdCyclic,
      eafEqualsEdf: cl.eafEqualsEdf,
      cafEqualsBde: cl.cafEqualsBde,
      pageSecondFormulationApplies: cl.eBeforeBBeforeCBeforeF && cl.supplementary,
    },
  };
}

const PROOF_NOTE =
  "Angles BAC and BDC stand on chord BC of the given circle, so they agree. " +
  "The turns give BAE = CDF; F lies within a hair of the circle through A, D and E, " +
  "so EAF = EDF on chord EF, and subtracting the equal add-on angles leaves CAF = BDE.";
const SUM_NOTE =
  "In the order E-B-C-F, ADF + AEF = (ADC + CDF) + (ABF - BAE) " +
  "= (ADC + ABC) + (CDF - BAE) = ADC + ABC = 180°, because ABCD is cyclic and the add-on angles cancel.";
const CAVEAT_NOTE =
  "When E and F both fall beyond B or beyond C on the same side, B and C are not on the side EF of AEFD: " +
  "the ordinary-angle conclusion CAF = BDE can fail there, even though A, E, F and D remain concyclic.";

export function actions(): GameActions {
  return {
    cyclic_conclusion: {
      describe:
        "For four corners A, B, C, D on the page's circle (each [x, y] or { x, y }, clamped onto the circle; omit any for the applet's opening positions) and an add-on angle in degrees (-45..45, default 20), run the real core's Compute and report E and F where the turned rays meet line BC, the circle through A, D, E and all the marked angles in degrees. It checks that A, E, F, D are concyclic, that EAF = EDF on chord EF and BAC = BDC on chord BC, and that subtracting the equal add-on angles gives CAF = BDE, with F's residual gap from the circle and the positions of E and F along BC.",
      args: '{"A":[125,150],"B":[253.033,97],"C":[275,150],"D":[200,225],"angle":20}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        if (!r.valid) {
          throw new Error(`those four corners make no drawing: ${r.reason}. Move a corner and try again.`);
        }
        return {
          ...r,
          status: C.describe(s),
          note:
            `The core puts E at (${r.points.E!.x}, ${r.points.E!.y}) and F at (${r.points.F!.x}, ${r.points.F!.y}); ` +
            `F misses the circle through A, D and E by only ${r.circleGap} board units, so A, E, F and D are concyclic to floating-point precision. ` +
            `${PROOF_NOTE} ` +
            (r.checks.cafEqualsBde
              ? `Here CAF = BDE = ${r.anglesDegrees.CAF}°. `
              : `Here CAF = ${r.anglesDegrees.CAF}° while BDE = ${r.anglesDegrees.BDE}°; ` + CAVEAT_NOTE + " ")
            + "This is an illustration, so there is no win or loss.",
        };
      },
    },

    angle_sum_and_caveat: {
      describe:
        "Compare the opening order E-B-C-F, where ADF + AEF = (ADC + CDF) + (ABF - BAE) = ADC + ABC = 180°, with the small-arc position A=30°, B=15°, C=0°, D=45° where E and F both land beyond B or beyond C on the same side and the ordinary-angle conclusion CAF = BDE can fail, using the real core for both. Pass A, B, C, D ([x, y] or { x, y }), anglesDegrees [A, B, C, D] or angle to test your own picture; the report gives tE and tF along BC (0 at B, 1 at C), both angles and their sum for each picture.",
      args: '{"anglesDegrees":[30,15,0,45],"angle":20}',
      run: (args) => {
        const C = core();
        const supplied = NAMES.some((n) => args[n] !== undefined && args[n] !== null)
          || args.anglesDegrees !== undefined || args.angle !== undefined;
        const smallArc = C.start();
        smallArc.angles = { C: 0, B: Math.PI / 12, A: Math.PI / 6, D: Math.PI / 4 };
        const otherState = supplied ? buildState(C, args) : C.setAngle(smallArc, 20);
        const opening = reading(C, C.start());
        const other = reading(C, otherState);
        if (!opening.valid || !other.valid) {
          throw new Error(
            `the core cannot draw one of the two pictures: ${!opening.valid ? opening.reason : other.reason}`,
          );
        }
        return {
          source: supplied
            ? "the opening picture and the supplied corners and add-on angle"
            : "the opening picture and a small-arc position from the port's logic test",
          opening,
          other,
          comparison: {
            openingOrder: opening.baseLine.order,
            otherOrder: other.baseLine.order,
            openingTE: opening.baseLine.tE,
            openingTF: opening.baseLine.tF,
            otherTE: other.baseLine.tE,
            otherTF: other.baseLine.tF,
            openingAngleSum: opening.angleSum.total,
            otherAngleSum: other.angleSum.total,
            openingSumIs180: opening.angleSum.is180,
            otherSumIs180: other.angleSum.is180,
            openingCafEqualsBde: opening.checks.cafEqualsBde,
            otherCafEqualsBde: other.checks.cafEqualsBde,
          },
          proof: { angleSum: SUM_NOTE, conclusion: PROOF_NOTE },
          note:
            `At the opening, ${opening.baseLine.order}: the angle sum is ${opening.angleSum.total}° ` +
            `and CAF = BDE = ${opening.anglesDegrees.CAF}°. ` +
            `In the second picture the base-line parameters are tE = ${other.baseLine.tE}, tF = ${other.baseLine.tF} ` +
            `(${other.baseLine.order}), the angle sum is ${other.angleSum.total}° and ` +
            `CAF = ${other.anglesDegrees.CAF}° against BDE = ${other.anglesDegrees.BDE}°` +
            (other.checks.cafEqualsBde ? ", still equal here" : ", so the page's conclusion fails as ordinary angles") +
            `. ${SUM_NOTE} ${CAVEAT_NOTE} This is an illustration with no win or loss.`,
        };
      },
    },
  };
}

/** Track.state saved the computed points and claims, not the core's angle list. */
function savedState(C: Core, state: Json): { s: State; savedReadable: boolean } {
  const home = C.start();
  const raw = state.options;
  let s = home;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Json;
    s = C.start({
      names: typeof o.names === "boolean" ? o.names : home.options.names,
      premise: typeof o.premise === "boolean" ? o.premise : home.options.premise,
      statement: typeof o.statement === "boolean" ? o.statement : home.options.statement,
    });
  }
  const angles = { ...s.angles };
  let savedReadable = true;
  for (const name of NAMES) {
    try {
      const t = C.angleOf(readPoint(state[name], name));
      if (!Number.isFinite(t)) throw new Error("non-finite circle angle");
      angles[name] = t;
    } catch {
      savedReadable = false; // keep the applet's opening place for that handle
    }
  }
  s = { ...s, angles };
  const rawAngle = state.angle;
  if (typeof rawAngle === "number" && Number.isFinite(rawAngle)) {
    s = C.setAngle(s, rawAngle);
  } else {
    savedReadable = false;
  }
  return { s, savedReadable };
}

/** Echo the saved fields, plus a fresh core reading of that same figure. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Forced Cyclic Quadrilateral state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Forced Cyclic Quadrilateral position must be an object");
  }
  const C = core();
  const { s, savedReadable } = savedState(C, state);
  const r = reading(C, s);
  return {
    ...state,
    stateVersion,
    saved: {
      A: pt(maybePoint(state.A)), B: pt(maybePoint(state.B)),
      C: pt(maybePoint(state.C)), D: pt(maybePoint(state.D)),
      E: pt(maybePoint(state.E)), F: pt(maybePoint(state.F)),
      circle: state.circle ?? null,
      angle: state.angle ?? null,
      options: state.options ?? null,
      claims: state.claims ?? null,
      measures: state.measures ?? null,
    },
    savedReadable,
    derived: r,
    conclusionHolds: r.checks.cafEqualsBde,
    status: C.describe(s),
    note: !savedReadable
      ? "Some saved points could not be read, so the applet's opening positions were substituted for them; the core reading below comes from those points. This is an illustration with no win or loss."
      : !r.valid
        ? `Track.state saved the six points, the add-on angle and the measured claims; the core cannot draw this saved figure (${r.reason}). ${CAVEAT_NOTE}`
        : `Track.state saved the six points, the circle, the add-on angle and the measured claims, not the corner angles; those are recovered from A, B, C and D and given to the real core. It rebuilds E, F and the circle through A, D, E: F is ${r.circleGap} units from that circle, and the page's claims hold here: ${PROOF_NOTE} ${SUM_NOTE} ${CAVEAT_NOTE} This is an illustration with no win or loss.`,
  };
}
