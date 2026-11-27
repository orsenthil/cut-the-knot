/*
 * run_game_logic actions and saved-position reader for Ceva Nest.
 *
 * The real core is ceva-nest/ceva-nest-core.js, copied into
 * src/generated/cores/ at build time. It follows the applet's Compute in its
 * own line intersection (a 3-by-3 determinant with a |det| < 1 cut-off). Given
 * a triangle P1P2P3 (V) and two dots P, Q it builds the first cevian triangle
 * Q1Q2Q3 from the cevians through P, then the second R1R2R3 from the cevians
 * through Q inside Q1Q2Q3. The point of the illustration is that the lines
 * P1R1, P2R2, P3R3 still meet in one point X, even though nothing in the
 * construction asks them to. Both Ceva products stay equal to 1, and the
 * article's proof is a cross-ratio identity: for each k, with n = k+1 and
 * h = k+2 (indices mod 3), the two directed ratios that split the outer side
 * Vh Vn at Qk and at Tk have the same quotient as the two that split the inner
 * side Qn Qh at Sk and at Rk. S and T are the extra proof feet hidden behind
 * "Show proof points". See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["ceva-nest"].CevaNestCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Position = { V: Point[]; P: Point; Q: Point };
type Construct = {
  V: Point[]; P: Point; Q: Point;
  q: (Point | null)[]; r: (Point | null)[]; S: (Point | null)[]; T: (Point | null)[];
  crossings: (Point | null)[]; W: Point | null;
  ok: boolean; spread: number; scale: number; concurrent: boolean;
  cevaOuter: number; cevaInner: number;
};

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** Non-finite measurements (a collapsed construction) are reported as null. */
const maybe = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const pts = (v: (Point | null)[]): ({ x: number; y: number } | null)[] => v.map(pt);

/** Accept the page's saved {x, y} as well as short [x, y] argument arrays. */
function asPoint(raw: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or {x, y}`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [num(o, "x"), num(o, "y")];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or {x, y}, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${label}" is not a finite point`);
  return { x, y };
}

function pointArg(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  return raw === undefined || raw === null ? fallback : asPoint(raw, key);
}

/** Omit any of the five dots to keep the page's starting diagram. */
function readPosition(C: Core, args: Json): Position {
  const seed = C.start() as Position;
  const raw = args.V;
  let V: Point[];
  if (raw === undefined || raw === null) {
    V = seed.V.map((p) => ({ x: p.x, y: p.y }));
  } else {
    if (!Array.isArray(raw) || raw.length !== 3) {
      throw new Error('argument "V" must be three points [P1, P2, P3]');
    }
    V = raw.map((p, i) => asPoint(p, `V[${i}]`));
  }
  return { V, P: pointArg(args, "P", seed.P), Q: pointArg(args, "Q", seed.Q) };
}

/** One empty cross-ratio entry, used when the construction collapses. */
function emptyCrossRatio(k: number) {
  return {
    k,
    outerSide: { atQ: null, atT: null },
    innerSide: { atS: null, atR: null },
    left: null, right: null, holds: false,
  };
}

/** Everything worth telling a tutor about one five-dot diagram. */
function reading(C: Core, s: Position) {
  const m = C.construct(s) as Construct;
  const crossRatios = [0, 1, 2].map((k) => {
    if (!m.ok || !m.q[k] || !m.r[k] || !m.S[k] || !m.T[k]) return emptyCrossRatio(k + 1);
    const q = m.q as Point[];
    const n = (k + 1) % 3, h = (k + 2) % 3;
    // Directed splits of the outer side Vh Vn and of the inner side Qn Qh.
    const outerAtQ = C.ratio(s.V[h], s.V[n], q[k]);
    const outerAtT = C.ratio(s.V[h], s.V[n], m.T[k] as Point);
    const innerAtS = C.ratio(q[n], q[h], m.S[k] as Point);
    const innerAtR = C.ratio(q[n], q[h], m.r[k] as Point);
    const left = outerAtQ / outerAtT;
    const right = innerAtS / innerAtR;
    return {
      k: k + 1,
      outerSide: { atQ: maybe(outerAtQ), atT: maybe(outerAtT) },
      innerSide: { atS: maybe(innerAtS), atR: maybe(innerAtR) },
      left: maybe(left),
      right: maybe(right),
      holds: Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-5,
    };
  });

  return {
    triangle: { P1: pt(s.V[0]), P2: pt(s.V[1]), P3: pt(s.V[2]), P: pt(s.P), Q: pt(s.Q) },
    qTriangle: { Q1: pt(m.q[0]), Q2: pt(m.q[1]), Q3: pt(m.q[2]) },
    rTriangle: { R1: pt(m.r[0]), R2: pt(m.r[1]), R3: pt(m.r[2]) },
    perspectiveX: pt(m.W),
    crossings: pts(m.crossings),
    spread: maybe(m.spread),
    scale: maybe(m.scale),
    concurrent: m.concurrent === true,
    usable: m.ok === true,
    ceva: {
      inner: maybe(m.cevaInner), // cevians of Q inside the Q triangle
      outer: maybe(m.cevaOuter), // the lines P1R1, P2R2, P3R3 inside P1P2P3
    },
    proofPoints: { S: pts(m.S), T: pts(m.T) },
    crossRatios,
    note: !m.ok
      ? "The construction collapses here: a vertex, a cevian foot or a join line is too close to parallel for the applet's line intersection, so there is no finite X or Ceva product. Move the dots apart."
      : `Q1Q2Q3 is the cevian triangle of P and R1R2R3 that of Q. The lines P1R1, P2R2, P3R3 meet at X, both Ceva products are 1 (inner ${maybe(m.cevaInner)}, outer ${maybe(m.cevaOuter)}), and each cross-ratio pair agrees: that is why the perspective point survives the nesting.`,
  };
}

