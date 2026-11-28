/*
 * run_game_logic actions and saved-position reader for La Hire on Ellipse.
 *
 * Two outside points A and B touch an ellipse at C,D and E,F. La Hire's
 * theorem says B lies on the chord CD exactly when A lies on the chord EF.
 * Stretch the ellipse into the unit circle with u = (x−cx)/a, v = (y−cy)/b:
 * the chord of contact of P is the polar u·u_P + v·v_P = 1, symmetric in P
 * and the running point, which is why the implication reverses. The applet's
 * own "touch" test is a one-unit screen distance from A to EF. When a = b the
 * ellipse is a circle (the separate "lahire" game) and the polar is simply
 * perpendicular to the radius. Every number below comes from the real core,
 * copied at build time from lahire-on-ellipse/ into src/generated/cores/.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Line = { p: Point; q: Point };
type View = { width: number; height: number };
type Ellipse = { center: Point; A: number; B: number };
type State = {
  view: View;
  V: Point[];
  A: Point;
  B: Point;
  names: boolean;
  explored: boolean;
};
type Geometry = {
  ellipse: Ellipse;
  C: Point | null;
  D: Point | null;
  E: Point | null;
  F: Point | null;
  lineA: Line | null;
  lineB: Line | null;
  touchDistance: number | null;
  touch: boolean;
};
type Claims = Geometry & {
  contactPoints: boolean;
  onPolars: boolean;
  bOnCD: boolean;
  aOnEF: boolean;
  implication: boolean;
  lineAgreement: boolean;
  residual: number;
  signedB: number | null;
  signedA: number | null;
};
type SavedEllipse = { center: Point; A: number; B: number };
type Core = {
  VIEW: View;
  TOUCH: number;
  CIRCLE_R: number;
  ellipseFrom(V: Point[]): Ellipse;
  ellipseValue(e: Ellipse, p: Point): number;
  tangentPoints(e: Ellipse, p: Point): Point[] | null;
  distToLine(p: Point, l: Line | null): number;
  compute(s: State): Geometry;
  polarCoefficients(e: Ellipse, p: Point): Point;
  polarResidual(e: Ellipse, p: Point, q: Point): number;
  polarDistance(e: Ellipse, p: Point, q: Point): number;
  start(options?: Partial<State> & Partial<View>): State;
  clamp(p: Point, s: State): Point;
  clampCorner(p: Point, s: State): Point;
  move(s: State, name: string, p: Point): State;
  placeB(s: State): State;
  claims(s: State): Claims;
  describe(s: State): string;
  position(s: State): {
    V: Point[]; A: Point; B: Point; ellipse: Ellipse;
    C: Point | null; D: Point | null; E: Point | null; F: Point | null;
    touch: boolean; names: boolean; explored: boolean;
  };
  result(s: State): null;
};

const core = (): Core =>
  cores["lahire-on-ellipse"].LahireOnEllipseCore as unknown as Core;

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const rounded = (v: number | null): number | null => v === null ? null : r6(v);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: r6(p.x), y: r6(p.y) }
    : null;
const nearPoint = (a: Point | null, b: Point | null): boolean | null =>
  a === null || b === null ? null : Math.hypot(a.x - b.x, a.y - b.y) <= 1e-6;

/** A point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(value: unknown, name: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${name}" must be [x, y]`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${name}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${name}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

function readPoints(value: unknown, count: number, name: string): Point[] {
  if (!Array.isArray(value) || value.length !== count) {
    throw new Error(`"${name}" must be an array of exactly ${count} finite points`);
  }
  return value.map((p, i) => readPoint(p, `${name}[${i}]`));
}

/** An optional saved point: absent or null is fine, a bad shape is not. */
function maybePoint(value: unknown, name: string): Point | null {
  return value === undefined || value === null ? null : readPoint(value, name);
}

/** The derived ellipse Track saves; check its centre and semi-axes. */
function readEllipse(value: unknown): SavedEllipse | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error('"ellipse" must be an object with center, A and B');
  }
  const o = value as Json;
  const center = readPoint(o.center, "ellipse.center");
  const A = Number(o.A), B = Number(o.B);
  if (!Number.isFinite(A) || !Number.isFinite(B)) {
    throw new Error('"ellipse" needs finite numeric A and B');
  }
  return { center, A, B };
}

