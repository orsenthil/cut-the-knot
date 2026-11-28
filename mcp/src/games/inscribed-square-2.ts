/*
 * run_game_logic actions and saved-position reader for Inscribed Square 2.
 *
 * The core (inscribed-square-2/ on the site, copied into src/generated/cores/
 * at build time) does the whole construction: it rotates AB into the Vecten
 * square, intersects the cevians from C with AB, and measures the red square
 * P Q Q' P'. Every number returned here is computed by that core, so the tutor
 * cannot drift from the picture on the page. See _shared.ts for the module
 * shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["inscribed-square-2"].InscribedSquare2Core;

type Point = { x: number; y: number };
type Board = { A: Point; B: Point; C: Point; showNames: boolean; showHint: boolean };

/* An applet intersection can be NaN when lines are parallel, and JSON cannot
   carry NaN or Infinity: report those as null instead. */
const safeNum = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) ? n : null;

function safePoint(p: unknown): Point | null {
  if (!p || typeof p !== "object") return null;
  const q = p as Json;
  const x = safeNum(q.x);
  const y = safeNum(q.y);
  return x === null || y === null ? null : { x, y };
}

function readPoint(value: unknown, label: string): Point {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a point with numeric x and y`);
  }
  const p = value as Json;
  try {
    return { x: num(p, "x"), y: num(p, "y") };
  } catch {
    throw new Error(`${label} must be a point with numeric x and y`);
  }
}

/** Strict triangle for actions: reject collapsed or collinear corners. */
function readTriangle(args: Json): Board {
  const C = core();
  const base = C.start();
  const board: Board = {
    A: args.A === undefined ? base.A : readPoint(args.A, "A"),
    B: args.B === undefined ? base.B : readPoint(args.B, "B"),
    C: args.C === undefined ? base.C : readPoint(args.C, "C"),
    showNames: args.showNames === undefined ? base.showNames : !!args.showNames,
    showHint: args.showHint === true,
  };
  if (!(C.dist(board.A, board.B) > 1e-6)) {
    throw new Error("A and B must be different points to build a square on AB");
  }
  if (!(Math.abs(C.orientation(board)) > 1e-6)) {
    throw new Error("C must not lie on the line AB, or the altitude is zero");
  }
  return board;
}

/** Lenient board for a saved position: fall back to the opening triangle. */
function readBoard(state: Json): Board {
  const base = core().start();
  const maybe = (value: unknown, fallback: Point, label: string): Point => {
    try {
      return value === undefined || value === null ? fallback : readPoint(value, label);
    } catch {
      return fallback;
    }
  };
  return {
    A: maybe(state.A, base.A, "A"),
    B: maybe(state.B, base.B, "B"),
    C: maybe(state.C, base.C, "C"),
    showNames: state.showNames === undefined ? base.showNames : !!state.showNames,
    showHint: state.showHint === true,
  };
}

/** Whether a constructed point lies between a and b, rather than on a sideline. */
function onSegment(C: ReturnType<typeof core>, a: Point, b: Point, p: Point | null): boolean | null {
  if (!p) return null;
  const vx = b.x - a.x, vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1e-12) return null;
  const t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  return safeNum(t) !== null && t >= -1e-9 && t <= 1 + 1e-9;
}

function squareChecks(C: ReturnType<typeof core>, f: ReturnType<ReturnType<typeof core>["compute"]>) {
  const m = C.metrics(f);
  return {
    valid: m.valid,
    equalSides: safeNum(m.equalSides),
    rightAngles: safeNum(m.rightAngles),
    parallelTop: safeNum(m.parallelTop),
    vecten: safeNum(m.vecten),
    collinearWithC: safeNum(m.collinear),
    homothetyError: safeNum(m.homothety),
  };
}

export function actions(): GameActions {
  return {
    inscribed_square: {
      describe:
        "For a triangle ABC, build the Vecten square on AB away from C and report the cevian cuts P and Q, the inscribed square P Q Q' P', its measured side beside the formula L*h/(L+h), and the homothety from C (scale h/(L+h), with C and the two square centres collinear).",
      args: '{ "A": {"x":137,"y":140}, "B": {"x":225,"y":140}, "C": {"x":202.5,"y":71.03} }',
      run: (args) => {
        const C = core();
        const s = readTriangle(args);
        const f = C.compute(s, 1); // +1 = outward square, away from C
        const m = C.metrics(f);
        const L = C.dist(s.A, s.B);
        const h = Math.abs(C.orientation(f)) / L;
        const predicted = C.outwardSide(s);
        const scale = predicted / L; // h / (L + h)
        const measuredScale = C.dist(f.C, f.c2) / C.dist(f.C, f.c1);
        const P = safePoint(f.P), Q = safePoint(f.Q);
        const inside = C.orientation(f) < 0;
        const allOnSides = onSegment(C, s.A, s.B, P) === true
          && onSegment(C, s.A, s.B, Q) === true
          && onSegment(C, s.A, s.C, safePoint(f.PP)) === true
          && onSegment(C, s.B, s.C, safePoint(f.QQ)) === true;
        const note = !m.valid
          ? `${C.describe(f, m)} The cevians are parallel, so no square is cut out here.`
          : `The lines from C through the Vecten corners cut AB at P and Q, giving PQ = ${m.base.toFixed(2)}, which matches L*h/(L+h) = ${predicted.toFixed(2)}. The red square is the image of the Vecten square under a homothety centred at C with scale ${scale.toFixed(3)} = h/(L+h); C and the two centres line up (cross error ${m.collinear.toExponential(1)}).${inside ? (allOnSides ? " All four vertices lie on the triangle's sides." : " Some vertices fall outside the triangle's sides.") : " C is on the square's side of AB, so the red square lies outside the triangle."}`;
        return {
          triangle: { A: s.A, B: s.B, C: s.C },
          baseLength: L,
          altitude: h,
          predictedSide: safeNum(predicted),
          measuredSide: safeNum(m.base),
          sideError: safeNum(Math.abs(m.base - predicted)),
          homothetyScale: safeNum(scale),
          measuredScale: safeNum(measuredScale),
          inscribedSquareInsideTriangle: inside,
          verticesOnSides: allOnSides,
          points: {
            CA: safePoint(f.CA), CB: safePoint(f.CB),
            P, Q, Pprime: safePoint(f.PP), Qprime: safePoint(f.QQ),
            centre1: safePoint(f.c1), centre2: safePoint(f.c2),
          },
          checks: squareChecks(C, f),
          note,
        };
      },
    },

    compare_vecten_squares: {
      describe:
        "Build both Vecten squares on AB and compare their inscribed squares: the outward one has side L*h/(L+h) inside the triangle, the inward one L*h/|L-h| on the sidelines, and the inward construction degenerates when the altitude equals AB.",
      args: '{ "A": {"x":137,"y":140}, "B": {"x":225,"y":140}, "C": {"x":202.5,"y":71.03} }',
      run: (args) => {
        const C = core();
        const s = readTriangle(args);
        const L = C.dist(s.A, s.B);
        const h = Math.abs(C.orientation(s)) / L;
        const degenerate = Math.abs(L - h) < 1e-9;
        const outwardSide = C.outwardSide(s);
        const inwardSide = C.inwardSide(s);
        const out = C.compute(s, 1);
        const inn = C.compute(s, -1); // square built on the same side as C
        const outM = C.metrics(out);
        const inM = C.metrics(inn);
        const outP = safePoint(out.P), outQ = safePoint(out.Q);
        const inP = safePoint(inn.P), inQ = safePoint(inn.Q);
        const inOnBase = onSegment(C, s.A, s.B, inP) === true && onSegment(C, s.A, s.B, inQ) === true;
        const note = degenerate
          ? `Here the altitude h = ${h.toFixed(2)} equals AB = ${L.toFixed(2)}, so L - h = 0: the inward cevians are parallel and the second square has no finite side. Only the outward solution survives, with side ${outwardSide.toFixed(2)}.`
          : `The outward square gives PQ = ${outM.base.toFixed(2)} = L*h/(L+h), while the inward one gives PQ = ${inM.base.toFixed(2)} = L*h/|L-h| = ${inwardSide.toFixed(2)}. Both centres stay collinear with C (errors ${outM.collinear.toExponential(1)} and ${inM.collinear.toExponential(1)}).${inOnBase ? " The inward cuts land on AB." : " The inward cuts land outside AB, so that square sits on the sidelines past C."}`;
        return {
          triangle: { A: s.A, B: s.B, C: s.C },
          baseLength: L,
          altitude: h,
          degeneracy: { hEqualsL: degenerate, denominator: safeNum(L - h) },
          outward: {
            formulaSide: safeNum(outwardSide),
            measuredSide: safeNum(outM.base),
            scale: safeNum(outwardSide / L),
            valid: outM.valid,
            pointsOnBase: onSegment(C, s.A, s.B, outP) === true && onSegment(C, s.A, s.B, outQ) === true,
            P: outP, Q: outQ,
            centre1: safePoint(out.c1), centre2: safePoint(out.c2),
            checks: squareChecks(C, out),
          },
          inward: {
            formulaSide: safeNum(inwardSide),
            measuredSide: safeNum(inM.base),
            scale: safeNum(inwardSide / L),
            valid: inM.valid,
            pointsOnBase: inOnBase,
            P: inP, Q: inQ,
            centre1: safePoint(inn.c1), centre2: safePoint(inn.c2),
            checks: squareChecks(C, inn),
          },
          note,
        };
      },
    },
  };
}

/** What the core says about the triangle the page has saved. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const here = readBoard(state);
  const f = C.compute(here, 1);
  const m = C.metrics(f);
  const L = C.dist(here.A, here.B);
  const h = L > 0 ? Math.abs(C.orientation(f)) / L : NaN;
  const predicted = C.outwardSide(here);
  const P = safePoint(f.P), Q = safePoint(f.Q);
  return {
    stateVersion,
    A: here.A, B: here.B, C: here.C,
    showNames: here.showNames,
    showHint: here.showHint,
    baseLength: safeNum(L),
    altitude: safeNum(h),
    predictedSide: safeNum(predicted),
    measuredSide: safeNum(m.base),
    homothetyScale: safeNum(L > 0 ? predicted / L : NaN),
    measuredScale: safeNum(C.dist(f.C, f.c2) / C.dist(f.C, f.c1)),
    inscribedSquareInsideTriangle: C.orientation(f) < 0,
    P, Q,
    Pprime: safePoint(f.PP), Qprime: safePoint(f.QQ),
    centre1: safePoint(f.c1), centre2: safePoint(f.c2),
    checks: squareChecks(C, f),
    note: C.describe(f, m),
  };
}