export function actions(): GameActions {
  return {
    nest: {
      describe:
        "For a triangle with corners P1, P2, P3 (V: three points, each [x, y] or {x, y} in page coordinates, y downward) and two dots P and Q, build both nested cevian triangles: Q1Q2Q3 from the cevians through P, then R1R2R3 from the cevians through Q inside the Q triangle. Report the two triangles, the perspective point X where P1R1, P2R2 and P3R3 meet (with the three pairwise crossings and their spread), both Ceva products (inner Q-triangle and outer P-R lines), the S and T proof feet, and the cross-ratio identity for each k. Omit any point to keep the page's starting diagram. If a crossing is too close to parallel the core reports it as unusable rather than drawing it. The start is V=[[166,107],[80,20],[40,112]], P=[95.33,79.67], Q=[115.33,39.67].",
      args: '{ "V": [[166,107],[80,20],[40,112]], "P": [95.33,79.67], "Q": [115.33,39.67] }',
      run: (args) => {
        const C = core();
        return reading(C, readPosition(C, args));
      },
    },
    check_claims: {
      describe:
        "Test every claim on the illustration's page for a triangle V=[P1,P2,P3] and dots P and Q (each [x, y] or {x, y}; omit any to keep the start): that Q1Q2Q3 is the cevian triangle of P and R1R2R3 that of Q (both Ceva products equal 1), that the three lines P1R1, P2R2, P3R3 concur at X (crossing spread within rounding), and that the cross-ratio identity holds for each pair of proof feet S and T. Returns the measured products, spread and cross-ratio quotients, a boolean for each claim, the names of any that fail, and a plain-language note.",
      args: '{ "V": [[166,107],[80,20],[40,112]], "P": [95.33,79.67], "Q": [115.33,39.67] }',
      run: (args) => {
        const C = core();
        const s = readPosition(C, args);
        const m = C.construct(s) as Construct;
        const r = reading(C, s);
        const claims = {
          constructionExists: m.ok === true,
          innerCevaIsOne: m.ok === true && Math.abs(m.cevaInner - 1) <= 1e-6,
          outerCevaIsOne: m.ok === true && Math.abs(m.cevaOuter - 1) <= 1e-6,
          linesConcurAtX: m.concurrent === true,
          crossRatioIdentity: m.ok === true && r.crossRatios.every((x) => x.holds),
        };
        const failed = Object.entries(claims).filter(([, v]) => v !== true).map(([k]) => k);
        return {
          ...r,
          claims,
          allHold: failed.length === 0,
          failed,
          note: !m.ok
            ? "The dots make an unusable diagram: a line crossing is too close to parallel, so there is nothing to check. Move them apart."
            : failed.length
              ? `These claims do not hold at this diagram: ${failed.join(", ")}.`
              : "Every page claim holds: both nested Ceva products are 1, the three join lines meet at X, and the cross-ratio quotient on each outer side equals the one on the corresponding inner side.",
        };
      },
    },
  };
}

/** The page's saved five dots, read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = readPosition(C, state);
  return {
    stateVersion,
    saved: { V: s.V.map(pt), P: pt(s.P), Q: pt(s.Q) },
    reading: reading(C, s),
    stateIsIllustration: C.result() === null,
    note:
      "Track.state saves the three outer corners P1, P2, P3 and the two inner dots P and Q: exactly the five handles the page lets you drag. The reading rebuilds both nested cevian triangles, the point X and the two Ceva products with the same construction the page draws, then checks the cross-ratio identity used in the article's proof. This is an illustration: there is no win or loss.",
  };
}
