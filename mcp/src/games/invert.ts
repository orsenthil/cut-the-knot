/*
 * run_game_logic actions and saved-position reader for invert, Bogomolny's
 * Peaucellier-Lipkin linkage applet.
 *
 * The real core is invert/invert-core.js, copied into src/generated/cores/ at
 * build time; every measurement below is made by calling it. Coordinates are
 * the applet's 400 x 350 board units, y downward.
 *
 * O is the inversion centre where the two long rods meet, A is held on a
 * circle of radius R about P and C is the fourth rhombus vertex. The core
 * puts C on ray OA with C = O + (OB² − AB²)/|OA|² · (A − O), so
 * OA · OC = OB² − AB² = k is constant. Because O and A both lie on P's circle
 * through O, inversion in O (power k) sends that circle to a straight line:
 * (C − O) · (P − O) = k/2. C draws it while A is dragged. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Options = {
  width?: number;
  height?: number;
  center?: Pt;
  radius?: number;
  O?: Pt;
  A?: Pt;
  longOne?: number;
  rombSide?: number;
  showNames?: boolean;
  showCircle?: boolean;
};
type Move = {
  type: string;
  which?: string;
  point?: Pt;
  key?: string;
  value?: boolean;
};
type State = Options & {
  width: number;
  height: number;
  center: Pt;
  radius: number;
  longOne: number;
  rombSide: number;
  O: Pt;
  A: Pt;
  B: Pt;
  C: Pt;
  D: Pt;
  M: Pt;
  its: number;
  newPeauc: boolean;
  trajectory: Pt[];
  draw: Pt;
  turn: number;
  moves: number;
  explored: boolean;
  failed: boolean;
  message: string;
  showNames: boolean;
  showCircle: boolean;
};
type Solve = { ok: boolean; M: Pt; C?: Pt; B?: Pt; D?: Pt };
interface Core {
  constants: {
    WIDTH: number;
    HEIGHT: number;
    RADIUS: number;
    LONG: number;
    SIDE: number;
    HANDLES: string[];
  };
  start(options?: Options): State;
  solve(O: Pt, A: Pt, longOne: number, rombSide: number): Solve | null;
  resolve(state: State): State | null;
  move(state: State, m: Move): State | null;
  legalMoves(): Move[];
  result(state: State | null): "done" | null;
}

const core = (): Core => cores.invert.InvertCore as unknown as Core;

const TOL = 1e-6; // board units; the core works in double precision
const offset = (p: Pt, q: Pt): Pt => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (p: Pt, q: Pt): number => p.x * q.x + p.y * q.y;
const cross = (p: Pt, q: Pt): number => p.x * q.y - p.y * q.x;
const dist = (p: Pt, q: Pt): number => Math.hypot(p.x - q.x, p.y - q.y);
const finite = (p: Pt | null | undefined): p is Pt =>
  !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const r6 = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(6)) : null;
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  finite(p) ? { x: r6(p.x)!, y: r6(p.y)! } : null;
const relativeError = (measured: number, expected: number): number =>
  Math.abs(measured - expected) / (Math.abs(expected) || 1);
const numOr = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const positiveOr = (v: unknown, fallback: number): number => {
  const n = numOr(v, fallback);
  return n > 0 ? n : fallback;
};

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

/** Hand the tutor's JSON to the core's own start(), with the applet's guards. */
function readOptions(C: Core, raw: Json): Options {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("arguments must be an object with optional center, O, A, radius, longOne, rombSide, width, height and display flags");
  }
  const width = num(raw, "width", C.constants.WIDTH);
  const height = num(raw, "height", C.constants.HEIGHT);
  if (!(width > 0 && height > 0)) {
    throw new Error('arguments "width" and "height" must be positive board sizes');
  }
  const radius = num(raw, "radius", C.constants.RADIUS);
  if (!(radius > 0)) throw new Error('argument "radius" must be positive');
  const longOne = num(raw, "longOne", C.constants.LONG);
  const rombSide = num(raw, "rombSide", C.constants.SIDE);
  if (!(longOne > 0 && rombSide > 0)) {
    throw new Error('arguments "longOne" and "rombSide" (the rod lengths) must be positive');
  }
  const o: Options = { width, height, radius, longOne, rombSide };
  for (const key of ["center", "O", "A"] as const) {
    if (raw[key] !== undefined && raw[key] !== null) o[key] = readPoint(raw[key], key);
  }
  for (const key of ["showNames", "showCircle"] as const) {
    if (raw[key] !== undefined && raw[key] !== null) {
      if (typeof raw[key] !== "boolean") throw new Error(`argument "${key}" must be true or false`);
      o[key] = raw[key] as boolean;
    }
  }
  return o;
}

