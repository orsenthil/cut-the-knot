/*
 * run_game_logic actions and saved-position reader for Equal Angles In Two
 * Circles (Bogomolny's EqualAnglesInTwoCircles applet).
 *
 * Two circles cross at S and T. P lies on the inner circle, inside the outer
 * one, and the chord AB of the outer circle is tangent to the inner circle at
 * P. The page claims two angle equalities: ∠ASP = ∠BTP and ∠ATP = ∠BSP. The
 * proof is the tangent–chord angle ∠PST = ∠BPT together with the cyclic
 * quadrilateral ABTS: ∠ASP + ∠PST + ∠ABT = 180° and, in triangle BPT,
 * ∠PBT + ∠BPT + ∠BTP = 180°. Splitting the equal inscribed angles
 * ∠ASB = ∠ATB at P yields the second pair. This is an illustration, not a
 * game to win: the claim needs P inside the other circle, and outside it the
 * two marked angles become supplementary instead.
 *
 * This is a different theorem from its siblings: Equal Angles In Crossed
 * Circles replaces the tangency by a chord with two ends P, Q and claims
 * ∠ASP = ∠BTQ and ∠ATP = ∠BSQ; Equal Chords in Crossing Circles draws two
 * lines through one crossing and claims equal chord lengths AB = CD.
 *
 * Every number below comes from the game's real core,
 * equal-angles-in-two-circles/equal-angles-in-two-circles-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * page's 400 x 400 view, y down. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type CircleData = { x: number; y: number; r: number };
type State = {
  S: Point; T: Point; RB: Point; RS: Point;
  names: boolean; statement: boolean; hint: boolean; extra: boolean;
};
type Drawing = {
  stale: boolean; valid: boolean; close: boolean;
  S: Point; T: Point; RB: Point; RS: Point; P: Point;
  viaRB: CircleData; viaRS: CircleData;
  bigCircle: CircleData; smallCircle: CircleData;
  st: { p1: Point; p2: Point } | null;
  chord: { p1: Point; p2: Point } | null;
  A: Point | null; B: Point | null;
  angleASP?: number; angleBTP?: number; angleATP?: number; angleBSP?: number;
  anglePST?: number; anglePBT?: number; angleBPT?: number;
  angleSTP?: number; angleSPA?: number; angleABT?: number; angleABS?: number;
};
type Core = {
  VIEW: { width: number; height: number };
  MARGIN: number;
  start(options?: Json): Json;
  inside(p: Point, options?: Json): Point;
  withPoint(state: Json, name: string, p: Point): Json;
  withToggle(state: Json, name: string, value: boolean): Json;
  compute(state: Json): Drawing;
  drawn(d: Drawing): boolean;
  pictured(d: Drawing): boolean;
  angleGap(d: Drawing): number;
  angle(v: Point, p: Point, q: Point): number;
  dist(p: Point, q: Point): number;
};

const core = (): Core =>
  cores["equal-angles-in-two-circles"].EqualAnglesInTwoCirclesCore as unknown as Core;

const EPS = 1e-7;       // rad: how close the two marked angles must be to call them equal
const ANGLE_EPS = 1e-6; // rad: tolerance on the proof's 180° sums

const r4 = (v: number): number => Number(v.toFixed(4));
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const sig = (v: number | undefined | null): number | null =>
  finite(v) ? Number(v.toExponential(2)) : null;
const deg = (v: number | undefined): number | null =>
  finite(v) ? r4((v * 180) / Math.PI) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && finite(p.x) && finite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;
const circleOf = (c: CircleData | null | undefined) =>
  c && finite(c.x) && finite(c.y) && finite(c.r)
    ? { center: pt(c), radius: r4(c.r) }
    : null;

/** Accept the page's saved { x, y } dots and the tutor's [x, y] arguments alike. */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Optional boolean switch, defaulting to the page's opening setting. */
function readBool(args: Json, key: string, dflt: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return dflt;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** Start from the applet's opening picture and apply any supplied drags/toggles. */
function buildState(args: Json, C: Core): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of points and toggles");
  }
  let s = C.start({}) as State;
  for (const name of ["S", "T", "RB", "RS"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      // withPoint clamps like a real drag, keeping the whole handle on the board.
      s = C.withPoint(s, name, readPoint(args[name], name)) as State;
    }
  }
  for (const name of ["names", "statement", "hint", "extra"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.withToggle(s, name, readBool(args, name, false)) as State;
    }
  }
  return s;
}

