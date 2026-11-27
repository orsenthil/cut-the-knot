/*
 * run_game_logic actions and saved-position reader for Circle of Similitude.
 *
 * Two circles that lie apart have four common tangents. The crossing pair
 * meets at the inner centre P, the outer pair at the outer centre Q; P divides
 * C1C2 internally and Q divides it externally in the ratio R1:R2. The circle
 * on PQ as diameter is the circle of similitude (an Apollonian circle): every
 * point T on it has d1/d2 = t1/t2 = R1/R2, and the two circles are seen from T
 * under the same angle 2·arcsin(R_i/d_i), because d_i² = t_i² + R_i².
 *
 * The core (circle-of-similitude/circle-of-similitude-core.js) computes P, Q,
 * the common tangents and the circle, then restricts T to that circle. It is
 * copied into src/generated/cores/ at build time; every number below comes
 * from it. See _shared.ts for the shape of a game module.
 *
 * Two cautions the page makes explicit: equal radii send Q to infinity, so
 * the circle becomes the perpendicular bisector of C1C2; and the old applet
 * put the circle's centre at (P.x + Q.x)/2 with the y of the first centre,
 * which agrees with the true midpoint of PQ only when the centres are level.
 * The core always uses the true midpoint, so the theorem survives any drag.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-of-similitude"].CircleOfSimilitudeCore as any;

type Point = { x: number; y: number };

/** Board coordinates to four decimals; computed numbers to six. */
const r4 = (v: number): number => Number(v.toFixed(4));
const r6 = (v: number): number => Number(v.toFixed(6));
const xy = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;
const deg = (rad: number | null | undefined): number | null =>
  rad === null || rad === undefined || !Number.isFinite(rad) ? null : r6(rad * 180 / Math.PI);

