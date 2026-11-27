/*
 * run_game_logic actions and saved-position reader for Equichordal.
 *
 * The real core is equichordal/equichordal-core.js, copied into
 * src/generated/cores/ at build time. It draws the polar curve
 *   r(t) = Scale * (Shift + sin(Frequency*t)^Power)
 * about the fixed centre O, with Scale = trunc(min(W, H)/5)/Shift, and keeps a
 * chord through O of fixed length SegLen = Scale*Shift*2 = 2*trunc(min/5)
 * (184 board units on the applet's 640 x 460 board).
 *
 * For odd Frequency and odd Power, sin(f(t + pi)) = (-1)^f sin(ft), so the sine
 * terms cancel in r(t) + r(t + pi) and the sum is the constant 2*Scale*Shift.
 * If either knob is even the terms add instead and the sum varies with t. The
 * page quotes Rychlik's theorem (no star-shaped region has two equichordal
 * points); we can measure the sum here but do not prove the theorem.
 * Every number below is measured on the real core; see _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Opts = { power: number; shift: number; freq: number; standard: boolean };
type Params = { scale: number; segLen: number; n: number };
type Geometry = {
  center: Pt; markRadius: number; scale: number; segLen: number; n: number;
  A: Pt; B: Pt; chord: number; radius0: number;
};
type State = Opts & {
  A: Pt; B: Pt; traceA: Pt[]; traceB: Pt[]; dragged: string | null;
};
type Core = {
  WIDTH: number; HEIGHT: number; CENTER: Pt;
  SELECTORS: {
    power: { min: number; max: number };
    shift: { min: number; max: number };
    freq: { min: number; max: number };
  };
  DEFAULTS: Opts;
  options(o?: Partial<Opts>): Opts;
  parameters(p: Opts): Params;
  radiusAt(p: Opts, t: number): number;
  curvePoint(p: Opts, t: number): Pt;
  standardPoints(p: Opts): Pt[];
  start(o?: Partial<Opts>): State;
  withOptions(state: State, o: Partial<Opts>): State;
  geometry(state: State): Geometry;
  secondPoint(state: State, moved: Pt, other: Pt): Pt;
  drag(state: State, name: string, point: Pt): State;
  legalMoves(): string[];
  result(): null;
  position(state: State): Json;
};

const core = (): Core => cores["equichordal"].EquichordalCore as unknown as Core;

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
/** Core values are finite here, but JSON cannot carry NaN or Infinity. */
const cnt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
const pt = (v: unknown): Pt | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Json;
  const x = cnt(o.x), y = cnt(o.y);
  return x === null || y === null ? null : { x, y };
};

/** Tool points may be [x, y]; saved Track.state points are { x, y }. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": number, "y": number }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

function readAngles(v: unknown): number[] {
  if (v === undefined || v === null) return [0, 0.4, 0.9, 1.6, 2.2, 3.0];
  if (!Array.isArray(v)) throw new Error('"angles" must be an array of numbers');
  if (v.length === 0 || v.length > 24) {
    throw new Error('"angles" must contain between 1 and 24 numbers');
  }
  return v.map((x, i) => {
    const n = Number(x);
    if (!Number.isFinite(n)) throw new Error(`angles[${i}] is not a number`);
    return n;
  });
}

/** Validate the requested knobs against the applet's selector ranges. */
function requestedKnobs(C: Core, args: Json): { power: number; shift: number; freq: number } {
  const out = {
    power: num(args, "power", C.DEFAULTS.power),
    shift: num(args, "shift", C.DEFAULTS.shift),
    freq: num(args, "freq", C.DEFAULTS.freq),
  };
  for (const kind of ["power", "shift", "freq"] as const) {
    const spec = C.SELECTORS[kind];
    if (out[kind] < spec.min || out[kind] > spec.max) {
      throw new Error(`"${kind}" must lie between ${spec.min} and ${spec.max}, got ${out[kind]}`);
    }
  }
  return out;
}

/** The knobs the applet actually uses after its NumberSelector snapping. */
function readOpts(C: Core, args: Json): { requested: { power: number; shift: number; freq: number }; applied: Opts } {
  const requested = requestedKnobs(C, args);
  const standard = args.standard === undefined || args.standard === null
    ? C.DEFAULTS.standard
    : typeof args.standard === "boolean"
      ? args.standard
      : (() => { throw new Error('"standard" must be true or false'); })();
  return { requested, applied: C.options({ ...requested, standard }) };
}

