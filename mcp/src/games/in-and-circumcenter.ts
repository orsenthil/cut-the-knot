/*
 * run_game_logic actions and saved-position reader for In And Circumcenter,
 * Bogomolny's "A Property of the Line IO" (the base applet).
 *
 * The real core is in-and-circumcenter/in-and-circumcenter-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units of the page's 450 x 450 SVG, with y down.
 *
 * Lay the side AB off along the two sides through C: BD = AE = AB, then join
 * D to E. For every triangle DE crosses the line joining the incenter I to the
 * circumcenter O at a right angle, and the lengths obey DE = 2·IO·sin(C). So
 * at C = 30 degrees (also 150) DE = IO, while the perpendicularity needs no
 * angle at all. The core reproduces the applet's Compute(): rotations for I,
 * two perpendicular bisectors for O, PlacePoint for D and E, midpoints and
 * perpendicular feet for the hint, and the intersection S of IO with DE.
 *
 * This is the BASE applet, whose hint uses midpoints A', B', feet X, Y and the
 * points D', E'. It is not the sibling applets B (a point on the circumcircle
 * and equilateral triangles), C (excenters and their radical axis) or D (a
 * circle centred at I through O): those share the premise but use different
 * proofs and have their own cores. This is an illustration, so there is no win
 * or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = { A: Pt; B: Pt; C: Pt };
type Sides = { a: number; b: number; c: number };
type Segment = [Pt, Pt];
type Parallels = Record<"A" | "B" | "C", Segment>;
type Measurements = {
  A: Pt; B: Pt; C: Pt;
  sides: Sides; angleC: number;
  I: Pt; rIn: number; O: Pt; rOut: number;
  D: Pt; E: Pt; Ap: Pt; Bp: Pt; Dp: Pt; Ep: Pt; X: Pt; Y: Pt;
  IO: Segment; DE: Segment; S: Pt; markPoint: Pt;
  deLength: number; ioLength: number; expectedDe: number;
  parallels: Parallels;
  extra: [Segment | null, Segment | null];
  doubleArea: number; degenerate: boolean;
};
type Claims = {
  nonDegenerate: boolean; bdEqualsAb: boolean; aeEqualsAb: boolean;
  iIsIncenter: boolean; oIsCircumcenter: boolean; dePerpendicularIo: boolean;
  deEqualsFormula: boolean; rightMarkAtS: boolean; threeParallel: boolean;
  all: boolean;
};
type Core = {
  start(options?: { points?: State; width?: number; height?: number }): State;
  withPoint(s: State, name: string, p: Pt): State;
  withAngleC(s: State, degrees: number): State;
  dist(p: Pt, q: Pt): number;
  cross(p: Pt, q: Pt, r: Pt): number;
  dot(u: Pt, v: Pt): number;
  measurements(s: State): Measurements;
  claims(s: State): Claims;
  parallelLines(s: State): Parallels;
  result(s: State): null;
};

const core = (): Core =>
  cores["in-and-circumcenter"].InAndCircumcenterCore as unknown as Core;

const SIBLINGS =
  "This is the base applet with the midpoint-and-foot construction, not the sibling applets B (a point on the circumcircle and equilateral triangles), C (excenters and their radical axis) or D (a circle centred at I through O), which share the premise but use different proofs and have their own cores.";
const NO_GAME = "This is an illustration, so there is no win or loss; the tracker records exploration.";

const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(3));
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const dir = (seg: Segment): Pt => ({ x: seg[1].x - seg[0].x, y: seg[1].y - seg[0].y });
const degrees = (radians: number): number => radians * 180 / Math.PI;
/** The smaller angle between two undirected lines, in degrees. */
const lineAngle = (u: Pt, v: Pt): number | null => {
  const den = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  if (den <= 0) return null;
  const cos = Math.min(1, Math.max(-1, Math.abs((u.x * v.x + u.y * v.y) / den)));
  return round(degrees(Math.acos(cos)));
};

