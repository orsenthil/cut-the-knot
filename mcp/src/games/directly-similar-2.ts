/*
 * run_game_logic actions and saved-position reader for Directly Similar 2.
 *
 * Unlike Directly Similar 1 (squares built from two opposite corners), this
 * page starts with two triangles ABC and A'B'C' and a point P. Only A, B, C,
 * A', B' and P are dragged; the core completes C' from the two signed angles
 * of ABC (rotate D->E by angle(A,B,C) and E->D by angle(B,A,C), then intersect
 * the rays - the GeoSDoub primitives transcribed in directly-similar-2-core.js).
 * With F = C' so built, the third triangle is
 *
 *     A1 = P + A - A',  B1 = P + B - B',  C1 = P + C - F,
 *
 * which is directly similar to both given triangles: a common rotation-and-
 * scale has the complex ratio q = (B'-A')/(B-A), and subtracting the second
 * triangle from the first leaves the same q (with centre P + A - A'). If
 * q = 1 the triangles are translates: C' = C + (A'-A) and all three new
 * corners fall on the single point P + A - A'. Every number below is measured
 * by the game's real core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Position = { width: number; height: number; points: Pt[] };
type Figures = { abc: Pt[]; primed: Pt[] | null; third: Pt[] | null; f: Pt | null };

interface DirectlySimilar2 {
  WIDTH: number;
  HEIGHT: number;
  NAMES: string[];
  start(options?: { width?: number; height?: number }): Position;
  movePoint(state: Position, index: number, p: Pt): Position;
  signedAngle(a: Pt, b: Pt, c: Pt): number;
  rotate(a: Pt, b: Pt, angle: number, sign: number): Pt;
  intersect(a: Pt, b: Pt, c: Pt, d: Pt): Pt;
  completed(a: Pt, b: Pt, c: Pt, d: Pt, e: Pt): Pt | null;
  complete(state: Position): Pt | null;
  figures(state: Position): Figures;
  complexDiv(a: Pt, b: Pt): Pt;
  similarityError(t: Pt[] | null, u: Pt[] | null): number;
  angleError(t: Pt[] | null, u: Pt[] | null): number;
  isDirectlySimilar(t: Pt[] | null, u: Pt[] | null, eps?: number): boolean;
  describe(state: Position): string;
  result(): null;
}

const core = (): DirectlySimilar2 =>
  cores["directly-similar-2"].DirectlySimilar2Core as unknown as DirectlySimilar2;

const EPS = 1e-6;
const GIVEN = ["A", "B", "C"];
const PRIMED = ["A'", "B'", "C'"];
const MADE = ["A1", "B1", "C1"];

/** Core points can be NaN (parallel completion rays); JSON cannot. */
const finite = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) ? n : null;
const round = (v: number): number => Math.round(v * 1e6) / 1e6;
const safePoint = (p: Pt | null): Pt | null =>
  p && finite(p.x) !== null && finite(p.y) !== null ? { x: round(p.x), y: round(p.y) } : null;
const pt = (p: Pt): Pt => ({ x: round(p.x), y: round(p.y) });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const neg = (a: Pt): Pt => ({ x: -a.x, y: -a.y });
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
const sides = (t: Pt[]): number[] => t.map((p, i) => round(dist(p, t[(i + 1) % 3])));

/** Accept both the page's { x, y } and the tutor's [x, y]. */
function readPoint(v: unknown, key: string): Pt {
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${key}" must be [x, y] or { x, y }`);
    const x = Number(v[0]), y = Number(v[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`"${key}" needs two finite numbers, got ${JSON.stringify(v)}`);
    }
    return { x, y };
  }
  if (v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`"${key}" must be [x, y] or { x, y }`);
}

/**
 * The six saved dots A, B, C, A', B', P, and the board size. A whole saved
 * `state` may be passed instead; omitted points give the opening picture.
 */
function readPosition(args: Json): Position {
  const C = core();
  const seed = C.start({});
  const src: Json =
    args.state !== null && typeof args.state === "object" && !Array.isArray(args.state)
      ? (args.state as Json)
      : args;
  const raw = src.points;
  let points: Pt[];
  if (raw === undefined || raw === null) {
    points = seed.points.map((p) => ({ x: p.x, y: p.y }));
  } else {
    if (!Array.isArray(raw) || raw.length !== 6) {
      throw new Error('"points" must hold exactly six points: A, B, C, A\', B\', P');
    }
    points = raw.map((p, i) => readPoint(p, `points[${i}]`));
  }
  const width = num(src, "width", seed.width);
  const height = num(src, "height", seed.height);
  if (!(width > 0) || !(height > 0)) {
    throw new Error('"width" and "height" must be positive numbers');
  }
  return { width, height, points };
}

