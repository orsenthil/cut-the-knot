/*
 * run_game_logic actions and saved-position reader for Conjugate Diameters.
 *
 * An ellipse is the image of the unit circle under (x, y) -> (cx + A x, cy + B y).
 * For a point P = (cx + A cos t, cy + B sin t), the diameter PP through P and
 * its antipode has a conjugate partner QQ through the centre, parallel to the
 * chords whose midpoints lie on PP. The chord through any point R of PP drawn
 * parallel to the tangent at P is bisected by R, and the tangents at its two
 * ends meet at a point U back on PP. Measured slopes multiply to -B²/A², so
 * conjugate diameters are perpendicular only for a circle (A = B); Apollonius
 * gives OP² + OQ² = A² + B² and a tangent parallelogram of area 4AB.
 *
 * Every number below comes from the real core
 * (conjugate-diameters/conjugate-diameters-core.js), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 * Coordinates are board units in the page's 400 x 300 viewBox, y down.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["conjugate-diameters"].ConjugateDiametersCore as any;

type Pt = { x: number; y: number };
type State = {
  view: { width: number; height: number };
  V: Pt[]; P: Pt; R: Pt; t: number; explored: boolean; names: boolean;
};

const round = (v: number, digits = 4): number => Number(v.toFixed(digits));
const finite = (p: any): boolean => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
const pt = (p: any): Pt | null =>
  finite(p) ? { x: round(p.x), y: round(p.y) } : null;
const seg = (l: any): { from: Pt | null; to: Pt | null } | null =>
  l ? { from: pt(l.p), to: pt(l.q) } : null;
const slope = (a: any, b: any): number | null =>
  finite(a) && finite(b) && Math.abs(b.x - a.x) > 1e-9
    ? (b.y - a.y) / (b.x - a.x)
    : null;
const sig = (v: number): number | null => Number.isFinite(v) ? Number(v.toExponential(3)) : null;

/** Tool arguments use [x, y]; a saved position from Track.state uses { x, y }. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
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

function readPoints(v: unknown, count: number, label: string): Pt[] {
  if (!Array.isArray(v) || v.length !== count) {
    throw new Error(`"${label}" must be exactly ${count} points`);
  }
  return v.map((p, i) => readPoint(p, `${label}[${i}]`));
}

/** Optional numeric arrays, checked for range and a hard length cap. */
function readNumbers(
  args: Json, key: string, fallback: number[],
  bounds: { min?: number; max?: number; limit?: number } = {},
): number[] {
  const raw = args[key];
  const values = raw === undefined || raw === null ? fallback.slice() : numArray(args, key);
  if (values.length === 0) throw new Error(`"${key}" must be a non-empty array of numbers`);
  if (values.length > (bounds.limit ?? 32)) {
    throw new Error(`"${key}" has too many entries (limit ${bounds.limit ?? 32})`);
  }
  values.forEach((v, i) => {
    if (bounds.min !== undefined && v < bounds.min) {
      throw new Error(`"${key}[${i}]" must be at least ${bounds.min}`);
    }
    if (bounds.max !== undefined && v > bounds.max) {
      throw new Error(`"${key}[${i}]" must be at most ${bounds.max}`);
    }
  });
  return values;
}

/**
 * Build a real core position. V0..V3 are the bounding-rectangle corners in the
 * applet's order (V0/V1 the lower edge). P may be given as a point or as an
 * eccentric angle in radians; t places R along the diameter from P to P'.
 */
