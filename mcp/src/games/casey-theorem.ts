/*
 * run_game_logic actions and saved-position reader for Casey's theorem.
 *
 * Four small circles touch one big circle, from either side. With t(XY) the
 * length of the common tangent segment of the circles at X and Y, Casey's
 * theorem says
 *
 *     t(AB) t(CD) + t(AD) t(BC) = t(AC) t(BD),
 *
 * provided A, B, C, D come in that order around the big circle (a rotation or
 * a complete reversal of the labels is fine). The four circles have radius
 * |SP_i - R|, and the tangent length is sqrt(|P_iP_j|^2 - (rho_i-rho_j)^2)
 * = 2 sqrt(d_i d_j) |sin((theta_i-theta_j)/2)|, so when the radii are all 0
 * the segments are chords and the identity becomes Ptolemy's theorem.
 * Every number below comes from the game's real core (casey-theorem/ in the
 * site, copied into src/generated/cores/ at build time). See _shared.ts for
 * the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["casey-theorem"].CaseyTheoremCore;

type Point = { x: number; y: number };
const NAMES = "ABCD";

const r4 = (n: number) => Number(n.toFixed(4));
const r6 = (n: number) => Number(n.toFixed(6));
const roundT = (n: number | null, f: (v: number) => number): number | null =>
  n === null ? null : f(n);

function pt(value: unknown): Point {
  const o = value as Point;
  return { x: r6(o.x), y: r6(o.y) };
}

/** Accept {x, y} (the saved form) or a flat [x, y]. */
function readPoint(value: unknown, label: string): Point {
  if (Array.isArray(value) && value.length === 2) {
    const x = Number(value[0]), y = Number(value[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`${label} must be two finite numbers, got ${JSON.stringify(value)}`);
    }
    return { x, y };
  }
  const o = value as Json;
  if (!o || typeof o !== "object") {
    throw new Error(`${label} must be a point {x, y} or [x, y]`);
  }
  const x = Number(o.x), y = Number(o.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} must have finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Rebuild the core position exactly as the page's Track.state payload does. */
function build(args: Json) {
  const C = core();
  if (args.points === undefined) {
    const width = num(args, "width", 400);
    const height = num(args, "height", 300);
    if (width <= 0 || height <= 0) {
      throw new Error('"width" and "height" must be positive');
    }
    return C.start({ width, height });
  }
  if (!Array.isArray(args.points) || args.points.length !== 4) {
    throw new Error('"points" must be an array of exactly four points, each {x, y} or [x, y]');
  }
  const S = readPoint(args.S, '"S"');
  const R = num(args, "R");
  if (R <= 0) throw new Error('"R" must be positive');
  const points = args.points.map((p, i) => readPoint(p, `points[${i}]`));
  return C.start({ S, R, points });
}

/** The full core reading of a position, in plain JSON. */
function reading(s: ReturnType<typeof build>) {
  const C = core();
  const m = C.measurements(s);
  const claims = C.claims(s);
  const length = (i: number, j: number): number | null => {
    const t = m.tangents.find((x: { i: number; j: number }) =>
      (x.i === i && x.j === j) || (x.i === j && x.j === i));
    return t ? t.length : null;
  };
  const tAB = length(0, 1), tBC = length(1, 2), tCD = length(2, 3), tDA = length(3, 0);
  const tAC = length(0, 2), tBD = length(1, 3);
  const product = (a: number | null, b: number | null): number | null =>
    a === null || b === null ? null : a * b;
  return {
    S: pt(s.S),
    R: r4(s.R),
    points: s.points.map(pt),
    circles: m.circles.map((c: {
      center: Point; distance: number; radius: number; signedRadius: number; inside: boolean;
    }) => ({
      center: pt(c.center),
      distance: r6(c.distance),
      radius: r6(c.radius),
      signedRadius: r6(c.signedRadius),
      inside: c.inside,
    })),
    tangents: m.tangents.map((t: {
      i: number; j: number; external: boolean; length: number | null;
      segment: { p: Point; q: Point } | null;
    }) => ({
      pair: NAMES[t.i] + NAMES[t.j],
      i: t.i,
      j: t.j,
      external: t.external,
      length: roundT(t.length, r6),
      endpoints: t.segment ? { p: pt(t.segment.p), q: pt(t.segment.q) } : null,
    })),
    cyclicOrder: m.cyclic,
    casey: {
      /* Page labels: A=1, B=2, C=3, D=4, so AB=01, CD=23, AD=03, BC=12. */
      tAB_tCD: roundT(product(tAB, tCD), r6),
      tAD_tBC: roundT(product(tDA, tBC), r6),
      left: roundT(m.left, r6),
      tAC_tBD: roundT(product(tAC, tBD), r6),
      difference: roundT(m.difference, r6),
      holds: claims.caseyIdentity,
    },
    claims: {
      circlesTouchBig: claims.circlesTouchBig === true,
      tangentsExist: claims.tangentsExist === true,
      cyclicOrder: claims.cyclicOrder === true,
      caseyIdentity: claims.caseyIdentity === true,
    },
  };
}

export function actions(): GameActions {
  return {
    casey_identity: {
      describe:
        "For four points A, B, C, D and a common circle (centre S, radius R), report the four tangent small circles, the six common tangent segments (AB, BC, CD, DA, AC, BD) with endpoints and lengths, and check Casey's identity t(AB)t(CD) + t(AD)t(BC) = t(AC)t(BD). Also says whether the labels follow the circle in order: the identity needs A, B, C, D consecutive around the big circle (up to rotation or full reversal), and becomes Ptolemy's theorem when all four radii are 0. Omit points to use the applet's default picture.",
      args:
        '{ "S": {"x":200,"y":150}, "R": 75, "points": [ {"x":267.9519052838329,"y":187.5}, {"x":135.1480947161671,"y":187.5}, {"x":139.11633688936115,"y":106.20297308914411}, {"x":237.5,"y":85.0480947161671} ] }',
      run: (args) => {
        const s = build(args);
        const view = reading(s);
        return {
          ...view,
          note:
            `Four circles of radius |SP - R| touch the big circle. Their ${view.tangents.length} common tangents give ` +
            `${view.casey.tAB_tCD} + ${view.casey.tAD_tBC} = ${view.casey.left} against t(AC)t(BD) = ${view.casey.tAC_tBD} ` +
            `(difference ${view.casey.difference}). Casey's identity ${view.casey.holds ? "holds" : "fails"} here; ` +
            `the labels ${view.cyclicOrder ? "do" : "do not"} run A, B, C, D around the circle in that direction. ` +
            "Purple tangents join circles on the same side (outer), dashed red ones cross between sides (inner); " +
            "each length is sqrt(|PQ|^2 - (rho_P - rho_Q)^2), independent of R. If all four centres sat on the big circle the tangents would be chords and this would be Ptolemy's theorem.",
        };
      },
    },

    swap_order: {
      describe:
        "Swap two of the four points (default B and C) and compare Casey's products before and after. Swapping neighbours breaks the circular order and makes the identity fail even though all six common tangents still exist; rotating the labels or reversing them all keeps it. Accepts swap as two names from A-D.",
      args:
        '{ "S": {"x":200,"y":150}, "R": 75, "points": [ {"x":267.9519052838329,"y":187.5}, {"x":135.1480947161671,"y":187.5}, {"x":139.11633688936115,"y":106.20297308914411}, {"x":237.5,"y":85.0480947161671} ], "swap": ["B","C"] }',
      run: (args) => {
        const C = core();
        const s = build(args);
        const raw = args.swap === undefined ? ["B", "C"] : args.swap;
        if (!Array.isArray(raw) || raw.length !== 2) {
          throw new Error('"swap" must be an array of two point names from ["A","B","C","D"]');
        }
        const index = raw.map((name) => NAMES.indexOf(String(name).toUpperCase()));
        if (index.some((i) => i < 0)) {
          throw new Error(`"swap" must name points A, B, C or D, got ${JSON.stringify(raw)}`);
        }
        if (index[0] === index[1]) {
          throw new Error('"swap" must name two different points');
        }
        const before = reading(s);
        const [i, j] = index as [number, number];
        const moved = C.withPoint(s, NAMES[i], s.points[j]);
        const swapped = C.withPoint(moved, NAMES[j], s.points[i]);
        const after = reading(swapped);
        return {
          swap: [NAMES[i], NAMES[j]],
          before: {
            cyclicOrder: before.cyclicOrder,
            casey: before.casey,
          },
          after,
          note:
            `After swapping ${NAMES[i]} and ${NAMES[j]}, the labels ${after.cyclicOrder ? "still" : "no longer"} follow the circle, ` +
            `and the two products are ${after.casey.left} and ${after.casey.tAC_tBD} ` +
            `(difference ${after.casey.difference}), so the identity ${after.casey.holds ? "still holds" : "fails"}. ` +
            "The six tangent lengths are unchanged as a set: only which pair plays which role in the identity changes. " +
            "Casey's theorem needs the four circles in circular order; a rotation or a full reversal of the names preserves it.",
        };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Casey's theorem state version ${stateVersion}`);
  }
  const view = reading(build(state));
  return {
    stateVersion,
    ...view,
    note:
      `The saved centres give circles of radius |SP - R| tangent to the big circle; all six common tangents ` +
      `${view.claims.tangentsExist ? "exist" : "do not all exist"}. Casey's identity ` +
      `${view.claims.caseyIdentity ? "holds" : "does not hold"} here ` +
      `(${view.casey.left} against ${view.casey.tAC_tBD}, difference ${view.casey.difference}), and the labels ` +
      `${view.cyclicOrder ? "run A, B, C, D around the circle" : "are not in A, B, C, D circular order"}. ` +
      "With zero radii the same identity is Ptolemy's theorem for four points on a circle.",
  };
}
