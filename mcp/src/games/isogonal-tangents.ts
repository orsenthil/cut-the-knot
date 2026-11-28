/*
 * run_game_logic actions and saved-position reader for Isogonal Tangents,
 * Alexander Bogomolny's IsogonalTangents applet ("Internal Tangents to Three
 * Circles").
 *
 * The real core is isogonal-tangents/isogonal-tangents-core.js, copied verbatim
 * into src/generated/cores/ at build time; every number below is measured by
 * it. Coordinates are board units of the page's 600 x 500 SVG, with y down.
 *
 * Three rays from O carry three circles, each touching the two rays of one
 * angle. A ray is one internal common tangent of its pair of circles; the
 * other one is the mirror image of that ray in the line joining the two
 * centres and meets it at the internal centre of similitude. The three rays
 * already concur at O, and Mannheim's theorem says the three second tangents
 * concur too. The core's claims() measures all of that as residuals, and
 * reports near-tangent circles as unstable rather than claiming the theorem.
 * The page's printed Steiner identity AO + DX = DO + DX is a typo for
 * AO + AX = DO + DX, but the applet defines no point D, so nothing here
 * measures a length involving D. This is a demonstration: no win or loss.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { x: number; y: number; r: number };
type Line = { a: Pt; b: Pt };
type Pair = { name: string; first: string; second: string; ray: string; crossing: string };
type Points = Record<string, Pt>;
type State = {
  width: number;
  height: number;
  points: Points;
  showNames: boolean;
};
type Compute = {
  circles: Record<string, Circle>;
  lines: Record<string, Line | null>;
  crossings: Record<string, Pt>;
  cuts: Pt[];
  X: Pt | null;
  regular: boolean;
};
type Claims = Compute & {
  rayResidual: number;
  tangentResidual: number;
  mirrorResidual: number;
  spread: number;
  gaps: number[];
  degenerate: boolean;
  raysTangent: boolean;
  linesTangent: boolean;
  mirrored: boolean;
  concurrent: boolean;
};
type Core = {
  COEF: number;
  NAMES: string[];
  RAY_NAMES: string[];
  CENTRES: string[];
  CIRCLE_RAYS: Record<string, string[]>;
  PAIRS: Pair[];
  dist(a: Pt, b: Pt): number;
  cross(a: Pt, b: Pt): number;
  start(o?: { width?: number; height?: number; showNames?: boolean }): State;
  withPoint(s: State, name: string, p: Pt): State;
  withNames(s: State, on: boolean): State;
  circles(s: State): Record<string, Circle>;
  compute(s: State): Compute;
  claims(s: State): Claims;
  reflectPoint(p: Pt, a: Pt, b: Pt): Pt;
  distToLine(p: Pt, a: Pt, b: Pt): number;
  commonPoint(c1: Circle, c2: Circle): Pt;
  commonTangent(c1: Circle, c2: Circle): Line;
  secondTangent(s: State, c1: Circle, c2: Circle): Line | null;
  result(s: State): null;
};

const core = (): Core => cores["isogonal-tangents"].IsogonalTangentsCore as unknown as Core;

/* The core keeps full precision; only what we print is rounded. */
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const circle = (c: Circle | undefined): Circle | null =>
  c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)
    ? { x: round(c.x), y: round(c.y), r: round(c.r) }
    : null;
const line = (ln: Line | null | undefined): { from: Pt | null; to: Pt | null } | null =>
  ln ? { from: pt(ln.a), to: pt(ln.b) } : null;
