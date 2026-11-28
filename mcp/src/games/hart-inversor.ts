/*
 * run_game_logic actions and saved-position reader for Hart's Inversor.
 *
 * The real core is hart-inversor/hart-inversor-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are the applet's 400 x 300 board units, y downward.
 *
 * The rods AB, CD (length a) and AD, BC (length b) make an isosceles
 * trapezoid. O, P and Q divide AB, AD and CB in the same fraction m, so
 * OP = m·BD and OQ = (1−m)·AC, and O, P, Q are collinear. Because
 * AC·BD = AD² − AB², the product OP·OQ = m(1−m)(AD² − AB²) never changes
 * while the linkage moves: P and Q are inverse points about O. A pivot S
 * with SP = SO carries P along a circle through O, whose inverse in O is
 * the straight line Q draws. This is Hart's Inversor, NOT Hart Circle:
 * that other applet is about the circle tangent to four inscribed circles
 * of three mutually crossing circles. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Line = { a: Pt; b: Pt };
type StartOptions = {
  width?: number;
  height?: number;
  A?: Pt;
  B?: Pt;
  D?: Pt;
  r?: number;
  c?: number;
  showNames?: boolean;
  showExtra?: boolean;
};
type Move = {
  type: string;
  which?: string;
  point?: Pt;
  delta?: Pt;
  key?: string;
  value?: boolean;
};
type State = StartOptions & {
  width: number;
  height: number;
  a: number;
  b: number;
  c: number;
  r: number;
  A: Pt;
  B: Pt;
  C: Pt;
  D: Pt;
  E: Pt;
  F: Pt;
  O: Pt;
  P: Pt;
  Q: Pt;
  S: Pt;
  showNames: boolean;
  showExtra: boolean;
  traceQ: Pt[];
  traceP: Array<Pt & { color?: string }>;
  collectPhase: number;
  eligible: boolean;
  message: string;
  moves: number;
  explored: boolean;
};
type Geometry = {
  A: Pt; B: Pt; C: Pt; D: Pt; E: Pt; F: Pt;
  O: Pt; P: Pt; Q: Pt; S: Pt;
  a: number; b: number; c: number; r: number;
  ac: number; bd: number; op: number; oq: number; sp: number; so: number;
  power: number;
  sLine: Line;
  inverseLine: Line;
  traceQ: Pt[];
  traceP: Array<Pt & { color?: string }>;
  eligible: boolean;
};
type Residuals = {
  aoRatio: number;
  apRatio: number;
  cqRatio: number;
  collinearity: number;
  acTimesBd: number;
  bSqMinusASq: number;
  product: number;
  power: number;
  sp: number;
  so: number;
  sameRay: number;
  inverseLineDeviation: number;
  bd: number;
  eligible: boolean;
};
interface Core {
  WIDTH: number;
  HEIGHT: number;
  R0: number;
  R_MIN: number;
  R_MAX: number;
  P_MARGIN: number;
  S_MARGIN: number;
  dist(p: Pt, q: Pt): number;
  start(options?: StartOptions): State;
  move(state: State, m: Move): State | null;
  result(state: State | null): "done" | null;
  legalMoves(state: State): Move[];
  compute(state: State): Geometry;
  residuals(state: State): Residuals;
}

const core = (): Core =>
  cores["hart-inversor"].HartInversorCore as unknown as Core;

const TOL = 1e-6; // board units; the core works in double precision
const DISTINCTION =
  "This is Hart's Inversor: four rods, O/P/Q dividing three of them in the same fraction, and inversion taking P's circle through O to Q's straight segment. It is not Hart Circle, the separate applet about the circle tangent to the four inscribed circles of three mutually crossing circles.";

/* Tidy what we print; non-finite core values become null, never NaN text. */
const r6 = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(6)) : null;
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: r6(p.x)!, y: r6(p.y)! }
    : null;
const numOr = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const positiveOr = (v: unknown, fallback: number): number => {
  const n = numOr(v, fallback);
  return n > 0 ? n : fallback;
};
const relativeError = (measured: number, expected: number): number =>
  Math.abs(measured - expected) / (Math.abs(expected) || 1);

