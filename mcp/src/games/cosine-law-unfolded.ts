/*
 * run_game_logic actions and saved-position reader for Cosine Law Unfolded.
 *
 * The real core is cosine-law-unfolded/cosine-law-unfolded-core.js, copied into
 * src/generated/cores/ at build time. A state is just the three triangle
 * corners A, B, C on the applet's 500 x 520 board (y grows downwards). The core
 * erects the three outer squares, builds P = C + s·J(B−A) (a quarter-turn copy
 * of AB based at C), and unfolds the squares on AC and BC into two orange
 * parallelograms. Every number below is measured by that core: CP = AB with
 * CP ⟂ AB, CTPR is a parallelogram so CP is the median (and altitude) of the
 * friendly triangle CTR, and the two pieces of area AC·BC·|cos C| give
 * AB² = AC² + BC² − 2·AC·BC·cos C. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cosine-law-unfolded"].CosineLawUnfoldedCore as any;

type Point = { x: number; y: number };
type State = { A: Point; B: Point; C: Point };

/** Round for display; NaN/Infinity become null so the result stays JSON-safe. */
const r = (v: number, digits = 6): number | null =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : null;
/** Tiny quantities (dot products, residuals) read better in exponential form. */
const sig = (v: number): number | null =>
  Number.isFinite(v) ? Number(v.toExponential(3)) : null;
type Out = { x: number | null; y: number | null };
const pt = (p: Point | null | undefined): Out | null =>
  p ? { x: r(p.x), y: r(p.y) } : null;
const vout = (v: Point | null | undefined): Out | null =>
  v ? { x: sig(v.x), y: sig(v.y) } : null;
const deg = (rad: number): number | null => r((rad * 180) / Math.PI, 4);
const len = (v: Point): number => Math.hypot(v.x, v.y);
const outLen = (v: Out): number => Math.hypot(v.x ?? 0, v.y ?? 0);
const nearZero = (v: number, scale = 1): boolean =>
  Number.isFinite(v) && Math.abs(v) <= 1e-6 * Math.max(1, scale);
