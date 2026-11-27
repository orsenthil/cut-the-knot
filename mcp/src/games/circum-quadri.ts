/*
 * run_game_logic actions and saved-position reader for Circum Quadri.
 *
 * Four touch points A, B, C, D glide on one circle. The tangent at each one
 * meets its neighbour's tangent in a corner of a circumscribed quadrilateral:
 * P = t(A) ^ t(B), Q = t(B) ^ t(C), R = t(C) ^ t(D), S = t(D) ^ t(A).
 * The page claims that its two diagonals (our PR and QS) and the two chords
 * joining opposite touch points (our AC and BD; the page's EG and FH) all pass
 * through one point M. Its proof rests on two ratio identities:
 *
 *   page AN / CN = AE / CG      (our QS cut by chord AC),
 *   page AH / CF                (our PR cut by chord BD).
 *
 * Equal tangents from a corner (PA = PB, etc.) make the two ratios agree, so
 * each chord cuts its diagonal at the same point, and that point is where the
 * diagonals cross. This is Brianchon's theorem for four tangents. Every number
 * returned below comes from the game's real core, circum-quadri-core.js,
 * copied into src/generated/cores/ at build time. Coordinates are board units
 * in the page's 400 x 250 viewBox, with y pointing down. See _shared.ts for
 * the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circum-quadri"].CircumQuadriCore as any;

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };

const NAMES = ["A", "B", "C", "D"] as const;
const CORNERS = ["P", "Q", "R", "S"] as const;

/** JSON-safe output: finite numbers rounded, non-finite measurements as null. */
const out = (v: number, digits = 6): number | null =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : null;
const pt = (p: any): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: out(p.x) as number, y: out(p.y) as number }
    : null;
const segment = (s: any): { from: Point | null; to: Point | null } | null =>
  Array.isArray(s) && s.length === 2 ? { from: pt(s[0]), to: pt(s[1]) } : null;

/** Tool points may be [x, y] or { "x": ..., "y": ... }; saved points are objects. */
function readPoint(v: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = num({ x: v[0] }, "x", NaN);
    y = num({ y: v[1] }, "y", NaN);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = num(o, "x", NaN);
    y = num(o, "y", NaN);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

function readCircle(v: unknown, label: string): Circle {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`argument "${label}" must be { "center": { "x": ..., "y": ... }, "radius": number }`);
  }
  const o = v as Json;
  const center = readPoint(o.center, `${label}.center`);
  const radius = num(o, "radius");
  if (!(radius > 0)) throw new Error(`argument "${label}.radius" must be positive`);
  return { center, radius };
}

/**
 * Four touch points may be given as angles (`angles` in radians, or
 * `anglesDegrees` in degrees) around the circle, or as named points on it
 * (`points`: { A, B, C, D }), which are projected onto the circle as the page
 * does when a dot is dragged. With neither, the applet's opening angles are
 * used. An optional circle overrides the board's default circle.
 */
function readState(args: Json) {
  const C = core();
  if (args.angles !== undefined && args.anglesDegrees !== undefined) {
    throw new Error('give either "angles" (radians) or "anglesDegrees", not both');
  }
  let angles: number[] | undefined;
  if (args.angles !== undefined) {
    angles = numArray(args, "angles");
  } else if (args.anglesDegrees !== undefined) {
    const degrees = numArray(args, "anglesDegrees");
    angles = degrees.map((d) => d * Math.PI / 180);
  }
  if (angles && args.points !== undefined) {
    throw new Error('give either angles ("angles" or "anglesDegrees") or "points", not both');
  }
  if (angles && angles.length !== 4) {
    throw new Error(`four touch points are needed: got ${angles.length} angles`);
  }

  const options: Json = { checked: args.checked === true };
  if (args.width !== undefined) options.width = num(args, "width");
  if (args.height !== undefined) options.height = num(args, "height");
  // C.start() rebuilds the circle from its default points when no points are
  // given, so override the circle afterwards instead of passing it to start().
  let s = C.start(options);
  if (args.circle !== undefined && args.circle !== null) {
    const circle = readCircle(args.circle, "circle");
    s = { ...s, circle: { center: { ...circle.center }, radius: circle.radius } };
  }
  if (angles) {
    const points: Record<string, Point> = {};
    NAMES.forEach((n, i) => { points[n] = C.pointOnCircle(s.circle, angles![i]); });
    s = { ...s, points };
  } else if (args.points !== undefined) {
    const raw = args.points;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error('argument "points" must be an object with keys A, B, C, D');
    }
    const points: Record<string, Point> = {};
    for (const n of NAMES) points[n] = readPoint((raw as Json)[n], `points.${n}`);
    s = C.start({ ...options, circle: s.circle, points });
  }
  return s;
}

function touchPoints(state: any): Record<string, Point | null> {
  return Object.fromEntries(NAMES.map((n) => [n, pt(state.points[n])]));
}

