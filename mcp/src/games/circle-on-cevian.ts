/*
 * run_game_logic actions and saved-position reader for Circle On Cevian.
 *
 * The core lives in circle-on-cevian/ and is copied into
 * src/generated/cores/ at build time. It recreates Bogomolny's drawing: a
 * circle on each cevian of a triangle as its diameter. By Thales' theorem the
 * circle meets the opposite side again at the foot of the altitude from that
 * corner, so the three altitude feet lie on their circles. The power of the
 * orthocenter H in the circle on AP_a is AH * HH_a, and the similar right
 * triangles AHH_c and CHH_a give AH * HH_a = CH * HH_c: H has equal power in
 * the circles on two different cevians and therefore lies on their radical
 * axis. With all three circles H is their radical center. Every number below
 * comes from that core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-on-cevian"].CircleOnCevianCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };
type State = { A: Point[]; P: Point[]; N: number; showNames: boolean; showHint: boolean };
type Axis = { point: Point; dir: Point };

const NAMES = ["A", "B", "C"];
const SUBS = ["a", "b", "c"];
const label = (i: number): string => `${NAMES[i]}P${SUBS[i]}`;
const PAIRS: [number, number][] = [[2, 0], [0, 1], [1, 2]];

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** JSON has no NaN: an undefined or non-finite measurement is reported as null. */
const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** Accept both [x, y] and the page's saved {x, y}. */
function point(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`${label} must be [x, y] or {x, y}`);
    x = Number(value[0]);
    y = Number(value[1]);
  } else if (value !== null && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`${label} must be [x, y] or {x, y}, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} must have finite numeric coordinates, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Each of A and P is exactly three points: corners, and feet on opposite sides. */
function points(value: unknown, label: string): Point[] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`"${label}" must be an array of exactly three points`);
  }
  return value.map((p, i) => point(p, `${label}[${i}]`));
}

function boolArg(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be a boolean`);
  return v;
}

/** Validate action/saved arguments and let the core clamp the N switch. */
function readState(C: Core, args: Json): State {
  const seed = C.start({}) as State;
  const A = args.A === undefined || args.A === null ? seed.A.map((p) => ({ ...p })) : points(args.A, "A");
  const P = args.P === undefined || args.P === null ? seed.P.map((p) => ({ ...p })) : points(args.P, "P");
  const rawN = num(args, "N", 1);
  if (!Number.isInteger(rawN) || rawN < 1 || rawN > 3) {
    throw new Error(`argument "N" must be 1, 2 or 3, got ${JSON.stringify(args.N)}`);
  }
  const N = rawN;
  const showNames = boolArg(args, "showNames", true);
  const showHint = boolArg(args, "showHint", true);
  return C.start({ points: { A, P }, N, showNames, showHint }) as State;
}

/** The longest side, used for the core's absolute-to-relative tolerances. */
function scaleOf(A: Point[]): number {
  return Math.max(
    Math.hypot(A[0].x - A[1].x, A[0].y - A[1].y),
    Math.hypot(A[1].x - A[2].x, A[1].y - A[2].y),
    Math.hypot(A[2].x - A[0].x, A[2].y - A[0].y),
  );
}

function circleView(z: Circle, i: number, s: State) {
  return {
    cevian: label(i),
    vertex: pt(s.A[i]),
    foot: pt(s.P[i]),
    center: pt(z.c),
    radius: round(z.r),
  };
}

/** All three radical axes, marked with the ones the page draws for this N. */
function axesView(C: Core, s: State, H: Point | null) {
  return PAIRS.map(([i, j]) => {
    const axis = C.radicalAxis(s, i, j) as Axis | null;
    const shown = s.N === 3 || (s.N === 2 && i === 2 && j === 0);
    return {
      circles: [label(i), label(j)],
      shown,
      axis: axis
        ? {
            point: pt(axis.point),
            dir: pt(axis.dir),
            signedDistanceH: H ? finite(C.axisDistance(H, axis)) : null,
          }
        : null,
      intersections: (C.circleIntersections(s, i, j) as Point[]).map(pt),
    };
  });
}

/** Everything the core measures at one diagram, in tutor-friendly units. */
function reading(C: Core, s: State) {
  const m = C.measurements(s) as {
    A: Point[]; P: Point[]; N: number; degenerate: boolean; doubleArea: number;
    circles: Circle[]; feet: Point[]; orthocenter: Point | null;
    powers: number[];
  };
  const claims = C.claims(s) as Record<string, boolean>;
  const H = pt(m.orthocenter);
  return {
    N: s.N,
    degenerate: m.degenerate === true,
    doubleArea: round(m.doubleArea),
    vertices: m.A.map(pt),
    cevianFeet: m.P.map(pt),
    circles: m.circles.map((z, i) => circleView(z, i, s)),
    altitudeFeet: m.feet.map(pt),
    orthocenter: H,
    powersAtH: m.powers.map(finite),
    axes: axesView(C, s, H),
    claims: {
      feetOnCircles: claims.feetOnCircles === true,
      altitudesConcurrent: claims.altitudesConcurrent === true,
      radicalThroughOrthocenter: claims.radicalThroughOrthocenter === true,
      intersectionsOnAxis: claims.intersectionsOnAxis === true,
      radicalCenter: claims.radicalCenter === true,
    },
    radicalCenterChecked: s.N === 3,
    stateIsIllustration: C.result() === null,
  };
}

