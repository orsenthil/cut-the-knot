/*
 * run_game_logic actions and saved-position reader for Circle of Similitude 1.
 *
 * Two circles (O1,r1) and (O2,r2) have an internal centre of similarity P and
 * an external one Q, where the common internal and external tangents meet.
 * The circle (CS) with PQ as diameter is the Apollonian circle for the ratio
 * r1/r2. The cut-the-knot page proves four properties of (CS):
 *
 *   1. (CS) is orthogonal to the circle on O1O2 as diameter (call it cm);
 *   2. for any point T on (CS), TP bisects the angle between the paired
 *      tangent points from T to the two circles;
 *   3. those paired points are equally far from the radical axis of O1,O2;
 *   4. the chord pieces L1K1 and L2K2 are equal, equivalently the crossed
 *      tangent lengths t(L1,c2) and t(L2,c1) are equal.
 *
 * The core (circle-of-similitude-1/circle-of-similitude-1-core.js) does all
 * the geometry; it is copied into src/generated/cores/ at build time and its
 * global is CircleOfSimilitude1Core. Every number below comes from that core.
 * See _shared.ts for the shape of a game module.
 *
 * Two limits are reported plainly rather than hidden: equal radii send Q to
 * infinity and turn (CS) into the perpendicular bisector of O1O2, and when the
 * circles overlap there is no internal centre P (so the four properties have
 * no finite circle to attach to).
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-of-similitude-1"].CircleOfSimilitude1Core as any;

type Point = { x: number; y: number };

/** Board coordinates to four decimals; computed numbers to six. */
const r4 = (v: number): number => Number(v.toFixed(4));
const r6 = (v: number): number => Number(v.toFixed(6));
const xy = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;

