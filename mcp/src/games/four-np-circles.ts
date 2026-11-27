/*
 * run_game_logic actions and saved-position reader for Four 9-Point Circles.
 *
 * The real core is four-np-circles/four-np-circles-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units of the applet's 400 x 300 view, y down. Four
 * draggable corners A, B, C, D give four triangles (BCD, CDA, DAB, ABC). For
 * each triangle the core draws the nine-point circle (centre halfway between
 * the circumcentre and the orthocentre, radius taken as the mean distance to
 * the three side midpoints) and the pedal circle of the missing corner (the
 * circle through the three perpendicular feet). All eight circles go through
 * one point M, even for a quadrilateral that is not cyclic.
 *
 * When the missing corner lies on that triangle's circumcircle the three feet
 * are collinear, its pedal circle has no finite centre, and it becomes a
 * Simson line; for a cyclic quadrilateral all four do, and M lies on all four
 * lines. This is an illustration: there is no win or loss. See _shared.ts for
 * the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number; feet?: Point[] };
type Common = {
  x: number; y: number; error: number; errorRelative: number; reliable: boolean;
};
type Diagram = {
  triangles: Point[][]; nine: Circle[]; pedal: Circle[]; mids: Point[]; common: Common;
};
type State = {
  A: Point; B: Point; C: Point; D: Point; width: number; height: number;
  showNineCenters: boolean; showNineCircles: boolean; showMidpoints: boolean;
  showCenterQuad: boolean; showPedalCircles: boolean; showPedalPoints: boolean;
  which: number;
};
interface Core {
  VIEW: { width: number; height: number };
  TOL: number;
  NAMES: string[];
  INDEX: number[][];
  OPTIONS: string[];
  start(options?: Json): State;
  compute(state: State): Diagram;
  withPoint(state: State, name: string, p: Point): State;
  withOption(state: State, name: string, value: boolean): State;
  circumcenter(a: Point, b: Point, c: Point): Point;
  dist(p: Point, q: Point): number;
  finite(p: Point | null | undefined): boolean;
  finiteCircle(c: Circle | null | undefined): boolean;
}

const core = (): Core =>
  cores["four-np-circles"].FourNpCirclesCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const maybe = (v: number | null | undefined, digits = 9): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v, digits) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) } : null;
const sig = (v: number | null | undefined): string =>
  typeof v === "number" && Number.isFinite(v)
    ? v !== 0 && Math.abs(v) < 1e-4 ? v.toExponential(2) : String(round(v, 9))
    : "undefined";

/** A board point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string): Point {
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y`);
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

/**
 * A real core state. Supplied corners are applied through withPoint, so they
 * are clamped to the board exactly as a page drag does; omitted corners keep
 * the applet's opening quadrilateral. Flags may be top-level or nested under
 * "flags", as in the page's Track.state payload.
 */
function readState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C, D points and display options");
  }
  let s = C.start({
    width: readNumber(args, "width", C.VIEW.width, 100, 2000),
    height: readNumber(args, "height", C.VIEW.height, 100, 2000),
  });
  for (const name of C.NAMES) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) s = C.withPoint(s, name, readPoint(raw, name));
  }
  const flagSrc: Json = args.flags && typeof args.flags === "object" && !Array.isArray(args.flags)
    ? args.flags as Json : args;
  for (const key of C.OPTIONS) {
    const v = flagSrc[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
    s = C.withOption(s, key, v);
  }
  if (args.which !== undefined && args.which !== null) {
    const n = Number(args.which);
    if (!Number.isInteger(n) || n < -1 || n > 4) {
      throw new Error('argument "which" must be an integer from -1 (none) to 4');
    }
    s = { ...s, which: n };
  }
  return s;
}

const triangleName = (C: Core, indices: number[]): string =>
  indices.map((i) => C.NAMES[i]).join("");

/** Largest side or diagonal: the scale used for relative geometric errors. */
function scaleOf(C: Core, s: State): number {
  const p: Point[] = [s.A, s.B, s.C, s.D];
  let m = 1;
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) m = Math.max(m, C.dist(p[i], p[j]));
  }
  return m;
}

/** Perpendicular distance from p to line ab, using the core's lengths. */
function lineDistance(C: Core, p: Point, a: Point, b: Point): number | null {
  if (!C.finite(p) || !C.finite(a) || !C.finite(b)) return null;
  const len = C.dist(a, b);
  if (!(len > 1e-9)) return null;
  return Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / len;
}