export function actions(): GameActions {
  return {
    cevian_circles: {
      describe:
        "For a triangle with corners A[3] and cevian feet P[3] on the opposite sides (each [x, y] or {x, y}, y downward; omit either to keep the page's starting figure), report the three diameter circles APa, BPb, CPc with centres and radii, the altitude feet where they cut the opposite sides, the orthocenter H, the signed power of H in each circle, and every pair's radical axis with its direction, the signed distance of H from it and the circles' crossing points (shown is whether the page draws that axis for N). N is 1, 2 or 3 and showNames/showHint are the page's toggles. claims gives the core's five checks: altitude feet on their circles, altitudes concurrent through H, radical axes through H, crossings on the axis, and H as radical center for three circles.",
      args:
        '{ "A": [[69.66666666666667, 214.28571428571428], [320, 175], [190, 25]], "P": [[255, 100], [129.83333333333334, 119.64285714285714], [194.83333333333331, 194.64285714285714]], "N": 3 }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const r = reading(C, s);
        return {
          ...r,
          note: r.degenerate || !r.orthocenter
            ? "Move the corners apart to make a triangle: the core cannot find the altitudes' intersection, so there is no power or radical axis to check."
            : "The circle on each cevian cuts the opposite side at an altitude foot (Thales' theorem). Similar right triangles give equal powers of H in any two of these circles, so H lies on their radical axis; with three circles its powers all agree and H is the radical center. The radicalCenter check only applies when N is 3.",
        };
      },
    },

    check_point: {
      describe:
        "Check a proposed point H (optional, [x, y] or {x, y}) against the circles on the three cevians of A[3], P[3]: report its signed power in each circle, its signed distance from each of the three radical axes, the spread of the powers, whether all three agree, whether it lies on all three axes, and its distance from the core's orthocenter. Omit H to check the actual orthocenter; equal powers are the claim, and a point such as the centroid fails it. Arguments as in cevian_circles.",
      args:
        '{ "A": [[69.66666666666667, 214.28571428571428], [320, 175], [190, 25]], "P": [[255, 100], [129.83333333333334, 119.64285714285714], [194.83333333333331, 194.64285714285714]], "N": 3, "H": [193.22222222222223, 138.0952380952381] }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const trueH = C.orthocenter(s) as Point | null;
        const given = args.H === undefined || args.H === null ? null : point(args.H, "H");
        if (!given && !trueH) {
          throw new Error("these corners make a degenerate triangle with no orthocenter; give an H to check");
        }
        const H = given || (trueH as Point);
        const scale = scaleOf(s.A);
        const rawPowers = [0, 1, 2].map((i) => C.power(s, i, H) as number);
        const spread = rawPowers.every((p) => Number.isFinite(p))
          ? Math.max(...rawPowers) - Math.min(...rawPowers)
          : null;
        const axes = axesView(C, s, H);
        const onAxes = axes.every((a) =>
          a.axis !== null && a.axis.signedDistanceH !== null &&
          Math.abs(a.axis.signedDistanceH) <= 1e-6 * scale);
        const fromOrthocenter = trueH ? C.distance(H, trueH) as number : null;
        return {
          candidate: pt(H),
          usedCoreOrthocenter: given === null,
          orthocenter: pt(trueH),
          distanceFromOrthocenter: finite(fromOrthocenter),
          powers: rawPowers.map(finite),
          powerSpread: finite(spread),
          powerTolerance: round(1e-7 * scale * scale),
          equalPowers: spread !== null && spread <= 1e-7 * scale * scale,
          axes,
          onAllAxes: onAxes,
          note: given === null
            ? "H is the orthocenter: its powers in the three diameter circles agree (within the core's tolerance), so it lies on each radical axis and is their radical center."
            : "Equal powers put a point on a pair's radical axis. Check the powers and signed axis distances: only the orthocenter satisfies all three pairs, so any other point fails at least one of them.",
        };
      },
    },
  };
}

/** The saved picture, with the core's reading of the same figure. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circle On Cevian state version ${stateVersion}`);
  }
  const C = core();
  const s = readState(C, state);
  return {
    stateVersion,
    saved: {
      A: s.A.map(pt),
      P: s.P.map(pt),
      N: s.N,
      showNames: s.showNames,
      showHint: s.showHint,
    },
    reading: reading(C, s),
    note:
      "Track.state saves the three corners, the three cevian feet on the opposite sides and the N/names/hint switches. The reading recomputes the diameter circles, their altitude feet, the orthocenter and the radical axes with the same construction the page uses. Equal powers of H in two circles put H on their radical axis; with three cevians H is the radical center. This is an illustration, so it has no win or loss.",
  };
}
