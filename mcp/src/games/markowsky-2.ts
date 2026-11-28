/*
 * run_game_logic actions and saved-position reader for Three Points on a
 * Parabola (Alexander Bogomolny's Markowsky2 applet).
 *
 * The real core is markowsky-2/markowsky-2-core.js, copied into
 * src/generated/cores/ at build time; every drawn number below comes from it.
 *
 * Three points A, B, C sit on a parabola; AA', BB', CC' run parallel to its
 * axis, P = AB ∩ CC', Q = AC ∩ BB' and R = BC ∩ AA'. If M_A is the crossing of
 * the tangents at B and C (M_B and M_C likewise), the theorem is that M_A lies
 * on PQ, M_B on PR, M_C on QR, and PQ, PR, QR are parallel to the tangents at
 * A, B, C. For the exact parabola y = t²/(4a) these are identities: the
 * tangents at q and r meet at ((q+r)/2, qr/(4a)), and PQ has slope p/(2a), the
 * tangent slope at A. The applet's Parabola(t) instead truncates to whole
 * pixels (Java integer division), so the drawn picture misses the exact
 * theorem by small but nonzero residuals; both readings are reported here.
 *
 * This is a different applet from markowsky-parabola, which puts two points on
 * one branch and asks for the equal angles ADC and BDC. Markowsky2 has three
 * sliders (A, B, C), a three-point tangent construction, and the extra quirk
 * that when any two sliders agree the applet stops redrawing and the previous
 * picture stays on screen. There is no win or loss: it is a demonstration.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Ticks = { A: number; B: number; C: number };
type Options = { names: boolean; tangents: boolean };
type State = { width: number; height: number; t: Ticks; options: Options };
type Segment = { p: Pt; q: Pt };
type Frame = {
  valid: boolean; blocked: boolean; width: number; height: number;
  t: Ticks; points: Record<string, Pt | null | undefined>;
  chords: Segment[]; verticals: Segment[]; tangents: Segment[]; pqr: Segment[];
  parabolaPoints: Pt[]; axisX: number; yDirectrix: number; yVertex: number; yFocus: number;
};
type SavedPosition = {
  width: number; height: number; t: Ticks;
  points: Record<string, Pt | null>; options: Options;
  valid: boolean; blocked: boolean; parabolaPoints: Pt[];
};
interface Core {
  DEFAULT_WIDTH: number; DEFAULT_HEIGHT: number;
  A: number; DT: number; DH: number; TANGENT_STEP: number;
  MIN_T: number; MAX_T: number; GUARD_EPS: number; PARALLEL_EPS: number;
  FOOT_Y: number; INITIAL_T: Ticks; OPTION_NAMES: string[];
  parabola(t: number): number;
  computeY(height: number, t: number): number;
  intersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt;
  finite(p: Pt | null | undefined): boolean;
  start(options?: {
    width?: number; height?: number; tA?: number; tB?: number; tC?: number;
    options?: Partial<Options>;
  }): State;
  reset(state: State): State;
  setT(state: State, name: string, value: number): State;
  setOption(state: State, name: string, on: boolean): State;
  initialOptions(): Options;
  pointAt(state: State, t: number): Pt;
  tangentAt(state: State, t: number, point: Pt): Segment;
  compute(state: State, previous?: Frame | null): Frame;
  position(state: State, shown: Frame): SavedPosition;
  result(state: State): null;
}

const core = (): Core => cores["markowsky-2"].Markowsky2Core as unknown as Core;

/* The core is exact up to floating point; only what we print is rounded. */
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(3)) : null);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const dist = (p: Pt, q: Pt): number => Math.hypot(p.x - q.x, p.y - q.y);
const slope = (p: Pt, q: Pt): number => (q.y - p.y) / (q.x - p.x);
/** Perpendicular distance from w to the line through u and v. */
const lineDistance = (u: Pt, v: Pt, w: Pt): number =>
  Math.abs((v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x)) / Math.hypot(v.x - u.x, v.y - u.y);

/* Whole-pixel parabola rounding moves the drawn points a little. */
const POINT_TOL = 2;
const SLOPE_TOL = 0.05;
const EXACT_TOL = 1e-9;
const NOTE =
  "This is Markowsky2 (three points A, B, C): M_A = tangent(B) ∩ tangent(C) lies on PQ, " +
  "M_B on PR, M_C on QR, and PQ, PR, QR are parallel to the tangents at A, B, C. For the exact " +
  "parabola y = t²/(4a) those are identities; the core draws Parabola(t) with Java integer " +
  "division, so the drawn residuals are small but nonzero while the exact ones are floating-point " +
  "zero. It is not markowsky-parabola, whose two points give the equal angles ADC and BDC.";