/** Tutors may write [x, y]; the page saves { x, y }. Both need finite values. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** Validate the tutor's JSON and hand it to the core's own start()/configure(). */
function readStartOptions(C: Core, raw: Json): StartOptions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("arguments must be an object with optional A, B, D points, r, c, width, height and display flags");
  }
  const width = num(raw, "width", C.WIDTH);
  const height = num(raw, "height", C.HEIGHT);
  if (!(width > 0 && height > 0)) {
    throw new Error('arguments "width" and "height" must be positive board sizes');
  }
  const r = num(raw, "r", C.R0); // the page calls this fraction m
  if (!(r > 0 && r < 1)) {
    throw new Error('argument "r" (the page\'s m) must lie strictly between 0 and 1');
  }
  const o: StartOptions = { width, height, r };
  if (raw.c !== undefined && raw.c !== null) {
    const c = num(raw, "c");
    if (!(c > 0)) throw new Error('argument "c" (the pivot circle radius) must be positive');
    o.c = c;
  }
  for (const key of ["A", "B", "D"] as const) {
    if (raw[key] !== undefined && raw[key] !== null) o[key] = readPoint(raw[key], key);
  }
  for (const key of ["showNames", "showExtra"] as const) {
    if (raw[key] !== undefined && raw[key] !== null) {
      if (typeof raw[key] !== "boolean") {
        throw new Error(`argument "${key}" must be true or false`);
      }
      o[key] = raw[key] as boolean;
    }
  }
  return o;
}

/** One measurement of the saved or constructed picture, all from the core. */
function measure(C: Core, s: State) {
  const g = C.compute(s);
  const res = C.residuals(s);
  const productRel = relativeError(res.product, res.power);
  const acBdRel = relativeError(res.acTimesBd, res.bSqMinusASq);
  const spSoGap = Math.abs(res.sp - res.so);
  const expectedOffset = s.c > 0 ? Math.abs(res.power) / (2 * s.c) : NaN;
  const checks = {
    dividerRatiosAreM: Math.max(
      Math.abs(res.aoRatio - s.r),
      Math.abs(res.apRatio - s.r),
      Math.abs(res.cqRatio - s.r),
    ) < TOL,
    oPqCollinear: res.collinearity < TOL,
    pAndQOnSameRay: res.sameRay < TOL,
    acTimesBdEqualsRodSquares: acBdRel < TOL,
    opTimesOqEqualsPower: productRel < TOL,
    spEqualsSo: spSoGap < TOL,
    qOnPredictedLine: res.inverseLineDeviation < TOL,
  };

  const note =
    `AO/AB = AP/AD = CQ/CB = ${s.r.toFixed(2)}, so OP ∥ BD, OQ ∥ AC and O, P, Q are ` +
    `collinear (worst drift ${sig(res.collinearity)} board units). AC·BD = ${r6(res.acTimesBd)} ` +
    `and AD²−AB² = ${r6(res.bSqMinusASq)}; OP·OQ = ${r6(res.product)} and ` +
    `m(1−m)(AD²−AB²) = ${r6(res.power)}, so P and Q are inverse points about O. ` +
    `SP = SO = ${r6(res.sp)}, so P's circle passes through O and inversion sends it to the ` +
    `straight line Q draws (offset ${sig(res.inverseLineDeviation)} board units). ` + DISTINCTION;

  return {
    board: { width: s.width, height: s.height },
    rods: { a: r6(s.a), b: r6(s.b), c: r6(s.c), m: r6(s.r) },
    points: {
      A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D), E: pt(g.E), F: pt(g.F),
      O: pt(g.O), P: pt(g.P), Q: pt(g.Q), S: pt(g.S),
    },
    lengths: {
      ao: r6(C.dist(g.A, g.O)), ap: r6(C.dist(g.A, g.P)),
      ac: r6(g.ac), bd: r6(g.bd), op: r6(g.op), oq: r6(g.oq),
      sp: r6(g.sp), so: r6(g.so),
    },
    power: r6(res.power),
    product: r6(res.product),
    opTimesOq: r6(res.product),
    acTimesBd: r6(res.acTimesBd),
    bSquaredMinusASquared: r6(res.bSqMinusASq),
    products: {
      opTimesOq: r6(res.product),
      mOneMinusMrodSquares: r6(res.power),
      relativeError: sig(productRel),
      acTimesBd: r6(res.acTimesBd),
      bSquaredMinusASquared: r6(res.bSqMinusASq),
      acBdRelativeError: sig(acBdRel),
    },
    ratios: {
      aoOverAB: r6(res.aoRatio), apOverAD: r6(res.apRatio), cqOverCB: r6(res.cqRatio),
    },
    collinearity: {
      worstDriftFromLine: sig(res.collinearity),
      sameRayCrossProduct: sig(res.sameRay),
    },
    pivotCircle: {
      centre: pt(g.S), radius: r6(s.c),
      spMinusSo: sig(spSoGap),
      guideLine: { through: [pt(g.sLine.a), pt(g.sLine.b)] },
    },
    inverseLine: {
      through: [pt(g.inverseLine.a), pt(g.inverseLine.b)],
      distanceFromO: r6(C.dist(g.O, g.inverseLine.a)),
      expectedDistanceFromO: r6(expectedOffset),
      qDeviation: sig(res.inverseLineDeviation),
    },
    checks,
    eligible: res.eligible,
    result: C.result(s),
    note,
  };
}