/** One marked pair, in degrees, with its residual gap in radians. */
function pair(label: string, first?: number, second?: number) {
  const both = finite(first) && finite(second);
  return {
    label,
    firstDegrees: deg(first), secondDegrees: deg(second),
    differenceRad: both ? sig(Math.abs((first as number) - (second as number))) : null,
    equal: both && Math.abs((first as number) - (second as number)) < EPS,
  };
}

/** A 180° angle sum used in the proof. */
function straight(label: string, a?: number, b?: number, c?: number) {
  const ok = finite(a) && finite(b) && finite(c);
  const total = ok ? (a as number) + (b as number) + (c as number) : NaN;
  return {
    label,
    partsDegrees: [deg(a), deg(b), deg(c)],
    totalDegrees: deg(total),
    is180: ok && Math.abs(total - Math.PI) < ANGLE_EPS,
  };
}

const supplementary = (a?: number, b?: number): boolean =>
  finite(a) && finite(b) && Math.abs((a as number) + (b as number) - Math.PI) < ANGLE_EPS;

/** Everything the core can say about one set of four draggable dots. */
function reading(C: Core, s: State) {
  const d = C.compute(s);
  const good = C.drawn(d);
  const gap = C.angleGap(d);
  const distance = good ? C.dist(d.bigCircle, d.P) : NaN;
  return {
    handles: { S: pt(s.S), T: pt(s.T), RB: pt(s.RB), RS: pt(s.RS) },
    toggles: {
      names: s.names === true, statement: s.statement === true,
      hint: s.hint === true, extra: s.extra === true,
    },
    drawing: {
      valid: d.valid === true, stale: d.stale === true, drawn: good,
      closeST: d.close === true, pictured: C.pictured(d),
    },
    circles: {
      viaRB: circleOf(d.viaRB), viaRS: circleOf(d.viaRS),
      big: circleOf(d.bigCircle), small: circleOf(d.smallCircle),
      bigCircleMadeBy: d.RB.x === s.RB.x && d.RB.y === s.RB.y ? "RB" : "RS",
    },
    tangentChord: {
      line: [pt(d.chord?.p1), pt(d.chord?.p2)],
      P: pt(d.P), A: pt(d.A), B: pt(d.B),
      stLine: [pt(d.st?.p1), pt(d.st?.p2)],
    },
    pPosition: {
      distanceToBigCentre: finite(distance) ? r4(distance) : null,
      bigRadius: good ? r4(d.bigCircle.r) : null,
      insideBigCircle: good ? distance < d.bigCircle.r : null,
      onSmallCircle: good ? Math.abs(C.dist(d.smallCircle, d.P) - d.smallCircle.r) < 1e-6 : null,
    },
    angles: {
      main: pair("∠ASP = ∠BTP", d.angleASP, d.angleBTP),
      second: pair("∠ATP = ∠BSP", d.angleATP, d.angleBSP),
      maxGapRad: sig(gap),
      bothEqual: good && gap < EPS,
      supplementary: {
        main: supplementary(d.angleASP, d.angleBTP),
        second: supplementary(d.angleATP, d.angleBSP),
      },
    },
    proof: {
      tangentChordSteps: {
        PSTequalsBPT: pair("∠PST = ∠BPT", d.anglePST, d.angleBPT),
        STPequalsSPA: pair("∠STP = ∠SPA", d.angleSTP, d.angleSPA),
      },
      angleSums: {
        cyclicABTS: straight("∠ASP + ∠PST + ∠ABT", d.angleASP, d.anglePST, d.angleABT),
        triangleBPT: straight("∠PBT + ∠BPT + ∠BTP", d.anglePBT, d.angleBPT, d.angleBTP),
      },
      sameArc: good && d.A && d.B
        ? pair("∠ASB = ∠ATB", C.angle(d.S, d.A, d.B), C.angle(d.T, d.A, d.B))
        : null,
    },
  };
}

