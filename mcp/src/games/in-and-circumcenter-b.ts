/*
 * run_game_logic actions and saved-position reader for In And Circumcenter B.
 *
 * The real core is in-and-circumcenter-b/in-and-circumcenter-b-core.js, copied
 * into src/generated/cores/ at build time; every number below is measured by
 * it. Coordinates are board units in the page's SVG (y down), 360 x 360 at the
 * opening picture.
 *
 * Put D on ray B->C with BD = AB and E on ray A->C with AE = AB, and compare
 * the line DE with IO, where I and O are the incenter and circumcenter. F is
 * the second meeting of AI with the circumcircle and M is where AI meets BE.
 * Because AB = AE, AI is the perpendicular bisector of BE, so M is the
 * midpoint of BE and FB = FE; with BF = IF a quarter turn carries angle IFO
 * to angle DBE, so IO is perpendicular to DE for every triangle. For the
 * length, AB = 2R sin(C), so DE = 2*IO*sin(C): equality holds at C = 30
 * degrees (the page's claim) and also at C = 150 degrees, which it omits. It
 * is the angle at corner C that matters, and D is a copied-length point, not
 * a corner. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Corner = "A" | "B" | "C";
type Tri = Record<Corner, Pt>;
type State = Tri & {
  showNames: boolean; showStatement: boolean; showPremise: boolean; showHint: boolean;
  moves: number; explored: boolean;
};
type Geometry = {
  degenerate: boolean;
  A: Pt; B: Pt; C: Pt; I: Pt; O: Pt; D: Pt; E: Pt; F: Pt | null; M: Pt; S: Pt;
  inRadius: number; outRadius: number; angleC: number; IO: number; DE: number;
};
type Residuals = {
  orthogonality: number; ratioError: number; bfEqualsEf: number; bfEqualsIf: number;
  beEqualsIf: number; mIsMidpoint: number; sOnBothLines: number;
};
type Core = {
  WIDTH: number; HEIGHT: number; NAMES: Corner[]; MIN_SEPARATION: number; EDGE: number;
  dist(p: Pt, q: Pt): number;
  angle(a: Pt, b: Pt, c: Pt): number;
  rotate(p: Pt, q: Pt, t: number, sign: number): Pt;
  start(options?: Partial<State>): State;
  compute(state: State): Geometry;
  claims(g: Geometry): Residuals | null;
  result(state: State): string | null;
};

const core = (): Core =>
  cores["in-and-circumcenter-b"].InAndCircumcenterBCore as unknown as Core;

const DEG = 180 / Math.PI;
const TOL = 1e-6;
const PERP_TOL = 1e-8;
const NOTE_FM =
  "Because AB = AE the bisector AI is the perpendicular bisector of BE, so M is the midpoint of BE and FB = FE. " +
  "An inscribed angle on chord AB gives angle BFE = 2*C, and the proof also has BF = IF; a quarter turn takes angle IFO to angle DBE, so IO is at right angles to DE. ";
const NOTE_LENGTH =
  "A chord AB in a circle of radius R has AB = 2R sin(C), so DE = 2*IO*sin(C). At C = 30 degrees this gives R = AB, OF = OA = AB = BD, and with IF = BE the triangles IFO and BDE agree by side-angle-side, hence IO = DE. " +
  "Since sin(150) = sin(30), equality also holds at C = 150 degrees, a case the page does not mention; it is the angle at corner C that matters, and D is the point on ray B->C with BD = AB, not a corner.";

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(2));
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const deg = (rad: number): number => rad * DEG;
const near = (a: number, b: number, tol = TOL): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

function objectArgs(args: Json, label = "arguments"): Json {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error(`${label} must be an object`);
  }
  return args;
}

function readBool(raw: unknown, label: string, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") {
    throw new Error(`${label} must be true or false, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

/** A point as the page saves it ({ x, y }) or as a short [x, y] argument. */
function readPoint(raw: unknown, label: string, fallback: Pt): Pt {
  if (raw === undefined || raw === null) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** A real core state: corners and the four applet switches, with defaults. */
function buildState(C: Core, args: Json): State {
  const a = objectArgs(args);
  const seed = C.start({});
  return C.start({
    A: readPoint(a.A, '"A"', seed.A),
    B: readPoint(a.B, '"B"', seed.B),
    C: readPoint(a.C, '"C"', seed.C),
    showNames: readBool(a.showNames, '"showNames"', seed.showNames),
    showStatement: readBool(a.showStatement, '"showStatement"', seed.showStatement),
    showPremise: readBool(a.showPremise, '"showPremise"', seed.showPremise),
    showHint: readBool(a.showHint, '"showHint"', seed.showHint),
  });
}

/** Everything the real core can say about one triangle. */
function reading(C: Core, s: State) {
  const g = C.compute(s);
  const triangle = { A: pt(s.A), B: pt(s.B), C: pt(s.C) };
  if (g.degenerate) {
    return {
      valid: false as const,
      degenerate: true as const,
      triangle,
      note:
        "The three corners are collinear or too close together, so the applet's line/circle intersections fail. Move one corner off the line to make a triangle.",
    };
  }
  const r = C.claims(g);
  if (!r) {
    return {
      valid: false as const, degenerate: true as const, triangle,
      note: "The core could not form the construction at these corners.",
    };
  }
  const AB = C.dist(s.A, s.B);
  const expectedRatio = 2 * Math.sin(g.angleC);
  const ratio = g.IO > 0 ? g.DE / g.IO : NaN;
  const circumRadiusFormula = AB / (2 * Math.sin(g.angleC));
  const d = deg(g.angleC);
  const degrees = r6(d);
  return {
    valid: true as const,
    degenerate: false as const,
    triangle,
    angleC: { radians: r6(g.angleC), degrees },
    centres: { I: pt(g.I), O: pt(g.O) },
    copiedPoints: {
      D: pt(g.D), E: pt(g.E),
      AB: r6(AB), BD: r6(C.dist(s.B, g.D)), AE: r6(C.dist(s.A, g.E)),
    },
    helpers: {
      F: pt(g.F), M: pt(g.M), S: pt(g.S),
      BF: r6(C.dist(g.B, g.F!)), EF: r6(C.dist(g.E, g.F!)),
      IF: r6(C.dist(g.I, g.F!)), BE: r6(C.dist(g.B, g.E)),
      angleBFE: g.F ? r6(deg(C.angle(g.F, g.B, g.E))) : null,
    },
    lengths: {
      DE: r6(g.DE), IO: r6(g.IO),
      ratio: sig(ratio), expectedRatio: sig(expectedRatio),
      circumRadius: r6(g.outRadius), circumRadiusFromChord: sig(circumRadiusFormula),
    },
    residuals: {
      orthogonality: sig(r.orthogonality),
      ratioError: sig(r.ratioError),
      bfMinusEf: sig(r.bfEqualsEf),
      bfMinusIf: sig(r.bfEqualsIf),
      beMinusIf: sig(r.beEqualsIf),
      mFromMidpoint: sig(r.mIsMidpoint),
      sOffBothLines: sig(r.sOnBothLines),
    },
    checks: {
      perpendicular: r.orthogonality < PERP_TOL,
      ratioFormula: r.ratioError < 1e-8,
      bfEqualsEf: r.bfEqualsEf < 1e-7,
      bfEqualsIf: r.bfEqualsIf < 1e-7,
      mIsMidpoint: r.mIsMidpoint < 1e-7,
      sOnBothLines: r.sOnBothLines < 1e-8,
      circumradiusFromChord: Math.abs(g.outRadius - circumRadiusFormula) < 1e-7,
      deEqualsIo: near(g.DE, g.IO, 1e-6),
      equalityAngle: near(d, 30, 1e-4) || near(d, 150, 1e-4),
    },
    status: C.result(s),
  };
}

/** A triangle whose angle at corner C is `degrees`, using the core's rotate. */
function triangleWithAngleC(C: Core, degrees: number, radius = 150): Tri {
  const V: Pt = { x: 90, y: 90 };       // corner C, the angle in question
  const A: Pt = { x: 120, y: 288 };     // fixes the first arm C->A
  const arm = C.rotate(V, A, -degrees / DEG, 1);
  const dx = arm.x - V.x, dy = arm.y - V.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) throw new Error(`cannot build a triangle with C = ${degrees} degrees`);
  return {
    A,
    B: { x: V.x + (dx / len) * radius, y: V.y + (dy / len) * radius },
    C: V,
  };
}