/** The applet's board: width/height default to its 600 x 450 viewBox. */
function boardOf(C: Core, args: Json): View {
  const width = num(args, "width", C.VIEW.width);
  const height = num(args, "height", C.VIEW.height);
  if (width < 50 || width > 5000) throw new Error('"width" must be between 50 and 5000');
  if (height < 50 || height > 5000) throw new Error('"height" must be between 50 and 5000');
  return { width, height };
}

/**
 * Build the real core state: V0..V3 are the rectangle corners in the applet's
 * order (V0/V1 bottom, V1/V2 right); A and B are the two outside points. With
 * no V/A/B supplied this is exactly the applet's start position.
 */
function readState(C: Core, args: Json): State {
  const view = boardOf(C, args);
  const seed = C.start(view);
  const V = args.V === undefined ? seed.V : readPoints(args.V, 4, "V");
  const A = args.A === undefined ? seed.A : readPoint(args.A, "A");
  const B = args.B === undefined ? seed.B : readPoint(args.B, "B");
  return C.start({
    ...view, V, A, B,
    names: args.names === true, explored: args.explored === true,
  });
}

/** Tangents exist only for a point with positive power: outside the ellipse. */
function outside(C: Core, s: State, name: "A" | "B"): void {
  if (C.tangentPoints(C.ellipseFrom(s.V), s[name]) === null) {
    throw new Error(`"${name}" must lie outside the ellipse for two tangents to exist`);
  }
}

/** A contact chord's direction is perpendicular to the polar's normal. */
function normalDotChord(n: Point, l: Line | null): number | null {
  if (!l) return null;
  return (l.q.x - l.p.x) * n.x + (l.q.y - l.p.y) * n.y;
}

/** The common geometry used by both actions and by position(). */
function reading(C: Core, s: State) {
  const c = C.claims(s);
  const e = c.ellipse;
  const line = (l: Line | null) =>
    l ? { from: pt(l.p), to: pt(l.q) } : null;
  return {
    ellipse: {
      center: pt(e.center),
      semiMajor: r6(Math.abs(e.A)),
      semiMinor: r6(Math.abs(e.B)),
    },
    points: { A: pt(s.A), B: pt(s.B) },
    contact: { C: pt(c.C), D: pt(c.D), E: pt(c.E), F: pt(c.F) },
    chords: { CD: line(c.lineA), EF: line(c.lineB) },
    polar: {
      residual: r6(c.residual),
      reversedResidual: r6(C.polarResidual(e, s.B, s.A)),
      signedDistanceBtoCD: c.signedB === null ? null : r6(c.signedB),
      signedDistanceAtoEF: c.signedA === null ? null : r6(c.signedA),
    },
    tests: {
      bOnCD: c.bOnCD,
      aOnEF: c.aOnEF,
      equivalenceHolds: c.bOnCD === c.aOnEF,
      implicationHolds: c.implication,
      touch: c.touch,
      distanceAtoEF: c.touchDistance === null ? null : r6(c.touchDistance),
      touchUnit: C.TOUCH,
      contactPointsOnEllipse: c.contactPoints,
      contactPointsOnPolars: c.onPolars,
      chordsAgreeWithContactPoints: c.lineAgreement,
    },
    status: C.describe(s),
    result: C.result(s),
  };
}