/** A successful FindPeauc solve, or null when one of the applet's guards bit. */
function solved(C: Core, s: State): Solve | null {
  const g = C.solve(s.O, s.A, s.longOne, s.rombSide);
  return g && g.ok !== false && finite(g.C) ? g : null;
}

function guardReason(C: Core, s: State, g: Solve | null): string | null {
  if (g !== null) return null;
  const oa = dist(s.O, s.A);
  if (!(oa >= 0.1)) return "O and A are closer than the applet's 0.1 minimum separation";
  const k = s.longOne * s.longOne - s.rombSide * s.rombSide;
  const f = k / (oa * oa);
  const c = { x: s.O.x + f * (s.A.x - s.O.x), y: s.O.y + f * (s.A.y - s.O.y) };
  if (Math.abs(c.x) > 2000 || Math.abs(c.y) > 2000) {
    return "C would fall outside the applet's ±2000 drawing guard";
  }
  const h2 = s.rombSide * s.rombSide - ((k / oa - oa) / 2) ** 2;
  return h2 > 0 ? null : "the rhombus half-diagonal is not real: the rods cannot close at this separation";
}

/** Signed distance of C from the inverse of P's circle: (C−O)·(P−O) = k/2. */
function lineDeviation(s: State, k: number): number | null {
  const op = dist(s.center, s.O);
  if (!(op > 0) || !finite(s.C)) return null;
  return (dot(offset(s.C, s.O), offset(s.center, s.O)) - k / 2) / op;
}

