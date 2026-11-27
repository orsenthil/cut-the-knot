/*
 * run_game_logic actions and saved-position reader for Cosine Law.
 *
 * The real core is cosine-law/cosine-law-core.js, copied into
 * src/generated/cores/ at build time. Dragging A, B or C leaves two squares on
 * AC and BC and three parallelograms (CTPR, STPM, QRPN) filling a heptagon
 * ABQNPMS. The core constructs S, T, Q, R, P, M, N with the applet's own
 * quarter-turns and sums, then measures the same picture twice: CP is equal
 * and perpendicular to AB, and cutting the heptagon in the two displayed ways
 * gives c² + 3·area(ABC) and a² + b² − 2ab·cos(C) + 3·area(ABC). See
 * _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cosine-law"].CosineLawCore;
type K = ReturnType<typeof core>;
type State = ReturnType<K["start"]>;
type Point = { x: number; y: number };

const TOL = 1e-6;
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const r4 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : NaN);
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const tiny = (v: number, scale = 1): boolean => Number.isFinite(v) && Math.abs(v) < TOL * Math.max(1, scale);

/** Accept {x, y} (the saved form) or a flat [x, y] for a caller's arguments. */
function readPoint(v: unknown, label: string): Point {
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    return { x: num({ x: v[0] }, "x"), y: num({ y: v[1] }, "y") };
  }
  if (v && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`${label} must be [x, y] or { x, y }`);
}

/** Rebuild the page's state: three dragged corners on its 600x440 board. */
function build(args: Json): State {
  const K = core();
  const width = num(args, "width", 600);
  const height = num(args, "height", 440);
  if (!(width > 0) || !(height > 0)) throw new Error('"width" and "height" must be positive');
  const seed = K.start({ width, height });
  const A = args.A === undefined || args.A === null ? seed.A : readPoint(args.A, "A");
  const B = args.B === undefined || args.B === null ? seed.B : readPoint(args.B, "B");
  const Cc = args.C === undefined || args.C === null ? seed.C : readPoint(args.C, "C");
  if (Math.abs(K.signed2([A, B, Cc])) < 1e-12) {
    throw new Error("A, B and C must be three distinct, non-collinear points");
  }
  return {
    ...seed,
    A: { ...A }, B: { ...B }, C: { ...Cc },
    showColors: args.showColors === undefined ? seed.showColors : Boolean(args.showColors),
    showNames: args.showNames === undefined ? seed.showNames : Boolean(args.showNames),
  };
}

/** Everything the real core says about one drawing, in plain JSON. */
function reading(state: State) {
  const K = core();
  const d = K.figure(state);
  const m = K.measure(state, d);
  const { A, B, C: Cc } = state;

  // A parallelogram's diagonals bisect each other: compare their midpoints.
  const para = (a: Point, b: Point, c: Point, e: Point) => {
    const gap = K.distance(mid(a, b), mid(c, e));
    return { midpointGap: r6(gap), holds: tiny(gap, Math.max(K.distance(a, b), K.distance(c, e))) };
  };
  const squareOnAC = {
    vertices: "C A S T",
    sides: [K.distance(Cc, A), K.distance(A, d.S), K.distance(d.S, d.T), K.distance(d.T, Cc)].map(r6),
    rightAngleAtA: tiny(K.dot(K.sub(Cc, A), K.sub(d.S, A)), K.distance(Cc, A) * K.distance(d.S, A)),
  };
  const squareOnBC = {
    vertices: "C B Q R",
    sides: [K.distance(Cc, B), K.distance(B, d.Q), K.distance(d.Q, d.R), K.distance(d.R, Cc)].map(r6),
    rightAngleAtB: tiny(K.dot(K.sub(Cc, B), K.sub(d.Q, B)), K.distance(Cc, B) * K.distance(d.Q, B)),
  };

  const cpDifference = m.cp - m.ab;
  const cosCPAB = m.perpendicular / (m.cp * m.ab);
  const triArea = Math.abs(K.signed2([A, B, Cc])) / 2;
  const shiftedCutting = m.left + 3 * triArea;
  const foldedCutting = m.right + 3 * triArea;
  const lawResidual = m.right - m.left;

  return {
    triangle: { A: pt(A), B: pt(B), C: pt(Cc) },
    constructed: {
      S: pt(d.S), T: pt(d.T), Q: pt(d.Q), R: pt(d.R),
      P: pt(d.P), M: pt(d.M), N: pt(d.N),
      unfoldedShift: pt(d.V),
    },
    squares: { onAC: squareOnAC, onBC: squareOnBC },
    parallelograms: {
      CTPR: { diagonals: "CP and TR", ...para(Cc, d.P, d.T, d.R) },
      STPM: { diagonals: "SP and TM", ...para(d.S, d.P, d.T, d.M) },
      QRPN: { diagonals: "QP and RN", ...para(d.Q, d.P, d.R, d.N) },
    },
    cp: {
      length: r6(m.cp), abLength: r6(m.ab), difference: r6(cpDifference),
      equal: tiny(cpDifference, m.ab),
      dotWithAB: r6(m.perpendicular), cosineWithAB: r6(cosCPAB),
      perpendicular: tiny(m.perpendicular, m.cp * m.ab),
    },
    sides: { a: r6(m.a), b: r6(m.b), c: r6(m.c) },
    angleC: { degrees: r4((m.angle * 180) / Math.PI), cosine: r6(m.cosC), acute: m.acute },
    dissection: {
      triangleArea: r6(triArea),
      heptagonArea: r6(m.heptagonArea),
      shiftedCutting_c2_plus_3T: r6(shiftedCutting),
      foldedCutting_a2_b2_minus_2abcosC_plus_3T: r6(foldedCutting),
      cSquared: r6(m.left),
      a2PlusB2Minus2abCosC: r6(m.right),
      lawResidual: r6(lawResidual),
      lawOfCosinesHolds: tiny(lawResidual, m.left),
      bothCuttingsAgree: tiny(m.heptagonArea - shiftedCutting, m.heptagonArea),
    },
  };
}

