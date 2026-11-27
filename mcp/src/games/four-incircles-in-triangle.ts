/*
 * run_game_logic actions and saved-position reader for Four Incircles in a Triangle.
 *
 * The real core is four-incircles-in-triangle/four-incircles-in-triangle-core.js,
 * copied into src/generated/cores/ at build time; every number below is measured
 * by it. Board units are the page's 400 x 250 SVG viewBox, y down. The only free
 * input is T on the circle through A and B whose centre is one circumradius
 * below the centre of the equilateral triangle; the core rotates the three side
 * rays by angle TAB to build the equilateral A'B'C' and its four incircles.
 *
 * An equilateral triangle of side s has inradius s√3/6. Adding the four triangle
 * areas gives 6·AB·A'B' + 4(A'B')² − 3(AB)² = 0, whose positive root is
 * A'B'/AB = (√21 − 3)/4 ≈ 0.3956439. The applet's top line prints
 * √3/(3 + √21) ≈ 0.228425, smaller by a factor of √3; Zettler's proof further
 * down that page has the correct root. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { center: Pt; radius: number };
type State = {
  width: number; height: number; center: Pt; radius: number;
  glider: { center: Pt; radius: number };
  A: Pt; B: Pt; C: Pt; T: Pt; angle: number; showNames: boolean;
};
type Diagram = {
  A: Pt; B: Pt; C: Pt; Ap: Pt; Bp: Pt; Cp: Pt; T: Pt;
  circleA: Circle; circleB: Circle; circleC: Circle; circleM: Circle;
  rA: number; rB: number; rC: number; rM: number;
  side: number; outerSide: number; theta: number; finished: boolean;
  cevians: { p: Pt; q: Pt }[];
  parallels: { p: Pt; q: Pt }[];
  bounds: Json;
};
type Core = {
  WIDTH: number; HEIGHT: number; START_ANGLE: number; FINISH_TOLERANCE: number;
  ARC_START: number; ARC_END: number;
  start(options?: Json): State;
  moveT(s: State, p: Pt): State;
  compute(s: State): Diagram | null;
  solve(options?: Json): number;
  position(s: State): Json;
  distance(p: Pt, q: Pt): number;
};

const core = (): Core =>
  cores["four-incircles-in-triangle"].FourIncirclesInTriangleCore as unknown as Core;

const EXACT_RATIO = (Math.sqrt(21) - 3) / 4;
const MISPRINT_RATIO = Math.sqrt(3) / (3 + Math.sqrt(21));

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
/** Keep a near-zero residual's sign and size instead of printing 0. */
const sig = (v: number): number =>
  !Number.isFinite(v) ? NaN
    : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toExponential(2))
      : round(v, 9);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const close = (a: number, b: number, scale = 1): boolean =>
  Math.abs(a - b) <= 1e-7 * Math.max(1, scale);

/** Read a point from the tutor's [x, y] or the page's { x, y }. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(v)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

function readNumber(args: Json, key: string, fallback: number, min: number, max: number): number {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`argument "${key}" must be a finite number`);
  if (n < min || n > max) throw new Error(`argument "${key}" must be between ${min} and ${max}`);
  return n;
}

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** A finite value, with a flag saying whether the page actually saved it. */
function readFinite(v: unknown, fallback: number): [number, boolean] {
  if (v === undefined || v === null) return [fallback, false];
  const n = Number(v);
  return Number.isFinite(n) ? [n, true] : [fallback, false];
}

function boardOptions(C: Core, args: Json): { width: number; height: number; showNames: boolean } {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with optional width, height, showNames, angle and T");
  }
  return {
    width: readNumber(args, "width", C.WIDTH, 50, 5000),
    height: readNumber(args, "height", C.HEIGHT, 50, 5000),
    showNames: readBool(args, "showNames", false),
  };
}

/** The arc ends are where the construction degenerates and where compute() bails out. */
function readAngle(C: Core, args: Json, fallback: number): number {
  const v = args.angle;
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error('argument "angle" must be a finite number of radians');
  if (n <= C.ARC_START || n >= C.ARC_END) {
    throw new Error(
      `argument "angle" must lie strictly between the arc ends ${round(C.ARC_START, 6)} and ` +
      `${round(C.ARC_END, 6)} radians (30 and 150 degrees); the core stops drawing below A ` +
      "and the circles degenerate at the ends",
    );
  }
  return n;
}

/** A real core state: optional board, then an angle or a drag of T, as on the page. */
function buildState(C: Core, args: Json): State {
  const o = boardOptions(C, args);
  const angle = readAngle(C, args, C.START_ANGLE);
  if (args.T !== undefined && args.T !== null) {
    // A drag projects onto the sliding circle and sets the angle, like the page's handle.
    return C.moveT(C.start(o), readPoint(args.T, "T"));
  }
  return C.start({ ...o, angle });
}

