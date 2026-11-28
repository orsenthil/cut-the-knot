/*
 * run_game_logic actions and saved-position reader for Mc Worter 2
 * (Bogomolny's McWorter2 applet, "On Bottema's Shoulders").
 *
 * A triangle ABC carries two similar parallelograms on CA and CB. With A at
 * the origin, B = b and C = g the applet's own computation gives the far
 * corners A_c = g + c·(b − g), A_b = A_c + (b − g), B_a = c·g, so their
 * midpoint M = (A_b + B_a)/2 = b·(1 + c)/2: every term containing C cancels.
 * With c = i this is Bottema's theorem; McWorter2 keeps the identity for any
 * similar parallelograms (c = K times a turn). The equal-angle claim made for
 * the flanks needs K > 0, since at K = 0 the parallelograms collapse onto the
 * triangle. This is a different applet from McWorter: that one adds the point
 * D completing ADBC and studies the isosceles right triangle B_a D A_b, with
 * a right angle at D; McWorter2 drops D and keeps only the fixed midpoint.
 *
 * Every number below comes from the real core,
 * mcworter-2/mcworter-2-core.js, copied into src/generated/cores/ at build
 * time. Coordinates are board units, y down. It is a drawing, so there is no
 * win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = { A: Pt; B: Pt; C: Pt; coef: number; angle: number; showNames: boolean };
type Settings = { K: number; angleValue: number; degrees: number; angle: number };
type Figure = { A: Pt; B: Pt; C: Pt; Ab: Pt; Ac: Pt; Ba: Pt; Bc: Pt; M: Pt };
type Claims = {
  midpointIndependent: boolean; independenceOverC: boolean;
  parallelograms: boolean; similar: boolean; equalAngles: boolean;
};
interface Core {
  COEF_MIN: number; COEF_MAX: number; ANGLE_MIN: number; ANGLE_MAX: number;
  rotate(pivot: Pt, point: Pt, angle: number, orientation: number): Pt;
  settings(state: State): Settings;
  computePoint(pivot: Pt, point: Pt, angle: number, K: number): Pt;
  completeParallelogram(p: Pt, q: Pt, r: Pt): Pt;
  midpoint(p: Pt, q: Pt): Pt;
  distance(p: Pt, q: Pt): number;
  angleBetween(u: Pt, v: Pt): number;
  start(options?: Json): State;
  figure(state: State): Figure;
  claimedMidpoint(state: State): Pt;
  claims(state: State): Claims;
  defaultSquares(state: State): boolean;
  withPoint(state: State, name: string, p: Pt): State;
  withOption(state: State, name: string, value: number | boolean): State;
  result(state: State): null;
}
const core = (): Core => cores["mcworter-2"].Mcworter2Core as unknown as Core;

/* Tidy only what we print; the core's own floats drive every verdict. */
const r6 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) : NaN);
const pt = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

const BOTTEMA_NOTE =
  "McWorter's generalisation of Bottema's theorem: the midpoint of the far corners of the " +
  "two similar parallelograms on CA and CB is M = b(1+c)/2, so it depends on A, B and the " +
  "complex multiplier c but not on where C is put. At the default c = i the flanks are squares.";
const RANGE_NOTE =
  "The applet makes Scrollbar(0,0,2,-20,30) and Scrollbar(0,0,10,-90,100), but AWT caps a " +
  "scrollbar's reachable value at maximum − visibleAmount, so the coefficient runs from -20 to " +
  "28 and the angle slider from -90 to 90. K = (coef+20)/20 therefore lies in [0, 2.4] and the " +
  "turn in [0°, 180°]; out-of-range arguments are clamped and rounded by the real core.";
const DISTINCTION_NOTE =
  "This is McWorter2, no point D: the earlier McWorter applet adds D = A+B−C and claims the " +
  "triangle B_a D A_b is isosceles with a right angle at D. Here that point and that claim are " +
  "gone, and the equal-angle statement holds for K > 0 (at K = 0 the flanks collapse).";
const NO_GAME = "This is an illustration, so there is no win or loss; the tracker records exploration.";

