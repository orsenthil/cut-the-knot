/*
 * run_game_logic actions and saved-position reader for From Grebe.
 *
 * The real core is from-grebe/from-grebe-core.js, copied into
 * src/generated/cores/ at build time. It transcribes the applet's Compute():
 * on each side of the dragged triangle A'B'C' a square is built; the outer
 * sides of two adjacent squares meet at A0, B0, C0, and the three joining
 * lines A'A0, B'B0, C'C0 concur at K. K is the Lemoine (symmedian) point,
 * with barycentrics a^2:b^2:c^2 where a = |BC|, b = |CA|, c = |AB|. Rays
 * from K through the far square corners cut the sides; rotating such a pair
 * by a right angle gives a corner of the sought triangle ABC. That triangle
 * is the image of A'B'C' under the homothety about K with factor
 *
 *   r = D / (D - (a^2 + b^2 + c^2)),  D = twice the signed area,
 *
 * which is 2*area / (a^2+b^2+c^2+2*area) when the squares lie outside.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["from-grebe"].FromGrebeCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };

/** The core's construct() result (and its early {valid: false} return). */
type Grebe = {
  valid: boolean;
  A: Point; B: Point; C: Point;
  As: Point[][];
  P: Point[];
  cevian: Point[];
  K: Point;
  S: Point[][];
  Ap: Point[];
};

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);