function diagramOf(C: Core, s: State): Diagram {
  const g = C.compute(s);
  if (!g) {
    throw new Error(
      "T is below A, where the applet leaves the last picture on the canvas; " +
      "choose an angle between 30 and 150 degrees or a T on the upper arc.",
    );
  }
  return g;
}

/** Every measurement, taken from the real core at one position of T. */
function measure(C: Core, s: State, g: Diagram) {
  const radii = [g.rA, g.rB, g.rC];
  const l = g.side, x = g.outerSide;
  const ratio = l / x;
  const inradiusFromSide = (l * Math.sqrt(3)) / 6;
  const degrees = (r: number): number => round((r * 180) / Math.PI, 3);
  return {
    board: { width: s.width, height: s.height },
    T: pt(s.T),
    angle: round(s.angle, 9), angleDegrees: degrees(s.angle),
    theta: round(g.theta, 9), thetaDegrees: degrees(g.theta),
    slidingCircle: { center: pt(s.glider.center), radius: round(s.radius) },
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    innerTriangle: { Ap: pt(g.Ap), Bp: pt(g.Bp), Cp: pt(g.Cp) },
    circles: {
      atA: { center: pt(g.circleA.center), radius: round(g.rA) },
      atB: { center: pt(g.circleB.center), radius: round(g.rB) },
      atC: { center: pt(g.circleC.center), radius: round(g.rC) },
      middle: { center: pt(g.circleM.center), radius: round(g.rM) },
    },
    radii: {
      rA: round(g.rA), rB: round(g.rB), rC: round(g.rC), rM: round(g.rM),
      middleMinusCorner: sig(g.rM - g.rA),
      cornerSpread: sig(Math.max(...radii) - Math.min(...radii)),
      allFourWithinTolerance:
        radii.every((r) => Math.abs(g.rM - r) < C.FINISH_TOLERANCE),
    },
    appletFinished: g.finished, tolerance: C.FINISH_TOLERANCE,
    middleIsIncircle: {
      statement: "r(middle) = A'B'·√3/6",
      fromSide: round(inradiusFromSide), fromCore: round(g.rM),
      residual: sig(inradiusFromSide - g.rM),
      holds: close(inradiusFromSide, g.rM, Math.max(1, g.rM)),
    },
    side: {
      statement: "A'B'/AB = (√21 − 3)/4 at the match",
      inner: round(l), outer: round(x), ratio: round(ratio, 9),
      exact: round(EXACT_RATIO, 9),
      misprintedAppletLine: round(MISPRINT_RATIO, 9),
      residualVsExact: sig(ratio - EXACT_RATIO),
      /** Equals √3 only at the match; at other positions the ratio is smaller. */
      ratioOverMisprint: round(ratio / MISPRINT_RATIO, 9),
      quadratic: "6·AB·A'B' + 4(A'B')² − 3(AB)² = 0",
      quadraticResidual: sig(6 * x * l + 4 * l * l - 3 * x * x),
    },
  };
}