function asArgs(args: unknown): Json {
  if (args === undefined || args === null) return {};
  if (!isObj(args)) throw new Error("arguments must be a JSON object of triangle points and sliders");
  return args;
}

/** A board point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback: Pt): Pt {
  if (raw === undefined || raw === null) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (isObj(raw)) {
    [x, y] = [Number(raw.x), Number(raw.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function finite(raw: unknown, label: string): number {
  if (raw === null || typeof raw === "boolean" || Array.isArray(raw) || isObj(raw)) {
    throw new Error(`argument "${label}" must be a finite number, got ${JSON.stringify(raw)}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`argument "${label}" must be a finite number, got ${JSON.stringify(raw)}`);
  }
  return n;
}

function slider(args: Json, key: string, fallback: number): number {
  return args[key] === undefined || args[key] === null ? fallback : finite(args[key], key);
}

/** The core's opening picture with any supplied triangle points and sliders applied. */
function buildState(C: Core, args: Json): State {
  const seed = C.start({});
  const A = readPoint(args.A, "A", seed.A);
  const B = readPoint(args.B, "B", seed.B);
  const Cc = readPoint(args.C, "C", seed.C);
  const coef = slider(args, "coef", seed.coef);
  const angle = slider(args, "angle", seed.angle);
  const showNames = args.showNames === undefined || args.showNames === null
    ? seed.showNames : args.showNames === true;
  return C.start({ points: { A, B, C: Cc }, coef, angle, showNames });
}

/** Everything the real core can say about one configuration. */
function reading(C: Core, s: State) {
  const f = C.figure(s);
  const set = C.settings(s);
  const closed = C.claimedMidpoint(s);
  const gap = C.distance(f.M, closed);
  return {
    sliders: { coef: s.coef, angle: s.angle, showNames: s.showNames },
    settings: { K: r6(set.K), angleValue: set.angleValue, degrees: r6(set.degrees), angleRad: r6(set.angle) },
    points: {
      A: pt(f.A), B: pt(f.B), C: pt(f.C),
      Ab: pt(f.Ab), Ac: pt(f.Ac), Ba: pt(f.Ba), Bc: pt(f.Bc), M: pt(f.M),
    },
    closedFormMidpoint: pt(closed),
    midpointGap: r6(gap),
    claims: C.claims(s),
    defaultSquares: C.defaultSquares(s),
    result: C.result(s),
  };
}

const FIXTURE_ARGS = JSON.stringify({
  A: [154, 187.5], B: [250, 187.5], C: [225, 31.25],
});
const DEFAULT_SETTINGS: Array<[number, number]> = [
  [-20, 0], [0, 0], [28, 0], [40, 120], [-30, -120],
];