/** Slide P along the pivot circle with real core drags, as the page does. */
function sweep(C: Core, s: State, steps: number, stepDegrees: number) {
  const startAngle = Math.atan2(s.P.y - s.S.y, s.P.x - s.S.x);
  let current = s;
  const samples: Array<{
    step: number;
    eligible: boolean;
    p: Pt | null;
    q: Pt | null;
    opTimesOq: number | null;
    qDeviationFromLine: number | null;
    message: string;
  }> = [];
  let refusedMoves = 0;

  for (let i = 1; i <= steps; i++) {
    const theta = startAngle + (i * stepDegrees * Math.PI) / 180;
    const target = {
      x: s.S.x + s.c * Math.cos(theta),
      y: s.S.y + s.c * Math.sin(theta),
    };
    const next = C.move(current, { type: "point", which: "P", point: target });
    if (!next) {
      refusedMoves++;
      samples.push({
        step: i, eligible: false, p: pt(target), q: null,
        opTimesOq: null, qDeviationFromLine: null,
        message: "The core refused this drag.",
      });
      continue;
    }
    current = next;
    const r = C.residuals(current);
    samples.push({
      step: i,
      eligible: current.eligible,
      p: pt(current.P),
      q: pt(current.Q),
      opTimesOq: r6(r.product),
      qDeviationFromLine: sig(r.inverseLineDeviation),
      message: current.message,
    });
  }

  const good = samples.filter((row) => row.eligible && row.qDeviationFromLine !== null);
  const maxDeviation = Math.max(0, ...good.map((row) => Math.abs(row.qDeviationFromLine!)));
  const products = good.map((row) => row.opTimesOq).filter((v): v is number => v !== null);
  const final = measure(C, current);
  return {
    guideCircle: { centre: pt(s.S), radius: r6(s.c) },
    stepDegrees,
    samples,
    refusedMoves,
    eligibleSamples: good.length,
    maxQDeviationFromLine: sig(maxDeviation),
    productRange: products.length
      ? { min: r6(Math.min(...products)), max: r6(Math.max(...products)) }
      : null,
    tracedQ: current.traceQ.map(pt),
    tracedP: current.traceP.map(pt),
    inverseLine: final.inverseLine,
    final,
    note:
      `P was dragged ${steps} more steps of ${stepDegrees}° round the circle centred at S with radius SP = SO; ` +
      `${good.length} drag(s) kept the rods reachable and ${refusedMoves} were refused. Every reachable Q stays on ` +
      `one straight line (largest measured deviation ${sig(maxDeviation)} board units) while OP·OQ stays at ` +
      `${r6(final.power)} = m(1−m)(AD²−AB²): inversion in O sends the circle through O to that line. ` +
      DISTINCTION,
  };
}

/* The saved opening position of the page: a = 75, b = 150, r = m = 0.4. */
const LINKAGE_ARGS =
  '{"A":[70,200],"B":[95.65151074942516,129.52305344105687],' +
  '"D":[202.4122350983015,129.52305344105687],"r":0.4}';
const SWEEP_ARGS =
  '{"A":[70,200],"B":[95.65151074942516,129.52305344105687],' +
  '"D":[202.4122350983015,129.52305344105687],"r":0.4,"steps":8,"stepDegrees":7}';