function readAngles(args: Json): number[] {
  const raw = args.angles;
  if (raw === undefined || raw === null) return [30, 60, 90, 150];
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 12) {
    throw new Error('"angles" must be an array of 1 to 12 angles in degrees');
  }
  return raw.map((v, i) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n >= 180) {
      throw new Error(`angles[${i}] must be strictly between 0 and 180 degrees, got ${JSON.stringify(v)}`);
    }
    return n;
  });
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or { x, y } on the page's 360 x 360 board, y down; omit any for the opening picture), run the real core and report the incenter I, circumcenter O, the copied points D (on ray B->C with BD = AB) and E (on ray A->C with AE = AB), the proof helpers F (second meeting of AI with the circumcircle) and M (midpoint of BE), and the crossing S of IO with DE. Returns the angle at C, the lengths DE and IO with the ratio DE/IO against 2 sin(C), and the core's residuals for perpendicularity, BF = EF, BF = IF, BE = IF, M the midpoint of BE, and S on both lines. showNames, showStatement, showPremise and showHint may be set; a collinear triangle is reported degenerate.",
      args: '{ "A": [120, 288], "B": [264, 240], "C": [90, 90], "showHint": true }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        return {
          builtFrom: "given corners",
          options: {
            showNames: s.showNames, showStatement: s.showStatement,
            showPremise: s.showPremise, showHint: s.showHint,
          },
          reading: r,
          note: !r.valid
            ? r.note
            : NOTE_FM + NOTE_LENGTH + " This is an illustration with no win or loss; the tracker records exploration.",
        };
      },
    },

    length_equality: {
      describe:
        "Build triangles whose angle at corner C is each value in 'angles' (degrees, default [30, 60, 90, 150]; 1 to 12 values strictly between 0 and 180) with the second arm of length 'radius' (default 150), using the core's own rotate and compute, and report IO, DE, the ratio DE/IO against 2 sin(C), the circumradius and whether DE = IO. Shows equality exactly at C = 30 degrees (the page's claim) and also at C = 150 degrees because sin(150) = sin(30), a case the page omits; the angle at C, not at A or B, controls it, and D is the copied-length point on ray B->C with BD = AB, not a corner.",
      args: '{ "angles": [30, 60, 90, 150] }',
      run: (args) => {
        const a = objectArgs(args);
        const C = core();
        const radius = num(a, "radius", 150);
        if (!(radius > 1) || radius > 1000) {
          throw new Error('"radius" must be between 1 and 1000 board units');
        }
        const rows = readAngles(a).map((degrees) => {
          // compute() uses the corners as given; start() would clamp them to the
          // board and change the very angle we are asking about.
          const s: State = { ...C.start({}), ...triangleWithAngleC(C, degrees, radius) };
          const rd = reading(C, s);
          return {
            requestedDegrees: degrees,
            corners: rd.triangle,
            measuredAngleC: rd.valid ? rd.angleC.degrees : null,
            IO: rd.valid ? rd.lengths.IO : null,
            DE: rd.valid ? rd.lengths.DE : null,
            ratio: rd.valid ? rd.lengths.ratio : null,
            expectedRatio: rd.valid ? rd.lengths.expectedRatio : null,
            circumRadius: rd.valid ? rd.lengths.circumRadius : null,
            deEqualsIo: rd.valid ? rd.checks.deEqualsIo : null,
            valid: rd.valid,
          };
        });
        return {
          formula: "DE = 2 * IO * sin(C)",
          equalityAngles: [30, 150],
          radius,
          rows,
          note: NOTE_LENGTH,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported In And Circumcenter B state version ${stateVersion}`);
  }
  const src = objectArgs(state, "saved In And Circumcenter B position");
  const C = core();
  const seed = C.start({});
  const saved = {
    A: readPoint(src.A, '"A"', seed.A),
    B: readPoint(src.B, '"B"', seed.B),
    C: readPoint(src.C, '"C"', seed.C),
    showNames: readBool(src.showNames, '"showNames"', seed.showNames),
    showStatement: readBool(src.showStatement, '"showStatement"', seed.showStatement),
    showPremise: readBool(src.showPremise, '"showPremise"', seed.showPremise),
    showHint: readBool(src.showHint, '"showHint"', seed.showHint),
    moves: num(src, "moves", 0),
    explored: readBool(src.explored, '"explored"', false),
  };
  if (!Number.isInteger(saved.moves) || saved.moves < 0) {
    throw new Error('"moves" must be a non-negative whole number');
  }
  const s: State = { ...C.start(saved), moves: saved.moves, explored: saved.explored };
  const r = reading(C, s);
  return {
    ...src,
    stateVersion,
    saved: {
      A: pt(saved.A), B: pt(saved.B), C: pt(saved.C),
      showNames: saved.showNames, showStatement: saved.showStatement,
      showPremise: saved.showPremise, showHint: saved.showHint,
      moves: saved.moves, explored: saved.explored,
    },
    valid: r.valid,
    ...(r.valid
      ? {
          reading: r,
          angleCdegrees: r.angleC.degrees,
          centres: r.centres,
          copiedPoints: r.copiedPoints,
          lengths: r.lengths,
          checks: r.checks,
        }
      : {}),
    note:
      "Track.state saved the three draggable corners, the four applet switches, the move count and whether the picture has been explored; the page does not save the derived points. " +
      (!r.valid
        ? r.note
        : `The real core rebuilds I, O, D, E, F, M and S from those corners: angle C is ${r.angleC.degrees} degrees, DE = ${r.lengths.DE}, IO = ${r.lengths.IO} and DE/IO = ${r.lengths.ratio} against 2 sin(C) = ${r.lengths.expectedRatio}. ` +
          NOTE_FM + NOTE_LENGTH),
  };
}
