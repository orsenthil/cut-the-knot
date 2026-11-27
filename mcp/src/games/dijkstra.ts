/*
 * run_game_logic actions and saved-position reader for Dijkstra.
 *
 * The real core is dijkstra/dijkstra-core.js, copied into src/generated/cores/
 * at build time. From corners A, B, C it runs the applet's own Compute():
 * the stripe through C parallel to AB, the two lines CL and CN that cut off
 * triangles similar to ABC, and the feet/intersections of the construction.
 * measure() then compares three signs on the same drawing:
 *
 *   sign(alpha + beta - gamma) = sign(a² + b² - c²)
 *                              = sign(area(ACL) + area(BCN) - area(ABC)).
 *
 * The area form comes from similarity: area(ACL) = k·b², area(BCN) = k·a² and
 * area(ABC) = k·c², so area(ACL)/b² = area(BCN)/a² = area(ABC)/c² = k. The
 * page prints area(ACL)/a² = area(BCN)/b² instead, which swaps the two
 * numerators and is false whenever a differs from b. See _shared.ts for the
 * module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["dijkstra"].DijkstraCore;
type K = ReturnType<typeof core>;
type State = ReturnType<K["start"]>;
type Point = { x: number; y: number };

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const deg = (radians: number): number => (radians * 180) / Math.PI;
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const tiny = (v: number, scale = 1): boolean =>
  Number.isFinite(v) && Math.abs(v) < 1e-6 * Math.max(1, Math.abs(scale));
const SHAPES = ["obtuse", "right", "acute"];

/** Accept the page's saved {x, y} and the short [x, y] form of JSON args. */
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

/** Build the page's position: three corners on its 500x450 board (y down). */
function build(args: Json): State {
  const K = core();
  const shape = args.shape;
  let seed: State;
  if (shape === undefined || shape === null) {
    seed = K.start();
  } else {
    if (typeof shape !== "string" || !SHAPES.includes(shape)) {
      throw new Error('"shape" must be "obtuse", "right" or "acute"');
    }
    seed = K.preset(shape);
  }
  const A = args.A === undefined || args.A === null ? seed.A : readPoint(args.A, "A");
  const B = args.B === undefined || args.B === null ? seed.B : readPoint(args.B, "B");
  const Cc = args.C === undefined || args.C === null ? seed.C : readPoint(args.C, "C");
  if (K.polygonArea([A, B, Cc]) < 1e-9) {
    throw new Error("A, B and C must be three distinct, non-collinear points");
  }
  const show = { ...seed.show };
  for (const key of ["areas", "color", "hint", "names"] as const) {
    if (args[key] !== undefined && args[key] !== null) show[key] = Boolean(args[key]);
  }
  return {
    ...seed,
    A: { ...A }, B: { ...B }, C: { ...Cc },
    show,
  };
}

/** Everything the real core measures about one drawing, in plain JSON. */
function reading(s: State) {
  const K = core();
  const m = K.measure(s);
  const a2 = m.a * m.a, b2 = m.b * m.b, c2 = m.c * m.c;
  const k = m.areaABC / c2;

  // Similarity mapping ACL ~ ABC (A->A, C->B, L->C) and BCN ~ ABC
  // (B->B, C->A, N->C) gives these three ratios, all equal to k.
  const correct = {
    ACL_over_b2: m.areaACL / b2,
    BCN_over_a2: m.areaBCN / a2,
    ABC_over_c2: k,
  };
  const pagePrinted = {
    ACL_over_a2: m.areaACL / a2,
    BCN_over_b2: m.areaBCN / b2,
  };
  const kScale = Math.max(1, Math.abs(k));
  const proportionalHolds =
    tiny(correct.ACL_over_b2 - k, kScale) && tiny(correct.BCN_over_a2 - k, kScale);
  const pageClaimHolds = tiny(
    pagePrinted.ACL_over_a2 - pagePrinted.BCN_over_b2,
    Math.max(1, Math.abs(pagePrinted.ACL_over_a2), Math.abs(pagePrinted.BCN_over_b2)),
  );

  const signs = {
    angles: m.signAngles,
    squares: m.signSquares,
    areas: m.signAreas,
    allAgree: m.signAngles === m.signSquares && m.signAngles === m.signAreas,
  };

  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sides: { a: r6(m.a), b: r6(m.b), c: r6(m.c) },
    anglesDegrees: {
      alpha: r6(deg(m.points.alpha)),
      beta: r6(deg(m.points.beta)),
      gamma: r6(deg(m.points.gamma)),
    },
    areas: { ABC: r6(m.areaABC), ACL: r6(m.areaACL), BCN: r6(m.areaBCN) },
    differences: {
      angleSum: r6(m.angleSum),
      squares: r6(m.squares),
      areas: r6(m.areas),
    },
    signs,
    proportionalAreas: {
      correct: {
        ACL_over_b2: r6(correct.ACL_over_b2),
        BCN_over_a2: r6(correct.BCN_over_a2),
        ABC_over_c2: r6(correct.ABC_over_c2),
      },
      proportionalHolds,
      pagePrinted: {
        ACL_over_a2: r6(pagePrinted.ACL_over_a2),
        BCN_over_b2: r6(pagePrinted.BCN_over_b2),
      },
      pageClaimHolds,
    },
    valid: m.valid,
    status: K.status(s),
  };
}