const NO_GAME = "This is a picture, so there is no win or loss; the tracker records exploration.";

/** A scrollbar offset: finite, inside the applet's range; the core rounds it. */
function readT(C: Core, obj: Json, key: string, fallback: number): number {
  const v = num(obj, key, fallback);
  if (!Number.isFinite(v) || v < C.MIN_T || v > C.MAX_T) {
    throw new Error(`argument "${key}" must be a slider offset from ${C.MIN_T} to ${C.MAX_T}`);
  }
  return v;
}

function dimension(args: Json, key: string, fallback: number): number {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 5000) {
    throw new Error(`argument "${key}" must be a positive board size, got ${JSON.stringify(raw)}`);
  }
  return n;
}

/** A real core state: open the applet at the requested sliders and switches. */
function buildState(C: Core, args: Json): State {
  if (!isObj(args)) throw new Error("arguments must be an object with tA, tB and tC slider offsets");
  const opts = isObj(args.options) ? args.options : {};
  return C.start({
    width: dimension(args, "width", C.DEFAULT_WIDTH),
    height: dimension(args, "height", C.DEFAULT_HEIGHT),
    tA: readT(C, args, "tA", C.INITIAL_T.A),
    tB: readT(C, args, "tB", C.INITIAL_T.B),
    tC: readT(C, args, "tC", C.INITIAL_T.C),
    options: { names: opts.names === true || args.names === true, tangents: opts.tangents === true || args.tangents === true },
  });
}

/** The same construction on the smooth parabola, using the core's intersect. */
function exactDiagram(C: Core, state: State) {
  const cx = Math.trunc(state.width / 2);
  const baseY = state.height - C.A - C.DH;
  const at = (t: number): Pt => ({ x: cx + t, y: baseY - (t * t) / (4 * C.A) });
  const foot = (p: Pt): Pt => ({ x: p.x, y: C.FOOT_Y });
  const tangentEnd = (t: number, p: Pt): Pt => ({
    x: cx + t + C.TANGENT_STEP,
    y: p.y - C.TANGENT_STEP * (t / (2 * C.A)),
  });
  const a = at(state.t.A), b = at(state.t.B), c = at(state.t.C);
  return {
    P: C.intersect(a, b, c, foot(c)),
    Q: C.intersect(c, a, b, foot(b)),
    R: C.intersect(b, c, a, foot(a)),
    MA: C.intersect(b, tangentEnd(state.t.B, b), c, tangentEnd(state.t.C, c)),
    MB: C.intersect(c, tangentEnd(state.t.C, c), a, tangentEnd(state.t.A, a)),
    MC: C.intersect(a, tangentEnd(state.t.A, a), b, tangentEnd(state.t.B, b)),
  };
}

/** The exact theorem in axis-relative coordinates: x = t, y = t²/(4a). */
function closedForm(C: Core, t: Ticks) {
  const { A: p, B: q, C: r } = t;
  return {
    parabola: `y = t²/(4a), a = ${C.A} (x = t, y upward from the vertex)`,
    MA: { x: round((q + r) / 2), y: round((q * r) / (4 * C.A)) },
    MB: { x: round((r + p) / 2), y: round((r * p) / (4 * C.A)) },
    MC: { x: round((p + q) / 2), y: round((p * q) / (4 * C.A)) },
    parallelSlopes: {
      PQ: round(p / (2 * C.A)), PR: round(q / (2 * C.A)), QR: round(r / (2 * C.A)),
    },
    note: `Tangents at q and r meet at ((q+r)/2, qr/(4a)); PQ has slope p/(2a), PR q/(2a), QR r/(2a).`,
  };
}

type Claim = {
  name: string; statement: string;
  drawnResidual: number | null; exactResidual: number | null;
  holdsInDrawing: boolean; holdsExactly: boolean;
};

