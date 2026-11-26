/*
 * run_game_logic actions and saved-position reader for Angle Bisector.
 *
 * The real core is angle-bisector/angle-bisector-core.js, copied into
 * src/generated/cores/ at build time. It transcribes the applet's Compute():
 * AD is copied onto the other ray with a circle centred at A (so AE = AD),
 * then two equal circles centred at D and E meet at P and F. Their common
 * chord is the perpendicular bisector of DE and passes through A; since
 * DF = EF, triangles ADF and AEF are congruent and AF bisects the angle.
 * The smallest radius that makes the circles meet is DE/2 = AD·sin(A/2),
 * not the radius > AD that the article suggests, and Euclid's own choice is
 * the still larger radius DE (an equilateral DEF).
 *
 * Coordinates are those of the page's 400 x 300 viewBox, with y downward.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["angle-bisector"].AngleBisectorCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type State = { A: Point; B: Point; C: Point; coefD: number; radius: number; R: Point };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : round(v);
const deg = (v: number | null | undefined): number | null =>
  maybe(v === null || v === undefined ? null : (v * 180) / Math.PI);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;

/** Accept a point as [x, y] or { "x": ..., "y": ... }, with an optional default. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
}

/**
 * Rebuild the page's { A, B, C, coefD, radius, R } state. Omitted fields fall
 * back to the illustration's opening position; D may be given as a point
 * instead of coefD (the page derives coefD the same way when D is dragged).
 */
function readState(args: Json): State {
  const C = core();
  const d = C.start();
  const A = readPoint(args, "A", d.A);
  const B = readPoint(args, "B", d.B);
  const Cc = readPoint(args, "C", d.C);
  const coefD = args.coefD !== undefined
    ? num(args, "coefD")
    : args.D !== undefined
      ? C.clamp(C.coef(B, readPoint(args, "D"), A), -0.2, 1.2)
      : d.coefD;
  const radius = num(args, "radius", d.radius);
  if (!(radius > 0)) throw new Error('argument "radius" must be a positive number');
  return { A, B, C: Cc, coefD, radius, R: readPoint(args, "R", d.R) };
}