/** One measurement of a linkage, all from the core's solve(). */
function measure(C: Core, s: State) {
  const g = solved(C, s);
  const g2 = C.solve(s.O, s.A, s.longOne, s.rombSide);
  const k = s.longOne * s.longOne - s.rombSide * s.rombSide;
  const oa = dist(s.O, s.A);
  const oc = g ? dist(s.O, g.C!) : null;
  const product = oc === null ? null : oa * oc;
  const op = dist(s.center, s.O);
  const deviation = g ? lineDeviation({ ...s, C: g.C! }, k) : null;
  const collinearity = g ? Math.abs(cross(offset(g.C!, s.O), offset(s.A, s.O))) / (oa * (oc || 1)) : null;
  const expectedScale = k / (oa * oa);
  const measuredScale = g ? (oc || 0) / oa : null;
  const sides = g && finite(g.B) && finite(g.D)
    ? {
        AB: dist(s.A, g.B!), BC: dist(g.B!, g.C!),
        CD: dist(g.C!, g.D!), DA: dist(g.D!, s.A),
      }
    : null;
  const rods = g && finite(g.B) && finite(g.D)
    ? { OB: dist(s.O, g.B!), OD: dist(s.O, g.D!) }
    : null;
  const closest = op > 0
    ? {
        x: s.O.x + (k / (2 * op * op)) * (s.center.x - s.O.x),
        y: s.O.y + (k / (2 * op * op)) * (s.center.y - s.O.y),
      }
    : null;
  const direction = op > 0
    ? { x: -(s.center.y - s.O.y) / op, y: (s.center.x - s.O.x) / op }
    : null;
  const line = closest && direction
    ? { through: [pt(closest), pt({ x: closest.x + direction.x, y: closest.y + direction.y })] }
    : { through: [null, null] };
  const oDrift = dist(s.center, s.O) - s.radius;
  const aDrift = dist(s.center, s.A) - s.radius;
  const sideDrift = sides
    ? Math.max(...Object.values(sides).map((v) => Math.abs(v - s.rombSide)))
    : null;
  const rodDrift = rods
    ? Math.max(...Object.values(rods).map((v) => Math.abs(v - s.longOne)))
    : null;

  return {
    ok: g !== null,
    guard: guardReason(C, s, g),
    board: { width: s.width, height: s.height },
    rods: { longOne: s.longOne, rombSide: s.rombSide, power: k },
    circle: {
      centre: pt(s.center), radius: r6(s.radius),
      distanceOP: r6(op), oDriftFromCircle: sig(oDrift), aDriftFromCircle: sig(aDrift),
    },
    points: {
      O: pt(s.O), A: pt(s.A), M: pt(g2?.M ?? s.M),
      B: g && finite(g.B) ? pt(g.B) : null,
      C: g && finite(g.C) ? pt(g.C) : null,
      D: g && finite(g.D) ? pt(g.D) : null,
    },
    lengths: {
      oa: r6(oa), oc: r6(oc),
      ob: rods ? r6(rods.OB) : null, od: rods ? r6(rods.OD) : null,
      ab: sides ? r6(sides.AB) : null, bc: sides ? r6(sides.BC) : null,
      cd: sides ? r6(sides.CD) : null, da: sides ? r6(sides.DA) : null,
    },
    invariant: {
      oaTimesOc: r6(product), obSquaredMinusAbSquared: r6(k),
      relativeError: product === null ? null : sig(relativeError(product, k)),
      expectedScale: sig(expectedScale), measuredScale: sig(measuredScale),
    },
    drifts: {
      rhombusSide: sig(sideDrift),
      longRod: sig(rodDrift),
    },
    inverseLine: {
      ...line,
      distanceFromO: r6(op > 0 ? k / (2 * op) : null),
      cDeviation: sig(deviation),
    },
    checks: {
      rodsClose: g !== null,
      productEqualsPower: product !== null && relativeError(product, k) < TOL,
      cOnRayOA: collinearity !== null && collinearity < TOL,
      oAndAOnCircle: Math.abs(oDrift) < TOL && Math.abs(aDrift) < TOL,
      circlePassesThroughO: Math.abs(op - s.radius) < TOL,
      rhombusSidesEqual: sideDrift !== null && sideDrift < TOL,
      longRodsEqual: rodDrift !== null && rodDrift < TOL,
      cOnInverseLine: deviation !== null && Math.abs(deviation) < TOL,
    },
    selectedHandle: s.its >= 0 && s.its < C.constants.HANDLES.length
      ? C.constants.HANDLES[s.its] : null,
    moves: s.moves,
    failed: s.failed,
    message: s.message,
    result: C.result(s),
    traceLength: s.trajectory.length,
    note:
      `FindPeauc puts C on ray OA with C = O + (OB²−AB²)/|OA|² · (A−O), so ` +
      `OA · OC = ${r6(k)} = OB² − AB² no matter where A sits on the circle. ` +
      `O and A stay on the circle of radius ${r6(s.radius)} about P, and that circle passes ` +
      `through O (OP = ${r6(op)}); inversion in O with power k sends it to the straight line ` +
      `(C−O)·(P−O) = ${r6(k / 2)}, whose distance from O is k/(2·OP) = ${r6(op > 0 ? k / (2 * op) : null)}. ` +
      `The applet's FindPeauc uses the vertical direction for the rhombus's short diagonal whenever ` +
      `|O.y−A.y| < 2 instead of the true perpendicular, so OB and the rhombus sides can drift from ` +
      `${r6(s.longOne)} and ${r6(s.rombSide)} (largest drifts ${sig(rodDrift)} and ${sig(sideDrift)}); ` +
      `the product OA·OC is unaffected because it fixes C before that branch.`,
  };
}

