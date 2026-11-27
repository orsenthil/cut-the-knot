/*
 * run_game_logic actions and saved-position reader for Dyno Ellipse.
 *
 * The real core is dyno-ellipse/dyno-ellipse-core.js, copied into
 * src/generated/cores/ at build time. Its frame() is one line of the applet's
 * update: two vectors (r1 cos(n*Rate1/360), -r1 sin(n*Rate1/360)) and
 * (r2 cos(n*Rate2/360), -r2 sin(n*Rate2/360)), added tip to tail. This module
 * only measures that core's own points: the ellipse identity when the speeds
 * are opposite, and the cusps of the four curves named on the page.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

interface Point { x: number; y: number; }
interface Frame {
  v1: Point; v2: Point; unusedL10: number; end1: Point; end2: Point; sum: Point;
}
interface Settings {
  rate1: number; rate2: number; r1: number; r2: number; n: number;
  showCircles: boolean; showBars: boolean; running: boolean; explored: boolean; moves: number;
}
interface Dyno {
  RATE_MIN: number; RATE_MAX: number; RADIUS_MIN: number; RADIUS_MAX: number;
  W: number; H: number; CENTER: Point; DIVISOR: number; PERIOD: number; TRACE: number;
  DEFAULTS: { rate1: number; rate2: number; r1: number; r2: number };
  start(options?: Partial<Settings>): Settings;
  setN(state: Settings, at: number): Settings;
  setShow(state: Settings, name: string, value: boolean): Settings;
  setRunning(state: Settings, on: boolean): Settings;
  frame(state: Settings, at?: number): Frame;
  trace(state: Settings, from: number, to: number): Point[];
  shapeName(state: Settings): string;
  status(state: Settings, f: Frame): string;
  result(state: Settings): string | null;
}

const core = (): Dyno => cores["dyno-ellipse"].DynoEllipseCore as unknown as Dyno;
const round = (v: number): number => Math.round(v * 1e6) / 1e6;
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });

/** An integer option, checked against the core's own slider range. */
function intIn(args: Json, key: string, fallback: number, lo: number, hi: number): number {
  const v = Math.trunc(num(args, key, fallback));
  if (!Number.isFinite(v) || v < lo || v > hi) {
    throw new Error(`"${key}" must be an integer between ${lo} and ${hi}`);
  }
  return v;
}

