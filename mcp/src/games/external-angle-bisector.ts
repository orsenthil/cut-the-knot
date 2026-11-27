/*
 * run_game_logic actions and saved-position reader for External Angle Bisector.
 *
 * The real core is external-angle-bisector/external-angle-bisector-core.js,
 * copied into src/generated/cores/ at build time. Drag the corners of triangle
 * ABC: the line through A perpendicular to the inside bisector is the outside
 * bisector, meeting line BC at D (outside the segment unless |AB| = |AC|). Both
 * the inside foot F and the outside foot D cut BC in the ratio AB/AC, the
 * Angle Bisector Theorem. The parallel through C to AD meets AB at E; then
 * AE = AC, similar triangles BEC and BAD give the ratio, and the excenter
 * opposite A is where the inside bisector at A meets the outside bisectors at
 * B and C. One wording fix: the original page ends its angle calculation with
 * "90° = BAC/2", which is false; the true identity proved there is
 * angle AEC = angle ACE = 90° − BAC/2. The core checks both.
 *
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = { A: Pt; B: Pt; C: Pt; showNames: boolean; hint: boolean; extra: boolean };
type Sides = { a: number; b: number; c: number };
type Angles = {
  BAC: number;
  AEC: number | null;
  ACE: number | null;
  halfComplement: number;
  externalWithChosen: number;
  externalWithReflection: number;
};
type Ratios = {
  AB_AC: number | null;
  internalDB_DC: number | null;
  externalDB_DC: number | null;
  AE_AC: number | null;
  BE_BA: number | null;
  BC_BD: number | null;
  CE_AD: number | null;
};
type Measure = {
  A: Pt; B: Pt; C: Pt;
  sides: Sides;
  degenerate: boolean;
  doubleArea: number;
  D: Pt | null; F: Pt | null; parallel: Pt; E: Pt | null; testD: Pt | null;
  direction: Pt; bisPoint: Pt; inside: boolean; chosen: Pt; reflected: Pt;
  t: number | null;
  angles: Angles;
  ratios: Ratios;
  showNames: boolean; hint: boolean; extra: boolean;
};
type Claims = {
  internalRatio: boolean; externalRatio: boolean; perpendicular: boolean;
  AE_equals_AC: boolean; CE_parallel_AD: boolean; similarTriangles: boolean;
  bisectsExternalAngle: boolean; correctedAngle: boolean; concurrence: boolean;
  printedAngle: boolean;
};
type Core = {
  start(options?: Json): State;
  withPoint(s: State, name: "A" | "B" | "C", p: Pt): State;
  withOption(s: State, name: "showNames" | "hint" | "extra", value: boolean): State;
  measurements(s: State): Measure;
  claims(s: State): Claims;
  excenter(s: State): Pt | null;
  distance(p: Pt, q: Pt): number;
  result(s: State): unknown;
};

const core = (): Core =>
  cores["external-angle-bisector"].ExternalAngleBisectorCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const deg = (v: number | null): number | null =>
  v === null || !Number.isFinite(v) ? null : round((v * 180) / Math.PI);
const ratio = (v: number | null): number | null =>
  v === null || !Number.isFinite(v) ? null : round(v);

/** A corner as the client sends it: [x, y] or { x, y }. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readBool(args: Json, key: string, dflt: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return dflt;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/**
 * Real core state: supplied corners are page drags; omitted ones stay at the
 * opening picture. `defaults` supplies the three checkbox values when absent.
 */
function buildState(args: Json, C: Core, defaults?: State): State {
  let s = C.start({});
  for (const name of ["A", "B", "C"] as const) {
    const v = args[name];
    if (v !== undefined && v !== null) s = C.withPoint(s, name, readPoint(v, name));
  }
  const d = defaults || s;
  return C.withOption(
    C.withOption(
      C.withOption(s, "showNames", readBool(args, "showNames", d.showNames)),
      "hint", readBool(args, "hint", d.hint),
    ),
    "extra", readBool(args, "extra", d.extra),
  );
}