/** Drag A around P's circle with the real core, collecting the line C draws. */
function sweep(C: Core, s: State, steps: number, stepDegrees: number) {
  const k = s.longOne * s.longOne - s.rombSide * s.rombSide;
  const startAngle = Math.atan2(s.A.y - s.center.y, s.A.x - s.center.x);
  let current = s;
  const samples: Array<{
    step: number;
    target: Pt | null;
    A: Pt | null;
    C: Pt | null;
    oa: number | null;
    oc: number | null;
    oaTimesOc: number | null;
    cDeviation: number | null;
    failed: boolean;
    message: string;
  }> = [];
  let refused = 0;

  for (let i = 1; i <= steps; i++) {
    const theta = startAngle + (i * stepDegrees * Math.PI) / 180;
    const target = {
      x: s.center.x + s.radius * Math.cos(theta),
      y: s.center.y + s.radius * Math.sin(theta),
    };
    const next = C.move(current, { type: "drag", which: "A", point: target });
    if (!next) {
      refused++;
      samples.push({
        step: i, target: pt(target), A: pt(current.A), C: null,
        oa: null, oc: null, oaTimesOc: null, cDeviation: null,
        failed: true, message: "The core refused this drag.",
      });
      continue;
    }
    current = next;
    const g = solved(C, current);
    const oa = dist(current.O, current.A);
    const oc = g ? dist(current.O, g.C!) : null;
    samples.push({
      step: i,
      target: pt(target),
      A: pt(current.A),
      C: g ? pt(g.C) : null,
      oa: r6(oa),
      oc: r6(oc),
      oaTimesOc: oc === null ? null : r6(oa * oc),
      cDeviation: g ? sig(lineDeviation({ ...current, C: g.C! }, k)) : null,
      failed: current.failed,
      message: current.message,
    });
  }

  const good = samples.filter((row) => row.oaTimesOc !== null && row.cDeviation !== null && !row.failed);
  const failedSamples = samples.filter((row) => row.failed).length;
  const deviations = good.map((row) => Math.abs(row.cDeviation!));
  const products = good.map((row) => row.oaTimesOc!);
  return {
    guideCircle: {
      centre: pt(s.center), radius: r6(s.radius),
      startsThroughO: Math.abs(dist(s.center, s.O) - s.radius) < TOL,
    },
    stepDegrees,
    samples,
    refusedMoves: refused,
    failedSamples,
    reachableSamples: good.length,
    maxCDeviationFromLine: deviations.length ? sig(Math.max(...deviations)) : null,
    productRange: products.length
      ? { min: r6(Math.min(...products)), max: r6(Math.max(...products)) }
      : null,
    tracedC: current.trajectory.map(pt),
    inverseLine: measure(C, current).inverseLine,
    final: measure(C, current),
    note:
      `A was dragged ${steps} more steps of ${stepDegrees}° around P's circle; ${good.length} ` +
      `drag(s) kept the rods reachable, ${failedSamples} hit the applet's rod guard (keeping the ` +
      `last good picture) and ${refused} returned no state. At every reachable step ` +
      `OA · OC stays ${r6(k)} = OB² − AB² while C stays on the line ` +
      `(C−O)·(P−O) = ${r6(k / 2)} (largest deviation ` +
      `${deviations.length ? sig(Math.max(...deviations)) : "n/a"} board units): that is ` +
      `inversion in O taking a circle through O to a straight line.`,
  };
}

const INVARIANT_ARGS =
  '{"center":[200,262],"radius":60,"O":[158.6206896551724,218.55172413793105],' +
  '"A":[242.42640687119285,219.57359312880715],"longOne":80,"rombSide":30}';