/** The core's eight circles and its best common point, with each residual. */
function circleReading(C: Core, s: State, d: Diagram) {
  const tol = 1e-6 * scaleOf(C, s);
  const miss = (c: Circle): number | null =>
    C.finiteCircle(c) && C.finite(d.common) ? maybe(C.dist(d.common, c) - c.r) : null;
  const circles = d.triangles.map((t, i) => {
    const nine = d.nine[i], pedal = d.pedal[i];
    return {
      omittedCorner: C.NAMES[i],
      triangle: triangleName(C, C.INDEX[i]),
      vertices: t.map(pt),
      nine: {
        center: pt(nine), radius: maybe(nine.r), finite: C.finiteCircle(nine),
        missFromCommon: miss(nine),
      },
      pedal: {
        center: pt(pedal), radius: maybe(pedal.r), finite: C.finiteCircle(pedal),
        feet: (pedal.feet || []).map(pt), missFromCommon: miss(pedal),
      },
    };
  });
  /* The core's own error is the max |distance to circumference| over its
     finite circles; use it before rounding, or a 1e-14 gap becomes 0. */
  const maxMiss = d.common.error;
  const count = d.nine.filter(C.finiteCircle).length + d.pedal.filter(C.finiteCircle).length;
  return {
    board: { width: s.width, height: s.height },
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D) },
    circles,
    midpoints: {
      AB: pt(d.mids[0]), BC: pt(d.mids[1]), CD: pt(d.mids[2]),
      DA: pt(d.mids[3]), AC: pt(d.mids[4]), BD: pt(d.mids[5]),
    },
    common: {
      point: pt(d.common), error: maybe(d.common.error),
      errorRelative: maybe(d.common.errorRelative),
      errorText: sig(d.common.error), errorRelativeText: sig(d.common.errorRelative),
      maxMiss: maybe(maxMiss), maxMissText: sig(maxMiss),
      tolerance: C.TOL, scaleTolerance: round(tol, 9),
      reliable: d.common.reliable === true,
    },
    finiteCircleCount: count,
    concurrenceHolds: d.common.reliable === true && Number.isFinite(maxMiss) && maxMiss <= tol,
    highlight: s.which >= 0 && s.which < 4 ? triangleName(C, C.INDEX[s.which]) : null,
  };
}

/** Core circumcentres and feet decide which pedal circles flatten to lines. */
function simsonReading(C: Core, s: State, d: Diagram) {
  const tol = 1e-6 * scaleOf(C, s);
  const corners: Point[] = [s.A, s.B, s.C, s.D];
  const O = C.circumcenter(s.A, s.B, s.C);
  const R = C.dist(O, s.A), dD = C.dist(O, s.D);
  const cases = d.triangles.map((t, i) => {
    const o = C.circumcenter(t[0], t[1], t[2]);
    const r = C.dist(o, t[0]), dp = C.dist(o, corners[i]);
    const onCircumcircle = C.finite(o) && Number.isFinite(r) && Math.abs(dp - r) <= tol;
    const pedal = d.pedal[i];
    const feet = pedal.feet || [];
    const footError = feet.length === 3 ? lineDistance(C, feet[0], feet[1], feet[2]) : null;
    const commonError = feet.length === 3
      ? lineDistance(C, d.common, feet[0], feet[1]) : null;
    return {
      omittedCorner: C.NAMES[i],
      triangle: triangleName(C, C.INDEX[i]),
      circumcenter: pt(o), radius: maybe(r),
      remainingCornerDistance: maybe(dp), distanceDifference: maybe(dp - r),
      remainingCornerOnCircumcircle: onCircumcircle,
      pedalCircleDegenerate: !C.finiteCircle(pedal),
      feet: feet.map(pt),
      feetCollinearityError: maybe(footError),
      commonPointToLine: maybe(commonError),
      simsonLine: onCircumcircle && footError !== null && footError <= tol,
      commonOnLine: onCircumcircle && commonError !== null && commonError <= tol,
    };
  });
  return {
    quadrilateralCyclic: C.finite(O) && Number.isFinite(R) && Math.abs(dD - R) <= tol,
    tolerance: round(tol, 9),
    ABCcircumcircle: {
      center: pt(O), radius: maybe(R), Ddistance: maybe(dD), difference: maybe(dD - R),
    },
    cases,
    degeneratePedalCount: cases.filter((c) => c.pedalCircleDegenerate).length,
    allSimsonLinesThroughCommon: cases.every((c) => c.commonOnLine),
  };
}

const EXAMPLE_ARGS =
  '{"A":[290.6,200],"B":[113.4,200],"C":[118.8,56.6],"D":[250,63.4],"showNineCircles":true,"showPedalCircles":true}';
const CYCLIC_ARGS = '{"A":[50,50],"B":[350,50],"C":[350,250],"D":[50,250]}';

