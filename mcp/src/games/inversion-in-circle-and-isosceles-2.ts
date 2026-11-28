/*
 * run_game_logic actions and saved-position reader for Inversion In Circle And
 * Isosceles 2, Bogomolny's InversionInCircleAndIsosceles2 applet.
 *
 * The real core is inversion-in-circle-and-isosceles-2/
 * inversion-in-circle-and-isosceles-2-core.js, copied into src/generated/cores/
 * at build time; every number below is measured by it. Coordinates are the
 * page's 400 x 340 SVG board, y downward.
 *
 * A, B and C lie on one line with A < B < C. (O) has diameter AC and (P) has
 * diameter AB; the orange circle (Q), computed from t = AB/AC, touches (O),
 * (P) and BE. The claim is that BQ is perpendicular to AC. The proof inverts
 * about B with NEGATIVE power -BA·BC = -BM²: that fixes (O), swaps A and C,
 * sends (P) to the upright line through C, and sends (Q) to the excircle (Q')
 * of triangle BI_kI_l opposite I_k. That excircle lies on the external bisector
 * at B and touches the nine-point circle (O), so B, Q and Q' share the upright
 * line through B. The positive-power sibling proves the same claim with a
 * Pythagorean sum and six Step screens; this one uses five.
 *
 * This is a demonstration, so there is no win or loss; Track records
 * exploration. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = Pt & { r: number };
type Segment = { a: Pt; b: Pt };
type Options = { names: boolean; premise: boolean; statement: boolean; step: number };
type State = { A: Pt; B: Pt; C: Pt; options: Options; touches: number };
type Geometry = {
  valid: boolean;
  A: Pt; B: Pt; C: Pt; O: Pt; R: number; P: Pt; rP: number; D: Pt; E: Pt; F: Pt;
  K: Pt; L: Pt; M: Pt; N: Pt; Q: Pt; rQ: number;
  BQ: Segment; circleMN: Circle; lineP: Segment; Circleb: Circle;
  Ik: Pt; Il: Pt; Qp: Circle;
  BE: Segment; BF: Segment; AB: Segment; BC: Segment;
  power: number; t: number;
};
type Core = {
  VIEW: { width: number; height: number };
  START: { A: Pt; B: Pt; C: Pt };
  start(options?: Partial<Options>): State;
  movePoint(s: State, name: string, p: Pt): State;
  setOption(s: State, name: string, value: unknown): State;
  result(s: State): null;
  geometry(s: State): Geometry;
  inverse(g: Geometry, X: Pt): Pt;
  dist(p: Pt, q: Pt): number;
  foot(p: Pt, a: Pt, b: Pt): Pt | null;
};
const core = (): Core =>
  cores["inversion-in-circle-and-isosceles-2"].InversionInCircleAndIsosceles2Core as unknown as Core;

const NEGATIVE_POWER_NOTE =
  "Inversion in the circle centred at B with power -BA·BC = -BM² reverses rays: it fixes the " +
  "big circle (O), swaps A and C (and M and N), sends the circle with diameter AB to the upright " +
  "line through C, and sends the orange circle (Q) to a circle whose centre is B's own vertical line. " +
  "The core measures each of those images directly, plus Q's three tangencies and the perpendicular BQ.";
const EXCIRCLE_NOTE =
  "The inverse of the orange circle is the excircle (Q') of triangle BI_kI_l opposite I_k: its " +
  "centre is equidistant from the three sides, it touches the big circle, which is that triangle's " +
  "nine-point circle (Feuerbach's theorem), and it lies on the external bisector at B, upright " +
  "through B. So B, Q and Q' are on one upright line and BQQ' is perpendicular to AC.";
const SIBLING_NOTE =
  "The sibling applet (positive-power inversion and a Pythagorean calculation) proves the same " +
  "claim with power +BA·BC and six Step screens; this applet uses negative power and Feuerbach's " +
  "theorem with five Step screens.";
const NO_GAME = "This is a demonstration with no win or loss; the tracker records exploration.";

/* Only what we print is rounded; the core keeps full precision. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(3));
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const point = (x: number, y: number): Pt => ({ x, y });
const shape = (c: Circle | null | undefined): { centre: Pt; radius: number } | null =>
  c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)
    ? { centre: pt(c)!, radius: round(c.r) }
    : null;
const segmentShape = (s: Segment): { from: Pt; to: Pt } => ({
  from: pt(s.a)!, to: pt(s.b)!,
});

function asArgs(args: unknown): Json {
  if (args === undefined || args === null) return {};
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be a JSON object with optional A, B, C points");
  }
  return args as Json;
}

/** One coordinate: finite number (or numeric string), never null or boolean. */
function coord(raw: unknown, label: string): number {
  if (raw === null || raw === undefined || typeof raw === "boolean" || typeof raw === "object") {
    throw new Error(`${label} needs finite numeric coordinates, got ${JSON.stringify(raw)}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${label} needs finite numeric coordinates, got ${JSON.stringify(raw)}`);
  return n;
}

/** A point as the page saves it ({ x, y }) or as a short [x, y] argument. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${label}": give [x, y] or { x, y }`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or { x, y }`);
    [x, y] = [coord(raw[0], label), coord(raw[1], label)];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [coord(o.x, label), coord(o.y, label)];
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function readBool(raw: unknown, label: string, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") throw new Error(`${label} must be true or false`);
  return raw;
}

function readStep(raw: unknown, label: string, fallback: number): number {
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 4) {
    throw new Error(`${label} must be an integer Step screen from 0 to 4`);
  }
  return n;
}

/**
 * Start at the applet's opening picture and drag any handles supplied. The
 * page's movePoint keeps all three on one horizontal line, so a supplied y
 * becomes the baseline for the other two (the last handle moved wins).
 */
function buildState(C: Core, args: Json, tolerant: boolean): { s: State; readable: boolean } {
  let s = C.start();
  const seed = s;
  const names = ["A", "B", "C"] as const;
  const given = names.filter((n) => args[n] !== undefined && args[n] !== null);
  let readable = true;
  const baseline = given.length
    ? (() => {
        try { return readPoint(args[given[given.length - 1]], `saved ${given[given.length - 1]}`).y; }
        catch { readable = false; return seed.A.y; }
      })()
    : seed.A.y;
  for (const name of names) {
    const raw = args[name];
    if (raw === undefined || raw === null) continue;
    try {
      const p = readPoint(raw, `${tolerant ? "saved" : "argument"} ${name}`);
      s = C.movePoint(s, name, point(p.x, baseline));
    } catch (err) {
      readable = false;
      if (!tolerant) throw err;
    }
  }
  const opt = args.options;
  const options: Json = opt && typeof opt === "object" && !Array.isArray(opt) ? opt as Json : {};
  for (const key of ["names", "premise", "statement"] as const) {
    const raw = options[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "boolean") {
      if (!tolerant) throw new Error(`argument "options.${key}" must be true or false`);
      readable = false;
      continue;
    }
    s = C.setOption(s, key, raw);
  }
  const stepRaw = options.step !== undefined && options.step !== null ? options.step : args.step;
  if (stepRaw !== undefined && stepRaw !== null) {
    try { s = C.setOption(s, "step", readStep(stepRaw, '"options.step"', seed.options.step)); }
    catch (err) {
      if (!tolerant) throw err;
      readable = false;
    }
  }
  return { s, readable };
}

/** Require a drawing the core can actually construct. */
function live(C: Core, args: Json): { s: State; g: Geometry } {
  const { s } = buildState(C, args, false);
  const g = C.geometry(s);
  if (!g.valid) {
    throw new Error(
      "A, B and C must be three distinct points on one horizontal line ([x, y] or { x, y } " +
      "on the 400 x 340 board); the core orders them as A < B < C. It draws nothing when two " +
      "collapse or the third cannot be placed strictly between the other two.",
    );
  }
  return { s, g };
}

/** The negative-power inversion and the direct construction of Q. */
function inversionReading(C: Core, g: Geometry) {
  const invA = C.inverse(g, g.A);
  const invC = C.inverse(g, g.C);
  const invM = C.inverse(g, g.M);
  const onBig = [g.A, g.C, g.E, g.F, g.K, g.L, g.M, g.N];
  const fixedResidual = Math.max(...onBig.map((p) => Math.abs(C.dist(g.O, C.inverse(g, p)) - g.R)));
  const topP = point(g.P.x, g.P.y - g.rP);
  const bottomP = point(g.P.x, g.P.y + g.rP);
  const lineResidual = Math.max(
    Math.abs(invA.x - g.C.x),
    Math.abs(C.inverse(g, topP).x - g.C.x),
    Math.abs(C.inverse(g, bottomP).x - g.C.x),
  );
  const footBE = C.foot(g.Q, g.B, g.E);
  const gapO = Math.abs(C.dist(g.O, g.Q) - (g.R - g.rQ));
  const gapP = Math.abs(C.dist(g.P, g.Q) - (g.rP + g.rQ));
  const gapBE = footBE ? Math.abs(C.dist(g.Q, footBE) - g.rQ) : NaN;
  const height = (g.C.x - g.A.x) * (g.t / (1 + g.t)) * Math.sqrt(2 * (1 - g.t));
  const radius = (g.C.x - g.A.x) * g.t * (1 - g.t) / (1 + g.t);
  const powerGap = Math.abs(g.power - C.dist(g.B, g.M) ** 2);
  const tangencyResidual = Math.max(gapO, gapP, gapBE);
  const residual = Math.max(tangencyResidual, fixedResidual, lineResidual, powerGap);
  return {
    baseline: { A: pt(g.A), B: pt(g.B), C: pt(g.C), AB: round(g.B.x - g.A.x),
      BC: round(g.C.x - g.B.x), AC: round(g.C.x - g.A.x) },
    t: round(g.t),
    inversion: {
      centre: pt(g.B),
      power: round(-g.power),
      powerIsMinusBM2: sig(powerGap),
      inversesOfAAndC: { inverseA: pt(invA), expectedC: pt(g.C), swapError: sig(C.dist(invA, g.C)),
        inverseC: pt(invC), expectedA: pt(g.A), reverseSwapError: sig(C.dist(invC, g.A)) },
      inversesOfMAndN: { inverseM: pt(invM), expectedN: pt(g.N), swapError: sig(C.dist(invM, g.N)) },
      bigCircleFixed: { checkedPoints: onBig.length, maxRadiusResidual: sig(fixedResidual) },
      circlePGoesToVerticalThroughC: { expectedX: round(g.C.x), maxXResidual: sig(lineResidual) },
    },
    orangeCircle: {
      centre: pt(g.Q), radius: round(g.rQ),
      heightAboveB: round(g.B.y - g.Q.y), heightFormula: round(height),
      radiusFormula: round(radius),
      tangencyGaps: { toBigCircleInternally: sig(gapO), toCirclePExternally: sig(gapP), toBE: sig(gapBE) },
      allThreeTangent: tangencyResidual < 1e-6,
      maxTangencyResidual: sig(tangencyResidual),
      maxConstructionResidual: sig(residual),
      allCoreChecksPass: residual < 1e-6,
    },
    perpendicular: {
      QxMinusBx: sig(g.Q.x - g.B.x),
      baselineYSpread: sig(Math.max(Math.abs(g.A.y - g.B.y), Math.abs(g.C.y - g.B.y))),
      BQ: segmentShape(g.BQ), AC: segmentShape({ a: g.A, b: g.C }),
    },
    note: NEGATIVE_POWER_NOTE + " " + SIBLING_NOTE + " " + NO_GAME,
  };
}

/** Q' as the excircle of BI_kI_l, and the collinearity that proves the claim. */
function excircleReading(C: Core, g: Geometry) {
  const lineDistance = (p: Pt, a: Pt, b: Pt): number => {
    const f = C.foot(p, a, b);
    return f ? C.dist(p, f) : NaN;
  };
  const sides = [
    { name: "I_k B", distance: lineDistance(g.Qp, g.Ik, g.B) },
    { name: "B I_l", distance: lineDistance(g.Qp, g.B, g.Il) },
    { name: "I_k I_l", distance: lineDistance(g.Qp, g.Ik, g.Il) },
  ];
  const sideResidual = Math.max(...sides.map((s) => Math.abs(s.distance - g.Qp.r)));
  const feuerbach = Math.abs(C.dist(g.O, g.Qp) - (g.R + g.Qp.r));
  const onQ = [point(g.Q.x + g.rQ, g.Q.y), point(g.Q.x - g.rQ, g.Q.y),
    point(g.Q.x, g.Q.y - g.rQ), point(g.Q.x, g.Q.y + g.rQ)];
  const images = onQ.map((p) => ({ original: pt(p), image: pt(C.inverse(g, p)),
    residual: sig(C.dist(C.inverse(g, p), g.Qp) - g.Qp.r) }));
  const imageResidual = Math.max(...images.map((v) => Math.abs(v.residual ?? 0)));
  const xResidual = Math.max(Math.abs(g.Q.x - g.B.x), Math.abs(g.Qp.x - g.B.x));
  const baselineResidual = Math.max(Math.abs(g.A.y - g.B.y), Math.abs(g.C.y - g.B.y));
  return {
    triangle: { I_k: pt(g.Ik), B: pt(g.B), I_l: pt(g.Il) },
    excentre: shape(g.Qp),
    excircle: {
      radius: round(g.Qp.r),
      distancesToSides: sides.map((s) => ({ side: s.name, distance: round(s.distance) })),
      maxSideResidual: sig(sideResidual),
      equidistantFromSides: sideResidual < 1e-6,
    },
    feuerbach: {
      ninePointCircle: shape({ x: g.O.x, y: g.O.y, r: g.R }),
      centreDistance: round(C.dist(g.O, g.Qp)),
      externalTangencyDistance: round(g.R + g.Qp.r),
      residual: sig(feuerbach),
      tangentToNinePointCircle: feuerbach < 1e-6,
    },
    inverseOfOrangeCircle: {
      sampledPoints: images,
      maxResidual: sig(imageResidual),
      imageIsQprime: imageResidual < 1e-5,
    },
    perpendicular: {
      Q: pt(g.Q), Qprime: pt(g.Qp), B: pt(g.B),
      xResidual: sig(xResidual), baselineYSpread: sig(baselineResidual),
      BQQprimePerpendicularToAC: xResidual < 1e-6 && baselineResidual < 1e-6,
    },
    note: EXCIRCLE_NOTE + " " + SIBLING_NOTE + " " + NO_GAME,
  };
}

const EXAMPLE_ARGS = '{"A":[108,105],"B":[214,105],"C":[297,105]}';

export function actions(): GameActions {
  return {
    negative_power_inversion: {
      describe:
        "For three collinear points A, B, C as [x, y] or { x, y } on the 400 x 340 board (omit any for the opening picture), run the real core and verify inversion about B with negative power -BA·BC = -BM²: it fixes the big circle and swaps A with C and M with N, sends the circle with diameter AB to the upright line through C, and leaves the orange circle touching (O), (P) and BE. Reports the power, t = AB/AC, the circle's height and radius formulas, the swap and tangency residuals, and that BQ is upright; a collapsed or wrongly ordered triple is refused.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const { s, g } = live(C, asArgs(args));
        return { ...inversionReading(C, g), result: C.result(s) };
      },
    },

    excentre_and_perpendicular: {
      describe:
        "For the same A, B, C (arguments as in negative_power_inversion), report the inverted circle Q' computed by the core as the excircle of triangle BI_kI_l opposite I_k: its distances to all three sides, its external tangency to the big circle (the triangle's nine-point circle, by Feuerbach), and four sampled points of Q inverted into Q'. Also checks that B, Q and Q' share B's x-coordinate, so BQQ' is perpendicular to the horizontal AC; a collapsed or wrongly ordered triple is refused.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const { s, g } = live(C, asArgs(args));
        return { ...excircleReading(C, g), result: C.result(s) };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure the picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Inversion In Circle And Isosceles 2 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Inversion In Circle And Isosceles 2 position must be an object");
  }
  const C = core();
  const { s, readable } = buildState(C, state, true);
  const g = C.geometry(s);
  const saved = {
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    options: { ...s.options }, touches: Number.isFinite(Number(state.touches)) ? Number(state.touches) : 0,
  };
  const base = {
    ...state,
    stateVersion,
    savedReadable: readable,
    saved,
    view: C.VIEW,
    valid: g.valid,
    result: C.result(s),
  };
  if (!g.valid) {
    return {
      ...base,
      note: (!readable
        ? "Some saved fields could not be read, so the opening picture was reconstructed. "
        : "Track.state saved the three draggable points, the display switches and the Step screen, not the derived points. ") +
        "Here A, B and C have collapsed or B is not strictly between them, so the core cannot draw the picture. " + NO_GAME,
    };
  }
  const inv = inversionReading(C, g);
  const exc = excircleReading(C, g);
  return {
    ...base,
    reading: {
      AB: inv.baseline.AB, BC: inv.baseline.BC, AC: inv.baseline.AC, t: inv.t,
      power: inv.inversion.power,
      swapAandC: inv.inversion.inversesOfAAndC,
      swapsMandN: inv.inversion.inversesOfMAndN,
      bigCircleFixed: inv.inversion.bigCircleFixed,
      circlePToVerticalThroughC: inv.inversion.circlePGoesToVerticalThroughC,
      orangeCircle: inv.orangeCircle,
      BQperpendicularAC: inv.perpendicular,
      excentre: exc.excentre,
      excircle: exc.excircle,
      feuerbach: exc.feuerbach,
      inverseOfQIsQprime: exc.inverseOfOrangeCircle,
      BQQprimePerpendicularAC: exc.perpendicular.BQQprimePerpendicularToAC,
    },
    note:
      (!readable
        ? "Some saved fields could not be read, so the opening picture was reconstructed; the reading below comes from it. "
        : "Track.state saved A, B, C in board units plus the names, premise, statement and Step switches; the core rebuilds every derived point. ") +
      `The power is -BA·BC = ${inv.inversion.power}, t = ${inv.t}, Q is at ` +
      `${JSON.stringify(inv.orangeCircle.centre)} with radius ${inv.orangeCircle.radius}, and the excircle Q' is at ` +
      `${JSON.stringify(exc.excentre?.centre ?? null)} with radius ${exc.excircle.radius}. ` +
      NEGATIVE_POWER_NOTE + " " + EXCIRCLE_NOTE + " " + SIBLING_NOTE + " " + NO_GAME,
  };
}