export function actions(): GameActions {
  return {
    la_hire: {
      describe:
        "With two outside points A and B and the ellipse fixed by rectangle corners V0..V3, the tangents touch at C,D from A and E,F from B; La Hire's theorem says B lies on chord CD exactly when A lies on chord EF, and the applet's touch test asks whether A is within one unit of EF. Pass A and B as [x, y] or { x, y } (V is optional), with placeB: true to slide B onto A's polar and see both chords touch.",
      args:
        '{ "A": [520.800641, 300], "B": [240, 112.799573], "V": [[168, 356], [312, 356], [312, 244], [168, 244]], "placeB": true }',
      run: (args) => {
        const C = core();
        const s0 = readState(C, args);
        outside(C, s0, "A");
        outside(C, s0, "B");
        const s = args.placeB === true ? C.placeB(s0) : s0;
        const r = reading(C, s);
        const c = C.claims(s);
        const e = C.ellipseFrom(s.V);
        return {
          valid: true,
          board: s.view,
          placeBRequested: args.placeB === true,
          movedByPlaceB: args.placeB === true && (s.B.x !== s0.B.x || s.B.y !== s0.B.y),
          B: pt(s.B),
          ellipse: r.ellipse,
          contact: r.contact,
          chords: r.chords,
          polar: {
            ...r.polar,
            normalDotCD: rounded(normalDotChord(C.polarCoefficients(e, s.A), c.lineA)),
          },
          tests: r.tests,
          status: r.status,
          result: r.result,
          note: c.touch
            ? `B now lies on the chord CD of A's contact points, and the core measures A ${r.tests.distanceAtoEF} units from EF: the two chords of contact carry each other's points. The applet calls it a touch when that distance is below ${C.TOUCH} unit; the signed polar residual is ${r.polar.residual}.`
            : `B is ${r.polar.signedDistanceBtoCD} units from CD and A is ${r.polar.signedDistanceAtoEF} units from EF (both share the polar residual ${r.polar.residual}), so neither chord carries the other point yet. Put B on CD with placeB and A lands on EF: the incidence is symmetric because the polar equation is symmetric in the two points.`,
        };
      },
    },

    stretched_polar: {
      describe:
        "In stretched coordinates u = (x−cx)/a and v = (y−cy)/b the chord of contact (polar) of P is u·u_P + v·v_P = 1, symmetric in P and the running point, so its residual is 0 at the four contact points and equal for A at B's polar and B at A's — La Hire's theorem for every conic. The action replays the same stretched points on a circle (a = b), giving the identical residual and a chord perpendicular to the radius, the circle case of the separate 'lahire' game.",
      args:
        '{ "A": [520.800641, 300], "B": [240, 112.799573], "V": [[168, 356], [312, 356], [312, 244], [168, 244]] }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        outside(C, s, "A");
        outside(C, s, "B");
        const e = C.ellipseFrom(s.V);
        const c = C.claims(s);
        const ua = { x: (s.A.x - e.center.x) / e.A, y: (s.A.y - e.center.y) / e.B };
        const ub = { x: (s.B.x - e.center.x) / e.A, y: (s.B.y - e.center.y) / e.B };
        const nA = C.polarCoefficients(e, s.A);
        const nB = C.polarCoefficients(e, s.B);
        const resAB = C.polarResidual(e, s.A, s.B);
        const resBA = C.polarResidual(e, s.B, s.A);

        /* Keep the stretched coordinates fixed and set a = b = radius. */
        const radius = Math.max(Math.abs(e.A), Math.abs(e.B));
        const r = Math.max(1, radius);
        const circleV: Point[] = [
          { x: e.center.x - r, y: e.center.y + r },
          { x: e.center.x + r, y: e.center.y + r },
          { x: e.center.x + r, y: e.center.y - r },
          { x: e.center.x - r, y: e.center.y - r },
        ];
        const circleA: Point = { x: e.center.x + r * ua.x, y: e.center.y + r * ua.y };
        const circleB: Point = { x: e.center.x + r * ub.x, y: e.center.y + r * ub.y };
        const circle = C.start({ V: circleV, A: circleA, B: circleB });
        const cc = C.claims(circle);
        const ce = C.ellipseFrom(circleV);
        const circleResidual = C.polarResidual(ce, circleA, circleB);
        const circleNormal = C.polarCoefficients(ce, circleA);

        return {
          valid: true,
          ellipse: {
            center: pt(e.center),
            semiMajor: r6(Math.abs(e.A)),
            semiMinor: r6(Math.abs(e.B)),
            stretchedA: { u: r6(ua.x), v: r6(ua.y) },
            stretchedB: { u: r6(ub.x), v: r6(ub.y) },
          },
          polarOfA: {
            coefficients: pt(nA),
            residualAtB: r6(resAB),
            residualAtC: c.C === null ? null : r6(C.polarResidual(e, s.A, c.C)),
            residualAtD: c.D === null ? null : r6(C.polarResidual(e, s.A, c.D)),
            normalDotChord: rounded(normalDotChord(nA, c.lineA)),
          },
          polarOfB: {
            coefficients: pt(nB),
            residualAtA: r6(resBA),
            residualAtE: c.E === null ? null : r6(C.polarResidual(e, s.B, c.E)),
            residualAtF: c.F === null ? null : r6(C.polarResidual(e, s.B, c.F)),
            normalDotChord: rounded(normalDotChord(nB, c.lineB)),
          },
          symmetric: Math.abs(resAB - resBA) < 1e-9,
          circleCase: {
            radius: r6(r),
            center: pt(ce.center),
            A: pt(circleA),
            B: pt(circleB),
            residualAtB: r6(circleResidual),
            sameResidualAsEllipse: Math.abs(circleResidual - resAB) < 1e-9,
            radiusDotPolarChord: rounded(normalDotChord(circleNormal, cc.lineA)),
            touch: cc.touch,
            status: C.describe(circle),
          },
          note:
            `In stretched coordinates the polar of P is u·u_P + v·v_P = 1: A's line gives ${r6(resAB)} at B and B's line gives ${r6(resBA)} at A, the same number, and it is 0 at all four contact points. Replaying those stretched coordinates on a circle of radius ${r6(r)} gives the very same residual ${r6(circleResidual)}, with the chord of contact perpendicular to the radius — the ellipse is a stretched circle and La Hire's theorem is affine-invariant, the circle case being the separate 'lahire' game.`,
        };
      },
    },
  };
}