/** A triangle's corners, side lengths and core-measured angle error vs ABC. */
function triangleReading(C: DirectlySimilar2, pts: Pt[] | null, names: string[], abc: Pt[]) {
  const angle = pts ? C.angleError(pts, abc) : Infinity;
  const similarity = pts ? C.similarityError(pts, abc) : Infinity;
  return {
    corners: pts ? pts.map(pt) : null,
    names,
    sideLengths: pts ? sides(pts) : null,
    angleErrorDegVsABC: finite(angle) === null ? null : round(angle),
    similarityErrorVsABC: finite(similarity) === null ? null : round(similarity),
  };
}

/** How the core rebuilds C' from the two signed angles of ABC. */
function completion(C: DirectlySimilar2, s: Position, f: Figures) {
  if (!f.primed || !f.f) return { possible: false, reason: "A = B or A' = B', or the completion rays are parallel" };
  const [a, b, c, d, e] = s.points;
  const atA = C.signedAngle(a, b, c);
  const atB = C.signedAngle(b, a, c);
  const rayAtD = C.rotate(d, e, atA, 1);
  const rayAtE = C.rotate(e, d, atB, 1);
  const fromCore = C.completed(a, b, c, d, e);
  return {
    possible: true,
    signedAngleAtA: atA,
    signedAngleAtB: atB,
    signedAngleAtA_deg: round(atA * 180 / Math.PI),
    signedAngleAtB_deg: round(atB * 180 / Math.PI),
    rayFromAprime: pt(rayAtD),
    rayFromBprime: pt(rayAtE),
    intersection: pt(C.intersect(d, rayAtD, e, rayAtE)),
    Cprime: safePoint(fromCore),
    matchesCoreCompletion: dist(fromCore || { x: NaN, y: NaN }, f.f) <= EPS,
  };
}

/**
 * The page's A1 = P + AA' versus the core's A1 = P + A - A', corner by corner,
 * and q = (B'-A')/(B-A). The core uses the opposite step (the half-turn of the
 * page's triangle about P), which has the same shape, so the two triangles are
 * not equal but each pair of matching corners is reflected through P.
 */
function translation(s: Position, f: Figures) {
  const [a, b, c, d, e, p] = s.points;
  const u = sub(b, a), v = sub(e, d);
  const q = core().complexDiv(v, u);
  const fromStep = [sub(d, a), sub(e, b), f.f ? sub(f.f, c) : null];
  const rows = MADE.map((name, k) => {
    const step = fromStep[k];
    const pageVertex = step ? add(p, step) : null;
    const coreVertex = f.third ? f.third[k] : null;
    const fromP = coreVertex ? sub(coreVertex, p) : null;
    return {
      vertex: name,
      step: `${GIVEN[k]} -> ${PRIMED[k]}`,
      stepVector: step ? pt(step) : null,
      pageVertex: pageVertex ? pt(pageVertex) : null,
      coreVertex: coreVertex ? pt(coreVertex) : null,
      oppositeStep: !!step && !!fromP && dist(fromP, neg(step)) <= EPS,
      halfTurnAboutP: !!pageVertex && !!coreVertex && dist(mid(pageVertex, coreVertex), p) <= EPS,
    };
  });
  return {
    pageRule: "page: A1 = P + AA' = P + A' - A (and likewise for B1, C1)",
    coreRule: "core: A1 = P + A - A', B1 = P + B - B', C1 = P + C - C'",
    corners: rows,
    allOppositeSteps: rows.every((row) => row.oppositeStep),
    allHalfTurnsAboutP: rows.every((row) => row.halfTurnAboutP),
    rotationScaleRatio_q: pt(q),
    q_is_one: Math.abs(q.x - 1) <= EPS && Math.abs(q.y) <= EPS,
  };
}

