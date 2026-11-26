/*
 * run_game_logic actions and saved-position reader for Angle: An Illustrated
 * Classification.
 *
 * The real core is angle/angle-core.js, copied into src/generated/cores/ at
 * build time. It reproduces SignedAngle.ToString: the turn from ray OA to ray
 * OB is rounded to a whole degree, the absolute value is classified with the
 * exact thresholds 0, 90, 180, 360, and signed mode appends ", positive" or
 * ", negative". See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["angle"].AngleCore;
type Point = { x: number; y: number };

const r1 = (v: number): number => Math.round(v * 10) / 10;
const pt = (p: Point): Point => ({ x: r1(p.x), y: r1(p.y) });

/** Accept the page's saved {x, y} as well as [x, y] argument arrays. */
function readPoint(args: Json, key: string): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
}

/** Signed is a boolean option, off unless the caller turns it on. */
function signedFlag(args: Json): boolean {
  const v = args.signed;
  if (v === undefined) return false;
  if (typeof v !== "boolean") throw new Error('argument "signed" must be true or false');
  return v;
}

const CLASSIFY_NOTE =
  "The applet rounds the turn to the nearest whole degree and then classifies its absolute value: 0 is zero, 1-89 acute, exactly 90 right, 91-179 obtuse, 180 straight, 181-359 reflex, 360 full, beyond that big. Rounding comes first, so 89.6° rounds to 90° and is right while 89.4° rounds to 89° and is acute. Signed mode prints the signed number and appends ', positive' or ', negative'.";

/** The three strings the applet prints, plus the numbers behind them. */
function reading(d: { number: number; word: string; suffix: string | null; text: string }, signed: boolean, roundedDegrees: number) {
  return {
    roundedDegrees,
    signed,
    number: d.number,
    category: d.word,
    suffix: d.suffix,
    text: d.text,
    note: CLASSIFY_NOTE,
  };
}

export function actions(): GameActions {
  return {
    measure_rays: {
      describe:
        "Given the two rays OA and OB (points A and B in page coordinates, y downward, either [x, y] or {x, y}), measure the turn from OA to OB and report the angle the applet would print: the rounded whole degrees, the absolute-value category (zero, acute, right, obtuse, straight, reflex, full or big), and the positive/negative suffix in signed mode. Only the directions of A and B matter: both are projected onto the drawing circle.",
      args: '{ "A": [256, 120], "B": [245.8, 82], "signed": false }',
      run: (args) => {
        const C = core();
        const signed = signedFlag(args);
        const A = readPoint(args, "A");
        const B = readPoint(args, "B");
        const s = C.moveB(C.moveA(C.start({ signed }), A), B);
        // The unrounded turn, for comparison with the applet's whole-degree reading.
        const unrounded = -C.degrees(C.signedAngle(s.center, s.A, B));
        return {
          ...reading(C.label(s), signed, s.degrees),
          unroundedDegrees: r1(unrounded),
          startRadians: r1(C.startRadians(s.center, s.A)),
          A: pt(s.A),
          B: pt(s.B),
        };
      },
    },
    classify_degrees: {
      describe:
        "Given a degree value (which may be fractional) and a signed flag, report the applet's exact printed angle: the value rounded to the nearest whole degree, its absolute-value category at the thresholds 0, 90, 180, 360, and the sign suffix. This is the reading of SignedAngle.ToString without needing to draw the rays; values outside -1800..1800 are clamped to the spinner's range.",
      args: '{ "degrees": 89.6, "signed": false }',
      run: (args) => {
        const C = core();
        const requested = num(args, "degrees");
        const signed = signedFlag(args);
        const deg = C.clamp(requested, C.MIN_DEGREES, C.MAX_DEGREES);
        const d = C.describe(C.radians(deg), signed);
        return {
          inputDegrees: requested,
          clampedDegrees: r1(deg),
          ...reading(d, signed, Math.round(deg)),
        };
      },
    },
  };
}

/** The page's saved illustration, read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const deg =
    typeof state.degrees === "number" && Number.isFinite(state.degrees)
      ? state.degrees
      : C.INITIAL_DEGREES;
  const signed = state.signed === true;
  let s = C.start({ degrees: deg, signed });
  let savedA: Point | null = null;
  let savedB: Point | null = null;
  try { savedA = readPoint(state, "A"); } catch { /* no saved ray A */ }
  try { savedB = readPoint(state, "B"); } catch { /* no saved ray B */ }
  if (savedA) s = C.moveA(s, savedA);
  // The angle the drawn rays actually show, as a check on the saved spinner value.
  let measuredFromRays: number | null = null;
  if (savedA && savedB) measuredFromRays = C.mathSignedDegrees(s.center, s.A, savedB);

  return {
    stateVersion,
    center: state.center ?? pt(s.center),
    radius: state.radius ?? s.radius,
    A: savedA ?? pt(s.A),
    B: savedB ?? pt(s.B),
    degrees: deg,
    signed,
    reading: {
      ...reading(C.label(s), signed, s.degrees),
      measuredFromRays,
    },
  };
}