const PROOF_NOTE =
  "Proof: the tangent–chord angle gives ∠PST = ∠BPT and ∠STP = ∠SPA; ABTS is cyclic so ∠ASP + ∠PST + ∠ABT = 180°, while triangle BPT gives ∠PBT + ∠BPT + ∠BTP = 180°, and subtracting yields ∠ASP = ∠BTP; splitting the equal inscribed angles ∠ASB = ∠ATB at P leaves ∠ATP = ∠BSP.";

const CAVEAT_NOTE =
  "The claim needs P on the inner circle and inside the outer one: outside, the two marked angles become supplementary (they add to 180°) instead of equal.";

const SIBLING_NOTE =
  "This is not the sibling Equal Angles In Crossed Circles (a chord cuts the other circle at P and Q; it claims ∠ASP = ∠BTQ and ∠ATP = ∠BSQ) nor Equal Chords in Crossing Circles (two lines through one crossing; it claims AB = CD).";

/** A clean integer configuration where P sits outside the outer circle. */
const OUTSIDE = {
  S: [150, 280], T: [250, 280], RB: [80, 320], RS: [100, 160],
};

export function actions(): GameActions {
  return {
    equal_angles: {
      describe:
        "For the four draggable dots S, T (the crossings) and RB, RS (each defines a circle through S and T; the larger-radius one is the outer circle), run the applet's Compute() with the real core. Each dot is [x, y] or { x, y } on the page's 400 by 400 board and may be omitted for the opening picture; optional booleans names, statement, hint and extra mirror the page's buttons. Report the tangent chord at P = the smaller-circle handle, its ends A and B on the outer circle, both angle pairs ∠ASP = ∠BTP and ∠ATP = ∠BSP in degrees with their gaps, the tangent–chord steps and the proof's 180° angle sums, and whether P is inside the outer circle as the claim requires. Out-of-board dots are clamped just as a drag clamps them.",
      args: '{ "S": [100, 320], "T": [300, 320], "RB": [133, 200], "RS": [222.2222, 200], "statement": true, "hint": true }',
      run: (args) => {
        const C = core();
        const s = buildState(args, C);
        const r = reading(C, s);
        return {
          ...r,
          note: r.drawing.stale
            ? `S and T are less than one unit apart, so the applet keeps the tangent at T as its line ST rather than stopping; there is no fresh chord to measure. ${SIBLING_NOTE}`
            : !r.drawing.drawn
              ? "The tangent at P does not cut the outer circle twice here (for instance when the three points defining a circle are collinear), so there is no new picture: the applet keeps its last drawing. " + CAVEAT_NOTE + " " + SIBLING_NOTE
              : r.drawing.pictured && r.angles.bothEqual
                ? `P is on the inner circle and inside the outer one, so both angle pairs agree to ${r.angles.maxGapRad} rad, as the page claims. ${PROOF_NOTE} ${SIBLING_NOTE}`
                : `P is ${r.pPosition.insideBigCircle ? "inside" : "outside"} the outer circle (distance ${r.pPosition.distanceToBigCentre} against radius ${r.pPosition.bigRadius}), and the marked pairs differ by up to ${r.angles.maxGapRad} rad${r.angles.supplementary.main ? " with ∠ASP + ∠BTP = 180°" : ""}; the page's equality is about the inside picture. ${CAVEAT_NOTE} ${PROOF_NOTE} ${SIBLING_NOTE}`,
        };
      },
    },

    outside_circle: {
      describe:
        "Show why the page's two equalities need P inside the other circle: measure the opening picture alongside a configuration (found by the port's logic test) with P outside the outer circle, where each marked pair adds to 180° instead of being equal, using the real core for both. Pass S, T, RB, RS ([x, y] or { x, y }) to measure your own four dots instead; the default outside dots are S=[150,280], T=[250,280], RB=[80,320], RS=[100,160]. Reports both angle pairs in degrees, their gaps and 180° sums for the two pictures, plus the tangent–chord and cyclic-quadrilateral steps of the proof.",
      args: '{ "S": [150, 280], "T": [250, 280], "RB": [80, 320], "RS": [100, 160] }',
      run: (args) => {
        const C = core();
        const custom = ["S", "T", "RB", "RS"].some(
          (k) => args[k] !== undefined && args[k] !== null,
        );
        const outsideState = custom
          ? buildState(args, C)
          : buildState(OUTSIDE as unknown as Json, C);
        const opening = reading(C, C.start({}) as State);
        const outside = reading(C, outsideState);
        const sumDegrees = (first: number | null, second: number | null): number | null =>
          first === null || second === null ? null : r4(first + second);
        return {
          source: custom ? "the four supplied dots" : "a P-outside configuration from the port's logic test",
          opening,
          outside,
          comparison: {
            openingPictured: opening.drawing.pictured,
            openingGapRad: opening.angles.maxGapRad,
            openingEqual: opening.angles.bothEqual,
            outsidePictured: outside.drawing.pictured,
            outsideGapRad: outside.angles.maxGapRad,
            outsideEqual: outside.angles.bothEqual,
            outsideSumMainDegrees: sumDegrees(
              outside.angles.main.firstDegrees, outside.angles.main.secondDegrees,
            ),
            outsideSumSecondDegrees: sumDegrees(
              outside.angles.second.firstDegrees, outside.angles.second.secondDegrees,
            ),
          },
          note:
            `At the opening picture P is inside the outer circle and both pairs match to ${opening.angles.maxGapRad} rad. ` +
            `Outside, ∠ASP + ∠BTP = ${outside.angles.main.firstDegrees}° + ${outside.angles.main.secondDegrees}° and ` +
            `∠ATP + ∠BSP = ${outside.angles.second.firstDegrees}° + ${outside.angles.second.secondDegrees}° — supplementary, not equal ` +
            `(largest gap ${outside.angles.maxGapRad} rad). ${CAVEAT_NOTE} ${PROOF_NOTE} ${SIBLING_NOTE}`,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of that diagram. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equal Angles In Two Circles state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  const home = C.start({}) as State;
  const read = (key: "S" | "T" | "RB" | "RS"): Point => {
    const raw = src[key];
    return raw === undefined || raw === null
      ? { ...home[key] }
      : C.withPoint(home, key, readPoint(raw, key))[key] as Point;
  };
  const s: State = {
    S: read("S"), T: read("T"), RB: read("RB"), RS: read("RS"),
    names: readBool({ names: src.names }, "names", home.names),
    statement: readBool({ statement: src.statement }, "statement", home.statement),
    hint: readBool({ hint: src.hint }, "hint", home.hint),
    extra: readBool({ extra: src.extra }, "extra", home.extra),
  };
  const r = reading(C, s);
  return {
    ...src,
    stateVersion,
    saved: {
      S: pt(s.S), T: pt(s.T), RB: pt(s.RB), RS: pt(s.RS),
      names: s.names, statement: s.statement, hint: s.hint, extra: s.extra,
    },
    core: r,
    equalitiesHold: r.angles.bothEqual && r.drawing.pictured === true,
    note: r.drawing.stale
      ? "Track.state saved the four draggable dots and four buttons; S and T are now less than one unit apart, so the applet keeps its old line ST. This is an illustration with no win or loss."
      : !r.drawing.drawn
        ? "Track.state saved the four draggable dots and four buttons; at this position the tangent at P does not cut the outer circle twice, so no angles are drawn. This is an illustration with no win or loss."
        : `Track.state saved the four draggable dots and four buttons. The core rebuilds both circumcircles, the tangent chord and its ends A, B, and the marked angles: ${r.angles.bothEqual ? `both pairs match to ${r.angles.maxGapRad} rad` : `the angle gap is ${r.angles.maxGapRad} rad`}, with P ${r.drawing.pictured ? "inside" : "outside"} the outer circle. ${CAVEAT_NOTE} ${SIBLING_NOTE}`,
  };
}