/** Echo what Track.state saved, then re-measure the picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported La Hire on Ellipse state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved La Hire on Ellipse position must be an object");
  }
  const C = core();
  try {
    const V = readPoints(state.V, 4, "V");
    const A = readPoint(state.A, "A");
    const B = readPoint(state.B, "B");
    const savedEllipse = readEllipse(state.ellipse);
    const savedC = maybePoint(state.C, "C");
    const savedD = maybePoint(state.D, "D");
    const savedE = maybePoint(state.E, "E");
    const savedF = maybePoint(state.F, "F");
    const savedTouch = state.touch === true;
    const names = state.names === true;
    const explored = state.explored === true;

    /* The page saves Core.position(state), so the core rebuilds it from V,A,B. */
    const here = C.start({ V, A, B, names, explored });
    const c = C.claims(here);
    const e = C.ellipseFrom(V);
    const r = reading(C, here);
    const savedMatchesCore = {
      ellipse: savedEllipse === null ? null
        : nearPoint(savedEllipse.center, e.center) &&
          Math.abs(Math.abs(savedEllipse.A) - Math.abs(e.A)) <= 1e-6 &&
          Math.abs(Math.abs(savedEllipse.B) - Math.abs(e.B)) <= 1e-6,
      C: nearPoint(savedC, c.C),
      D: nearPoint(savedD, c.D),
      E: nearPoint(savedE, c.E),
      F: nearPoint(savedF, c.F),
      touch: savedTouch === c.touch,
    };
    return {
      stateVersion,
      valid: true,
      saved: {
        V: V.map(pt),
        A: pt(A),
        B: pt(B),
        ellipse: savedEllipse === null ? null : {
          center: pt(savedEllipse.center),
          semiMajor: r6(Math.abs(savedEllipse.A)),
          semiMinor: r6(Math.abs(savedEllipse.B)),
        },
        C: pt(savedC), D: pt(savedD), E: pt(savedE), F: pt(savedF),
        touch: savedTouch,
        names,
        explored,
      },
      ...r,
      polar: {
        ...r.polar,
        normalDotCD: rounded(normalDotChord(C.polarCoefficients(e, here.A), c.lineA)),
      },
      savedMatchesCore,
      note:
        "Track.state saved the four rectangle corners, the outside points A and B, the derived ellipse and four contact points, the one-unit touch flag and two display flags, in the page's board units. The core rebuilds everything from V, A and B, so the saved contact points and touch flag can be compared with the chords it actually draws; B is on A's chord of contact exactly when A is on B's.",
    };
  } catch (err) {
    return {
      stateVersion,
      valid: false,
      saved: { ...state },
      error: err instanceof Error ? err.message : String(err),
      note:
        "A readable position needs four finite rectangle corners and two finite outside points A and B; optional saved ellipse, contact points and touch flag must also have the right shape.",
    };
  }
}