function buildState(args: Json): State {
  const C = core();
  const width = num(args, "width", C.VIEW.width);
  const height = num(args, "height", C.VIEW.height);
  if (!(width > 0 && height > 0)) throw new Error('"width" and "height" must be positive');
  const names = args.names === true, explored = args.explored === true;
  let s = C.start({ width, height, names, explored }) as State;
  if (args.V !== undefined && args.V !== null) {
    const V = readPoints(args.V, 4, "V");
    const e = C.ellipseFrom(V);
    if (Math.abs(e.A) < 1e-6 || Math.abs(e.B) < 1e-6) {
      throw new Error('"V" must span a non-degenerate ellipse (both half-axes positive)');
    }
    s = C.start({
      width, height, names, explored, V,
      P: C.pointAt(e, C.START_ANGLE as number),
    }) as State;
  }
  if (args.P !== undefined && args.P !== null) {
    if (args.angle !== undefined && args.angle !== null) {
      throw new Error('give "P" or "angle", not both');
    }
    /* As the page does when P is dragged, project the point onto the ellipse. */
    s = C.move(s, "P", readPoint(args.P, "P")) as State;
  } else if (args.angle !== undefined && args.angle !== null) {
    s = C.move(s, "P", C.pointAt(C.ellipseFrom(s.V), num(args, "angle"))) as State;
  }
  if (args.t !== undefined && args.t !== null) {
    const t = num(args, "t");
    if (t < 0 || t > 1) throw new Error('"t" must be between 0 and 1');
    const Pp = C.antipode(C.ellipseFrom(s.V), s.P);
    s = C.move(s, "R", C.atParam(s.P, Pp, t)) as State;
  }
  return s;
}

/** The core's own measurements of one diagram, safe to JSON-stringify. */
function reading(C: any, state: State) {
  const c = C.claims(state);
  const g = C.compute(state);
  const e = g.ellipse;
  const A = Math.abs(e.A), B = Math.abs(e.B);
  const mPP = slope(g.P, g.Pp);
  const mQQ = slope(g.QQ.p, g.QQ.q);
  const product = mPP !== null && mQQ !== null ? mPP * mQQ : null;
  const expected = -(B * B) / (A * A);
  const OP2 = C.sqDist(e.center, g.P);
  const OQ2 = C.sqDist(e.center, c.Q);
  const area = Number.isFinite(c.area) ? round(c.area) : null;
  return {
    ellipse: { center: pt(e.center), A: round(A), B: round(B) },
    rectangle: state.V.map((p) => pt(p)),
    R: pt(state.R),
    midpointParameter: round(state.t, 6),
    diameter: {
      from: pt(g.P), opposite: pt(g.Pp), slope: mPP === null ? null : round(mPP, 6),
      centreDistance: sig(C.distToLine(e.center, g.P, g.Pp)),
    },
    conjugateDiameter: {
      from: pt(g.QQ.p), to: pt(g.QQ.q), slope: mQQ === null ? null : round(mQQ, 6),
      parallelToTangent: c.tangentsParallel === true,
    },
    chord: {
      midpoint: pt(c.midpoint), ends: g.S ? g.S.map((p: any) => pt(p)) : null,
      tangentAtP: seg(g.tangentP), tangentsAtEnds: g.tangentS.map((l: any) => seg(l)),
      midpointDistanceToDiameter: c.midpoint
        ? sig(C.distToLine(c.midpoint, g.P, g.Pp)) : null,
    },
    tangentIntersection: {
      U: pt(g.U), onDiameter: c.uOnPP === true, onBothTangents: c.uOnTangents === true,
    },
    slopes: {
      diameter: mPP === null ? null : round(mPP, 6),
      conjugate: mQQ === null ? null : round(mQQ, 6),
      product: product === null ? null : round(product, 6),
      expectedProduct: round(expected, 6),
      productIsMinusB2OverA2: product !== null && Math.abs(product - expected) < 1e-4,
      perpendicularOnlyForCircle: c.perpendicularOnlyForCircle === true,
      circleWouldGiveProductMinusOne: Math.abs(expected + 1) < 1e-9,
    },
    apollonius: {
      OP2: round(OP2), OQ2: round(OQ2), sum: round(OP2 + OQ2),
      a2PlusB2: round(A * A + B * B), firstTheoremHolds: c.apollonius1 === true,
      tangentParallelogramArea: area, expectedArea: round(4 * A * B),
      secondTheoremHolds: c.apollonius2 === true,
    },
    claims: {
      chordMidpoint: c.chordMidpoint === true,
      chordEndsOnEllipse: c.chordEndsOnEllipse === true,
      rOnDiameter: c.rOnPP === true,
      pOnEllipse: c.pOnEllipse === true,
      tangentsParallel: c.tangentsParallel === true,
      uOnTangents: c.uOnTangents === true,
      uOnDiameter: c.uOnPP === true,
      theoremHolds: c.chordMidpoint === true && c.uOnPP === true && c.uOnTangents === true,
    },
    status: C.describe(state) as string,
  };
}