/** The page's proof ratios, read off the core's own line intersection. */
function ratio(C: any, state: any, corner1: number, corner2: number, touch1: string, touch2: string) {
  const m = C.measurements(state);
  const v1 = m.vertices[corner1], v2 = m.vertices[corner2];
  const p1 = state.points[touch1], p2 = state.points[touch2];
  const cut = C.intersectPoints(v1, v2, p1, p2);
  if (!pt(cut)) return { cut: null, diagonalRatio: null, tangentRatio: null };
  return {
    cut: pt(cut),
    diagonalRatio: out(C.distance(v1, cut) / C.distance(v2, cut), 9),
    tangentRatio: out(C.distance(v1, p1) / C.distance(v2, p2), 9),
  };
}

function geometry(state: any) {
  const C = core();
  const m = C.measurements(state);
  const corners: Record<string, Point | null> = {};
  m.vertices.forEach((v: any, i: number) => { corners[CORNERS[i]] = pt(v); });
  const mConc = m.concurrent;
  return {
    circle: { center: pt(m.circle.center), radius: out(m.circle.radius) },
    touchPoints: touchPoints(state),
    corners,
    diagonals: { PR: segment(m.diagonals[0]), QS: segment(m.diagonals[1]) },
    contactChords: {
      AC: { ...segment(m.chords[0])!, pageName: "EG" },
      BD: { ...segment(m.chords[1])!, pageName: "FH" },
    },
    meeting: {
      point: mConc ? pt(mConc.point) : null,
      error: mConc ? out(mConc.error, 12) : null,
      holds: Boolean(mConc && mConc.error < m.tolerance),
    },
    tolerance: m.tolerance,
    finiteVertices: m.finite,
    note: C.describe(state),
  };
}

export function actions(): GameActions {
  return {
    inspect: {
      describe:
        "For four touch points on a circle, report the touch points A, B, C, D; the four tangent corners P, Q, R, S; the quadrilateral's two diagonals PR and QS; the two contact chords AC and BD (the original page calls them EG and FH); and the meeting point M where all four lines cross, with its error and the drawing's tolerance. Accept angles in radians, anglesDegrees, or four named points, and an optional circle. Omit them for the applet's opening diagram. The meeting is reported only when the lines really are concurrent; when two tangents are near parallel there is no meeting to draw.",
      args: '{ "angles": [0, 1.2, 2.9, 4.5] }',
      run: (args) => geometry(readState(args)),
    },
    check_claims: {
      describe:
        "Test every claim on the illustration's page for the current touch points: all four dots lie on the circle, each tangent touches at its dot, each side of the quadrilateral touches the circle, its corners are finite, and the diagonals PR, QS and contact chords AC, BD all pass through one point M. Also report the two ratio identities from the proof: the chord AC cuts the page's diagonal AC (our QS) in the ratio AN/CN = AE/CG, and chord BD cuts the page's diagonal BD (our PR) in the ratio AH/CF. For each, give where the cut falls and both ratios, plus the core's verdict. Take the same angles, anglesDegrees, points and circle arguments as inspect.",
      args: '{ "anglesDegrees": [0, 70, 165, 260] }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const claims = C.claims(state);
        const m = C.measurements(state);
        const onQS = ratio(C, state, 3, 1, "A", "C"); // page AC : AN/CN = AE/CG
        const onPR = ratio(C, state, 0, 2, "B", "D"); // page BD : AH/CF
        return {
          claims,
          ratioIdentities: {
            splitsPageAC: {
              pageStatement: "AN / CN = AE / CG",
              diagonal: "our QS (the page's AC)",
              chord: "our AC (the page's EG)",
              ...onQS,
              holds: claims.splitsAC === true,
            },
            splitsPageBD: {
              pageStatement: "AH / CF",
              diagonal: "our PR (the page's BD)",
              chord: "our BD (the page's FH)",
              ...onPR,
              holds: claims.splitsBD === true,
            },
          },
          meetingError: m.concurrent ? out(m.concurrent.error, 12) : null,
          tolerance: m.tolerance,
          note: claims.finiteVertices && claims.concurrent && claims.splitsAC === true && claims.splitsBD === true
            ? "All claims hold here: the four lines meet at M and each chord cuts its diagonal in the ratio of the two tangent lengths. Equal tangents from a corner make the two cuts coincide; this is Brianchon's theorem for four tangents."
            : "Some claims do not hold here, or a corner is off the board because two tangents are almost parallel. Move a touch point away from its neighbour and try again.",
        };
      },
    },
  };
}

/** The page's saved diagram and options, plus a fresh reading of it by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circum Quadri state version ${stateVersion}`);
  }
  const C = core();
  const here = readState(state);
  const reading = geometry(here);
  const claims = C.claims(here);
  return {
    stateVersion,
    width: num(state, "width", here.width),
    height: num(state, "height", here.height),
    circle: reading.circle,
    touchPoints: reading.touchPoints,
    checked: state.checked === true,
    reading,
    claims,
    note: C.describe(here),
  };
}
