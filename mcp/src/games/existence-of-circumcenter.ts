/*
 * run_game_logic actions and saved-position reader for Existence of the
 * Circumcenter.
 *
 * The real core is existence-of-circumcenter/existence-of-circumcenter-core.js,
 * copied into src/generated/cores/ at build time; every number below is
 * measured by it. Coordinates are board units in the page's SVG (y down),
 * 450 x 400 at the opening picture.
 *
 * A point on the perpendicular bisector of a side is equally far from its two
 * ends. Solving 2(B-A)·O = |B|²-|A|² and 2(C-A)·O = |C|²-|A|² gives the common
 * point O, and it also lies on the bisector of BC. The dots L, M, N ride on
 * their sides; the perpendicular line through a dot is a true bisector only
 * when the dot is at its side's midpoint (the applet's 2-pixel hit test). With
 * all three there, AO = BO = CO and the circle through A, B, C appears. O lies
 * inside an acute triangle, on the hypotenuse of a right one and outside an
 * obtuse one. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  A: Pt; B: Pt; C: Pt;
  coefL: number; coefM: number; coefN: number;
  L: Pt; M: Pt; N: Pt;
  showNames: boolean; width: number; height: number;
};
type Segment = { from: Pt; to: Pt };
type Lines = { L: Segment; M: Segment; N: Segment };
type Measurements = {
  A: Pt; B: Pt; C: Pt; L: Pt; M: Pt; N: Pt;
  center: Pt; noDraw: boolean; radius: number;
  distances: { A: number; B: number; C: number };
  hits: { L: boolean; M: boolean; N: boolean }; allHit: boolean;
  lines: Lines; trueLines: Lines;
  area: number; onBC: boolean; inside: boolean; rightAtA: boolean;
};
type Claims = {
  midpointsEquidistant: boolean; linesPerpendicular: boolean; bisectorsConcurrent: boolean;
  equidistant: boolean; circleThroughVertices: boolean; locationPossible: boolean;
};
type Core = {
  distance(p: Pt, q: Pt): number;
  along(first: Pt, second: Pt, coef: number): Pt;
  circumcenter(A: Pt, B: Pt, C: Pt): Pt;
  start(options?: Partial<State>): State;
  dragMidpoint(state: State, name: string, p: Pt): State;
  releaseMidpoint(state: State, name: string): State;
  snapMidpoints(state: State): State;
  measurements(state: State): Measurements;
  claims(state: State): Claims;
  result(state: State): string | null;
};

const core = (): Core =>
  cores["existence-of-circumcenter"].ExistenceOfCircumcenterCore as unknown as Core;

const TOL = 1e-6;
const DOTS = ["L", "M", "N"] as const;
const VERTICES = ["A", "B", "C"] as const;
const SIDE_OF = { L: "BC", M: "CA", N: "AB" } as const;
const HYPOTENUSE_OF = { A: "BC", B: "CA", C: "AB" } as const;

const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(2));
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const linesView = (lines: Lines) => ({
  L: { from: pt(lines.L.from), to: pt(lines.L.to) },
  M: { from: pt(lines.M.from), to: pt(lines.M.to) },
  N: { from: pt(lines.N.from), to: pt(lines.N.to) },
});

function readNumber(raw: unknown, label: string, fallback: number, min = -Infinity, max = Infinity): number {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === "boolean") throw new Error(`${label} must be a number, got ${JSON.stringify(raw)}`);
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a finite number, got ${JSON.stringify(raw)}`);
  if (n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}, got ${n}`);
  return n;
}

function readBool(raw: unknown, label: string, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") throw new Error(`${label} must be true or false, got ${JSON.stringify(raw)}`);
  return raw;
}

/** A point as the page saves it ({x, y}) or as a short [x, y] argument. */
function readPoint(raw: unknown, label: string, fallback: Pt): Pt {
  if (raw === undefined || raw === null) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/**
 * A real core state. start() derives the three side dots from the corners and
 * coefficients exactly as the page does; width and height shape the opening
 * triangle when a corner is omitted.
 */
function buildState(C: Core, args: Json): State {
  const width = readNumber(args.width, 'argument "width"', 450, 1);
  const height = readNumber(args.height, 'argument "height"', 400, 1);
  const seed = C.start({ width, height });
  return C.start({
    width, height,
    A: readPoint(args.A, 'argument "A"', seed.A),
    B: readPoint(args.B, 'argument "B"', seed.B),
    C: readPoint(args.C, 'argument "C"', seed.C),
    coefL: readNumber(args.coefL, 'argument "coefL"', seed.coefL, 0, 1),
    coefM: readNumber(args.coefM, 'argument "coefM"', seed.coefM, 0, 1),
    coefN: readNumber(args.coefN, 'argument "coefN"', seed.coefN, 0, 1),
    showNames: readBool(args.showNames, 'argument "showNames"', seed.showNames),
  });
}

/** Honour any dot positions captured mid-drag; the core re-projects them. */
function withSavedDots(C: Core, s: State, src: Json): State {
  let out = s;
  for (const name of DOTS) {
    const raw = src[name];
    if (raw === undefined || raw === null) continue;
    try {
      out = C.dragMidpoint(out, name, readPoint(raw, `saved ${name}`, out[name]));
    } catch {
      // Keep the coefficient-derived dot when a saved dot cannot be read.
    }
  }
  return out;
}

/** The complete measured picture, shared by the actions and position(). */
function fullReading(C: Core, s: State) {
  const m = C.measurements(s);
  const triangle = { A: pt(s.A), B: pt(s.B), C: pt(s.C) };
  if (m.noDraw) {
    return {
      valid: false as const,
      triangle,
      note:
        "The three corners are collinear or too close together, so the core cannot meet the perpendicular bisectors: move one corner off the line to make a triangle.",
    };
  }

  const radii = [m.distances.A, m.distances.B, m.distances.C];
  const spread = Math.max(...radii) - Math.min(...radii);
  const scale = Math.max(C.distance(s.A, s.B), C.distance(s.B, s.C), C.distance(s.C, s.A));
  const eps = 1e-9 * scale * scale;
  const dot = (v: Pt, p: Pt, q: Pt) =>
    (p.x - v.x) * (q.x - v.x) + (p.y - v.y) * (q.y - v.y);
  const angles = {
    A: dot(s.A, s.B, s.C), B: dot(s.B, s.C, s.A), C: dot(s.C, s.A, s.B),
  };
  const obtuseAt = VERTICES.filter((k) => angles[k] < -eps);
  const rightAt = VERTICES.filter((k) => Math.abs(angles[k]) <= eps);
  const kind = obtuseAt.length ? "obtuse" : rightAt.length ? "right" : "acute";
  const hypotenuse = rightAt.length ? HYPOTENUSE_OF[rightAt[0]] : null;
  const found = Number(m.hits.L) + Number(m.hits.M) + Number(m.hits.N);
  const where =
    kind === "acute"
      ? "all three angles are acute, so O lies inside the triangle"
      : kind === "right"
        ? `there is a right angle at ${rightAt[0]}, so O lies at the midpoint of the hypotenuse ${hypotenuse}`
        : `there is an obtuse angle at ${obtuseAt[0]}, so O lies outside the triangle`;

  return {
    valid: true as const,
    triangle,
    circumcenter: pt(m.center),
    circle: { centre: pt(m.center), radius: round(m.radius) },
    distances: { AO: round(m.distances.A), BO: round(m.distances.B), CO: round(m.distances.C) },
    radiusSpread: sig(spread),
    equalDistances: spread <= TOL,
    drawnPerpendiculars: linesView(m.lines),
    trueBisectors: linesView(m.trueLines),
    dots: { L: pt(m.L), M: pt(m.M), N: pt(m.N) },
    sideOfDot: SIDE_OF,
    hits: m.hits,
    dotsFound: found,
    circleDrawn: m.allHit,
    positionOfO: {
      kind,
      rightAngleAt: rightAt.length ? [...rightAt] : null,
      obtuseAngleAt: obtuseAt.length ? [...obtuseAt] : null,
      hypotenuse,
      coreInside: m.inside,
      coreOnSideBC: m.onBC,
      coreRightAtA: m.rightAtA,
      description: `${where.charAt(0).toUpperCase()}${where.slice(1)}.`,
    },
    claims: C.claims(s),
    status: C.result(s),
    tolerance: TOL,
  };
}

export function actions(): GameActions {
  return {
    circumcenter: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or { x, y } in the page's 450 x 400 board, y down; omit any for the opening triangle), run the real core and report the perpendicular bisectors' intersection O, the three distances AO, BO and CO, the circle through A, B and C, the drawn perpendicular lines and the true bisectors, and the core's checks (midpoints equidistant, lines perpendicular, bisectors concurrent, circle through the vertices). Also classify the triangle as acute, right or obtuse and say where O sits: inside, on the hypotenuse or outside. coefL, coefM, coefN (0 to 1) and showNames may be set; a collinear triangle is refused.",
      args: '{"A":[94,320],"B":[405,320],"C":[360,160]}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const reading = fullReading(C, s);
        if (!reading.valid) throw new Error(reading.note);
        return {
          ...reading,
          options: { showNames: s.showNames, width: s.width, height: s.height },
          note:
            `A point on a side's perpendicular bisector is equally far from the side's ends. Solving the equal-distance equations for AB and AC gives O, and it satisfies the one for BC too; here AO = BO = CO = ${reading.distances.AO} (spread ${reading.radiusSpread}), so the circle through all three corners is centred at O. ` +
            reading.positionOfO.description +
            " This is an illustration with no win or loss; the tracker records exploration.",
        };
      },
    },

    midpoint_dots: {
      describe:
        "For the same triangle A, B, C, place the side dots L (on BC), M (on CA) and N (on AB) at the fractions coefL, coefM, coefN of their sides (each 0 to 1, defaulting to the applet's 0.3, 0.3, 0.4) and report each dot's distances to the two ends, which dots are within the applet's 2-pixel hit test of the exact midpoint, how many are in place and whether the circumcircle is drawn. Then run the core's snapMidpoints (the Put dots at midpoints button) and report the completed picture. A collinear triangle is refused.",
      args: '{"A":[94,320],"B":[405,320],"C":[360,160],"coefL":0.3,"coefM":0.3,"coefN":0.4}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const m = C.measurements(s);
        if (m.noDraw) {
          throw new Error(
            "A, B and C are collinear or too close: the side dots have no usable perpendicular bisectors. Move a corner off the line.",
          );
        }
        const snapped = C.snapMidpoints(s);
        const ms = C.measurements(snapped);
        const dotView = (p: Pt, first: Pt, second: Pt) => ({
          point: pt(p),
          toFirst: round(C.distance(p, first)),
          toSecond: round(C.distance(p, second)),
          gap: sig(Math.abs(C.distance(p, first) - C.distance(p, second))),
        });
        return {
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          coefficients: { coefL: s.coefL, coefM: s.coefM, coefN: s.coefN },
          before: {
            dots: {
              L: dotView(s.L, s.B, s.C),
              M: dotView(s.M, s.C, s.A),
              N: dotView(s.N, s.A, s.B),
            },
            hits: m.hits,
            dotsFound: Number(m.hits.L) + Number(m.hits.M) + Number(m.hits.N),
            circleDrawn: m.allHit,
            status: C.result(s),
          },
          afterSnap: {
            dots: {
              L: dotView(snapped.L, snapped.B, snapped.C),
              M: dotView(snapped.M, snapped.C, snapped.A),
              N: dotView(snapped.N, snapped.A, snapped.B),
            },
            hits: ms.hits,
            dotsFound: Number(ms.hits.L) + Number(ms.hits.M) + Number(ms.hits.N),
            circleDrawn: ms.allHit,
            status: C.result(snapped),
            circumcenter: pt(ms.center),
            radius: round(ms.radius),
          },
          note:
            "A dot is 'hit' when it is within 2 pixels of its side's exact midpoint, which makes its perpendicular line a true bisector. Slide all three onto their middles, or use the core's snapMidpoints (the Put dots at midpoints button): the three perpendicular bisectors then meet at O with AO = BO = CO and the circle through A, B, C appears. There is no win or loss.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Existence of the Circumcenter state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  let savedReadable = true;
  let s: State;
  try {
    s = withSavedDots(C, buildState(C, src), src);
  } catch {
    savedReadable = false;
    s = C.start({});
  }
  const reading = fullReading(C, s);
  const saved = {
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    coefL: s.coefL, coefM: s.coefM, coefN: s.coefN,
    L: pt(s.L), M: pt(s.M), N: pt(s.N),
    showNames: s.showNames, width: s.width, height: s.height,
  };
  return {
    ...src,
    stateVersion,
    savedReadable,
    saved,
    valid: reading.valid,
    ...(reading.valid
      ? {
          reading,
          circumcenter: reading.circumcenter,
          circle: reading.circle,
          positionOfO: reading.positionOfO,
          claims: reading.claims,
        }
      : {}),
    note:
      (!savedReadable
        ? "Some saved fields could not be read, so the applet's opening triangle is shown; the core reading below comes from those opening corners. "
        : "Track.state saved the three draggable corners, their three coefficients and dot positions, the show-names flag and the board size; the page does not save derived points. ") +
      (!reading.valid
        ? reading.note
        : `The real core rebuilds the perpendicular bisectors and O from those fields: AO = BO = CO = ${reading.distances.AO} (spread ${reading.radiusSpread}), the core's checks are ${JSON.stringify(reading.claims)}, and ${reading.positionOfO.description} ` +
          "This is an illustration with no win or loss; the tracker records exploration."),
  };
}