export function actions(): GameActions {
  return {
    cp_and_parallelograms: {
      describe:
        "For a triangle with corners A, B, C (each {x, y} or [x, y] on the page's 600x440 board, y down; omitted corners use the starting triangle), report the constructed points S, T, Q, R, P, M, N from the applet's quarter-turns. Check that CTPR, STPM and QRPN are parallelograms and the two squares are squares, then verify that CP is exactly as long as AB and meets it at a right angle. Says whether angle C is acute, which decides which cutting shows the yellow parallelograms.",
      args: '{"A":[125.42857142857142,333.3333333333333],"B":[231.42857142857142,313.3333333333333],"C":[171.42857142857142,293.3333333333333],"width":600,"height":440}',
      run: (args) => {
        const v = reading(build(args));
        return {
          triangle: v.triangle,
          constructed: v.constructed,
          squares: v.squares,
          parallelograms: v.parallelograms,
          cp: v.cp,
          angleC: v.angleC,
          note:
            `The applet's rotations give CTPR, STPM and QRPN as parallelograms (diagonal-midpoint gaps ` +
            `${v.parallelograms.CTPR.midpointGap}, ${v.parallelograms.STPM.midpointGap}, ${v.parallelograms.QRPN.midpointGap}). ` +
            `Since CTPR is a parallelogram, CP is the median of triangle CTR and so an altitude of ABC: ` +
            `CP is ${v.cp.length} long against AB = ${v.cp.abLength}, and its dot product with AB is ` +
            `${v.cp.dotWithAB}. Angle C is ${v.angleC.degrees}° (${v.angleC.acute ? "acute" : "not acute"}).`,
        };
      },
    },

    two_cuttings: {
      describe:
        "For the same triangle, report the side lengths a, b, c, angle C and cos(C), the heptagon area, and the two cuttings of the same pieces: c² + 3·area(ABC) (the shifted picture) and a² + b² − 2ab·cos(C) + 3·area(ABC) (the folded picture). Verify c² = a² + b² − 2ab·cos(C) on this drawing, whether C is acute or obtuse; when C is right the rectangle term vanishes and this is Pythagoras.",
      args: '{"A":[125.42857142857142,333.3333333333333],"B":[231.42857142857142,313.3333333333333],"C":[171.42857142857142,293.3333333333333]}',
      run: (args) => {
        const v = reading(build(args));
        return {
          sides: v.sides,
          angleC: v.angleC,
          dissection: v.dissection,
          note:
            `The same pieces fill the heptagon twice: ${v.dissection.shiftedCutting_c2_plus_3T} = c² + 3T ` +
            `and ${v.dissection.foldedCutting_a2_b2_minus_2abcosC_plus_3T} = a² + b² − 2ab·cos(C) + 3T, ` +
            `with T = ${v.dissection.triangleArea}. So c² = ${v.dissection.cSquared} and ` +
            `a² + b² − 2ab·cos(C) = ${v.dissection.a2PlusB2Minus2abCosC} ` +
            `(residual ${v.dissection.lawResidual}); the law of cosines ` +
            `${v.dissection.lawOfCosinesHolds ? "holds" : "does not hold"} here, and angle C is ` +
            `${v.angleC.acute ? "acute" : "not acute"}.`,
        };
      },
    },
  };
}

const savedNum = (v: unknown): number | null => {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? r6(n) : null;
};

function savedPoint(v: unknown): Point | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Json;
  const x = savedNum(o.x), y = savedNum(o.y);
  return x === null || y === null ? null : { x, y };
}

/** The fields the page saved with Track.state, read again through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const saved = {
    stateVersion,
    A: savedPoint(state.A),
    B: savedPoint(state.B),
    C: savedPoint(state.C),
    width: savedNum(state.width),
    height: savedNum(state.height),
    showColors: state.showColors === true,
    showNames: state.showNames === true,
  };
  try {
    const current = build(state);
    return {
      ...saved,
      reading: reading(current),
      note:
        "The saved corners are measured with the applet's own rotations and sums: CP matches AB and is perpendicular to it, the three parallelograms close the heptagon, and its two cuttings both give c² + 3·area(ABC). The two Show checkboxes change only the colours and labels on the page, not the geometry.",
    };
  } catch (e) {
    return { ...saved, reading: null, note: `The saved position cannot be measured: ${(e as Error).message}` };
  }
}