export function actions(): GameActions {
  return {
    third_triangle: {
      describe:
        "From the six draggable dots (A, B, C, A', B', P; points may be [x, y] or { x, y }, or a whole saved `state`), report the core-completed C' and the third triangle A1B1C1 = P + A - A', P + B - B', P + C - C'. It shows the two signed angles and rotation rays used to complete C', the translation step at each corner, the complex ratio q = (B'-A')/(B-A), and the core's similarity and angle errors showing A1B1C1 matches both given triangles. Unlike Directly Similar 1, the figures are triangles whose third corner is completed, not squares from opposite corners. Omit the dots for the opening picture.",
      args: '{ "points": [[55,166], [277,300], [166,100], [62,333], [187,375], [375,333]] }',
      run: (args) => {
        const C = core();
        const s = readPosition(args);
        const f = C.figures(s);
        return {
          board: { width: s.width, height: s.height },
          namedPoints: {
            A: pt(s.points[0]), B: pt(s.points[1]), C: pt(s.points[2]),
            "A'": pt(s.points[3]), "B'": pt(s.points[4]), P: pt(s.points[5]),
          },
          given: triangleReading(C, f.abc, GIVEN, f.abc),
          primed: triangleReading(C, f.primed, PRIMED, f.abc),
          completed: completion(C, s, f),
          third: triangleReading(C, f.third, MADE, f.abc),
          claim: translation(s, f),
          directlySimilarToBoth:
            C.isDirectlySimilar(f.third, f.abc) && C.isDirectlySimilar(f.third, f.primed),
          status: C.describe(s),
          note:
            "The core completes C' by rotating the ray A'->B' through the signed angle at A and the ray B'->A' through the signed angle at B, then intersecting them. Subtracting the two triangles term by term keeps the same complex ratio q, so A1B1C1 = P + ABC - A'B'C' is directly similar to both. The page states A1 = P + AA'; the core draws the opposite step P - AA', a half-turn of the page triangle about P with the same shape. If q = 1 the given triangles are translates and the new triangle shrinks to a point (see collapsing_case).",
        };
      },
    },

    collapsing_case: {
      describe:
        "Move A' and B' so the second triangle is an exact translate of ABC by (dx, dy) (defaults 40, -25), i.e. q = 1, and report what the real core draws: C' lands on C + (dx, dy) and all three translated corners A1, B1, C1 collapse onto the single point P - (dx, dy). Other saved dots can be supplied through `points` or `state`; A, B and A', B' must be distinct pairs.",
      args: '{ "dx": 40, "dy": -25 }',
      run: (args) => {
        const C = core();
        const s0 = readPosition(args);
        const dx = num(args, "dx", 40);
        const dy = num(args, "dy", -25);
        if (dist(s0.points[0], s0.points[1]) <= EPS || dist(s0.points[3], s0.points[4]) <= EPS) {
          throw new Error("A and B, and A' and B', must be distinct points");
        }
        const t = { x: dx, y: dy };
        let s = C.movePoint(s0, 3, add(s0.points[0], t));
        s = C.movePoint(s, 4, add(s0.points[1], t));
        const f = C.figures(s);
        const collapse = sub(s.points[5], t);
        const worst = f.third
          ? Math.max(...f.third.map((p) => dist(p, collapse)))
          : Infinity;
        const expectedF = add(s0.points[2], t);
        return {
          translation: pt(t),
          given: triangleReading(C, f.abc, GIVEN, f.abc),
          primed: triangleReading(C, f.primed, PRIMED, f.abc),
          completed: completion(C, s, f),
          expectedCprime: pt(expectedF),
          CprimeIsTranslateOfC: !!f.f && dist(f.f, expectedF) <= EPS,
          third: triangleReading(C, f.third, MADE, f.abc),
          collapsePoint: pt(collapse),
          collapseFormula: "P - t = P + A - A'",
          worstOffsetFromCollapse: round(worst),
          allThreeCornersCoincide: worst <= EPS,
          claim: translation(s, f),
          status: C.describe(s),
          note:
            "Translating the second triangle by t leaves q = (B'-A')/(B-A) = 1, so its completion is C' = C + t. The core's rule third[k] = P + k - k' then gives the same point P - t for all three corners: the three triangles are still directly similar, but the constructed one has shrunk to a point. Directly Similar 1 reaches a similar collapse from squares built on two corners; here the collapse follows from q = 1 on completed triangles.",
        };
      },
    },
  };
}

/** The six saved dots plus the core's reading of the completed and third triangles. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Directly Similar 2 state version ${stateVersion}`);
  }
  const C = core();
  try {
    const s = readPosition(state);
    const f = C.figures(s);
    return {
      ...state,
      stateVersion,
      valid: true,
      board: { width: s.width, height: s.height },
      namedPoints: {
        A: pt(s.points[0]), B: pt(s.points[1]), C: pt(s.points[2]),
        "A'": pt(s.points[3]), "B'": pt(s.points[4]), P: pt(s.points[5]),
      },
      reading: {
        given: triangleReading(C, f.abc, GIVEN, f.abc),
        primed: triangleReading(C, f.primed, PRIMED, f.abc),
        completed: completion(C, s, f),
        third: triangleReading(C, f.third, MADE, f.abc),
        claim: translation(s, f),
        collapsed: !!f.third && f.third.every((p) => dist(p, f.third![0]) <= EPS),
        directlySimilarToBoth:
          C.isDirectlySimilar(f.third, f.abc) && C.isDirectlySimilar(f.third, f.primed),
        result: C.result(),
        status: C.describe(s),
        note:
          "Track.state saved the six draggable dots A, B, C, A', B' and P plus the board size. The core rebuilds C' from the two signed angles of ABC, forms A1B1C1 = P + A - A', P + B - B', P + C - C', and measures its similarity to both triangles; a single point means q = 1 and the given triangles are translates.",
      },
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "A saved Directly Similar 2 position needs six points A, B, C, A', B', P, each { x, y }, plus optional width and height.",
    };
  }
}