/** A fixed centre O, the constant 2*Scale*Shift and a sample of the radius sum. */
function sumReading(C: Core, p: Opts, angles: number[]) {
  const par = C.parameters(p);
  // 2*Scale*Shift = SegLen; the sum the curve should have for odd/odd knobs.
  const constant = 2 * par.scale * p.shift;
  const samples = angles.map((t) => {
    const r1 = C.radiusAt(p, t);
    const r2 = C.radiusAt(p, t + Math.PI);
    return {
      t: round(t, 6),
      rT: round(r1),
      rTPlusPi: round(r2),
      sum: round(r1 + r2),
      deviation: round(r1 + r2 - constant),
    };
  });
  const sums = samples.map((s) => s.sum);
  const min = Math.min(...sums), max = Math.max(...sums);
  const spread = max - min;
  const powerOdd = p.power % 2 === 1;
  const freqOdd = p.freq % 2 === 1;
  return {
    scale: round(par.scale),
    segLen: round(par.segLen),
    constantSum: round(constant),
    power: p.power, shift: round(p.shift), freq: p.freq,
    powerOdd, freqOdd, bothOdd: powerOdd && freqOdd,
    samples,
    sumRange: { min: round(min), max: round(max), spread: round(spread) },
    sumIsConstant: spread <= 1e-6 * Math.max(1, Math.abs(constant)),
  };
}

function readHandle(v: unknown): "A" | "B" {
  if (v === undefined || v === null) return "A";
  if (v !== "A" && v !== "B") throw new Error('"from" must be "A" or "B"');
  return v;
}

function chordReading(C: Core, s: State, from: "A" | "B", point: Pt) {
  const g = C.geometry(s);
  const next = C.drag(s, from, point);
  const gn = C.geometry(next);
  const otherName = from === "A" ? "B" : "A";
  const moved = next[from];
  const other = next[otherName];
  const center = g.center;
  const u = { x: moved.x - center.x, y: moved.y - center.y };
  const v = { x: other.x - center.x, y: other.y - center.y };
  const du = Math.hypot(u.x, u.y), dv = Math.hypot(v.x, v.y);
  const dot = u.x * v.x + u.y * v.y;
  const cross = u.x * v.y - u.y * v.x;
  // Opposite rays through O: the radii point the opposite way and are collinear.
  const opposite = du > 0.1 && dv > 0 &&
    dot / (du * dv) < -1 + 1e-9 && Math.abs(cross) <= 1e-6 * Math.max(1, du * dv);
  return {
    applied: { power: next.power, shift: round(next.shift), freq: next.freq },
    center: g.center,
    scale: round(g.scale),
    segLen: round(g.segLen),
    opening: {
      A: pt(g.A), B: pt(g.B), chord: round(g.chord), radiusAtZero: round(g.radius0),
    },
    drag: {
      from,
      movedTo: pt(moved),
      otherEnd: pt(other),
      otherFromCoreSecondPoint: pt(C.secondPoint(s, moved, s[otherName])),
      distanceMovedToO: round(du),
      distanceOtherToO: round(dv),
      chordAfter: round(gn.chord),
      chordPreserved: Math.abs(gn.chord - g.segLen) <= 1e-6 * Math.max(1, g.segLen),
      oppositeRaysThroughO: opposite,
      tracePoints: next.traceA.length + next.traceB.length,
    },
    curveAtZeroAndPi: {
      atZero: pt(C.curvePoint(C.options(next), 0)),
      atPi: pt(C.curvePoint(C.options(next), Math.PI)),
    },
  };
}