export function actions(): GameActions {
  return {
    conjugate_diameters: {
      describe:
        "Draw the ellipse fixed by rectangle corners V0..V3 (canvas coordinates, V0/V1 the lower edge), put P on it as a point or an eccentric angle in radians, and place the chord midpoint R at fraction t of the diameter P--P'. Report the midpoint diameter through the centre, its conjugate (parallel to the chords), the chord through R, where the tangents at the chord's ends meet, the slope product -B²/A² and Apollonius' OP²+OQ² = A²+B² (plus the 4AB tangent-parallelogram area). A chord very near an end of the diameter is tiny and may give no finite tangent intersection; then U is null.",
      args: '{ "V": [[153, 180], [247, 180], [247, 120], [153, 120]], "angle": 2.3, "t": 0.55 }',
      run: (args) => {
        const C = core();
        const state = buildState(args);
        const r = reading(C, state);
        return {
          ...r,
          note: r.claims.theoremHolds
            ? `The chord through R has R as its midpoint and lies on PP; the tangents at its ends meet at U on PP. Conjugate slopes multiply to ${r.slopes.product} = -B²/A², so they are perpendicular only when A = B; Apollonius gives OP²+OQ² = ${r.apollonius.sum} = A²+B².`
            : "This position is degenerate: P is at a flat spot or R is too near an end of the diameter, so the chord ends or their tangent crossing U could not be read. Move P or R and try again.",
        };
      },
    },

    verify_theorems: {
      describe:
        "Using the ellipse and P from the same arguments as conjugate_diameters, slide R along the diameter at each value of t_values (default 0.2, 0.4, 0.6, 0.8) and report the chord midpoint and tangent intersection U each time. Then move P to each eccentric angle in angles (default six angles), reporting the slope product and OP²+OQ² there, and compare with a circle of the same half-width: conjugate diameters meet at right angles only for the circle, where the product is -1.",
      args: '{ "angle": 2.3, "t_values": [0.15, 0.35, 0.55, 0.75, 0.9], "angles": [0.6, 1.5, 2.6, 3.7, 4.8, 5.7] }',
      run: (args) => {
        const C = core();
        const base = buildState(args);
        const e = C.ellipseFrom(base.V);
        const ts = readNumbers(args, "t_values", [0.2, 0.4, 0.6, 0.8], { min: 0, max: 1 });
        const angles = readNumbers(args, "angles", [0.6, 1.5, 2.6, 3.7, 4.8, 5.7]);

        const midpoints = ts.map((t) => {
          const Pp = C.antipode(e, base.P);
          const s = C.move(base, "R", C.atParam(base.P, Pp, t)) as State;
          const r = reading(C, s);
          return {
            t: round(t, 6), R: r.R, chordMidpoint: r.chord.midpoint,
            U: r.tangentIntersection.U, onDiameter: r.tangentIntersection.onDiameter,
            onTangents: r.tangentIntersection.onBothTangents,
            midpointIsR: r.claims.chordMidpoint,
          };
        });

        const acrossAngles = angles.map((a) => {
          const s = C.move(base, "P", C.pointAt(e, a)) as State;
          const r = reading(C, s);
          return {
            angleRadians: round(a, 6), P: pt(s.P),
            slopeProduct: r.slopes.product, expectedProduct: r.slopes.expectedProduct,
            holds: r.slopes.productIsMinusB2OverA2,
            OP2: r.apollonius.OP2, OQ2: r.apollonius.OQ2,
            sum: r.apollonius.sum, a2PlusB2: r.apollonius.a2PlusB2,
            apolloniusHolds: r.apollonius.firstTheoremHolds,
            area: r.apollonius.tangentParallelogramArea,
            areaHolds: r.apollonius.secondTheoremHolds,
          };
        });

        /* The circle case: same centre and half-width, but A = B. */
        const centre = e.center;
        const rCircle = Math.abs(e.A);
        const circleV = [
          { x: centre.x - rCircle, y: centre.y + rCircle },
          { x: centre.x + rCircle, y: centre.y + rCircle },
          { x: centre.x + rCircle, y: centre.y - rCircle },
          { x: centre.x - rCircle, y: centre.y - rCircle },
        ];
        const circle = C.start({
          V: circleV, P: C.pointAt(C.ellipseFrom(circleV), 0.7),
        }) as State;
        const cr = reading(C, circle);

        const usableMid = midpoints.filter((m) => m.midpointIsR && m.chordMidpoint !== null);
        const usableAngles = acrossAngles.filter((a) => a.holds && a.apolloniusHolds);
        return {
          ellipse: { center: pt(e.center), A: round(Math.abs(e.A)), B: round(Math.abs(e.B)) },
          midpointSweep: midpoints,
          allMidpointsAreR: usableMid.length === midpoints.length,
          allUsableUOnDiameter: midpoints.every((m) => m.U === null || m.onDiameter),
          angleSweep: acrossAngles,
          slopeProductsAgree: usableAngles.length === acrossAngles.length,
          apolloniusAgrees: acrossAngles.every((a) => a.apolloniusHolds),
          circle: {
            radius: round(rCircle), slopeProduct: cr.slopes.product,
            perpendicular: cr.slopes.perpendicularOnlyForCircle === true && cr.slopes.circleWouldGiveProductMinusOne,
            area: cr.apollonius.tangentParallelogramArea, expectedArea: cr.apollonius.expectedArea,
            note: "With A = B the slopes are -1 times each other: conjugate diameters of a circle are perpendicular, and the tangent parallelogram is the square of side 2r, of area 4r².",
          },
          note: `Sliding R keeps the chord midpoint on PP${usableMid.length === midpoints.length ? " at every tested t" : " except where the chord degenerates"}; the tangents at the chord's ends meet back on PP. At every tested angle the slope product is ${round(-(e.B * e.B) / (e.A * e.A), 6)} = -B²/A² and OP²+OQ² = ${round(e.A * e.A + e.B * e.B, 6)} = A²+B², while the circle gives -1 and perpendicular conjugates.`,
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh reading by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Conjugate Diameters state version ${stateVersion}`);
  const C = core();
  let here: State = C.start({}) as State;
  let savedReadable = false;
  try {
    const V = readPoints(state.V, 4, "V");
    const P = readPoint(state.P, "P");
    const R = readPoint(state.R, "R");
    const t = num(state, "t", C.START_R as number);
    if (t < 0 || t > 1) throw new Error('"t" must be between 0 and 1');
    here = C.start({
      V, P, R, t, names: state.names === true, explored: state.explored === true,
    }) as State;
    savedReadable = true;
  } catch { /* unusable saved data: fall back to the opening picture */ }

  const saved = {
    V: here.V.map((p) => pt(p)),
    P: pt(here.P), R: pt(here.R), t: round(here.t, 6),
    Pp: pt(state.Pp), S: Array.isArray(state.S) ? state.S.map((p: unknown) => pt(p)) : null,
    midpoint: pt(state.midpoint), U: pt(state.U),
    names: state.names === true, explored: state.explored === true,
  };
  const r = reading(C, here);
  const near = (a: Pt | null, b: Pt | null): boolean | null =>
    a && b ? Math.hypot(a.x - b.x, a.y - b.y) < 0.01 : null;
  return {
    stateVersion,
    savedReadable,
    saved,
    ...r,
    agreement: {
      midpointMatchesSaved: near(saved.midpoint, r.chord.midpoint),
      UMatchesSaved: near(saved.U, r.tangentIntersection.U),
      oppositeMatchesSaved: near(saved.Pp, r.diameter.opposite),
    },
    note: !savedReadable
      ? "The saved position could not be read, so the applet's opening picture is shown instead."
      : r.claims.theoremHolds
        ? "The saved R is the midpoint of its chord and lies on PP, and the tangents at the chord's ends meet at U on PP: the conjugate-diameter theorem holds in this saved picture."
        : "The saved diagram is readable but degenerate: the chord is too short or P is at a flat spot, so U may have no finite point. Move P or R and check the theorem again.",
  };
}