export function actions(): GameActions {
  return {
    linkage_invariants: {
      describe:
        "Build Hart's four-bar linkage from optional A, B and D points ([x, y] or { x, y } on the 400 x 300 board), divider fraction r (the page's m, strictly between 0 and 1) and optional c, width, height and display flags; omitted values keep the applet's opening picture. Measure OP, OQ and OP·OQ against m(1−m)(AD²−AB²), AC·BD against AD²−AB², O/P/Q collinearity, SP = SO and the straight line that inversion of P's circle through O predicts for Q; this is Hart's Inversor, not Hart Circle.",
      args: LINKAGE_ARGS,
      run: (args) => {
        const C = core();
        return measure(C, C.start(readStartOptions(C, args)));
      },
    },

    circle_to_line: {
      describe:
        "Starting from the same linkage (arguments as in linkage_invariants, plus steps 1–24 and stepDegrees, default 8 steps of 7°), slide P around its pivot circle by calling the real core's drag and report Q's traced segment, every measured Q deviation from the predicted inverse line and the unchanged product OP·OQ. Inversion centred at O takes a circle through O to a straight line at distance m(1−m)(AD²−AB²)/(2·SP) from O; unlike Hart Circle, the circle here is P's guide circle, not a tangent circle of three crossing circles.",
      args: SWEEP_ARGS,
      run: (args) => {
        const C = core();
        const o = readStartOptions(C, args);
        const steps = num(args, "steps", 8);
        if (!Number.isInteger(steps) || steps < 1 || steps > 24) {
          throw new Error('argument "steps" must be an integer from 1 to 24');
        }
        const stepDegrees = num(args, "stepDegrees", 7);
        if (!(stepDegrees !== 0 && Math.abs(stepDegrees) <= 30)) {
          throw new Error('argument "stepDegrees" must be nonzero and between -30 and 30');
        }
        return sweep(C, C.start(o), steps, stepDegrees);
      },
    },
  };
}

/** A core state rebuilt from a Track.state payload, keeping its saved handles. */
function stateFromSaved(C: Core, state: Json): State {
  const seed = C.start({});
  const point = (raw: unknown, fallback: Pt): Pt => {
    try { return readPoint(raw, "saved point"); } catch { return { ...fallback }; }
  };
  const trace = (raw: unknown): Pt[] =>
    Array.isArray(raw)
      ? raw.map((v) => pt(v as Pt)).filter((p): p is Pt => p !== null)
      : [];
  const r = numOr(state.r, seed.r);
  return {
    ...seed,
    width: positiveOr(state.width, seed.width),
    height: positiveOr(state.height, seed.height),
    a: positiveOr(state.a, seed.a),
    b: positiveOr(state.b, seed.b),
    c: positiveOr(state.c, seed.c),
    r: r > 0 && r < 1 ? r : seed.r,
    A: point(state.A, seed.A), B: point(state.B, seed.B),
    C: point(state.C, seed.C), D: point(state.D, seed.D),
    E: point(state.E, seed.E), F: point(state.F, seed.F),
    O: point(state.O, seed.O), P: point(state.P, seed.P),
    Q: point(state.Q, seed.Q), S: point(state.S, seed.S),
    showNames: state.showNames === true,
    showExtra: state.showExtra === true,
    traceQ: trace(state.traceQ),
    traceP: trace(state.traceP),
    collectPhase: numOr(state.collectPhase, seed.collectPhase),
    eligible: state.eligible !== false,
    message: typeof state.message === "string" ? state.message : "",
    moves: numOr(state.moves, seed.moves),
    explored: state.explored === true,
  };
}

/** Echo Track's saved fields, then re-measure them with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Hart's Inversor state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Hart's Inversor position must be an object");
  }
  const C = core();
  const s = stateFromSaved(C, state);
  const reading = measure(C, s);
  const geometry = C.compute(s); // full precision: the printed reading is rounded
  const gap = (a: unknown, b: Pt): number | null => {
    try {
      return sig(C.dist(readPoint(a, "saved point"), b));
    } catch {
      return null;
    }
  };
  return {
    ...state,
    stateVersion,
    movesSoFar: s.moves,
    finished: reading.result === "done",
    power: reading.power,
    product: reading.product,
    opTimesOq: reading.opTimesOq,
    acTimesBd: reading.acTimesBd,
    inverseLine: reading.inverseLine,
    core: reading,
    savedVsCore: {
      O: gap(state.O, geometry.O),
      P: gap(state.P, geometry.P),
      Q: gap(state.Q, geometry.Q),
      S: gap(state.S, geometry.S),
    },
    note:
      "Track.state saved the linkage handles A, B, C, D, O, P, Q, S, E and F, the rod lengths a and b, the pivot radius c, the divider fraction r (m), the display flags, both trails, the move count and the status message. " +
      "The core recomputes the geometry from those saved fields: OP·OQ = m(1−m)(AD²−AB²) and AC·BD = AD²−AB² are checked at this position, and inversion in O sends P's circle through O to Q's straight line. " +
      DISTINCTION,
  };
}