/** The six page claims, measured on the drawn frame and on the smooth curve. */
function reading(C: Core, state: State, frame: Frame) {
  const d = frame.points;
  const e = exactDiagram(C, state);
  const drawnPts = [d.P, d.Q, d.R, d.MA, d.MB, d.MC];
  const exactPts = [e.P, e.Q, e.R, e.MA, e.MB, e.MC];
  const drawnOK = drawnPts.every((p) => C.finite(p));
  const exactOK = exactPts.every((p) => C.finite(p));
  const slopeA = -state.t.A / (2 * C.A);
  const slopeB = -state.t.B / (2 * C.A);
  const slopeC = -state.t.C / (2 * C.A);

  const claim = (
    name: string, statement: string,
    drawn: number | null, exact: number | null, tol: number,
  ): Claim => ({
    name, statement,
    drawnResidual: drawn === null || !Number.isFinite(drawn) ? null : round(drawn),
    exactResidual: exact === null || !Number.isFinite(exact) ? null : sig(Math.abs(exact)),
    holdsInDrawing: drawn !== null && Number.isFinite(drawn) && drawn <= tol,
    holdsExactly: exact !== null && Number.isFinite(exact) && Math.abs(exact) < EXACT_TOL,
  });
  const onLine = (p: Pt, q: Pt, w: Pt): number | null =>
    p && q && w ? lineDistance(p, q, w) : null;
  const parallel = (p: Pt, q: Pt, target: number): number | null =>
    p && q ? Math.abs(slope(p, q) - target) : null;

  const claims: Claim[] = [
    claim("MA_on_PQ", "M_A (tangents at B and C) lies on PQ",
      drawnOK ? onLine(d.P as Pt, d.Q as Pt, d.MA as Pt) : null,
      exactOK ? onLine(e.P, e.Q, e.MA) : null, POINT_TOL),
    claim("MB_on_PR", "M_B (tangents at C and A) lies on PR",
      drawnOK ? onLine(d.P as Pt, d.R as Pt, d.MB as Pt) : null,
      exactOK ? onLine(e.P, e.R, e.MB) : null, POINT_TOL),
    claim("MC_on_QR", "M_C (tangents at A and B) lies on QR",
      drawnOK ? onLine(d.Q as Pt, d.R as Pt, d.MC as Pt) : null,
      exactOK ? onLine(e.Q, e.R, e.MC) : null, POINT_TOL),
    claim("PQ_parallel_tangentA", "PQ is parallel to the tangent at A",
      drawnOK ? parallel(d.P as Pt, d.Q as Pt, slopeA) : null,
      exactOK ? parallel(e.P, e.Q, slopeA) : null, SLOPE_TOL),
    claim("PR_parallel_tangentB", "PR is parallel to the tangent at B",
      drawnOK ? parallel(d.P as Pt, d.R as Pt, slopeB) : null,
      exactOK ? parallel(e.P, e.R, slopeB) : null, SLOPE_TOL),
    claim("QR_parallel_tangentC", "QR is parallel to the tangent at C",
      drawnOK ? parallel(d.Q as Pt, d.R as Pt, slopeC) : null,
      exactOK ? parallel(e.Q, e.R, slopeC) : null, SLOPE_TOL),
  ];
  const residuals = (i: number): number | null => claims[i].drawnResidual;
  return {
    drawnOK, exactOK,
    drawn: {
      A: pt(d.A), B: pt(d.B), C: pt(d.C), P: pt(d.P), Q: pt(d.Q), R: pt(d.R),
      MA: pt(d.MA), MB: pt(d.MB), MC: pt(d.MC),
      AT: pt(d.AT), BT: pt(d.BT), CT: pt(d.CT),
    },
    exact: {
      P: pt(e.P), Q: pt(e.Q), R: pt(e.R), MA: pt(e.MA), MB: pt(e.MB), MC: pt(e.MC),
    },
    closedForm: closedForm(C, state.t),
    tangentSlopesInDrawing: { A: round(slopeA), B: round(slopeB), C: round(slopeC) },
    claims,
    maxDrawnPointDeviation: Math.max(
      ...[0, 1, 2].map((i) => residuals(i) ?? 0),
    ),
    maxDrawnSlopeDeviation: Math.max(
      ...[3, 4, 5].map((i) => residuals(i) ?? 0),
    ),
    allHoldExactly: claims.every((c) => c.holdsExactly),
    allWithinPixelRounding: claims.every((c) => c.holdsInDrawing),
  };
}

const EXAMPLE = { tA: 81, tB: 180, tC: 10, moves: [["B", 81], ["B", 180]] };

function readMoves(C: Core, args: Json, state: State): Array<{ name: keyof Ticks; value: number }> {
  const raw = args.moves;
  if (raw === undefined || raw === null) {
    return [{ name: "B", value: state.t.A }, { name: "B", value: state.t.B }];
  }
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) {
    throw new Error('argument "moves" must be an array of 1 to 20 [name, offset] pairs');
  }
  return raw.map((m, i) => {
    let name: unknown, value: unknown;
    if (Array.isArray(m)) {
      if (m.length !== 2) throw new Error(`moves[${i}] must be [name, offset]`);
      [name, value] = m;
    } else if (isObj(m)) {
      name = m.name; value = m.value;
    } else {
      throw new Error(`moves[${i}] must be [name, offset] or { name, value }`);
    }
    if (name !== "A" && name !== "B" && name !== "C") {
      throw new Error(`moves[${i}].name must be "A", "B" or "C"`);
    }
    const v = num({ value }, "value");
    if (!Number.isFinite(v) || v < C.MIN_T || v > C.MAX_T) {
      throw new Error(`moves[${i}].value must be from ${C.MIN_T} to ${C.MAX_T}`);
    }
    return { name, value: v };
  });
}