export function actions(): GameActions {
  return {
    compare_signs: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or { x, y } on the page's 500x450 board, y down), or with shape 'obtuse', 'right' or 'acute' to jump to that preset, report sides a=BC, b=CA, c=AB, the three angles, and the differences alpha+beta-gamma, a²+b²-c² and area(ACL)+area(BCN)-area(ABC) with their signs. Verify with the applet's own construction that all three signs agree, meaning the two small pieces leave a gap (-1), fit exactly (0) or overlap (+1).",
      args: '{"A":[66.5,285],"B":[437.5,285],"C":[281.25,140.87341226347257]}',
      run: (args) => {
        const v = reading(build(args));
        const sign = v.signs.angles;
        const word = sign < 0 ? "a gap (gamma obtuse)" : sign > 0 ? "an overlap (gamma acute)" : "an exact fit (gamma is a right angle)";
        return {
          triangle: v.triangle,
          sides: v.sides,
          anglesDegrees: v.anglesDegrees,
          differences: v.differences,
          signs: v.signs,
          valid: v.valid,
          status: v.status,
          note:
            `With a=${v.sides.a}, b=${v.sides.b}, c=${v.sides.c}, the three signs are ` +
            `${v.signs.angles}, ${v.signs.squares} and ${v.signs.areas} ` +
            `(${v.signs.allAgree ? "they agree" : "WARNING: they disagree"}). ` +
            `alpha+beta-gamma = ${v.differences.angleSum}, a²+b²-c² = ${v.differences.squares} ` +
            `and area(ACL)+area(BCN)-area(ABC) = ${v.differences.areas}, so the pieces show ${word}. ` +
            v.status,
        };
      },
    },

    proportional_areas: {
      describe:
        "For the same triangle, check the area form of Dijkstra's proof: area(ACL)/b² = area(BCN)/a² = area(ABC)/c² = k, so adding the two small triangles compares with the big one just as a²+b² compares with c². Report those ratios alongside the page's printed area(ACL)/a² = area(BCN)/b², which swaps the numerators and is false unless a=b; the summed area claim remains true.",
      args: '{"shape":"right"}',
      run: (args) => {
        const v = reading(build(args));
        const p = v.proportionalAreas;
        return {
          triangle: v.triangle,
          sides: v.sides,
          areas: v.areas,
          proportionalAreas: p,
          note:
            `Similarity gives area(ACL)/b² = ${p.correct.ACL_over_b2}, ` +
            `area(BCN)/a² = ${p.correct.BCN_over_a2} and area(ABC)/c² = ${p.correct.ABC_over_c2} ` +
            `— ${p.proportionalHolds ? "all the same k" : "not equal here"}. ` +
            `The page instead prints area(ACL)/a² = ${p.pagePrinted.ACL_over_a2} and ` +
            `area(BCN)/b² = ${p.pagePrinted.BCN_over_b2}; ` +
            `${p.pageClaimHolds ? "these happen to match (a and b are equal or the picture is degenerate)" : "these differ, so the page's printed ratio is false: its two numerators are swapped"}. ` +
            `Adding the pieces still gives sign(${v.differences.areas}) = sign(${v.differences.squares}).`,
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
  const show = state.show && typeof state.show === "object" ? (state.show as Json) : null;
  const saved = {
    stateVersion,
    A: savedPoint(state.A),
    B: savedPoint(state.B),
    C: savedPoint(state.C),
    show: show ? {
      areas: show.areas === true,
      color: show.color === true,
      hint: show.hint === true,
      names: show.names === true,
    } : null,
  };
  if (!saved.A || !saved.B || !saved.C) {
    return { ...saved, reading: null, note: "The saved position has no three valid corners to measure." };
  }
  try {
    return {
      ...saved,
      reading: reading(build(state)),
      note:
        "The saved corners are measured with the applet's own Compute(): the stripe through C, the two similar triangles ACL and BCN, and the foot H. The sign of alpha+beta-gamma, of a²+b²-c² and of area(ACL)+area(BCN)-area(ABC) always agrees; the correct area ratios are area(ACL)/b² = area(BCN)/a² = area(ABC)/c² (the page's printed a² and b² numerators are swapped). The four Show buttons change only the drawing, not the geometry.",
    };
  } catch (e) {
    return { ...saved, reading: null, note: `The saved position cannot be measured: ${(e as Error).message}` };
  }
}