/** One fresh measurement and claim check, laid out for a tutor. */
function analyse(C: Core, s: State) {
  const m = C.measurements(s);
  const cl = C.claims(s);
  const X = C.excenter(s);
  return {
    s, m, cl, X,
    corners: { A: pt(m.A), B: pt(m.B), C: pt(m.C) },
    options: { showNames: s.showNames, hint: s.hint, extra: s.extra },
    degenerate: m.degenerate,
    sides: { a: round(m.sides.a), b: round(m.sides.b), c: round(m.sides.c) },
    feet: { F: pt(m.F), D: pt(m.D) },
    ratios: {
      AB_AC: ratio(m.ratios.AB_AC),
      internalDB_DC: ratio(m.ratios.internalDB_DC),
      externalDB_DC: ratio(m.ratios.externalDB_DC),
      AE_AC: ratio(m.ratios.AE_AC),
      BE_BA: ratio(m.ratios.BE_BA),
      BC_BD: ratio(m.ratios.BC_BD),
      CE_AD: ratio(m.ratios.CE_AD),
    },
    anglesDeg: {
      BAC: deg(m.angles.BAC),
      AEC: deg(m.angles.AEC),
      ACE: deg(m.angles.ACE),
      halfComplement: deg(m.angles.halfComplement),
      externalWithChosen: deg(m.angles.externalWithChosen),
      externalWithReflection: deg(m.angles.externalWithReflection),
    },
    excenter: pt(X),
  };
}

