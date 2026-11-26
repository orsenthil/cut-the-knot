/*
 * run_game_logic actions and saved-position reader for ABOnCircumcircle
 * (Bogomolny's "Angle Bisectors On Circumcircle").
 *
 * For a triangle A, B, C the three internal bisectors meet the circumcircle
 * again at D, E, F. Each of those is an arc midpoint (BD = CD, CE = AE,
 * AF = BF), the bisectors concur at the incenter I, and AD meets EF at right
 * angles at M. The angle chase in the hint is ∠IFM = ∠CFE = ∠CBE = B/2 and
 * ∠FIM = A/2 + C/2, so the third angle of triangle FIM is 90°.
 *
 * Every number below comes from the game's real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["ab-on-circumcircle"].AbOnCircumcircleCore;

type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };

const ANGLE_TOL = 1e-8; // radians / direction cosines
const DIST_TOL = 1e-6;  // drawing units
const round = (v: number) => Math.round(v * 1e4) / 1e4;
const deg = (radians: number) => Math.round(radians * 180000 / Math.PI) / 1000;
const xy = (p: Point) => ({ x: round(p.x), y: round(p.y) });
const near = (a: number, b: number, tol: number) => Math.abs(a - b) < tol;

/** Accept [x, y] or { x, y }; the page saves objects, JSON args are arrays. */
function readPoint(v: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(v) && v.length === 2) {
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} needs finite x and y`);
  return { x, y };
}

/** Saved fields may be absent; never fail just because a drawing was incomplete. */
function savedPoint(v: unknown): { x: number; y: number } | null {
  try { return xy(readPoint(v, "point")); } catch { return null; }
}

function readTriangle(args: Json): Triangle {
  const C = core();
  const home = C.start({});
  const A = args.A === undefined ? home.A : readPoint(args.A, "A");
  const B = args.B === undefined ? home.B : readPoint(args.B, "B");
  const Cc = args.C === undefined ? home.C : readPoint(args.C, "C");
  if (C.dist(A, B) < 1e-9 || C.dist(B, Cc) < 1e-9 || C.dist(Cc, A) < 1e-9) {
    throw new Error("A, B and C must be three different points");
  }
  if (Math.abs(C.cross(C.sub(B, A), C.sub(Cc, A))) < 1e-9) {
    throw new Error("A, B and C must not lie on one line");
  }
  return { A, B, C: Cc };
}

function build(C: any, t: Triangle) {
  const g = C.compute(t.A, t.B, t.C);
  if (!g) throw new Error("those three points do not define a circle and a triangle");
  return g;
}

/** Cosine of the angle between the lines pq and rs; 0 means perpendicular. */
function lineCosine(C: any, p: Point, q: Point, r: Point, s: Point): number {
  return C.dot(C.unit(C.sub(q, p)), C.unit(C.sub(s, r)));
}

/** The construction: circle, arc midpoints, incenter, M and the basic facts. */
function outline(C: any, g: any) {
  const cosADef = lineCosine(C, g.A, g.D, g.E, g.F);
  const ame = C.angle(g.M, g.A, g.E);
  return {
    circle: { center: xy(g.circle.c), radius: round(g.circle.r) },
    arcMidpoints: {
      D: xy(g.D), E: xy(g.E), F: xy(g.F),
      of: "D is the midpoint of arc BC, E of arc CA, F of arc AB",
      onCircle: [g.D, g.E, g.F].map((p: Point) => near(C.dist(p, g.circle.c), g.circle.r, DIST_TOL)),
    },
    incenter: xy(g.I),
    intersectionM: xy(g.M),
    anglesDegrees: { A: deg(g.angles.A), B: deg(g.angles.B), C: deg(g.angles.C) },
    sides: { BC: round(g.sides.a), CA: round(g.sides.b), AB: round(g.sides.c) },
    perpendicularAtM: {
      AD_vs_EF_cosine: round(cosADef),
      angleAME: deg(ame),
      holds: Math.abs(cosADef) < ANGLE_TOL && near(ame, Math.PI / 2, ANGLE_TOL),
    },
  };
}

/** The measured equalities the page proves; checks use unrounded values. */
function proof(C: any, g: any) {
  const halfB = g.angles.B / 2;
  const halfAC = (g.angles.A + g.angles.C) / 2;
  const IFM = C.angle(g.F, g.I, g.M);
  const FIM = C.angle(g.I, g.F, g.M);
  const FMI = C.angle(g.M, g.F, g.I);
  const CFE = C.angle(g.F, g.C, g.E);
  const CBE = C.angle(g.B, g.C, g.E);

  const chords = {
    BD: C.dist(g.B, g.D), CD: C.dist(g.C, g.D),
    CE: C.dist(g.C, g.E), AE: C.dist(g.A, g.E),
    AF: C.dist(g.A, g.F), BF: C.dist(g.B, g.F),
  };
  const onBisectors = {
    AD: C.distanceToLine(g.I, g.A, g.D),
    BE: C.distanceToLine(g.I, g.B, g.E),
    CF: C.distanceToLine(g.I, g.C, g.F),
  };
  const toSides = {
    AB: C.distanceToLine(g.I, g.A, g.B),
    BC: C.distanceToLine(g.I, g.B, g.C),
    CA: C.distanceToLine(g.I, g.C, g.A),
  };
  const perp = {
    AD_EF: lineCosine(C, g.A, g.D, g.E, g.F),
    BE_FD: lineCosine(C, g.B, g.E, g.F, g.D),
    CF_DE: lineCosine(C, g.C, g.F, g.D, g.E),
  };

  return {
    angleChase: {
      B_over_2: deg(halfB),
      angleIFM: deg(IFM), angleCFE: deg(CFE), angleCBE: deg(CBE),
      angleFIM: deg(FIM), A_over_2_plus_C_over_2: deg(halfAC),
      angleFMI: deg(FMI),
      allHold: near(IFM, halfB, ANGLE_TOL) && near(CFE, halfB, ANGLE_TOL)
        && near(CBE, halfB, ANGLE_TOL) && near(FIM, halfAC, ANGLE_TOL)
        && near(FMI, Math.PI / 2, ANGLE_TOL),
    },
    equalChords: {
      BD_CD: { BD: round(chords.BD), CD: round(chords.CD) },
      CE_AE: { CE: round(chords.CE), AE: round(chords.AE) },
      AF_BF: { AF: round(chords.AF), BF: round(chords.BF) },
      allHold: near(chords.BD, chords.CD, DIST_TOL)
        && near(chords.CE, chords.AE, DIST_TOL)
        && near(chords.AF, chords.BF, DIST_TOL),
    },
    incenter: {
      distanceFromBisectors: {
        AD: round(onBisectors.AD), BE: round(onBisectors.BE), CF: round(onBisectors.CF),
      },
      onAllThree: Object.values(onBisectors).every((d) => Math.abs(d) < DIST_TOL),
      distanceFromSides: { AB: round(toSides.AB), BC: round(toSides.BC), CA: round(toSides.CA) },
      equidistantFromSides: near(toSides.AB, toSides.BC, DIST_TOL)
        && near(toSides.BC, toSides.CA, DIST_TOL),
    },
    perpendiculars: {
      cosines: { AD_EF: round(perp.AD_EF), BE_FD: round(perp.BE_FD), CF_DE: round(perp.CF_DE) },
      allRight: Object.values(perp).every((c) => Math.abs(c) < ANGLE_TOL),
    },
    note: `∠IFM = ∠CFE = ∠CBE = B/2 = ${deg(halfB)}°, ∠FIM = A/2 + C/2 = ${deg(halfAC)}°, so the angle at M is 90°.`,
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a triangle with corners A, B, C (as [x, y] or { x, y }), report its circumcircle, the three arc-midpoints D, E, F where the angle bisectors meet it again, the incenter I, the crossing M = AD ∩ EF, the angles and sides, and a check that AD is perpendicular to EF.",
      args: '{ "A": [200, 60], "B": [100, 240], "C": [300, 240] }',
      run: (args) => {
        const C = core();
        const g = build(C, readTriangle(args));
        return {
          ...outline(C, g),
          note: "D, E and F bisect arcs BC, CA and AB; the three bisectors pass through I, and AD meets EF at a right angle at M.",
        };
      },
    },
    check_relations: {
      describe:
        "For the same triangle, verify the facts the page proves: equal chords BD=CD, CE=AE, AF=BF, the incenter on all three bisectors and equidistant from the sides, the angle chase ∠IFM=∠CFE=∠CBE=B/2 and ∠FIM=A/2+C/2, and the three perpendicular pairs AD⊥EF, BE⊥FD, CF⊥DE. Each equality comes with measured residuals.",
      args: '{ "A": [255, 63.4], "B": [119.1, 208.8], "C": [280.9, 208.8] }',
      run: (args) => {
        const C = core();
        return proof(C, build(C, readTriangle(args)));
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const t = readTriangle(state);
  const g = C.compute(t.A, t.B, t.C);
  const options = (state.options && typeof state.options === "object")
    ? state.options as Json
    : C.start({}).options;
  const saved = {
    A: xy(t.A), B: xy(t.B), C: xy(t.C),
    D: savedPoint(state.D), E: savedPoint(state.E), F: savedPoint(state.F),
    I: savedPoint(state.I), M: savedPoint(state.M),
    circle: state.circle && typeof state.circle === "object"
      ? { c: savedPoint((state.circle as Json).c), r: Number((state.circle as Json).r) }
      : null,
    options: {
      names: options.names !== false,
      statement: options.statement === true,
      hint: options.hint === true,
    },
  };
  if (!g) {
    return { stateVersion, ...saved, note: "The saved corners no longer make a triangle." };
  }
  return {
    stateVersion,
    ...saved,
    reading: { ...outline(C, g), ...proof(C, g) },
    note: C.describe({ A: t.A, B: t.B, C: t.C, options }),
  };
}