/** Accept both the page's saved {x, y} and the tutor's [x, y] arguments. */
function readPoint(v: unknown, label: string, fallback: Point): Point {
  if (v === undefined || v === null) return { x: fallback.x, y: fallback.y };
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/** The five draggable dots, plus the two display options, in board units. */
function readScene(v: Json) {
  const C = core();
  const home = C.start({});
  if (v === null || typeof v !== "object") throw new Error("the diagram must be an object of points");
  const o = v.options && typeof v.options === "object" ? v.options as Json : {};
  const s = {
    C1: readPoint(v.C1, "C1", home.C1),
    R1: readPoint(v.R1, "R1", home.R1),
    C2: readPoint(v.C2, "C2", home.C2),
    R2: readPoint(v.R2, "R2", home.R2),
    T: readPoint(v.T, "T", home.T),
    options: {
      names: o.names === undefined ? true : !!o.names,
      hint: !!o.hint,
    },
    explored: v.explored === true,
  };
  const r1 = C.dist(s.C1, s.R1), r2 = C.dist(s.C2, s.R2);
  if (!(r1 > C.EPS)) throw new Error("R1 must be away from C1 to give the first circle a radius");
  if (!(r2 > C.EPS)) throw new Error("R2 must be away from C2 to give the second circle a radius");
  if (!(C.dist(s.C1, s.C2) > C.EPS)) throw new Error("C1 and C2 must be different points");
  return { s, g0: C.compute(s), r1, r2 };
}

const circleView = (cs: any) => cs ? { centre: xy(cs.c), radius: r6(cs.r) } : null;

/** The common-tangent intersections and the circle drawn on PQ as diameter. */
function construction(g: any) {
  const C = core();
  const P = g.P, Q = g.Q;
  const tangents = C.commonTangents(g);
  return {
    innerCentreP: xy(P),
    outerCentreQ: xy(Q),
    ratioR1overR2: r6(g.ratio),
    circle: circleView(g.cs),
    line: g.line
      ? { midpoint: xy(g.line.m), normalAlongCentres: xy(g.line.n) }
      : null,
    diameter: Q
      ? {
          from: xy(P), to: xy(Q),
          length: r6(C.dist(P, Q)),
          twiceRadius: r6(2 * g.cs.r),
          isDiameter: Math.abs(C.dist(P, Q) - 2 * g.cs.r) < 1e-9 &&
            C.dist(C.midpoint(P, Q), g.cs.c) < 1e-9,
        }
      : null,
    // The old applet averaged only the x coordinates and reused C1.y. Its
    // x agrees with the true midpoint; the y agrees only for level centres.
    appletCentre: Q ? { x: r4((P.x + Q.x) / 2), y: r4(g.C1.y) } : null,
    midpointCaveatGap: Q ? r6(C.dist(C.point((P.x + Q.x) / 2, g.C1.y), g.cs.c)) : null,
    tangentLines: { external: tangents.external.length, internal: tangents.internal.length },
  };
}

/** d1/d2, tangent lengths and viewing angles at T, all from the core. */
function measurements(g: any) {
  return {
    distances: { d1: r6(g.d1), d2: r6(g.d2), ratio: r6(g.measured) },
    tangentLengths: { t1: r6(g.t1), t2: r6(g.t2), ratio: r6(g.tangentRatio) },
    viewingAnglesDeg: { first: deg(g.angle1), second: deg(g.angle2), difference: deg(Math.abs(g.angle1 - g.angle2)) },
    matchesRadiusRatio: Math.abs(g.measured - g.ratio) < 1e-6,
    tangentRatioMatchesRadiusRatio: Math.abs(g.tangentRatio - g.ratio) < 1e-6,
    anglesEqual: Math.abs(g.angle1 - g.angle2) < 1e-6,
  };
}

const INVALID_NOTE =
  "The picture needs two circles with positive radii whose centres are far enough apart for the crossing tangents to exist. ";
const LINE_NOTE =
  "Equal radii send Q to infinity: the blue circle becomes the perpendicular bisector of C1C2, and reflection across that line swaps the circles. ";
const MIDPOINT_CAVEAT =
  "The old applet placed the circle's centre at (P.x + Q.x)/2 with the y of C1; that is the true midpoint of PQ only when the two centres are level. This core uses the midpoint of PQ, so the ratios and equal angles hold after any drag. ";

export function actions(): GameActions {
  return {
    circle_of_similitude: {
      describe:
        "For two circles, each given by a centre dot and a radius dot (C1/R1 and C2/R2, as [x, y] or {x, y} in the page's 400 x 300 board), report the inner and outer centres of similarity P and Q, where the crossing and outer common tangents meet, the circle of similitude drawn on PQ as diameter, its centre and radius, and how many external and internal tangents exist. Optional T ([x, y] or {x, y}) is projected onto that circle; the report then gives d1/d2, t1/t2, R1/R2 and the two equal viewing angles, with checks. Equal radii give no finite Q and a straight-line limit; it also reports the old applet's x-average centre and its gap from the true midpoint of PQ.",
      args: '{ "C1": [100, 150], "R1": [50, 150], "C2": [280, 150], "R2": [300, 150], "T": [230, 90] }',
      run: (args) => {
        const C = core();
        const { s, g0, r1, r2 } = readScene(args);
        const givenT = { x: s.T.x, y: s.T.y };
        const circles = { first: { centre: xy(s.C1), radius: r6(r1) }, second: { centre: xy(s.C2), radius: r6(r2) } };
        if (!g0.valid) {
          return {
            valid: false, reason: g0.reason, circles,
            note: INVALID_NOTE + g0.reason,
          };
        }
        const placed = Object.assign({}, s, { T: C.restrict(s, s.T) });
        const g = C.geometry(placed);
        const build = construction(g);
        return {
          valid: true,
          circles,
          centreSeparation: r6(g.sep),
          radiiSum: r6(r1 + r2),
          T: { given: xy(givenT), onCircle: xy(g.T) },
          ...build,
          measuredAtT: measurements(g),
          status: C.describe(placed),
          note:
            (g.Q
              ? "P and Q divide C1C2 internally and externally in the ratio R1/R2, so the circle on PQ as diameter is the circle of Apollonius: at every T on it, d1/d2 = t1/t2 = R1/R2 and the two circles are seen under the same angle. "
              : LINE_NOTE) + MIDPOINT_CAVEAT,
        };
      },
    },

    viewing_angles: {
      describe:
        "Given the same two circles and a point T, report what the circle of similitude looks like from T: where each tangent from T touches each circle, the tangent lengths t_i and distances d_i with the Pythagorean check d_i² = t_i² + R_i², and the two apparent angles 2·arcsin(R_i/d_i) in degrees. T is projected onto the blue circle first, as the page does; pass an off-circle T to see the projection. The equality of angles comes from the similar right triangles t_i, R_i, d_i. Equal radii send Q to infinity and leave a straight line instead of a circle.",
      args: '{ "C1": [100, 150], "R1": [50, 150], "C2": [280, 150], "R2": [300, 150], "T": [230, 90] }',
      run: (args) => {
        const C = core();
        const { s, g0, r1, r2 } = readScene(args);
        const givenT = { x: s.T.x, y: s.T.y };
        if (!g0.valid) {
          return { valid: false, reason: g0.reason, note: INVALID_NOTE + g0.reason };
        }
        const placed = Object.assign({}, s, { T: C.restrict(s, s.T) });
        const g = C.geometry(placed);
        const rows = [1, 2].map((i) => {
          const d = i === 1 ? g.d1 : g.d2;
          const t = i === 1 ? g.t1 : g.t2;
          const radius = i === 1 ? r1 : r2;
          const contacts = i === 1 ? g.fromT1 : g.fromT2;
          return {
            circle: i,
            centre: xy(i === 1 ? g.C1 : g.C2),
            radius: r6(radius),
            distanceFromT: r6(d),
            tangentLength: r6(t),
            angleDeg: deg(i === 1 ? g.angle1 : g.angle2),
            tangentPoints: contacts ? contacts.map((p: Point) => xy(p)) : [],
            pythagorasResidual: r6(d * d - t * t - radius * radius),
          };
        });
        return {
          valid: true,
          T: { given: xy(givenT), onCircle: xy(g.T) },
          circle: circleView(g.cs),
          line: g.line ? { midpoint: xy(g.line.m), normalAlongCentres: xy(g.line.n) } : null,
          ratioR1overR2: r6(g.ratio),
          circles: rows,
          ...measurements(g),
          status: C.describe(placed),
          note:
            "A radius to a tangent point is perpendicular to the tangent, so t_i² + R_i² = d_i². Since d1/d2 = R1/R2 on the blue circle, dividing the two copies leaves t1/t2 = R1/R2, and the similar t_i,R_i,d_i triangles give the same apparent angle 2·arcsin(R_i/d_i) for both circles. " +
            (g.Q ? MIDPOINT_CAVEAT : LINE_NOTE + MIDPOINT_CAVEAT),
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Circle of Similitude state version ${stateVersion}`);
  const C = core();
  const { s, g0, r1, r2 } = readScene(state ?? ({} as Json));
  const givenT = { x: s.T.x, y: s.T.y };
  const base = {
    stateVersion,
    saved: {
      C1: xy(s.C1), R1: xy(s.R1), C2: xy(s.C2), R2: xy(s.R2), T: xy(givenT),
      options: { names: s.options.names, hint: s.options.hint },
      explored: s.explored,
    },
    radii: { r1: r6(r1), r2: r6(r2) },
  };
  if (!g0.valid) {
    return { ...base, valid: false, reason: g0.reason, note: INVALID_NOTE + g0.reason };
  }
  const placed = Object.assign({}, s, { T: C.restrict(s, s.T) });
  const g = C.geometry(placed);
  return {
    ...base,
    valid: true,
    centreSeparation: r6(g.sep),
    onCircleT: xy(g.T),
    ...construction(g),
    measuredAtT: measurements(g),
    status: C.describe(placed),
    note:
      (g.Q ? "The saved picture has both centres of similarity and a circle of similitude through P and Q; at T the core finds the radius ratio in the distances and tangent lengths and equal viewing angles. " : LINE_NOTE) +
      MIDPOINT_CAVEAT,
  };
}