export function actions(): GameActions {
  return {
    ratio_check: {
      describe:
        "Build triangle ABC from the given corners (each [x, y] or { x, y }; omit any for the applet's opening triangle) and report side lengths a = |BC|, b = |CA|, c = |AB|, the inside foot F and outside foot D on line BC, and the core's check of AB/AC = DB/DC for both. It also checks that the two bisectors are perpendicular and returns invalid=true when the corners collapse to a line, where there is no genuine foot. showNames, hint and extra may be set as booleans.",
      args: '{"A":[203,230],"B":[300,230],"C":[225,61.7]}',
      run: (args) => {
        const C = core();
        const r = analyse(C, buildState(args, C));
        return {
          corners: r.corners, options: r.options, degenerate: r.degenerate,
          sides: r.sides,
          feet: r.feet,
          ratios: {
            AB_AC: r.ratios.AB_AC,
            internalDB_DC: r.ratios.internalDB_DC,
            externalDB_DC: r.ratios.externalDB_DC,
          },
          checks: {
            internalRatio: r.cl.internalRatio,
            externalRatio: r.cl.externalRatio,
            perpendicular: r.cl.perpendicular,
            bisectsExternalAngle: r.cl.bisectsExternalAngle,
          },
          note: r.degenerate
            ? "The corners are collinear or collapsed, so there is no triangle and the feet are hidden; move a corner away."
            : r.cl.internalRatio && r.cl.externalRatio
              ? `Both feet cut line BC in the ratio AB/AC = |AB|/|CA| = ${r.ratios.AB_AC}: the inside foot F gives DB/DC = ${r.ratios.internalDB_DC} and the outside foot D gives ${r.ratios.externalDB_DC}, the Angle Bisector Theorem. The two bisectors at A are at right angles.`
              : "The core did not find the expected ratio here; drag the corners to a non-degenerate triangle and try again. This is an illustration, so there is no win or loss.",
        };
      },
    },

    proof_and_concurrence: {
      describe:
        "For the same triangle, report the parallel through C to AD meeting line AB at E, the check AE = AC, the similar-triangle ratios BE/BA = BC/BD = CE/AD that carry the ratio across, and the angles in degrees. It checks the corrected angle identity angle AEC = angle ACE = 90° − BAC/2 and confirms the original page's printed '90° = BAC/2' is false. It also returns the excenter where the inside bisector at A meets the outside bisectors at B and C (one inside and two outside bisectors are concurrent).",
      args: '{"A":[203,230],"B":[300,230],"C":[225,61.7]}',
      run: (args) => {
        const C = core();
        const r = analyse(C, buildState(args, C));
        return {
          corners: r.corners, options: r.options, degenerate: r.degenerate,
          auxiliary: { E: r.m.E ? pt(r.m.E) : null, D: r.feet.D },
          lengths: { AC: r.sides.b, AE: r.m.E ? round(C.distance(r.m.A, r.m.E)) : null },
          construction: {
            AE_AC: r.ratios.AE_AC,
            AE_equals_AC: r.cl.AE_equals_AC,
            CE_parallel_AD: r.cl.CE_parallel_AD,
            similarTriangles: {
              BE_BA: r.ratios.BE_BA, BC_BD: r.ratios.BC_BD, CE_AD: r.ratios.CE_AD,
              holds: Boolean(r.cl.similarTriangles),
            },
          },
          anglesDeg: r.anglesDeg,
          angleChecks: {
            correctedAngle: r.cl.correctedAngle,
            printedAngle: r.cl.printedAngle,
          },
          concurrence: { excenter: r.excenter, holds: r.cl.concurrence },
          note: r.degenerate
            ? "The corners are collinear or collapsed, so E, the equal-angle marks and the excenter cannot be formed."
            : `The parallel through C meets AB at E with AE/AC = ${r.ratios.AE_AC}, so AE = AC and triangle AEC is isosceles; triangles BEC and BAD are similar and give BE/BA = BC/BD = CE/AD. Angle AEC = angle ACE = ${r.anglesDeg.halfComplement}°, i.e. 90° − BAC/2 (BAC = ${r.anglesDeg.BAC}°) — the core confirms this and rejects the page's printed "90° = BAC/2". One inside and two outside bisectors meet at the excenter ${r.excenter ? `(${r.excenter.x}, ${r.excenter.y})` : "(none)"}.`,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of those same corners. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported External Angle Bisector state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" ? state : ({} as Json);
  let s: State;
  let savedReadable = true;
  try {
    s = buildState(src, C, C.start());
  } catch {
    s = C.start();
    savedReadable = false;
  }
  const r = analyse(C, s);
  return {
    ...src,
    stateVersion,
    savedReadable,
    saved: {
      A: r.corners.A, B: r.corners.B, C: r.corners.C,
      showNames: s.showNames, hint: s.hint, extra: s.extra,
    },
    degenerate: r.degenerate,
    sides: r.sides,
    feet: r.feet,
    ratios: r.ratios,
    anglesDeg: r.anglesDeg,
    checks: {
      internalRatio: r.cl.internalRatio,
      externalRatio: r.cl.externalRatio,
      perpendicular: r.cl.perpendicular,
      AE_equals_AC: r.cl.AE_equals_AC,
      CE_parallel_AD: r.cl.CE_parallel_AD,
      similarTriangles: Boolean(r.cl.similarTriangles),
      bisectsExternalAngle: r.cl.bisectsExternalAngle,
      correctedAngle: r.cl.correctedAngle,
      printedAngle: r.cl.printedAngle,
      concurrence: r.cl.concurrence,
    },
    excenter: r.excenter,
    result: C.result(s),
    note: !savedReadable
      ? "The saved corners could not be read, so the core reading below is from the applet's opening triangle."
      : r.degenerate
        ? "The saved corners are collinear or collapsed; the core cannot check the bisector construction here."
        : `Track.state saved the three corners and the showNames/hint/extra toggles; the core rebuilds the inside foot F and outside foot D, the point E, the excenter and the angles from them. Both feet cut BC in ratio AB/AC = ${r.ratios.AB_AC}, AE = AC, and angle AEC = angle ACE = ${r.anglesDeg.halfComplement}° = 90° − BAC/2 (the printed "90° = BAC/2" is false). This is an illustration, so there is no win or loss.`,
  };
}