const isPlain = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** A point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or { x, y }`);
    x = Number(raw[0]);
    y = Number(raw[1]);
  } else if (isPlain(raw)) {
    x = Number(raw.x);
    y = Number(raw.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

const maybePoint = (raw: unknown): Pt | null => {
  try {
    return readPoint(raw, "point");
  } catch {
    return null;
  }
};

function dimension(args: Json, key: string, fallback: number): number {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 50 || n > 10000) {
    throw new Error(`argument "${key}" must be a board size from 50 to 10000, got ${JSON.stringify(v)}`);
  }
  return n;
}

/**
 * Start from the applet's opening board and drag the named points through the
 * core: a ray point rebuilds all three centres, a centre slides along its
 * bisector. Unknown point names and non-finite coordinates are refused.
 */
function buildState(C: Core, args: Json): State {
  if (!isPlain(args)) {
    throw new Error("arguments must be an object with optional width, height and points");
  }
  let s = C.start({ width: dimension(args, "width", 600), height: dimension(args, "height", 500) });
  const raw = args.points;
  if (raw !== undefined && raw !== null) {
    if (!isPlain(raw)) throw new Error('argument "points" must be an object of named points');
    for (const key of Object.keys(raw)) {
      if (!C.NAMES.includes(key)) {
        throw new Error(`unknown point "${key}": expected one of ${C.NAMES.join(", ")}`);
      }
    }
    for (const name of [...C.RAY_NAMES, ...C.CENTRES]) {
      const v = raw[name];
      if (v !== undefined && v !== null) s = C.withPoint(s, name, readPoint(v, `points.${name}`));
    }
  }
  return s;
}

function readPair(C: Core, args: Json): Pair {
  const raw = args.pair;
  if (raw === undefined || raw === null) return C.PAIRS[0];
  if (typeof raw !== "string") throw new Error('argument "pair" must be "QR", "RP" or "PQ"');
  const pair = C.PAIRS.find((p) => p.name === raw.toUpperCase());
  if (!pair) throw new Error(`argument "pair" must be "QR", "RP" or "PQ", got "${raw}"`);
  return pair;
}

/** One compute() plus the page's claims, as rounded, core-derived numbers. */
function reading(C: Core, s: State, g: Compute = C.compute(s)) {
  const cl = C.claims(s);
  const gap = (a: string, b: string): number | null =>
    sig(C.dist(g.circles[a], g.circles[b]) - g.circles[a].r - g.circles[b].r);
  return {
    board: { width: s.width, height: s.height },
    showNames: s.showNames,
    points: Object.fromEntries(C.NAMES.map((n) => [n, pt(s.points[n])])),
    circles: Object.fromEntries(C.CENTRES.map((n) => [n, circle(g.circles[n])])),
    gaps: { PQ: gap("P", "Q"), QR: gap("Q", "R"), RP: gap("R", "P") },
    secondTangents: Object.fromEntries(C.PAIRS.map((p) => [p.name, line(g.lines[p.name])])),
    crossings: Object.fromEntries(C.PAIRS.map((p) => [p.crossing, pt(g.crossings[p.crossing])])),
    cuts: g.cuts.map((q) => pt(q)),
    X: pt(g.X),
    spread: sig(cl.spread),
    tolerance: 1e-6 * Math.max(1, s.width, s.height),
    regular: cl.regular,
    degenerate: cl.degenerate,
    raysTouchBothCircles: cl.raysTangent,
    secondTangentsTouchBothCircles: cl.linesTangent,
    mirrored: cl.mirrored,
    concurrent: cl.concurrent,
    residuals: {
      ray: sig(cl.rayResidual),
      tangent: sig(cl.tangentResidual),
      mirror: sig(cl.mirrorResidual),
    },
    result: C.result(s),
  };
}

/** The reflection-in-centre-line construction for one of the three pairs. */
function mirrorReading(C: Core, s: State, g: Compute, pair: Pair) {
  const c1 = g.circles[pair.first];
  const c2 = g.circles[pair.second];
  const O = s.points.O;
  const rayPoint = s.points[pair.ray];
  const gap = sig(C.dist(c1, c2) - c1.r - c2.r);
  const circles = { [pair.first]: circle(c1), [pair.second]: circle(c2) };
  const ln = C.secondTangent(s, c1, c2);
  if (!ln) {
    return {
      pair: pair.name,
      circles,
      gap,
      secondTangent: null,
      note: `The core cannot draw a second internal tangent for ${pair.name} at this picture.`,
    };
  }
  const qO = C.reflectPoint(O, c1, c2);
  const qRay = C.reflectPoint(rayPoint, c1, c2);
  const u = { x: qRay.x - qO.x, y: qRay.y - qO.y };
  const v = { x: ln.b.x - ln.a.x, y: ln.b.y - ln.a.y };
  const du = Math.hypot(u.x, u.y), dv = Math.hypot(v.x, v.y);
  const sin = du > 1e-9 && dv > 1e-9 ? Math.abs(C.cross(u, v)) / (du * dv) : Infinity;
  const sim = C.commonPoint(c1, c2);
  const crossing = g.crossings[pair.crossing];
  const scale = Math.max(1, s.width, s.height);
  return {
    pair: pair.name,
    circles,
    gap,
    centresLine: { from: pt(c1), to: pt(c2) },
    ray: { name: pair.ray, from: pt(O), through: pt(rayPoint) },
    reflectedRay: { from: pt(qO), through: pt(qRay) },
    secondTangent: line(ln),
    coalescedTangent: line(C.commonTangent(c1, c2)),
    tangencyResiduals: {
      rayToFirst: sig(C.distToLine(c1, O, rayPoint) - c1.r),
      rayToSecond: sig(C.distToLine(c2, O, rayPoint) - c2.r),
      secondToFirst: sig(C.distToLine(c1, ln.a, ln.b) - c1.r),
      secondToSecond: sig(C.distToLine(c2, ln.a, ln.b) - c2.r),
    },
    reflectedDirectionSin: sig(sin),
    reflectionIsSecondTangent: sin < 1e-7,
    internalSimilitudeCentre: pt(sim),
    similitudeOnRay: sig(C.distToLine(sim, O, rayPoint)),
    similitudeOnSecondTangent: sig(C.distToLine(sim, ln.a, ln.b)),
    crossing: pt(crossing),
    crossingIsSimilitude: Number.isFinite(crossing.x) && C.dist(sim, crossing) < 1e-6 * scale,
  };
}

const NO_GAME =
  "This is a demonstration, so there is no win or loss; the tracker records exploration.";

/* The live page's saved diagram: O shifted six units right of the opening. */
const fixture = {
  points: {
    O: [306, 250], U: [100, 370], V: [500, 370], W: [400, 16.794919243112275],
  },
};

export function actions(): GameActions {
  return {
    second_tangents_concur: {
      describe:
        "Build the applet's three circles on the angle bisectors of the rays O-U, O-V and O-W, then run the real IsogonalTangents core to find each pair's other internal tangent and check the page's claims. Pass optional width and height (board units, 50 to 10000, default 600 x 500) and a points object with any of O, U, V, W, P, Q, R as [x, y] or { x, y }; moving a ray point rebuilds the centres, while moving a centre slides it along its bisector. The result gives the circles and their gaps, the three second tangents and their crossings A, B, C, the three pairwise cuts, their average X and spread, the tangency and mirror residuals, and whether the three second tangents are concurrent at X; the example uses the live page's saved diagram.",
      args: JSON.stringify(fixture),
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = C.compute(s);
        const r = reading(C, s, g);
        return {
          ...r,
          note:
            `The core draws the second internal tangent for each of QR, RP and PQ. The rays miss their two circles by at most ${r.residuals.ray ?? "n/a"} units, the second lines by ${r.residuals.tangent ?? "n/a"}, the mirror residual is ${r.residuals.mirror ?? "n/a"}, and the three cuts sit within ${r.spread ?? "n/a"} units of X = ${JSON.stringify(r.X)}. ` +
            (r.concurrent
              ? "Mannheim's form holds here: the three rays meet at O and the other three internal tangents meet at X."
              : "Two circles nearly touch or a circle has collapsed onto O, so the crossing is unstable and concurrency is not claimed.") +
            " " + NO_GAME,
        };
      },
    },

    reflection_in_centre_line: {
      describe:
        "For one pair of circles (pair = 'QR', 'RP' or 'PQ', default 'QR'), reflect the common ray through O in the line joining the two centres and compare its direction with the core's second internal tangent; also report the internal centre of similitude where both tangents cross the ray, the four tangency residuals and the coalesced tangent for reference. Takes the same width, height and points arguments as second_tangents_concur, and adds Mannheim's companion reading that the three rays meet at O while the three second tangents meet at X; the page's printed Steiner identity AO + DX = DO + DX is a typo for AO + AX = DO + DX, but the core defines no D, so no length involving D is measured.",
      args: JSON.stringify({ ...fixture, pair: "QR" }),
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const pair = readPair(C, args);
        const g = C.compute(s);
        const r = reading(C, s, g);
        const m = mirrorReading(C, s, g, pair);
        return {
          ...r,
          mirror: m,
          mannheim: {
            firstTangentsConcurAt: pt(s.points.O),
            secondTangentsConcurAt: r.X,
            spread: r.spread,
            concurrent: r.concurrent,
          },
          note:
            `Reflecting the ray O-${pair.ray} in the line ${pair.first}${pair.second} gives a direction parallel to the core's second tangent (sine of angle = ${m.reflectedDirectionSin}). Both internal tangents cross at the similitude centre ${JSON.stringify(m.internalSimilitudeCentre)}, which is the labelled crossing ${pair.crossing}. ` +
            `Mannheim: the rays meet at O and the second tangents meet at X = ${JSON.stringify(r.X)}. ` +
            "The printed Steiner identity AO + DX = DO + DX cancels to AO = DO; the step the proof needs is AO + AX = DO + DX, but no point D exists in the core to measure it. " +
            NO_GAME,
        };
      },
    },
  };
}