export function actions(): GameActions {
  return {
    bottema_midpoint: {
      describe:
        "Open McWorter2 at triangle A, B, C (each [x, y] or { x, y }; the example uses the live fixture's 154,187.5 / 250,187.5 / 225,31.25), with optional coef, angle and showNames. Run the real core and report the two similar parallelograms on CA and CB, their far corners A_b, A_c, B_a, B_c and the midpoint M of A_b B_a, the closed form b(1+c)/2, and the core's checks that M is independent of C (including five moved positions of C), that both shapes close up as similar parallelograms, and that the equal-angle claim holds. This is the generalised Bottema theorem, not the earlier McWorter applet's right angle at D.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, asArgs(args));
        return {
          reading: reading(C, s),
          note:
            BOTTEMA_NOTE + " " + DISTINCTION_NOTE + " " + RANGE_NOTE + " " + NO_GAME,
        };
      },
    },

    slider_claims: {
      describe:
        "Sweep the two applet scrollbars through settings, a list of 1 to 20 [coef, angle] pairs (defaults [-20,0], [0,0], [28,0], [40,120], [-30,-120]), on triangle A, B, C (fixture defaults if omitted). The real core clamps and rounds each slider to the reachable AWT range (coef -20..28, angle -90..90), then rechecks Bottema's fixed midpoint, the similar parallelograms and the equal-angle claim for K = (coef+20)/20. It shows the midpoint never follows C at any setting while the equal angles need K > 0 — at K = 0 the flanks collapse and that claim is false. This is not the earlier McWorter applet's right-angle-at-D claim.",
      args: JSON.stringify({ settings: DEFAULT_SETTINGS }),
      run: (args) => {
        const C = core();
        const a = asArgs(args);
        const raw = a.settings === undefined || a.settings === null ? DEFAULT_SETTINGS : a.settings;
        if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) {
          throw new Error('argument "settings" must be an array of 1 to 20 [coef, angle] pairs');
        }
        const seed = C.start({});
        const A = readPoint(a.A, "A", seed.A);
        const B = readPoint(a.B, "B", seed.B);
        const Cc = readPoint(a.C, "C", seed.C);
        const rows = raw.map((pair, i) => {
          if (!Array.isArray(pair) || pair.length !== 2) {
            throw new Error(`settings[${i}] must be [coef, angle]`);
          }
          const requested = { coef: finite(pair[0], `settings[${i}][0]`), angle: finite(pair[1], `settings[${i}][1]`) };
          const s = C.start({ points: { A, B, C: Cc }, coef: requested.coef, angle: requested.angle });
          const set = C.settings(s);
          const f = C.figure(s);
          const closed = C.claimedMidpoint(s);
          const cl = C.claims(s);
          return {
            requested,
            applied: { coef: s.coef, angle: s.angle },
            settings: { K: r6(set.K), degrees: r6(set.degrees) },
            M: pt(f.M),
            closedFormMidpoint: pt(closed),
            midpointGap: r6(C.distance(f.M, closed)),
            claims: cl,
            defaultSquares: C.defaultSquares(s),
          };
        });
        const collapsed = rows.filter((r) => r.settings.K === 0 && r.claims.equalAngles);
        return {
          triangle: { A: pt(A), B: pt(B), C: pt(Cc) },
          sliderRange: {
            coef: [C.COEF_MIN, C.COEF_MAX], angle: [C.ANGLE_MIN, C.ANGLE_MAX],
          },
          rows,
          midpointAlwaysFixed: rows.every((r) => r.claims.midpointIndependent && r.claims.independenceOverC),
          equalAnglesNeedPositiveK: rows.every((r) => r.settings.K <= 0 || r.claims.equalAngles)
            && rows.every((r) => r.settings.K > 0 || !r.claims.equalAngles) && collapsed.length === 0,
          note:
            BOTTEMA_NOTE + " " + RANGE_NOTE +
            " The equal-angle check is true only when K > 0; at K = 0 the two flanks collapse onto the triangle, so the angles are undefined. " +
            DISTINCTION_NOTE + " " + NO_GAME,
        };
      },
    },
  };
}

/** Echo every field Track.state saved, then re-measure the picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported McWorter2 state version ${stateVersion}`);
  if (!isObj(state)) throw new Error("saved McWorter2 position must be an object");
  const C = core();
  const seed = C.start({});
  const A = readPoint(state.A, "saved A", seed.A);
  const B = readPoint(state.B, "saved B", seed.B);
  const Cc = readPoint(state.C, "saved C", seed.C);
  const coef = slider(state, "coef", seed.coef);
  const angle = slider(state, "angle", seed.angle);
  const showNames = state.showNames === undefined || state.showNames === null
    ? seed.showNames : state.showNames === true;
  const built = C.start({ points: { A, B, C: Cc }, coef, angle, showNames });
  const saved = {
    A: pt(built.A), B: pt(built.B), C: pt(built.C),
    coef: built.coef, angle: built.angle, showNames: built.showNames,
  };
  return {
    ...state,
    stateVersion,
    saved,
    reading: reading(C, built),
    note:
      "Track.state saved the three triangle vertices A, B, C, the two slider values coef and angle " +
      "and the showNames flag, all in board units; the real core rebuilds the two similar " +
      "parallelograms and the fixed midpoint from exactly those fields and re-runs all five checks. " +
      BOTTEMA_NOTE + " " + RANGE_NOTE + " " + DISTINCTION_NOTE + " " + NO_GAME,
  };
}