function nearPair(t: Ticks, eps: number): string | null {
  const names: (keyof Ticks)[] = ["A", "B", "C"];
  const pairs: string[] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (Math.abs(t[names[i]] - t[names[j]]) < eps) pairs.push(`${names[i]}=${names[j]}`);
    }
  }
  return pairs.length ? pairs.join(", ") : null;
}

function samePoints(a: Frame["points"], b: Frame["points"]): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => {
    const p = a[k], q = b[k];
    if (!p || !q) return p === q;
    return p.x === q.x && p.y === q.y;
  });
}

export function actions(): GameActions {
  return {
    tangent_claim: {
      describe:
        "Set the three slider offsets tA, tB, tC (finite, from -250 to 260; the example uses the live fixture's 81, 180, 10) and optional width, height, names and tangents. Run the real Markowsky2 core: report the drawn A, B, C, P, Q, R and M_A, M_B, M_C, and check that M_A lies on PQ, M_B on PR, M_C on QR and that PQ, PR, QR are parallel to the tangents at A, B, C. The same six checks are measured on the exact parabola y = t²/(4a), whose closed form is given beside the whole-pixel drawing, so the theorem is separated from the applet's integer-division rounding. Equal sliders freeze the drawing and are reported with blocked = true.",
      args: JSON.stringify({ tA: 81, tB: 180, tC: 10 }),
      run: (args) => {
        const C = core();
        const state = buildState(C, args);
        const frame = C.compute(state, null);
        const common = {
          sliderValues: { ...state.t },
          board: { width: state.width, height: state.height },
          options: { ...state.options },
        };
        if (frame.blocked || !frame.valid) {
          return {
            ...common, valid: frame.valid, blocked: true, claims: [],
            note:
              "Two sliders agree (or are closer than " + C.GUARD_EPS + "), so ComputeWhatNot " +
              "returns before rebuilding the picture and the last drawing stays on screen. " +
              "Move a slider away from the others, or use slider_freeze to watch the quirk. " + NOTE,
          };
        }
        const r = reading(C, state, frame);
        return {
          ...common,
          valid: true, blocked: false, drawnOK: r.drawnOK, exactOK: r.exactOK,
          points: r.drawn,
          exactPoints: r.exact,
          closedForm: r.closedForm,
          tangentSlopesInDrawing: r.tangentSlopesInDrawing,
          claims: r.claims,
          allHoldExactly: r.allHoldExactly,
          allWithinPixelRounding: r.allWithinPixelRounding,
          maxDrawnPointDeviation: round(r.maxDrawnPointDeviation),
          maxDrawnSlopeDeviation: round(r.maxDrawnSlopeDeviation),
          note:
            `On the smooth parabola all six residuals are floating-point zero (${r.allHoldExactly}); ` +
            `the drawn points miss by at most ${round(r.maxDrawnPointDeviation)} board units and the ` +
            `drawn slopes by at most ${round(r.maxDrawnSlopeDeviation)} because Parabola(t) truncates ` +
            `t²/4 then divides by a = ${C.A} with Java integer division. ` + NOTE + " " + NO_GAME,
        };
      },
    },

    slider_freeze: {
      describe:
        "Start at slider offsets tA, tB, tC (finite, -250 to 260) and apply each optional move [name, offset] (name A, B or C; 1-20 moves) with the core's setT, recomputing with the previous frame as the page does. Defaults to moving B onto A and back, which first freezes and then unfreezes the picture. For each step report the slider values, the values the drawing was made from, the pair within 0.1 that triggers the guard, whether the points are exactly the old ones, and whether the drawing was rebuilt. This is the Markowsky2 slider freeze, not markowsky-parabola's two-slider angle applet.",
      args: JSON.stringify(EXAMPLE),
      run: (args) => {
        const C = core();
        let state = buildState(C, args);
        const moves = readMoves(C, args, state);
        let frame = C.compute(state, null);
        const start = {
          sliderValues: { ...state.t },
          drawnValues: { ...frame.t },
          blocked: frame.blocked,
          triggeredBy: nearPair(state.t, C.GUARD_EPS),
        };
        const steps: Json[] = [];
        for (const move of moves) {
          const next = C.setT(state, move.name, move.value);
          const shown = C.compute(next, frame);
          const pair = nearPair(next.t, C.GUARD_EPS);
          steps.push({
            move: { name: move.name, offset: move.value },
            sliderValues: { ...next.t },
            drawnValues: { ...shown.t },
            blocked: shown.blocked,
            triggeredBy: pair,
            pointsUnchanged: samePoints(shown.points, frame.points),
            rebuilt: !shown.blocked,
            status: shown.blocked
              ? "Frozen: the old picture stays; the drawn values are from the last valid sliders."
              : "Rebuilt from the current sliders.",
          });
          state = next;
          frame = shown;
        }
        const frozen = steps.filter((s) => s.blocked).length;
        return {
          board: { width: state.width, height: state.height },
          guardEps: C.GUARD_EPS,
          start,
          steps,
          frozenSteps: frozen,
          note:
            "The applet's ComputeWhatNot returns before touching any field when two offsets are " +
            `within ${C.GUARD_EPS}; the frame it returns is the previous one with blocked = true, so ` +
            "the drawn values lag behind the sliders while the points are bit-for-bit unchanged. " +
            "Once the offsets differ again the picture is rebuilt. This is the three-point " +
            "tangent applet, not markowsky-parabola, which stops when either of its two offsets " +
            "is near zero as well. " + NOTE + " " + NO_GAME,
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure the picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Markowsky2 state version ${stateVersion}`);
  if (!isObj(state)) throw new Error("saved Markowsky2 position must be an object");
  const C = core();
  const width = dimension(state, "width", C.DEFAULT_WIDTH);
  const height = dimension(state, "height", C.DEFAULT_HEIGHT);
  const tObj = isObj(state.t) ? state.t : ({} as Json);
  const opts = isObj(state.options) ? state.options : ({} as Json);
  const t: Ticks = {
    A: readT(C, tObj, "A", C.INITIAL_T.A),
    B: readT(C, tObj, "B", C.INITIAL_T.B),
    C: readT(C, tObj, "C", C.INITIAL_T.C),
  };
  const built = C.start({
    width, height, tA: t.A, tB: t.B, tC: t.C,
    options: { names: opts.names === true, tangents: opts.tangents === true },
  });
  const frame = C.compute(built, null);
  const names = ["A", "B", "C", "A1", "B1", "C1", "AT", "BT", "CT", "P", "Q", "R", "MA", "MB", "MC"];
  const savedPoints: Record<string, Pt | null> = {};
  const rawPoints = isObj(state.points) ? state.points : ({} as Json);
  for (const name of names) savedPoints[name] = pt(rawPoints[name] as Pt | null | undefined);

  const saved = {
    width, height,
    t: { ...t },
    options: { ...built.options },
    valid: state.valid === true,
    blocked: state.blocked === true,
    savedPoints,
    parabolaPointCount: Array.isArray(state.parabolaPoints) ? state.parabolaPoints.length : null,
  };
  if (frame.blocked || !frame.valid) {
    return {
      stateVersion, saved, reading: null,
      note:
        "The saved sliders are too close, so the core cannot rebuild the drawing: as in the " +
        "applet the last picture stays on screen (blocked = true). " + NOTE + " " + NO_GAME,
    };
  }
  const r = reading(C, built, frame);
  const agreement: Record<string, number | null> = {};
  for (const name of ["P", "Q", "R", "MA", "MB", "MC"]) {
    const was = savedPoints[name];
    const now = frame.points[name];
    agreement[name] = was && C.finite(now) ? round(dist(was, now as Pt)) : null;
  }
  return {
    stateVersion,
    saved,
    reading: {
      drawnOK: r.drawnOK, exactOK: r.exactOK,
      points: r.drawn,
      exactPoints: r.exact,
      closedForm: r.closedForm,
      tangentSlopesInDrawing: r.tangentSlopesInDrawing,
      claims: r.claims,
      allHoldExactly: r.allHoldExactly,
      allWithinPixelRounding: r.allWithinPixelRounding,
      maxDrawnPointDeviation: round(r.maxDrawnPointDeviation),
      maxDrawnSlopeDeviation: round(r.maxDrawnSlopeDeviation),
    },
    agreesWithSaved: agreement,
    note:
      "Track.state saved the board size, the three slider offsets, the names and tangents " +
      "switches, the valid and blocked flags, the fifteen derived points and the parabola " +
      "polyline; the core rebuilds every point from the sliders and re-measures the six claims " +
      "beside the exact parabola, so agreement measures how far the saved points are from a " +
      "fresh draw. " + NOTE + " " + NO_GAME,
  };
}