export function actions(): GameActions {
  return {
    linkage_invariants: {
      describe:
        "Build the Peaucellier linkage from optional points O and A ([x, y] or { x, y }), circle centre `center` and `radius`, and rod lengths `longOne` (OB = OD) and `rombSide` (the rhombus side); omitted values use the applet's opening picture. Measure OA·OC against OB²−AB², check C = O + (OB²−AB²)/|OA|²·(A−O), the equal rhombus sides and that O and A lie on P's circle through O, and report the straight line that inversion in O predicts for C, including the applet's refusal guards.",
      args: INVARIANT_ARGS,
      run: (args) => {
        const C = core();
        return measure(C, C.start(readOptions(C, args)));
      },
    },

    circle_to_line: {
      describe:
        "Starting from the same linkage (arguments as in linkage_invariants, plus `steps` 1–36 and `stepDegrees`, default 8 steps of 7°), drag A around its circle by calling the real core and report each C it draws, the unchanged OA·OC = OB²−AB², and C's deviation from the inverse line (C−O)·(P−O) = (OB²−AB²)/2. Both O and A stay on the circle through O, so inversion in O sends that circle to the straight line C traces.",
      args: '{"steps":8,"stepDegrees":7}',
      run: (args) => {
        const C = core();
        const options = readOptions(C, args);
        const steps = num(args, "steps", 8);
        if (!Number.isInteger(steps) || steps < 1 || steps > 36) {
          throw new Error('argument "steps" must be an integer from 1 to 36');
        }
        const stepDegrees = num(args, "stepDegrees", 7);
        if (!(stepDegrees !== 0 && Math.abs(stepDegrees) <= 30)) {
          throw new Error('argument "stepDegrees" must be nonzero and between -30 and 30');
        }
        return sweep(C, C.start(options), steps, stepDegrees);
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
      ? raw.map((v) => {
          const p = v as Pt | null;
          return finite(p) ? { x: p.x, y: p.y } : null;
        }).filter((p): p is Pt => p !== null)
      : [];
  return {
    ...seed,
    width: positiveOr(state.width, seed.width),
    height: positiveOr(state.height, seed.height),
    center: point(state.center, seed.center),
    radius: positiveOr(state.radius, seed.radius),
    longOne: positiveOr(state.longOne, seed.longOne),
    rombSide: positiveOr(state.rombSide, seed.rombSide),
    O: point(state.O, seed.O), A: point(state.A, seed.A),
    B: point(state.B, seed.B), C: point(state.C, seed.C), D: point(state.D, seed.D),
    M: point(state.M, seed.M),
    its: numOr(state.its, seed.its),
    newPeauc: typeof state.newPeauc === "boolean" ? state.newPeauc : seed.newPeauc,
    trajectory: trace(state.trajectory),
    draw: point(state.draw, seed.draw),
    turn: numOr(state.turn, seed.turn),
    moves: numOr(state.moves, seed.moves),
    explored: state.explored === true,
    failed: state.failed === true,
    message: typeof state.message === "string" ? state.message : "",
    showNames: state.showNames !== false,
    showCircle: state.showCircle !== false,
  };
}

/** Echo Track's saved fields, then re-measure them with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported invert state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved invert position must be an object");
  }
  const C = core();
  const s = stateFromSaved(C, state);
  const reading = measure(C, s);
  const g = solved(C, s);
  const gap = (saved: unknown, corePoint: Pt | null | undefined): number | null => {
    try {
      return sig(dist(readPoint(saved, "saved point"), corePoint!));
    } catch {
      return null;
    }
  };
  return {
    ...state,
    stateVersion,
    movesSoFar: s.moves,
    selectedHandle: reading.selectedHandle,
    finished: reading.result === "done",
    product: reading.invariant,
    inverseLine: reading.inverseLine,
    checks: reading.checks,
    core: reading,
    savedVsCore: {
      O: gap(state.O, s.O), A: gap(state.A, s.A),
      B: gap(state.B, g?.B), C: gap(state.C, g?.C),
      D: gap(state.D, g?.D), M: gap(state.M, g2Point(C, s)),
    },
    note:
      "Track.state saved the linkage handles O, A, B, C, D, M, the circle centre P and radius, " +
      "the rod lengths longOne and rombSide, the selected handle, the traced line and display flags. " +
      "The core recomputes C from O and A: OA · OC = OB² − AB² stays constant, and because O and A " +
      "lie on P's circle through O, inversion in O sends that circle to the straight line C draws. " +
      reading.note,
  };
}

/** The midpoint FindPeauc writes even when it refuses a solve. */
function g2Point(C: Core, s: State): Pt | null {
  const g = C.solve(s.O, s.A, s.longOne, s.rombSide);
  return g && finite(g.M) ? g.M : null;
}