/** Accept the page's saved {x, y} and the tutor's [x, y] arguments alike. */
function readPoint(v: unknown, label: string, fallback?: Point): Point {
  if (v === undefined || v === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    if (o.x === undefined || o.x === null || o.y === undefined || o.y === null) {
      throw new Error(`"${label}" needs both x and y`);
    }
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/*
 * Build a position from the five draggable dots. The core's geometry() builds
 * (CS) from midpoint(P,Q), so it throws when P is null and Q is finite (circles
 * that overlap but have unequal radii). Detect that case first and report it.
 */
function scene(args: Json) {
  const C = core();
  const home = C.start({});
  const s = Object.assign({}, home, {
    O1: readPoint(args.O1, "O1", home.O1),
    R1: readPoint(args.R1, "R1", home.R1),
    O2: readPoint(args.O2, "O2", home.O2),
    R2: readPoint(args.R2, "R2", home.R2),
    explored: true,
  });
  const { c1, c2 } = C.circles(s);
  if (!(c1.r > C.EPS) || !(c2.r > C.EPS)) {
    throw new Error("each radius dot R1/R2 must be away from its centre O1/O2");
  }
  const d = C.dist(c1.center, c2.center);
  if (!(d > C.EPS)) throw new Error("the two centres O1 and O2 must be different points");

  const Q = C.externalCenter(s);
  const P = C.internalCenter(s);
  // Q null => equal radii (the infinite line case, safe for geometry()).
  // P null with Q finite => overlapping, unequal circles (geometry would throw).
  const canGeometry = !(Q !== null && P === null);
  const rawT = readPoint(args.T, "T", home.T);
  s.T = canGeometry ? C.restrict(s, rawT) : rawT;
  const g = canGeometry ? C.geometry(s) : null;
  const m = g && g.possible ? C.claims(s) : null;
  return { C, s, c1, c2, d, P, Q, g, m, canGeometry, rawT };
}

/** Circles come as {center, r} from circles() and {center, radius} from geometry().cm. */
function circleView(c: { center: Point; r?: number; radius?: number }) {
  const radius = c.r !== undefined ? c.r : c.radius as number;
  return { center: xy(c.center), radius: r6(radius) };
}

/** The paired tangent points and the four measured properties for one pair. */
function pairView(pair: any, m: any) {
  if (!pair || !m) return null;
  return {
    contactOnC1: xy(pair.L1),
    contactOnC2: xy(pair.L2),
    P1: xy(pair.P1), P2: xy(pair.P2),
    K1: xy(pair.K1), K2: xy(pair.K2),
    // Statement 2: TP bisects angle(P1,T,P2).
    bisects: m.bisects,
    bisectAngleDeg: r6(m.bisectAngleDeg),
    otherAngleDeg: r6(m.otherAngleDeg),
    otherPairBisects: m.otherBisects,
    // Statement 3: P1 and P2 are the same distance from the radical axis.
    equallyFar: m.equallyFar,
    distanceToAxis: Number.isFinite(m.distanceToAxis) ? r6(m.distanceToAxis) : null,
    // Statement 4: L1K1 = L2K2, equivalently t(L1,c2) = t(L2,c1).
    segmentsEqual: m.segments,
    chord: r6(m.chord),
    tangentLengthsEqual: m.tangentLengths,
    tangent: r6(m.tangent),
    converse: m.converse,
    feet: { B1: xy(m.B1), B2: xy(m.B2), B: xy(m.B) },
  };
}

export function actions(): GameActions {
  return {
    similitude_circle: {
      describe:
        "For two circles, each given by a centre dot and a radius dot (O1/R1 and O2/R2, as [x, y] or {x, y} on the page's 400 x 300 board), report the internal and external centres of similarity P and Q, the circle (CS) with PQ as diameter, and the circle cm on O1O2 as diameter. It measures the orthogonality gap |centres|² − ((CS radius)² + (cm radius)²) (zero means orthogonal), the right angles at their crossings E and F, and at the point T on (CS) the ratios TO1/TO2 and of the tangent lengths to circle 1 and circle 2, both compared with r1/r2. Optional T ([x, y] or {x, y}) is projected onto (CS) by the core; omit it for a default. Equal radii give the straight-line limit (CS = perpendicular bisector of O1O2); overlapping circles have no internal centre and are reported as such.",
      args:
        '{ "O1": [123, 150], "R1": [100, 150], "O2": [280, 150], "R2": [330, 150], "T": [43.544, 66.343] }',
      run: (args) => {
        const { C, c1, c2, d, P, Q, g, m, canGeometry } = scene(args);

        if (!canGeometry) {
          return {
            possible: false,
            circles: { c1: circleView(c1), c2: circleView(c2) },
            centreDistance: r6(d),
            internalCenter: null, externalCenter: xy(Q),
            note:
              "These circles overlap but have different radii, so there is no internal centre of similarity P. " +
              "Without P there is no finite circle (CS) with PQ as diameter; drag one centre away from the other " +
              "until the circles are disjoint to see the construction.",
          };
        }
        if (!g || !g.possible) {
          return {
            possible: false,
            circles: { c1: circleView(c1), c2: circleView(c2) },
            centreDistance: r6(d),
            note: "A radius is zero or the centres coincide; move the dots to draw two genuine circles.",
          };
        }

        const cs = g.cs;
        const csView = cs.infinite
          ? {
              infinite: true,
              center: null, radius: null,
              midpoint: xy(cs.midpoint),
              line: cs.line.map((p: Point) => xy(p)),
            }
          : {
              infinite: false,
              center: xy(cs.center),
              radius: r6(cs.radius),
              midpoint: xy(cs.midpoint),
              diameterEndpoints: { P: xy(P), Q: xy(Q) },
              diameterMatches: Boolean(m && m.diameter),
            };

        const base = {
          possible: true,
          circles: { c1: circleView(c1), c2: circleView(c2) },
          centreDistance: r6(d),
          radiiEqual: Math.abs(c1.r - c2.r) < C.EPS,
          ratio: r6(c1.r / c2.r),
          internalCenter: xy(P),
          externalCenter: xy(Q),
          collinear: Boolean(m && m.collinear),
          similitudeCircle: csView,
          diameterCircle: circleView(g.cm),
        };

        if (cs.infinite) {
          return {
            ...base,
            orthogonal: null, orthogonalGap: null,
            crossings: { E: null, F: null, Eright: null, Fright: null },
            T: xy(g.T), distanceRatio: null, tangentRatio: null,
            note:
              "Equal radii put Q at infinity: (CS) becomes the perpendicular bisector of O1O2, which passes " +
              "through the centre of the diameter circle, the limiting form of orthogonality. Give the circles " +
              "different sizes for a finite circle (CS) and the tangent-pair properties.",
          };
        }

        return {
          ...base,
          orthogonal: Boolean(m && m.orthogonal),
          orthogonalGap: m ? r6(m.orthogonalGap) : null,
          crossings: {
            E: xy(g.E), F: xy(g.F),
            Eright: Boolean(m && m.Eright), Fright: Boolean(m && m.Fright),
          },
          radicalAxis: g.radical
            ? { point: xy(g.radical.point), normal: xy(g.radical.n), perpendicularToCentres: Boolean(m && m.radicalPerpendicular) }
            : null,
          T: xy(g.T),
          distanceRatio: m ? r6(m.distanceRatio) : null,
          ratioOK: Boolean(m && m.ratioOK),
          tangentRatio: m ? r6(m.tangentRatio) : null,
          tangentRatioOK: Boolean(m && m.tangentRatioOK),
          note:
            `P and Q divide O1O2 internally and externally in the ratio r1:r2, so the circle on PQ as diameter is ` +
            `the locus TO1/TO2 = r1/r2 = ${r6(c1.r / c2.r)}. The orthogonal gap is measured as ` +
            `|centre(CS) − centre(cm)|² − (rCS² + rcm²); zero (within rounding) confirms statement 1, and the ` +
            "right angles at E and F are the same fact seen at the two crossing points. The ratios at T confirm that tangent lengths are in the same ratio r1/r2.",
        };
      },
    },

    tangent_pair: {
      describe:
        "For two circles (O1/R1, O2/R2) and a point T on their circle of similitude, report the paired tangent contacts from T to each circle and check the three tangent properties on the page: TP bisects the angle between the paired contacts, the two contacts are equally far from the radical axis, and the chord pieces L1K1, L2K2 (equivalently the crossed tangent lengths t(L1,c2), t(L2,c1)) are equal. Both pairs are reported; 'one' says which pair the page highlights (default true). Optional T is projected onto (CS) by the core.",
      args:
        '{ "O1": [123, 150], "R1": [100, 150], "O2": [280, 150], "R2": [330, 150], "T": [43.544, 66.343], "one": true }',
      run: (args) => {
        const { C, c1, c2, P, Q, g, m, canGeometry } = scene(args);
        const one = args.one === undefined ? true : Boolean(args.one);

        if (!canGeometry) {
          return {
            possible: false,
            note:
              "Overlapping circles of unequal radii have no internal centre P and no finite circle of similitude, " +
              "so there is no T from which the paired tangent properties can be read. Make the circles disjoint first.",
          };
        }
        if (!g || !g.possible || g.cs.infinite || !P || !Q) {
          return {
            possible: false,
            note:
              "Equal radii send Q to infinity and turn (CS) into a line, so the core draws no finite T-pairs. " +
              "Move a radius dot to make the radii unequal.",
          };
        }
        if (!m) {
          return {
            possible: false,
            note: "The core cannot check the tangent pairs here; move the circles apart or drag T so it lies outside both circles.",
          };
        }

        return {
          possible: true,
          circles: { c1: circleView(c1), c2: circleView(c2) },
          ratio: r6(c1.r / c2.r),
          T: xy(g.T),
          distanceRatio: r6(m.distanceRatio),
          internalCenter: xy(P), externalCenter: xy(Q),
          radicalAxis: g.radical
            ? { point: xy(g.radical.point), normal: xy(g.radical.n) }
            : null,
          one,
          highlighted: one ? "L" : "M",
          pairs: {
            L: pairView(g.pairL, m.L),
            M: pairView(g.pairM, m.M),
          },
          note:
            "From T on (CS) the two tangent lines touch each circle; join the contacts across to get the pairs P1,P2 " +
            "and the chord pieces L1K1, L2K2. The fields bisects, equallyFar, segmentsEqual and tangentLengthsEqual " +
            "are the core's checks of statements 2-4: TP bisects angle(P1,T,P2), the contacts have equal perpendicular " +
            "distance to the radical axis, and the two chord pieces (equivalently the crossed tangent lengths) match. " +
            "converse checks that the tangents at P1 and P2 meet back on (CS). All comparisons are to tight rounding tolerances.",
        };
      },
    },
  };
}

/** Saved dots plus a fresh core reading of the four properties. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circle of Similitude 1 state version ${stateVersion}`);
  }
  const saved = state ?? ({} as Json);
  const { C, s, c1, c2, d, P, Q, g, m, canGeometry } = scene(saved);
  const options = (saved.options && typeof saved.options === "object"
    ? saved.options : {}) as Json;

  const base = {
    stateVersion,
    saved: {
      O1: xy(s.O1), R1: xy(s.R1), O2: xy(s.O2), R2: xy(s.R2), T: xy(s.T),
      options: {
        names: options.names !== false,
        hint: options.hint === true,
        s1: options.s1 === true, s2: options.s2 === true,
        s3: options.s3 === true, s4: options.s4 === true,
        one: options.one !== false,
      },
      explored: saved.explored === true,
    },
    circles: { c1: circleView(c1), c2: circleView(c2) },
    centreDistance: r6(d),
    radiiEqual: Math.abs(c1.r - c2.r) < C.EPS,
    ratio: r6(c1.r / c2.r),
    internalCenter: xy(P),
    externalCenter: xy(Q),
    status: C.describe(s),
  };

  if (!canGeometry || !g || !g.possible) {
    return {
      ...base,
      possible: false,
      note: "The saved circles overlap (with unequal radii) or are degenerate, so there is no finite circle of similitude to read.",
    };
  }

  const cs = g.cs;
  const csView = cs.infinite
    ? { infinite: true, center: null, radius: null, midpoint: xy(cs.midpoint), line: cs.line.map((p: Point) => xy(p)) }
    : {
        infinite: false, center: xy(cs.center), radius: r6(cs.radius),
        diameterEndpoints: { P: xy(P), Q: xy(Q) },
        diameterMatches: Boolean(m && m.diameter),
      };

  return {
    ...base,
    possible: true,
    T: xy(g.T),
    similitudeCircle: csView,
    diameterCircle: circleView(g.cm),
    orthogonal: cs.infinite ? null : Boolean(m && m.orthogonal),
    orthogonalGap: cs.infinite || !m ? null : r6(m.orthogonalGap),
    crossings: cs.infinite
      ? { E: null, F: null, Eright: null, Fright: null }
      : { E: xy(g.E), F: xy(g.F), Eright: Boolean(m && m.Eright), Fright: Boolean(m && m.Fright) },
    radicalAxis: g.radical ? { point: xy(g.radical.point), normal: xy(g.radical.n) } : null,
    distanceRatio: m ? r6(m.distanceRatio) : null,
    tangentRatio: m ? r6(m.tangentRatio) : null,
    ratioOK: Boolean(m && m.ratioOK),
    tangentRatioOK: Boolean(m && m.tangentRatioOK),
    tangentPairs: m
      ? { L: pairView(g.pairL, m.L), M: pairView(g.pairM, m.M) }
      : null,
    note: cs.infinite
      ? "The saved circles have equal radii: (CS) is the perpendicular bisector of O1O2 and the tangent-pair claims need unequal radii."
      : m
        ? `The core rebuilds (CS) on PQ as diameter, checks orthogonality with the circle on O1O2 (gap ${r6(m.orthogonalGap)}), and at the saved T reads TO1/TO2 = ${r6(m.distanceRatio)} against r1/r2 = ${r6(c1.r / c2.r)}. The tangent-pair fields hold the angle-bisector, radical-axis and chord/tangent-length checks.`
        : "The saved circles and T do not give two tangent pairs; drag T outside both circles to see the properties.",
  };
}