export function actions(): GameActions {
  return {
    sangaku_answer: {
      describe:
        "Find where all four incircles match by running the core's solve() and compute(): an equilateral triangle of side s has inradius s√3/6, so 6·AB·A'B' + 4(A'B')² − 3(AB)² = 0 gives A'B'/AB = (√21 − 3)/4 ≈ 0.3956439, while the applet's top line √3/(3 + √21) ≈ 0.228425 is too small by √3. Optional width, height (50–5000) and showNames set the board; angle and T are refused because the action finds the match itself.",
      args: '{ "width": 400, "height": 250 }',
      run: (args) => {
        const C = core();
        const o = boardOptions(C, args);
        if (args.angle !== undefined && args.angle !== null) {
          throw new Error('sangaku_answer solves for the matching angle; do not pass "angle"');
        }
        if (args.T !== undefined && args.T !== null) {
          throw new Error('sangaku_answer solves for the matching T; do not pass "T"');
        }
        const matchAngle = C.solve({ width: o.width, height: o.height });
        const s = C.start({ ...o, angle: matchAngle });
        const g = diagramOf(C, s);
        const m = measure(C, s, g);
        return {
          ...m,
          match: {
            angle: round(matchAngle, 9),
            angleDegrees: round((matchAngle * 180) / Math.PI, 3),
            foundBy: "core.solve: bisection on the arc from A to B",
          },
          note:
            `The core finds the match at ${round((matchAngle * 180) / Math.PI, 3)} degrees, where the four radii ` +
            `are about ${m.radii.rM} and A'B'/AB = ${m.side.ratio}. An equilateral triangle of side s has ` +
            `inradius s√3/6, so adding the four areas leaves ${m.side.quadratic}, whose positive root is ` +
            `${m.side.exact}. The applet's top line √3/(3 + √21) = ${m.side.misprintedAppletLine} is smaller ` +
            `by a factor of ${m.side.ratioOverMisprint} ≈ √3; the proof further down its page agrees with the core. ` +
            "This is a drawing, so the tracker records exploration rather than a win or a loss.",
        };
      },
    },

    circle_radii: {
      describe:
        "Run the core at `angle` radians on the sliding arc (30–150 degrees, ends excluded), or drag T with `T` as [x, y] or { x, y }, and report the four incircle radii, the applet's 0.5-pixel `finished` test, angle TAB and A'B'/AB. The three corner circles stay equal as T slides, so compare their radius with the middle one; optional width, height (50–5000) and showNames set the board, and with neither angle nor T the page's starting angle is used.",
      args: '{ "angle": 1.203066475563504 }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = diagramOf(C, s);
        const m = measure(C, s, g);
        const matchAngle = C.solve({ width: s.width, height: s.height });
        return {
          ...m,
          distanceFromMatch: {
            angle: sig(s.angle - matchAngle),
            angleDegrees: sig(((s.angle - matchAngle) * 180) / Math.PI),
            matchAngle: round(matchAngle, 9),
          },
          note:
            `At ${m.angleDegrees} degrees the core gives corner radii ${m.radii.rA}, ${m.radii.rB}, ` +
            `${m.radii.rC} and middle radius ${m.radii.rM} (middle minus corner ${m.radii.middleMinusCorner}). ` +
            `The applet calls it finished when that gap is under ${C.FINISH_TOLERANCE} board units, which happens ` +
            `near ${round((matchAngle * 180) / Math.PI, 3)} degrees, where A'B'/AB = ${m.side.exact}. ` +
            "Tiny residuals are floating-point noise. This is an illustration, so there is no win or loss.",
        };
      },
    },
  };
}

/** Echo what Track.state saved, then re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Incircles in a Triangle state version ${stateVersion}`);
  }
  const C = core();
  const seed = C.start();
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : {};

  let savedReadable = true;
  let T: Pt | null = null;
  try {
    if (src.T !== undefined && src.T !== null) T = readPoint(src.T, "T");
  } catch {
    savedReadable = false;
  }
  const [angle, angleOk] = readFinite(src.angle, seed.angle);
  const [radius, radiusOk] = readFinite(src.radius, seed.radius);
  savedReadable = savedReadable && angleOk && radiusOk;

  // T is authoritative for the picture, as on the page; moveT reprojects it and
  // recovers its angle. Without a saved T, the saved angle places the point.
  const s = T ? C.moveT(C.start({ angle }), T) : C.start({ angle });
  const saved = {
    T: pt(T), angle, radius,
    showNames: src.showNames === true,
  };
  const onGlider = T === null ? null : Math.abs(C.distance(T, s.glider.center) - s.radius);

  const g = C.compute(s);
  if (!g || ![g.rA, g.rB, g.rC, g.rM, g.side, g.outerSide].every(Number.isFinite)) {
    return {
      ...state, stateVersion, savedReadable, saved,
      onGliderResidual: sig(onGlider === null ? NaN : onGlider),
      savedAngleResidual: sig(s.angle - angle),
      savedRadiusResidual: sig(radius - s.radius),
      valid: false,
      note: !savedReadable
        ? "The saved T, angle or radius could not be read, so the opening picture was rebuilt; even that position cannot be measured here."
        : "The saved T is below A, where the applet stops drawing, or the construction degenerates there, so no four incircles can be measured. Move T back onto the upper arc.",
    };
  }

  const m = measure(C, s, g);
  const matchAngle = C.solve({ width: s.width, height: s.height });
  return {
    ...state, stateVersion, savedReadable, saved,
    onGliderResidual: sig(onGlider === null ? NaN : onGlider),
    savedAngleResidual: sig(s.angle - angle),
    savedRadiusResidual: sig(radius - s.radius),
    reading: m,
    angleToMatch: sig(s.angle - matchAngle),
    matchAngle: round(matchAngle, 9),
    note:
      `Track.state saved T, its angle, the sliding circle's radius and the Show names flag, but not the circles. ` +
      `The core rebuilds them: corner radii ${m.radii.rA}, ${m.radii.rB}, ${m.radii.rC} and middle radius ` +
      `${m.radii.rM}, so the applet's finished test is ${m.appletFinished ? "true" : "false"} ` +
      `(${m.radii.middleMinusCorner} = middle minus corner, tolerance ${C.FINISH_TOLERANCE}). ` +
      `Here A'B'/AB = ${m.side.ratio} versus the sangaku match ${m.side.exact}; the match is at angle ` +
      `${round(matchAngle, 9)} radians. This is an illustration, so the tracker records exploration rather than a win or a loss.`,
  };
}