const agree = (a: number, b: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Arguments accept [x, y] (tools) or { x, y } (the saved Track.state shape). */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(value[0]);
    y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    try {
      x = num(o, "x");
      y = num(o, "y");
    } catch {
      throw new Error(`argument "${label}" must be { "x": ..., "y": ... } with finite numbers`);
    }
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Start from the applet's opening triangle, then apply any supplied corners. */
function readState(C: any, args: Json): State {
  const seed = C.start({}) as State;
  let s: State = { A: { ...seed.A }, B: { ...seed.B }, C: { ...seed.C } };
  for (const name of ["A", "B", "C"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      // withPoint is the same clamp the page's drag handles apply.
      s = C.withPoint(s, name, readPoint(args[name], name)) as State;
    }
  }
  return s;
}

/** All of the picture's measurable claims, taken straight from core.measure(). */
function reading(C: any, state: State) {
  const m = C.measure(state);
  const q = m.points;
  const pieces = (m.quadrilaterals as Point[][]).map((poly) => poly.map(pt));
  const sym = (m.symmetry as Point[]).map(vout);
  const branchSym = (m.branchSymmetry as Point[]).map(vout);
  const gap = len(m.parallelogram as Point);
  const cosC = m.cosC as number;

  return {
    triangle: { A: pt(q.A), B: pt(q.B), C: pt(q.C) },
    orientation: q.orientation,
    unfoldedThrough: q.SwitchParas ? "F and G" : "S and Q",
    sides: { AB: r(m.ab), AC: r(m.ac), BC: r(m.bc) },
    anglesDeg: { atA: deg(m.angleA), atC: deg(m.angleC) },
    cosC: r(cosC),

    copyOfAB: {
      from: pt(q.C), to: pt(q.P),
      lengthCP: r(m.cp),
      lengthAB: r(m.ab),
      CPequalsAB: agree(m.cp, m.ab),
      dotWithAB: sig(m.cpDot),
      perpendicularToAB: nearZero(m.cpDot, m.cp * m.ab),
    },
    parallelogramCTPR: {
      C: pt(q.C), T: pt(q.T), P: pt(q.P), R: pt(q.R),
      diagonalGap: vout(m.parallelogram),
      diagonalsBisect: nearZero(gap),
      medianLength: r(m.median),
      medianDotWithAB: sig(m.medianDot),
      medianIsAltitude: nearZero(m.medianDot, m.median * m.ab),
    },
    friendlyTriangles: {
      CT: r(m.ct), AC: r(m.ac), CTequalsAC: agree(m.ct, m.ac),
      CR: r(m.cr), BC: r(m.bc), CRequalsBC: agree(m.cr, m.bc),
      areaABC: r(m.areaABC), areaCTR: r(m.areaCTR),
      equalArea: agree(m.areaABC, m.areaCTR),
    },
    symmetry: {
      C_J_S_G_Q_F: sym,
      allCentredOnO: sym.every((v) => v !== null && nearZero(outLen(v))),
      unfoldingPair: branchSym,
      unfoldingPairCentredOnO: branchSym.every((v) => v !== null && nearZero(outLen(v))),
      O: pt(q.O),
    },
    unfoldedPieces: {
      vertices: pieces,
      areas: (m.quadAreas as number[]).map((a) => r(a)),
      expectedEach: r(m.expectedQuadArea),
      eachHasAreaACtimesBCtimesCosC: (m.quadAreas as number[]).every(
        (a) => agree(a, m.expectedQuadArea),
      ),
    },
    lawOfCosines: {
      ABsquared: r(m.ab * m.ab),
      ACsquaredPlusBCsquaredMinusTerm: r(m.ac * m.ac + m.bc * m.bc - 2 * m.ac * m.bc * cosC),
      residual: sig(m.lawResidual),
      holds: nearZero(m.lawResidual, Math.max(m.ab * m.ab, m.ac * m.ac, m.bc * m.bc)),
    },
    status: C.status(state) as string,
    note:
      "CP is AB turned a quarter turn and based at C, so CP = AB and CP is perpendicular to AB. " +
      "CTPR is a parallelogram, so its diagonals CP and TR bisect each other and CP is the median of triangle CTR; " +
      "with CT = AC and CR = BC the friendly triangle CTR has the same area as ABC, making that median an altitude. " +
      "The two orange parallelograms each have area AC·BC·|cos C|, and the dissection gives " +
      "AB² = AC² + BC² − 2·AC·BC·cos C.",
  };
}

export function actions(): GameActions {
  return {
    unfold: {
      describe:
        "Place the triangle's corners A, B, C on the 500 x 520 board (y down), each as [x, y] or { x, y }; omit them for the opening picture. The core erects squares outward and reports the highlighted segment CP (a quarter-turn copy of AB, so CP = AB and CP ⟂ AB), the parallelogram CTPR whose diagonals bisect each other, the friendly triangle CTR (CT = AC, CR = BC, equal area to ABC), the two orange unfolded pieces of area AC·BC·|cos C|, and the law-of-cosines residual AB² − (AC² + BC² − 2·AC·BC·cos C).",
      args: '{ "A": [204, 232.85714285714286], "B": [340, 212.85714285714286], "C": [250, 192.85714285714286] }',
      run: (args) => {
        const C = core();
        return reading(C, readState(C, args));
      },
    },
    move_vertex: {
      describe:
        "Drag one corner of a triangle: choose vertex A, B or C and give its new [x, y] point (clamped to the board), as the page's handle does; the other corners and any omitted ones stay as given or at the opening picture. Reports the same full reading at the new triangle, so you can watch CP = AB, CP ⟂ AB and the law of cosines keep holding as the picture moves, and see which unfolding the applet picks.",
      args: '{ "A": [204, 232.85714285714286], "B": [340, 212.85714285714286], "C": [250, 192.85714285714286], "vertex": "C", "to": [250, 150] }',
      run: (args) => {
        const C = core();
        const vertex = args.vertex === undefined || args.vertex === null ? "C" : args.vertex;
        if (vertex !== "A" && vertex !== "B" && vertex !== "C") {
          throw new Error('argument "vertex" must be "A", "B" or "C"');
        }
        const to = readPoint(args.to, "to");
        const s = C.withPoint(readState(C, args), vertex, to) as State;
        const read = reading(C, s);
        return {
          moved: { vertex, to: pt(to) },
          ...read,
          note: `${vertex} moved to (${r(to.x)}, ${r(to.y)}). ` + read.note,
        };
      },
    },
  };
}

/** Track.state saves just the three corners A, B, C; the core rebuilds the rest. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Cosine Law Unfolded state version ${stateVersion}`);
  }
  const C = core();
  const seed = C.start({}) as State;
  let here: State = { A: { ...seed.A }, B: { ...seed.B }, C: { ...seed.C } };
  let savedReadable = false;
  try {
    here = {
      A: state.A === undefined || state.A === null ? { ...seed.A } : readPoint(state.A, "A"),
      B: state.B === undefined || state.B === null ? { ...seed.B } : readPoint(state.B, "B"),
      C: state.C === undefined || state.C === null ? { ...seed.C } : readPoint(state.C, "C"),
    };
    savedReadable = true;
  } catch { /* unusable saved data: fall back to the opening picture */ }

  const echo = (v: unknown): Point | null => {
    try { return readPoint(v, "state"); } catch { return null; }
  };
  const read = reading(C, here);
  return {
    stateVersion,
    savedReadable,
    saved: { A: echo(state.A), B: echo(state.B), C: echo(state.C) },
    ...read,
    note: (!savedReadable
      ? "The saved position could not be read, so the applet's opening picture is shown instead. "
      : "Track.state saved the three triangle corners as { x, y } points on the 500 x 520 board, y down. " +
        "The core rebuilds the outer squares, the segment CP, the parallelogram CTPR, the friendly triangle and the two orange pieces from them. ") +
      read.note,
  };
}