/** One coordinate: a finite number (or numeric string), never null/boolean. */
function coord(raw: unknown, label: string): number {
  if (raw === null || raw === undefined || typeof raw === "boolean" || typeof raw === "object") {
    throw new Error(`${label} needs finite numeric coordinates, got ${JSON.stringify(raw)}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`${label} needs finite numeric coordinates, got ${JSON.stringify(raw)}`);
  }
  return n;
}

/** A point as the page saves it ({x, y}) or as a short [x, y] argument. */
function readPoint(raw: unknown, label: string, fallback: Pt): Pt {
  if (raw === undefined || raw === null) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or { x, y }`);
    x = coord(raw[0], label); y = coord(raw[1], label);
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Json;
    x = coord(o.x, label); y = coord(o.y, label);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function readPositive(raw: unknown, label: string, fallback: number): number {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === "boolean") throw new Error(`${label} must be a positive number, got ${JSON.stringify(raw)}`);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} must be a positive number, got ${JSON.stringify(raw)}`);
  }
  return n;
}

/**
 * Start at the applet's opening picture and move the corners that are given.
 * An optional angleC (degrees, strictly between 0 and 180) rotates B around C
 * with the core's own withAngleC, exactly as the page's "Make C = 30°" button.
 */
function buildState(C: Core, args: Json): { s: State; width: number; height: number; angleCRequested: number | null } {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with A, B, C points and optional width, height and angleC");
  }
  const width = readPositive(args.width, 'argument "width"', 450);
  const height = readPositive(args.height, 'argument "height"', 450);
  let s = C.start({ width, height });
  for (const name of ["A", "B", "C"] as const) {
    const v = args[name];
    if (v !== undefined && v !== null) s = C.withPoint(s, name, readPoint(v, `argument "${name}"`, s[name]));
  }
  let angleCRequested: number | null = null;
  if (args.angleC !== undefined && args.angleC !== null) {
    if (typeof args.angleC === "boolean") throw new Error('argument "angleC" must be degrees between 0 and 180');
    const d = Number(args.angleC);
    if (!Number.isFinite(d) || d <= 0 || d >= 180) {
      throw new Error(`argument "angleC" must be a number of degrees strictly between 0 and 180, got ${JSON.stringify(args.angleC)}`);
    }
    angleCRequested = d;
    s = C.withAngleC(s, d);
  }
  return { s, width, height, angleCRequested };
}

type Reading = ReturnType<typeof reading>;

/** One measurements() and one claims() call, shaped for the model. */
function reading(C: Core, s: State) {
  const m = C.measurements(s);
  const cl = C.claims(s);
  const dDE = dir(m.DE), dIO = dir(m.IO);
  const dot = C.dot(dDE, dIO);
  const product = Math.max(1e-12, m.deLength * m.ioLength);
  const cos = Math.min(1, Math.max(-1, dot / product));
  const segments = m.parallels;
  const dPar = { A: dir(segments.A), B: dir(segments.B), C: dir(segments.C) };
  return {
    m, cl,
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sides: { BC_a: round(m.sides.a), CA_b: round(m.sides.b), AB_c: round(m.sides.c) },
    angleCDegrees: round(degrees(m.angleC)),
    centers: { I: pt(m.I), O: pt(m.O), inradius: round(m.rIn), circumradius: round(m.rOut) },
    marks: {
      D: pt(m.D), E: pt(m.E),
      BD: round(C.dist(s.B, m.D)), AE: round(C.dist(s.A, m.E)), AB: round(m.sides.c),
    },
    io: { from: pt(m.IO[0]), to: pt(m.IO[1]), length: round(m.ioLength) },
    de: { from: pt(m.DE[0]), to: pt(m.DE[1]), length: round(m.deLength) },
    formula: {
      DE: round(m.deLength),
      twoIOsinC: round(m.expectedDe),
      residual: sig(m.deLength - m.expectedDe),
      DEoverIO: m.ioLength > 0 ? round(m.deLength / m.ioLength, 9) : null,
      twoSinC: round(2 * Math.sin(m.angleC), 9),
      holds: cl.deEqualsFormula,
    },
    deVsIo: {
      dot: sig(dot),
      cosAngle: sig(cos),
      smallerAngleDegrees: round(degrees(Math.acos(Math.abs(cos)))),
      intersectionS: pt(m.S),
      SOnDE: sig(m.S && Number.isFinite(m.S.x) ? C.cross(m.DE[0], m.DE[1], m.S) : NaN),
      rightMarkAtS: cl.rightMarkAtS,
      perpendicular: cl.dePerpendicularIo,
    },
    parallels: {
      copiedSide: { A: "BC", B: "CA", C: "AB (this is DE)" },
      segments: {
        fromBC: { from: pt(segments.A[0]), to: pt(segments.A[1]) },
        fromCA: { from: pt(segments.B[0]), to: pt(segments.B[1]) },
        DE: { from: pt(segments.C[0]), to: pt(segments.C[1]) },
      },
      directions: { fromBC: pt(dPar.A), fromCA: pt(dPar.B), DE: pt(dPar.C) },
      pairwiseSmallAngleDegrees: {
        BC_CA: lineAngle(dPar.A, dPar.B),
        BC_DE: lineAngle(dPar.A, dPar.C),
        CA_DE: lineAngle(dPar.B, dPar.C),
      },
      angleToIO: {
        fromBC: lineAngle(dPar.A, dIO),
        fromCA: lineAngle(dPar.B, dIO),
        DE: lineAngle(dPar.C, dIO),
      },
      allParallel: cl.threeParallel,
    },
    claims: cl,
    result: C.result(s),
    degenerate: m.degenerate,
    doubleArea: round(m.doubleArea),
  };
}

/** Require a triangle the applet can actually draw and check. */
function live(C: Core, args: Json) {
  const { s, width, height, angleCRequested } = buildState(C, args);
  const r = reading(C, s);
  if (r.m.degenerate || !r.cl.nonDegenerate) {
    throw new Error(
      "A, B and C must form a proper, non-collinear triangle with distinct corners on the page's " +
      `${width} x ${height} board: the core cannot meet the bisectors or draw DE and IO here. Move a corner apart.`,
    );
  }
  return { s, width, height, angleCRequested, r };
}

function ioNote(r: Reading): string {
  const c = r.angleCDegrees;
  const special = Math.abs(c - 30) < 1e-3
    ? "C is 30 degrees, so sin(C) = 1/2 and DE = IO exactly. "
    : Math.abs(c - 150) < 1e-3
      ? "C is 150 degrees, and sin(150°) is also 1/2, so DE = IO here too — the page only claims 30 degrees is enough, not that it is the only way. "
      : "";
  return (
    `Lay AB off along the two sides through C: BD = AE = AB = ${r.marks.AB}, giving ` +
    `D = (${r.marks.D!.x}, ${r.marks.D!.y}) and E = (${r.marks.E!.x}, ${r.marks.E!.y}). ` +
    `The core puts the incenter at I = (${r.centers.I!.x}, ${r.centers.I!.y}) and the circumcenter at ` +
    `O = (${r.centers.O!.x}, ${r.centers.O!.y}). It measures DE = ${r.formula.DE} and IO = ${r.io.length}; ` +
    `with angle C = ${c}°, 2·IO·sin(C) = ${r.formula.twoIOsinC} and the residual DE − 2·IO·sin(C) is ` +
    `${r.formula.residual} (DE/IO = ${r.formula.DEoverIO}, 2 sin(C) = ${r.formula.twoSinC}). ` +
    `The dot product of the DE and IO directions is ${r.deVsIo.dot}, so the angle between the lines is ` +
    `${r.deVsIo.smallerAngleDegrees}° and they cross at right angles at S. ` + special +
    NO_GAME + " " + SIBLINGS
  );
}

function parallelNote(r: Reading): string {
  const p = r.parallels;
  return (
    "Copy each side onto the two sides meeting at the far corner: BC gives the fromBC segment, " +
    "CA gives fromCA, and AB gives DE. All three have the same direction — the pairwise small angles are " +
    `${p.pairwiseSmallAngleDegrees.BC_CA}°, ${p.pairwiseSmallAngleDegrees.BC_DE}° and ` +
    `${p.pairwiseSmallAngleDegrees.CA_DE}°. Their angles with IO are ` +
    `${p.angleToIO.fromBC}°, ${p.angleToIO.fromCA}° and ${p.angleToIO.DE}°, so all three are perpendicular to IO. ` +
    "The page's aside that IO cannot be perpendicular to them (because angles A, B, C are all 30 degrees) is muddled: " +
    "a triangle cannot have three 30-degree corners; what is true is that the lines are perpendicular to IO for every " +
    `triangle, while equality with IO needs C = 30° (or 150°), where DE = IO = ${r.formula.DE}. ` +
    NO_GAME + " " + SIBLINGS
  );
}

export function actions(): GameActions {
  return {
    io_de: {
      describe:
        "For a triangle ABC (corners as [x, y] or { x, y } in the page's 450 x 450 board, y down; omit a corner for the opening picture, and width/height may be overridden), run the real core and report the incenter I, circumcenter O and the points D and E found by laying AB off along the sides through C (BD = AE = AB), the segment DE and line IO, angle C in degrees, and the measured lengths DE and IO checked against DE = 2·IO·sin(C) (residual and ratio). It also reports the intersection S, the dot product and angle between the DE and IO directions, and the core's claim verdicts. Set angleC (degrees, strictly between 0 and 180) to rotate B around C first as the page's 'Make C = 30°' button does; at 30 (or 150) degrees DE equals IO. A degenerate triangle is refused. This is the base applet, not the sibling applets B, C or D.",
      args: '{"A":[153,360],"B":[330,300],"C":[112,112]}',
      run: (args) => {
        const C = core();
        const { s, width, height, angleCRequested, r } = live(C, args);
        return {
          ...r,
          options: { width, height, angleCRequested },
          note: ioNote(r),
        };
      },
    },

    three_parallels: {
      describe:
        "For the same triangle (arguments as in io_de, including the optional angleC), report the three parallel segments from the page: copy side BC onto the sides through B and C, side CA onto the sides through C and A, and side AB onto the sides through A and B (the last is DE). Gives both endpoints and the direction vector of each, the pairwise smaller angles between them, the angle each makes with IO, and the core's threeParallel verdict; also echoes the DE = 2·IO·sin(C) numbers. The three lines are perpendicular to IO for every triangle, while DE = IO only at C = 30 (or 150) degrees. This is the base applet, not the siblings B (circumcircle point and equilateral triangles), C (excenters and radical axis) or D (circle centred at I through O).",
      args: '{"A":[153,360],"B":[330,300],"C":[112,112]}',
      run: (args) => {
        const C = core();
        const { r } = live(C, args);
        return {
          triangle: r.triangle,
          angleCDegrees: r.angleCDegrees,
          parallels: r.parallels,
          deVsIo: r.deVsIo,
          formula: r.formula,
          claims: r.claims,
          note: parallelNote(r),
        };
      },
    },
  };
}

/** Echo the three saved corners, then re-measure the diagram with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported In And Circumcenter state version ${stateVersion}`);
  }
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  const C = core();
  let savedReadable = true;
  let s: State;
  try {
    const seed = C.start({});
    s = {
      A: readPoint(src.A, "saved A", seed.A),
      B: readPoint(src.B, "saved B", seed.B),
      C: readPoint(src.C, "saved C", seed.C),
    };
  } catch {
    savedReadable = false;
    s = C.start({});
  }
  const saved = { A: pt(s.A), B: pt(s.B), C: pt(s.C) };
  const r = reading(C, s);
  if (r.m.degenerate || !r.cl.nonDegenerate) {
    return {
      ...src, stateVersion, savedReadable, saved, valid: false,
      note:
        (!savedReadable
          ? "Some saved corners could not be read, so the applet's opening triangle is shown. "
          : "Track.state saved only the three draggable corners A, B and C in the page's 450 x 450 board; derived points are not saved. ") +
        "Here the corners are collinear, coincident or too close, so the core cannot meet the bisectors or draw DE and IO. " +
        NO_GAME + " " + SIBLINGS,
    };
  }
  return {
    ...src,
    stateVersion,
    savedReadable,
    saved,
    valid: true,
    triangle: r.triangle,
    sides: r.sides,
    angleCDegrees: r.angleCDegrees,
    centers: r.centers,
    marks: r.marks,
    io: r.io,
    de: r.de,
    formula: r.formula,
    deVsIo: r.deVsIo,
    parallels: r.parallels,
    claims: r.claims,
    result: r.result,
    note:
      (!savedReadable
        ? "Some saved corners could not be read, so the applet's opening triangle is shown; the reading below is from those opening corners. "
        : "Track.state saved only the three draggable corners A, B and C in board units (no derived points or board size); the page uses the default 450 x 450 board. ") +
      `The real core rebuilds I, O, D and E from those corners: DE = ${r.formula.DE}, IO = ${r.io.length}, ` +
      `2·IO·sin(C) = ${r.formula.twoIOsinC} (residual ${r.formula.residual}), and DE/IO = ${r.formula.DEoverIO} against ` +
      `2 sin(C) = ${r.formula.twoSinC}. The DE and IO directions have dot product ${r.deVsIo.dot}, so they cross at ` +
      `${r.deVsIo.smallerAngleDegrees}°; the three copied-side lines are parallel=${r.parallels.allParallel}. ` +
      ioNote(r),
  };
}