export function actions(): GameActions {
  return {
    radius_sum: {
      describe:
        "Sample the applet's radius r(t) and its opposite r(t + pi) at the given angles, using the real core's slider snapping and Scale. For odd Power and odd Frequency the sine terms cancel and r(t) + r(t + pi) is the constant 2*Scale*Shift = SegLen (184 board units here); turn either knob even and the sum varies with t, so O stops being equichordal. The note recalls Rychlik's theorem, which the page states but this demonstration does not prove.",
      args: '{ "power": 1, "shift": 2, "freq": 1, "angles": [0, 0.4, 0.9, 1.6, 2.2, 3.0] }',
      run: (args) => {
        const C = core();
        const { requested, applied } = readOpts(C, args);
        const angles = readAngles(args.angles);
        const reading = sumReading(C, applied, angles);
        return {
          requested,
          applied: { power: applied.power, shift: round(applied.shift), freq: applied.freq, standard: applied.standard },
          ...reading,
          note:
            "Because sin(f(t + pi)) = (-1)^f sin(ft), an odd Frequency flips the sine's sign and an odd Power keeps it flipped, so the two radii cancel their sine parts and add to 2*Scale*Shift = SegLen. " +
            (reading.bothOdd
              ? "With both knobs odd every sampled sum equals that constant."
              : "With an even knob the sine parts no longer cancel, so the sampled sums spread out instead of staying constant.") +
            " Rychlik's theorem says no star-shaped region can have two equichordal points; the page quotes it, and this core only measures the sum — it does not prove the theorem.",
        };
      },
    },

    fixed_chord: {
      describe:
        "Build a real core position from the three knobs, then drag handle A (or B) to the given point and watch the other end jump to the far end of a chord through O. The core reports Scale, the fixed length SegLen = 2*trunc(min(W,H)/5), the opening chord, and the chord and opposite-ray geometry after the drag, confirming the length never changes. The chord length is independent of Power, Shift and Frequency: those knobs change the curve, not the bar.",
      args: '{ "power": 3, "shift": 2, "freq": 3, "from": "A", "point": [400, 240] }',
      run: (args) => {
        const C = core();
        const { requested, applied } = readOpts(C, args);
        const from = readHandle(args.from);
        const point = args.point === undefined || args.point === null
          ? { x: C.CENTER.x + 80, y: C.CENTER.y + 56 }
          : readPoint(args.point, "point");
        const s = C.start(applied);
        const reading = chordReading(C, s, from, point);
        return {
          requested,
          ...reading,
          note:
            "The applet sets Scale = trunc(min(W,H)/5)/Shift, so SegLen = Scale*Shift*2 is always 2*trunc(min(W,H)/5) = 184 board units whatever the three knobs say. " +
            (reading.drag.chordPreserved && reading.drag.oppositeRaysThroughO
              ? "After the drag the chord still measures SegLen and its two ends lie on opposite rays through O."
              : "This drag did not preserve the expected chord and opposite-ray geometry; check the point (a point at O is ignored by the applet's guard).") +
            " Changing the knobs reshapes the sine curve but leaves the bar's length fixed.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of that same picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equichordal state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Equichordal position must be an object");
  }
  const saved = {
    power: cnt(state.power), shift: cnt(state.shift), freq: cnt(state.freq),
    standard: state.standard === true,
    center: pt(state.center), A: pt(state.A), B: pt(state.B),
    chord: cnt(state.chord), segLen: cnt(state.segLen), scale: cnt(state.scale),
  };
  try {
    const C = core();
    const { applied } = readOpts(C, state);
    const A = readPoint(state.A, "A");
    const B = readPoint(state.B, "B");
    const s: State = {
      ...applied, A, B, traceA: [A], traceB: [B], dragged: null,
    };
    const g = C.geometry(s);
    const canonical = C.position(s);
    const sum = sumReading(C, applied, [0, 0.4, 0.9, 1.6, 2.2, 3.0]);
    return {
      stateVersion,
      valid: true,
      saved,
      applied: { power: applied.power, shift: round(applied.shift), freq: applied.freq, standard: applied.standard },
      center: g.center,
      A: pt(g.A), B: pt(g.B),
      chord: round(g.chord),
      segLen: round(g.segLen),
      scale: round(g.scale),
      radiusAtZero: round(g.radius0),
      fromCore: canonical,
      radiusSum: {
        constantSum: sum.constantSum,
        powerOdd: sum.powerOdd, freqOdd: sum.freqOdd, bothOdd: sum.bothOdd,
        sumIsConstant: sum.sumIsConstant,
        samples: sum.samples,
      },
      note:
        "Track.state saved the three knobs, the centre and the two chord ends; the core rebuilds Scale and SegLen, measures the chord between the saved A and B, and samples r(t) + r(t + pi) at the saved knobs. " +
        (sum.bothOdd
          ? "With odd Power and odd Frequency those samples add to the constant 2*Scale*Shift."
          : "An even knob makes that radius sum vary with t, so O is not equichordal for this curve.") +
        " Rychlik's no-two-equichordal-points theorem is quoted on the page, not proved here. This is a demonstration, so there is no win or loss.",
    };
  } catch (err) {
    return {
      stateVersion,
      valid: false,
      saved,
      error: err instanceof Error ? err.message : String(err),
      note: "A usable saved position needs numeric Power, Shift and Frequency plus the centre and the two chord ends A and B in the applet's 640 by 460 board units.",
    };
  }
}