/**
 * Echo what Track.state saved (the applet's own plain state: board, showNames
 * and the seven points) and rebuild every derived circle, tangent and crossing
 * with the core. A damaged record falls back to the opening diagram.
 */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Isogonal Tangents state version ${stateVersion}`);
  }
  const src: Json = isPlain(state) ? state : {};
  const C = core();
  let s: State;
  let readable = true;
  try {
    s = buildState(C, src);
    if (src.points === undefined || src.points === null) {
      throw new Error("saved position has no points");
    }
    s = C.withNames(s, src.showNames !== false);
  } catch {
    s = C.start({});
    readable = false;
  }
  const g = C.compute(s);
  const r = reading(C, s, g);
  const savedPoints = isPlain(src.points) ? src.points : ({} as Json);
  const agreesWithSaved = Object.fromEntries(
    C.NAMES.map((n) => {
      const p = maybePoint(savedPoints[n]);
      return [n, p ? sig(C.dist(p, s.points[n])) : null];
    }),
  );
  return {
    ...src,
    stateVersion,
    valid: readable,
    savedReadable: readable,
    width: s.width,
    height: s.height,
    showNames: s.showNames,
    savedPoints: Object.fromEntries(C.NAMES.map((n) => [n, pt(maybePoint(savedPoints[n]))])),
    agreesWithSaved,
    reading: r,
    X: r.X,
    spread: r.spread,
    concurrent: r.concurrent,
    note:
      (!readable
        ? "Some saved fields could not be read, so the core's opening diagram is shown and the reading below comes from it. "
        : "Track.state saved the board, the showNames flag and the seven points O, U, V, W, P, Q, R in board units; the core rebuilds the circles and the three second tangents from them. ") +
      `Here X = ${JSON.stringify(r.X)}, the three cuts are ${r.spread} units apart, and concurrency is ${r.concurrent}. ` +
      NO_GAME,
  };
}