/** A board point, either { x, y } or [x, y], with finite coordinates. */
function readPoint(value: unknown, name: string): Point {
  const bad = (): never => { throw new Error(`"${name}" must be a finite point { x, y } or [x, y]`); };
  let x = NaN, y = NaN;
  if (Array.isArray(value) && value.length === 2) {
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else return bad();
  if (!Number.isFinite(x) || !Number.isFinite(y)) return bad();
  return { x, y };
}
const maybePoint = (value: unknown, name: string): Point | null =>
  value === undefined || value === null ? null : readPoint(value, name);

/** Cusps are local minima of the pen's distance from the common centre. */
function cuspSteps(C: Dyno, s: Settings, period: number): number[] {
  const radii: number[] = [];
  for (let k = 0; k <= period; k++) {
    const p = C.frame(s, k).sum;
    radii.push(Math.hypot(p.x - C.CENTER.x, p.y - C.CENTER.y));
  }
  const found: number[] = [];
  for (let k = 1; k < period; k++) {
    if (radii[k] <= radii[k - 1] && radii[k] <= radii[k + 1] &&
        radii[k] < radii[k - 1] + radii[k + 1]) found.push(k);
  }
  return found;
}

/** The core's name for the picture, plus the semi-axes when the speeds oppose. */
function shapeReading(C: Dyno, s: Settings) {
  const counter = s.rate1 === -s.rate2 && s.rate1 !== 0;
  return {
    shape: C.shapeName(s),
    counterRotating: counter,
    semiAxes: counter ? { horizontal: s.r1 + s.r2, vertical: Math.abs(s.r1 - s.r2) } : null,
  };
}

export function actions(): GameActions {
  return {
    ellipse: {
      describe:
        "Run the core with the first arm turning at `rate` and the second at `-rate` (lengths `r1`, `r2`, each 0–100). The sampled pen points should satisfy (X/(r1+r2))² + (Y/|r1−r2|)² = 1: an ellipse with those semi-axes, collapsing to a back-and-forth segment when the lengths are equal. Reports the core's own name for the curve, the largest identity error over one full turn and the sampled pen positions.",
      args: '{ "rate": 2, "r1": 60, "r2": 40 }',
      run: (args) => {
        const C = core();
        const rate = intIn(args, "rate", 2, 1, C.RATE_MAX);
        const r1 = intIn(args, "r1", C.DEFAULTS.r1, C.RADIUS_MIN, C.RADIUS_MAX);
        const r2 = intIn(args, "r2", C.DEFAULTS.r2, C.RADIUS_MIN, C.RADIUS_MAX);
        const s = C.start({ rate1: rate, rate2: -rate, r1, r2 });
        const stepsPerTurn = Math.ceil(C.PERIOD / rate);
        const a = r1 + r2, b = Math.abs(r1 - r2);
        const samples: Array<{ step: number; X: number; Y: number }> = [];
        let worst = 0;
        for (let i = 0; i < 16; i++) {
          const step = Math.round((stepsPerTurn * i) / 16);
          const f = C.frame(s, step);
          const X = f.sum.x - C.CENTER.x, Y = f.sum.y - C.CENTER.y;
          if (a > 0 && b > 0) worst = Math.max(worst, Math.abs((X / a) ** 2 + (Y / b) ** 2 - 1));
          samples.push({ step, X: round(X), Y: round(Y) });
        }
        const identityCheckable = a > 0 && b > 0;
        return {
          settings: { rate1: rate, rate2: -rate, r1, r2 },
          ...shapeReading(C, s),
          equation: a === 0
            ? "X = Y = 0 (both arms have length zero)"
            : b === 0
              ? "Y = 0: the pen runs along a segment of length 2(r1+r2)"
              : "(X/(r1+r2))² + (Y/|r1−r2|)² = 1",
          stepsPerTurn,
          divisor: C.DIVISOR,
          maxEllipseIdentityError: identityCheckable ? worst : null,
          ellipseIdentityHolds: identityCheckable ? worst < 1e-9 : null,
          samplePoints: samples,
          status: C.status(s, C.frame(s, 0)),
          note:
            "With Rate2 = −Rate1, cosine is even and sine is odd, so X = (r1+r2)cos(wt) and Y = −(r1−r2)sin(wt); squaring and adding removes t and gives the ellipse. The divisor is 360 radians, so a full turn takes 720π/rate steps, rounded up here.",
        };
      },
    },

    special_curves: {
      describe:
        "Run the real core on the four curves named on the page: cardioid (W=2, R=1/2), deltoid (W=−2, R=1/2), astroid (W=−3, R=1/3) and nephroid (W=3, R=1/3), where W=Rate1/Rate2 and R=r1/r2. `length` (6–100) sets the longer arm; each curve is scanned for one full turn of the slower arm, and the number of cusps (local minima of the pen's distance from the centre) is compared with W−1 for W>0 and |W|+1 for W<0.",
      args: '{ "length": 60 }',
      run: (args) => {
        const C = core();
        const length = intIn(args, "length", 60, 6, C.RADIUS_MAX);
        const presets = [
          { name: "cardioid", rate1: 2, rate2: 1, label: "W=2, R=1/2" },
          { name: "deltoid", rate1: -4, rate2: 2, label: "W=−2, R=1/2" },
          { name: "astroid", rate1: -9, rate2: 3, label: "W=−3, R=1/3" },
          { name: "nephroid", rate1: 6, rate2: 2, label: "W=3, R=1/3" },
        ];
        const curves = presets.map((p) => {
          const W = p.rate1 / p.rate2;
          const r1 = Math.round(length / Math.abs(W));
          const s = C.start({ rate1: p.rate1, rate2: p.rate2, r1, r2: length });
          const period = Math.ceil(C.PERIOD / Math.min(Math.abs(p.rate1), Math.abs(p.rate2)));
          const cusps = cuspSteps(C, s, period);
          const expected = W > 0 ? W - 1 : Math.abs(W) + 1;
          const points = C.trace(s, 0, period);
          const stride = Math.max(1, Math.floor(period / 5));
          const sample = points
            .filter((_: Point, i: number) => i % stride === 0 || i === points.length - 1)
            .slice(0, 6)
            .map(pt);
          return {
            name: p.name, ratio: p.label, W, r1, r2: length,
            period, cuspsFound: cusps.length, cuspSteps: cusps,
            expectedCusps: expected, agrees: cusps.length === expected,
            shape: C.shapeName(s), samplePoints: sample,
          };
        });
        return {
          length,
          curves,
          note:
            "For a whole W the sum of two circular motions with R = 1/|W| is an epicycloid when W>0 (W−1 cusps) or a hypocycloid when W<0 (|W|+1 cusps). The cusps reported here are counted from the core's own pen positions, not from a lookup table.",
        };
      },
    },
  };
}

/** Track.state saves the four sliders, the step and the three pen points; the core rebuilds them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Dyno Ellipse state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Dyno Ellipse position must be an object");
  }
  const C = core();
  try {
    const rate1 = intIn(state, "rate1", C.DEFAULTS.rate1, C.RATE_MIN, C.RATE_MAX);
    const rate2 = intIn(state, "rate2", C.DEFAULTS.rate2, C.RATE_MIN, C.RATE_MAX);
    const r1 = intIn(state, "r1", C.DEFAULTS.r1, C.RADIUS_MIN, C.RADIUS_MAX);
    const r2 = intIn(state, "r2", C.DEFAULTS.r2, C.RADIUS_MIN, C.RADIUS_MAX);
    const n = intIn(state, "n", 0, 0, 1e7);
    const showCircles = state.showCircles === true;
    const showBars = state.showBars === true;
    const running = state.running === true;
    const explored = state.explored === true;
    const moves = intIn(state, "moves", 0, 0, 1e9);
    const savedPen = maybePoint(state.pen, "pen");
    const savedEnd1 = maybePoint(state.end1, "end1");
    const savedEnd2 = maybePoint(state.end2, "end2");

    let s = C.start({ rate1, rate2, r1, r2 });
    s = C.setN(s, n);
    s = C.setShow(C.setShow(s, "showCircles", showCircles), "showBars", showBars);
    s = C.setRunning(s, running);
    s = { ...s, explored, moves };
    const f = C.frame(s);
    const near = (a: Point | null, b: Point): boolean | null =>
      a === null ? null : Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

    return {
      stateVersion,
      valid: true,
      saved: {
        rate1, rate2, r1, r2, n, showCircles, showBars, running, explored, moves,
        pen: savedPen ? pt(savedPen) : null,
        end1: savedEnd1 ? pt(savedEnd1) : null,
        end2: savedEnd2 ? pt(savedEnd2) : null,
      },
      ...shapeReading(C, s),
      penFromCore: pt(f.sum),
      end1FromCore: pt(f.end1),
      end2FromCore: pt(f.end2),
      savedPenMatchesCore: near(savedPen, f.sum),
      savedEnd1MatchesCore: near(savedEnd1, f.end1),
      savedEnd2MatchesCore: near(savedEnd2, f.end2),
      status: C.status(s, f),
      result: C.result(s),
      note:
        "Track.state saved the four slider values, the step and the pen and arm tips in the 400 by 300 board units. The core rebuilds step `n` from those sliders, so each saved point can be checked against the one it actually reaches; with opposite speeds its pen lies on the ellipse with semi-axes r1+r2 and |r1−r2|.",
    };
  } catch (err) {
    return {
      stateVersion,
      valid: false,
      saved: { ...state },
      error: err instanceof Error ? err.message : String(err),
      note: "The saved position needs four integer sliders within the applet's ranges, a non-negative step and finite pen points.",
    };
  }
}