/** All the numbers behind the construction, in tutor-friendly units/degrees. */
function reading(C: Core, s: State) {
  const m = C.measurements(s);
  const c = m.construction;
  const cl = C.claims(s);
  const chord = c.P.length === 2 ? C.line(c.P[0], c.P[1]) : null;
  // F is one of the two crossings; P is the other one, as named on the page.
  const other = c.F && c.P.length === 2
    ? (C.dist(c.P[0], c.F) > C.dist(c.P[1], c.F) ? c.P[0] : c.P[1])
    : null;
  const fromFormula = m.AD === null || m.angleBAC === null
    ? null : m.AD * Math.sin(m.angleBAC / 2);
  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    D: pt(c.D),
    E: pt(c.E),
    crossings: { P: pt(other), F: pt(c.F), note: "P and F are the two crossings; the page uses F, the one farther from A, as the direction of the bisector." },
    commonChord: {
      line: chord ? { a: round(chord.a), b: round(chord.b), c: round(chord.c) } : null,
      throughA: cl.chordThroughA === true,
      drawnAsChord: c.fallback === true,
      note: "The chord of the two equal circles is the perpendicular bisector of DE; AD = AE puts A on it.",
    },
    incenter: pt(c.incenter),
    distances: {
      AD: maybe(m.AD), AE: maybe(m.AE),
      DF: maybe(m.DF), EF: maybe(m.EF), DE: maybe(m.DE),
      radius: maybe(c.radius), distFToAB: maybe(m.distToAB), distFToAC: maybe(m.distToAC),
    },
    anglesDegrees: {
      BAC: deg(m.angleBAC), half: deg(m.halfAngle),
      DAF: deg(m.leftAngle), FAC: deg(m.rightAngle),
    },
    radiusThreshold: {
      trueMinimum_DE_over_2: maybe(m.minRadius),
      AD_times_sin_half_A: maybe(fromFormula),
      agree: fromFormula !== null && m.minRadius !== null
        ? Math.abs(fromFormula - m.minRadius) <= 1e-6 * m.scale : null,
      euclidRadius_DE: maybe(C.euclidRadius(s)),
      radiusSufficient: cl.radiusSufficient === true,
      note: "The circles first meet at radius DE/2 = AD·sin(A/2), which is less than AD; any larger radius works. Euclid uses DE, making DEF equilateral.",
    },
    degenerate: c.degenerate === true,
    drawingPossible: c.ok === true,
    note:
      "The dotted circle centred at A copies AD onto the other ray, so AD = AE. The two equal circles centred at D and E give DF = EF = radius, so triangles ADF and AEF are congruent and the angles at A match: AF bisects ∠BAC. The chord through both crossings passes through A, and every point on it is equally far from the two rays.",
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For two rays AB and AC from A, a point D on the first ray (given as coefD from A towards B, or as a point D) and a common circle radius: report D, E, the two circle crossings (P and the farther F), the common chord and whether it passes through A, the incenter, the equal lengths AD = AE and DF = EF = radius, the angles ∠BAC, half of it, ∠DAF and ∠FAC in degrees, the distances from F to each ray, and the true minimum radius DE/2 = AD·sin(A/2) compared with Euclid's radius DE. Omit a field to use the illustration's opening position.",
      args: '{ "A": [133.33, 150], "B": [266.67, 150], "C": [163.33, 33.33], "coefD": 0.4, "radius": 84.85 }',
      run: (args) => {
        const C = core();
        return reading(C, readState(args));
      },
    },
    check_claims: {
      describe:
        "Check the illustration's claims for the same angle configuration (A, B, C, coefD or D, radius): AD = AE, DF = EF = radius, the common chord passes through A and contains F, the two angles at A are equal, F and four other points on the line are equally far from both rays, F is the farther crossing, the radius is above the true minimum DE/2 = AD·sin(A/2), and the Euclid-radius case. Returns a boolean for each claim, the failures, and the radius thresholds that explain why a smaller radius can fail.",
      args: '{ "A": [133.33, 150], "B": [266.67, 150], "C": [163.33, 33.33], "coefD": 0.4, "radius": 84.85 }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const m = C.measurements(s);
        const cl = C.claims(s);
        const names = [
          "adEqualsAe", "dfEqualsEf", "chordThroughA", "fOnChord",
          "equalAngles", "equidistant", "locus", "fartherPoint",
          "radiusSufficient", "euclidEquilateral",
        ] as const;
        const failed = names.filter((k) => cl[k] !== true);
        return {
          adEqualsAe: cl.adEqualsAe === true,
          dfEqualsEf: cl.dfEqualsEf === true,
          chordThroughA: cl.chordThroughA === true,
          fOnChord: cl.fOnChord === true,
          equalAngles: cl.equalAngles === true,
          equidistant: cl.equidistant === true,
          locus: cl.locus === true,
          fartherPoint: cl.fartherPoint === true,
          radiusSufficient: cl.radiusSufficient === true,
          euclidEquilateral: cl.euclidEquilateral === true,
          allHold: failed.length === 0,
          failed,
          radius: round(C.radius(s)),
          trueMinimum: maybe(m.minRadius),
          euclidRadius_DE: maybe(C.euclidRadius(s)),
          note: failed.length
            ? "The circles may still be too small to cross: the true minimum is DE/2 = AD·sin(A/2), less than AD but not zero. Move the rays apart or drag R outward, then check again."
            : "Every claim holds here: the common chord through A is the bisector, and F is equally far from the two rays. A radius just above DE/2 would already be enough; DE is Euclid's larger, equilateral choice.",
        };
      },
    },
  };
}

/** The page's saved state, with the core's reading of that position. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = readState(state);
  return {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    coefD: round(s.coefD), radius: round(s.radius), R: pt(s.R),
    reading: reading(C, s),
  };
}