export function actions(): GameActions {
  return {
    eight_circles: {
      describe:
        "For a quadrilateral with corners A, B, C, D (each [x, y] or { x, y } on the page's 400 x 300 board, y down; omit any to keep the opening figure), run the real core and report the four triangles BCD, CDA, DAB and ABC, each triangle's nine-point circle, the pedal circle of the missing corner with its three feet, and the six midpoints. The core intersects circles to locate the point M common to all eight and measures the largest gap from M to any circle; the six checkbox flags and the highlight index only change what the page draws. Points outside the board are clamped as a drag would clamp them.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const r = circleReading(C, s, C.compute(s));
        const m = r.common.point;
        return {
          ...r,
          flags: {
            showNineCenters: s.showNineCenters, showNineCircles: s.showNineCircles,
            showMidpoints: s.showMidpoints, showCenterQuad: s.showCenterQuad,
            showPedalCircles: s.showPedalCircles, showPedalPoints: s.showPedalPoints,
            which: s.which,
          },
          note: r.concurrenceHolds && m
            ? `The core finds M near (${m.x}, ${m.y}). Its largest gap from any of the ${r.finiteCircleCount} finite circles is ${r.common.maxMissText} board units (relative ${r.common.errorRelativeText}, tolerance ${r.common.tolerance}), so the four nine-point circles and the four pedal circles do pass through M. ` +
              (r.finiteCircleCount < 8
                ? "At least one pedal circle has flattened into a Simson line here, so the core counts fewer than eight circles; use cyclic_simson_lines to inspect those cases. "
                : "") +
              "This is an illustration, so there is no win or loss."
            : `The core could not confirm a common point here (reliable ${r.common.reliable}, largest gap ${r.common.maxMissText} board units). Move the four corners farther apart so the altitudes and circumcentres are well defined, then try again.`,
        };
      },
    },

    cyclic_simson_lines: {
      describe:
        "For the same four corners A, B, C, D (each [x, y] or { x, y } in board units; omit any for the opening figure), use the real core's circumcentres and perpendicular feet to test when a pedal circle disappears into a Simson line. It reports whether ABCD is cyclic, whether each missing corner lies on its triangle's circumcircle, whether that pedal circle has a finite centre, how collinear the three feet are, and how far M is from the resulting Simson line. The example is a rectangle: all four corners lie on one circle, all four pedal circles degenerate, and M lies on all four Simson lines.",
      args: CYCLIC_ARGS,
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const d = C.compute(s);
        const simson = simsonReading(C, s, d);
        const r = circleReading(C, s, d);
        const m = r.common.point;
        return {
          ...simson,
          common: r.common,
          note: simson.quadrilateralCyclic
            ? `The core's circumcircle of ABC has centre (${simson.ABCcircumcircle.center!.x}, ${simson.ABCcircumcircle.center!.y}) and radius ${simson.ABCcircumcircle.radius}; D is ${simson.ABCcircumcircle.difference} units from it, so ABCD is cyclic. The missing corner of every triangle lies on that triangle's circumcircle, so its three perpendicular feet line up and the core reports no pedal circle (${simson.degeneratePedalCount} of 4). The common point of the nine-point circles lies on all four Simson lines: ${simson.allSimsonLinesThroughCommon}. This is an illustration, so there is no win or loss.`
            : `ABCD is not cyclic here (${simson.ABCcircumcircle.difference === null
              ? "the circumcircle of ABC is undefined for these collinear corners"
              : `D is ${simson.ABCcircumcircle.difference} units off the circumcircle of ABC`}), so the Simson-line case is not expected. ` +
              (m
                ? `The core finds ${r.finiteCircleCount} finite circles through M near (${m.x}, ${m.y}); see cases for each triangle's circumcircle test and foot collinearity.`
                : "The core could not locate M: move the corners apart so the triangles have proper circumcentres. ") +
              "This is an illustration, so there is no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of that figure. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Four 9-Point Circles state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four 9-Point Circles position must be an object");
  }
  const C = core();
  let savedReadable = true;
  let s: State;
  try {
    s = readState(C, state);
  } catch {
    savedReadable = false;
    s = C.start({});
  }
  const d = C.compute(s);
  const reading = circleReading(C, s, d);
  const simson = simsonReading(C, s, d);
  return {
    ...state,
    stateVersion,
    savedReadable,
    saved: {
      A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D),
      width: s.width, height: s.height,
      showNineCenters: s.showNineCenters, showNineCircles: s.showNineCircles,
      showMidpoints: s.showMidpoints, showCenterQuad: s.showCenterQuad,
      showPedalCircles: s.showPedalCircles, showPedalPoints: s.showPedalPoints,
      which: s.which,
    },
    core: reading,
    simson: {
      quadrilateralCyclic: simson.quadrilateralCyclic,
      degeneratePedalCount: simson.degeneratePedalCount,
      allSimsonLinesThroughCommon: simson.allSimsonLinesThroughCommon,
    },
    note: !savedReadable
      ? "The saved fields could not be read as four board corners and options, so the core's opening quadrilateral was rebuilt; the reading below is of that figure."
      : "Track.state saved the four corners A-D in board units, the 400 x 300 board size, the six checkbox flags and the highlight index. The core rebuilds the four triangles, their nine-point circles, the four pedal circles of the missing corners and the common point M; " +
        (reading.concurrenceHolds
          ? `the largest gap from M to any finite circle is ${reading.common.maxMissText} board units (relative ${reading.common.errorRelativeText}), confirming the concurrence. `
          : `the core could not confirm concurrence here (largest gap ${reading.common.maxMissText}); move a corner if the circles look unclear. `) +
        (simson.quadrilateralCyclic
          ? `ABCD is cyclic and all ${simson.degeneratePedalCount} pedal circles flatten into Simson lines through M. `
          : "ABCD is not cyclic, so the pedal circles are genuine circles. ") +
        "This is an illustration: there is no win or loss.",
  };
}