/** Accept both the page's saved {x, y} and short [x, y] arguments. */
function asPoint(raw: unknown, label: string, fallback: Point): Point {
  if (raw === undefined || raw === null) return fallback;
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or {x, y}`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [num(o, "x"), num(o, "y")];
  } else {
    throw new Error(`${label} must be [x, y] or {x, y}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} is not a finite point`);
  return { x, y };
}

/** A corner may be omitted: it then keeps the applet's opening triangle. */
function readTriangle(C: Core, args: Json): Triangle {
  const seed = C.start();
  return {
    A: asPoint(args.A, 'argument "A"', seed.A),
    B: asPoint(args.B, 'argument "B"', seed.B),
    C: asPoint(args.C, 'argument "C"', seed.C),
  };
}

/** The page's one checkbox, either at the top level or in saved options. */
function readNames(args: Json): boolean {
  const raw = args.options !== undefined && args.options !== null && typeof args.options === "object"
    ? (args.options as Json) : args;
  if (raw.names !== undefined && typeof raw.names !== "boolean") {
    throw new Error('argument "names" must be a boolean');
  }
  return raw.names === true;
}

/** Whether a cut lies on the segment between the two corners of a side. */
function onSegment(p: Point, from: Point, to: Point): boolean {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return false;
  const t = ((p.x - from.x) * dx + (p.y - from.y) * dy) / len2;
  const cross = ((p.x - from.x) * dy - (p.y - from.y) * dx) / Math.sqrt(len2);
  return t >= -1e-6 && t <= 1 + 1e-6 && Math.abs(cross) < 1e-6;
}

/** Everything the core constructs for one dragged triangle, in tutor units. */
function reading(C: Core, s: Triangle) {
  const g = C.construct(s.A, s.B, s.C) as unknown as Grebe;
  if (!g || g.valid !== true || !g.K || !g.P || !g.As || !g.S || !g.Ap || !g.cevian) {
    return {
      valid: false as const,
      note:
        "The core stops drawing when two corners are within 2 board units or the outer sides are parallel: there is no Lemoine point or homothety to report. Move the corners apart so A', B' and C' form a proper triangle.",
    };
  }

  // a, b, c are opposite A', B', C' respectively.
  const a2 = C.sideSquares(s.B, s.C);
  const b2 = C.sideSquares(s.C, s.A);
  const c2 = C.sideSquares(s.A, s.B);
  const sum = a2 + b2 + c2;
  const D = C.twiceArea(s.A, s.B, s.C);
  const factor = C.factor(s.A, s.B, s.C);

  const bary = C.barycentric(g.K, s.A, s.B, s.C) as number[] | null;
  const expected = sum !== 0 ? [a2 / sum, b2 / sum, c2 / sum] : null;
  const maxBaryDiff = bary && expected
    ? Math.max(...bary.map((w, i) => Math.abs(w - expected[i]))) : null;

  const spread = Math.max(
    dist(g.cevian[0], g.cevian[1]),
    dist(g.cevian[1], g.cevian[2]),
    dist(g.cevian[2], g.cevian[0]),
  );

  const T = [s.A, s.B, s.C];
  const homothetic = T.map((p) => ({
    x: g.K.x + factor * (p.x - g.K.x),
    y: g.K.y + factor * (p.y - g.K.y),
  }));
  const maxScaleDiff = Math.max(...g.Ap.map((p, i) => dist(p, homothetic[i])));
  const cutsOnSides = g.S.every((pair, i) =>
    pair.every((p) => onSegment(p, T[i], T[(i + 1) % 3])));

  return {
    valid: true as const,
    primed: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    farSquareCorners: {
      onAB: g.As[0].map(pt), onBC: g.As[1].map(pt), onCA: g.As[2].map(pt),
    },
    outerIntersections: { A0: pt(g.P[0]), B0: pt(g.P[1]), C0: pt(g.P[2]) },
    concurrency: {
      pairwise: g.cevian.map(pt),
      spread: round(spread),
      concurrent: spread < 1e-6,
    },
    K: pt(g.K),
    sideSquares: { a2: round(a2), b2: round(b2), c2: round(c2), sum: round(sum) },
    barycentric: {
      ofK: bary ? bary.map(maybe) : null,
      fromSides: expected ? expected.map(maybe) : null,
      sum: maybe(bary ? bary[0] + bary[1] + bary[2] : null),
      maxDifference: maybe(maxBaryDiff),
      matchesSideSquares: maxBaryDiff !== null && maxBaryDiff < 1e-6,
    },
    homothety: {
      factor: round(factor),
      twiceSignedArea: round(D),
      reconstructed: g.Ap.map(pt),
      fromScale: homothetic.map(pt),
      maxDifference: round(maxScaleDiff),
      matches: maxScaleDiff < 1e-6,
      squaresOutside: factor > 0 && factor < 1,
    },
    cutsOnSides,
    status: C.label(g as never),
    note:
      "A', B', C' are the corners you drag. A0, B0, C0 are the meetings of the outer sides of adjacent squares; A'A0, B'B0 and C'C0 meet at K, whose weights at A', B', C' are a^2:b^2:c^2. The reconstructed triangle is the dragged triangle scaled about K by D/(D-a^2-b^2-c^2); for the winding with the squares outside this lies between 0 and 1, so the answer is unique.",
  };
}

export function actions(): GameActions {
  return {
    construct: {
      describe:
        "For the draggable triangle A', B', C' (each [x, y] or {x, y} in page coordinates, y downward; omit a corner to keep the applet's starting triangle), build a square on each side and report the far square corners, the outer-line intersections A0, B0, C0, the three pairwise cevian meetings and their average K (the Lemoine point), the side cuts and the reconstructed triangle ABC. Also gives K's barycentrics against a^2:b^2:c^2, the twice signed area, the homothety factor and the status line. names may be set at the top level or in options.",
      args: '{ "A": [170, 220], "B": [250, 220], "C": [195, 160] }',
      run: (args) => {
        const C = core();
        const s = readTriangle(C, args);
        return { names: readNames(args), ...reading(C, s) };
      },
    },
    check_claims: {
      describe:
        "Check the page's claims for a draggable triangle A', B', C': the three vertex-to-outer-square lines concur at K, K's barycentrics are a^2:b^2:c^2, the rotated ray cuts lie on the sides, and the reconstructed triangle is the dragged triangle scaled about K by D/(D-a^2-b^2-c^2) (between 0 and 1 when the squares are outside). Returns a boolean for each check, the failed names and the measurements used.",
      args: '{ "A": [175, 220], "B": [250, 220], "C": [195, 160] }',
      run: (args) => {
        const C = core();
        const r = reading(C, readTriangle(C, args));
        if (!r.valid) return r;
        const checks = {
          ceviansConcurrent: r.concurrency.concurrent,
          KIsSymmedian: r.barycentric.matchesSideSquares,
          cutsOnSides: r.cutsOnSides,
          reconstructedIsHomothetic: r.homothety.matches,
          squaresOutside: r.homothety.squaresOutside,
        };
        const failed = Object.keys(checks).filter((k) => !checks[k as keyof typeof checks]);
        return {
          ...checks,
          allHold: failed.length === 0,
          failed,
          cevianSpread: r.concurrency.spread,
          barycentricDifference: r.barycentric.maxDifference,
          scaleDifference: r.homothety.maxDifference,
          homothetyFactor: r.homothety.factor,
          note: failed.length
            ? "One or more checks fail: a collapsed triangle or a different square winding can make the applet's construction degenerate or turn the scale negative."
            : "Every checked claim holds: the joining lines meet at K, its weights are proportional to the squared opposite sides, the cuts lie on the sides and the answer is the dragged triangle scaled about K.",
        };
      },
    },
  };
}

/** The page's saved triangle, checkbox and Lemoine point, read through the core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = readTriangle(C, state);
  const g = C.construct(s.A, s.B, s.C) as unknown as Grebe;
  const savedK = state.K !== undefined && state.K !== null && typeof state.K === "object"
    ? asPoint(state.K, "state.K", g && g.K ? g.K : s.A) : null;
  const r = reading(C, s);
  return {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    options: { names: readNames(state) },
    K: pt(savedK),
    reading: r,
    savedKDistance: savedK && g && g.K ? round(dist(savedK, g.K)) : null,
    note:
      "Track.state saves the three dragged corners A', B' and C', the show-names option and the Lemoine point K drawn on the page. The reading recomputes K, the outer-square intersections and the homothety scale from those saved corners with the same core; savedKDistance should be 0.",
  };
}
