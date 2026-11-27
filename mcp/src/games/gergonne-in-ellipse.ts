/*
 * run_game_logic actions and saved-position reader for Gergonne in Ellipse.
 *
 * Three touch points T0,T1,T2 on an ellipse have tangents that meet in the
 * contact triangle. Its corner A_i is opposite T_i: A_i is the intersection of
 * the tangents at the other two touch points, and the cevian A_i—T_i joins a
 * corner to the touch point opposite it. The three cevians concur at the
 * Gergonne point: an ellipse is an affine image of a circle, and that stretch
 * preserves incidence. Every number below comes from the game's real core,
 * copied at build time from gergonne-in-ellipse/ into src/generated/cores/.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Line = { p: Point; q: Point };
type View = { width: number; height: number };
type Ellipse = { center: Point; inf: Point; A: number; B: number };
type SavedEllipse = { center: Point; A: number; B: number };
type State = { view: View; V: Point[]; P: Point[]; explored: boolean; names: boolean };
type Geometry = {
  ellipse: Ellipse;
  tangents: (Line | null)[];
  vertices: Point[];
  cevians: Line[];
  meetings: Point[];
  G: Point | null;
  noDraw: boolean;
};
type Claims = {
  tangentsTouch: boolean;
  verticesOnTangents: boolean;
  concurrent: boolean;
  verticesFinite: boolean;
  meetingsFinite: boolean;
  tangentsFinite: boolean;
  G: Point | null;
  geometry: Geometry;
};
type Core = {
  VIEW: View;
  POINT_NAMES: string[];
  START_ANGLES: number[];
  ellipseFrom(V: Point[]): Ellipse;
  pointAt(e: Ellipse, t: number): Point;
  compute(state: State): Geometry;
  claims(state: State): Claims;
  start(options?: Partial<State> & Partial<View>): State;
  clamp(p: Point, state: State): Point;
  clampCorner(p: Point, state: State): Point;
  move(state: State, name: string, p: Point): State;
  legalMoves(): string[];
  distToLine(p: Point, a: Point, b: Point): number;
  describe(state: State): string;
  result(state: State): null;
};

const core = (): Core =>
  cores["gergonne-in-ellipse"].GergonneInEllipseCore as unknown as Core;

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: r6(p.x), y: r6(p.y) }
    : null;
const named = (p: Point | null | undefined, name: string) => {
  const q = pt(p);
  return q ? { name, x: q.x, y: q.y } : { name, x: null, y: null };
};
const nearPoint = (a: Point | null, b: Point | null): boolean | null =>
  a === null || b === null ? null : Math.hypot(a.x - b.x, a.y - b.y) <= 1e-6;

/** A point, as [x, y] or { x, y }, with finite coordinates. */
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

/** The derived ellipse Track saves; its centre and semi-axes are enough to check it. */
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

function boardOf(C: Core, args: Json): View {
  const width = num(args, "width", C.VIEW.width);
  const height = num(args, "height", C.VIEW.height);
  if (width < 50 || width > 5000) throw new Error('"width" must be between 50 and 5000');
  if (height < 50 || height > 5000) throw new Error('"height" must be between 50 and 5000');
  return { width, height };
}

/** Three touch-point angles in radians, defaulting to the applet's init() angles. */
function anglesOf(C: Core, args: Json): number[] {
  const v = args.angles;
  if (v === undefined || v === null) return C.START_ANGLES.slice();
  if (!Array.isArray(v) || v.length !== 3) {
    throw new Error('"angles" must be an array of exactly 3 radian values');
  }
  return v.map((x, i) => {
    const n = Number(x);
    if (!Number.isFinite(n)) throw new Error(`angles[${i}] must be a finite number of radians`);
    return n;
  });
}

/** The real core state: the applet's frame, with three touch points at those angles. */
function buildState(C: Core, args: Json): State {
  const view = boardOf(C, args);
  const seed = C.start(view);
  const e = C.ellipseFrom(seed.V);
  const P = anglesOf(C, args).map((t) => C.pointAt(e, t));
  return C.start({ ...view, V: seed.V, P });
}

/** Every reading is measured from the core's own compute() and claims(). */
function reading(C: Core, s: State) {
  const c = C.claims(s);
  const g = c.geometry;
  const G = g.G;
  const tangents = g.tangents.map((l, i) => ({
    at: `T${i}`,
    through: l ? pt(l.p) : null,
    direction: l ? pt(l.q) : null,
  }));
  const corners = g.vertices.map((v, i) => ({
    name: `A${i}`,
    oppositeTouch: `T${i}`,
    fromTangents: [`T${(i + 1) % 3}`, `T${(i + 2) % 3}`],
    point: pt(v),
  }));
  const cevians = g.cevians.map((l, i) => ({
    from: `A${i}`,
    to: `T${i}`,
    corner: pt(l.p),
    touch: pt(l.q),
    distanceFromG: G ? r6(C.distToLine(G, l.p, l.q)) : null,
  }));
  const pairwiseMeetings = g.meetings.map((m, i) => ({
    name: `A${(i + 1) % 3}—T${(i + 1) % 3} ∩ A${(i + 2) % 3}—T${(i + 2) % 3}`,
    point: pt(m),
    distanceFromG: G ? r6(Math.hypot(m.x - G.x, m.y - G.y)) : null,
  }));
  const spread = G && c.meetingsFinite && g.meetings.length === 3
    ? Math.max(...g.meetings.map((m) => Math.hypot(m.x - G.x, m.y - G.y)))
    : null;
  return {
    ellipse: {
      center: pt(g.ellipse.center),
      semiMajor: r6(Math.abs(g.ellipse.A)),
      semiMinor: r6(Math.abs(g.ellipse.B)),
    },
    touchPoints: s.P.map((p, i) => named(p, `T${i}`)),
    tangents,
    corners,
    cevians,
    pairwiseMeetings,
    gergonnePoint: pt(G),
    checks: {
      tangentsTouchAtTheirPoints: c.tangentsTouch,
      cornersOnBothTheirTangents: c.verticesOnTangents,
      threeCeviansConcurrentAtG: c.concurrent,
      verticesFinite: c.verticesFinite,
      meetingsFinite: c.meetingsFinite,
      tangentsFinite: c.tangentsFinite,
      pairwiseMeetingSpread: spread === null ? null : r6(spread),
      noDraw: g.noDraw,
    },
  };
}

export function actions(): GameActions {
  return {
    gergonne_point: {
      describe:
        "Place the three touching points on the ellipse at `angles` (three radians; the applet's start angles by default) and report the tangents, the contact triangle, its cevians and the Gergonne point where they concur. Corner A_i is opposite touch point T_i: it is the meeting of the tangents at the other two touch points, and the cevian joins A_i to T_i. Optional `width` and `height` (50–5000) set the board.",
      args: '{ "angles": [0.1570796327, -2.3561944902, 2.0943951024], "width": 400, "height": 300 }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        const G = r.gergonnePoint;
        const ok = r.checks.tangentsFinite && r.checks.verticesFinite &&
          r.checks.meetingsFinite && G !== null;
        return {
          valid: ok,
          board: s.view,
          angles: anglesOf(C, args).map(r6),
          ...r,
          status: C.describe(s),
          result: C.result(s),
          note: ok
            ? `The tangents at T0, T1 and T2 form a triangle whose corner A_i is opposite T_i: A_i = tangent(T_(i+1)) ∩ tangent(T_(i+2)). The three cevians A_i T_i concur at G = (${G!.x}, ${G!.y}) — Ceva's theorem in the contact triangle, and the affine circle-to-ellipse stretch carries the circle's Gergonne point to it. The core's three pairwise cevian intersections agree to within ${r.checks.pairwiseMeetingSpread} board units.`
            : "Two touch points coincide or are antipodal, so their tangents are parallel and no triangle corner can be formed; choose three distinct, non-antipodal angles.",
        };
      },
    },

    drag_and_check: {
      describe:
        "Move touch point `handle` (A, B or C) or frame corner `handle` (V0–V3) to `to` as [x, y] or { x, y }, and report the contact triangle before and after with a check that its three cevians still concur. Frame corners reshape the ellipse and resnap every touch point; touch points slide along the ellipse. `angles`, `width` and `height` may be given as in gergonne_point.",
      args: '{ "handle": "A", "to": [130, 124], "angles": [0.1570796327, -2.3561944902, 2.0943951024] }',
      run: (args) => {
        const C = core();
        const handle = String(args.handle ?? "A");
        const legal = C.legalMoves();
        if (!legal.includes(handle)) {
          throw new Error(`"handle" must be one of ${legal.join(", ")}`);
        }
        const requested = readPoint(args.to, "to");
        const s = buildState(C, args);
        // The page clamps a pointer to the board, then a frame corner away from
        // the centre lines; Core.move does the actual snap and mirror.
        const clamped = C.clamp(requested, s);
        const applied = handle[0] === "V" ? C.clampCorner(clamped, s) : clamped;
        const moved = C.move(s, handle, applied);
        const before = reading(C, s);
        const after = reading(C, moved);
        const b = before.gergonnePoint, a = after.gergonnePoint;
        return {
          handle,
          requested: pt(requested),
          applied: pt(applied),
          frameCorner: handle[0] === "V",
          before,
          after,
          gergonneMovedBy: b && a ? r6(Math.hypot(a.x - b.x, a.y - b.y)) : null,
          stillConcurrent: after.checks.threeCeviansConcurrentAtG,
          status: C.describe(moved),
          result: C.result(moved),
          note:
            `Moving ${handle} ${handle[0] === "V" ? "mirrors the other frame corners about the centre and snaps every touch point onto the new ellipse" : "slides that touch point along the ellipse"}, and the core rebuilds the contact triangle. ` +
            (a
              ? `The cevians from the corners opposite T0, T1 and T2 still meet at G = (${a.x}, ${a.y}), ${after.checks.threeCeviansConcurrentAtG ? "as concurrent as ever" : "but the new position is degenerate"}.`
              : "At this position two tangents are parallel, so the core cannot measure a Gergonne point; try another target.") +
            " Stretching a circle into an ellipse is affine, so it preserves the concurrence that gives this projective Gergonne point.",
        };
      },
    },
  };
}

/** Echo what Track.state saved, then re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Gergonne in Ellipse state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Gergonne in Ellipse position must be an object");
  }
  const C = core();
  try {
    const V = readPoints(state.V, 4, "V");
    const P = readPoints(state.P, 3, "P");
    const savedEllipse = readEllipse(state.ellipse);
    const savedG = state.G === undefined || state.G === null ? null : readPoint(state.G, "G");
    const explored = state.explored === true;
    const names = state.names === true;

    // The page saves the core's whole geometry state; the board is its 400x300
    // SVG viewBox, which is the core's default and is not stored separately.
    const here = C.start({ V, P, explored, names });
    const r = reading(C, here);
    const e = C.ellipseFrom(V);
    const savedMatchesCore = {
      ellipse: savedEllipse === null ? null
        : nearPoint(savedEllipse.center, e.center) &&
          Math.abs(Math.abs(savedEllipse.A) - Math.abs(e.A)) <= 1e-6 &&
          Math.abs(Math.abs(savedEllipse.B) - Math.abs(e.B)) <= 1e-6,
      G: nearPoint(savedG, r.gergonnePoint),
    };
    return {
      stateVersion,
      valid: true,
      saved: {
        V: V.map(pt),
        P: P.map(pt),
        ellipse: savedEllipse === null ? null : {
          center: pt(savedEllipse.center),
          semiMajor: r6(Math.abs(savedEllipse.A)),
          semiMinor: r6(Math.abs(savedEllipse.B)),
        },
        G: pt(savedG),
        explored,
        names,
      },
      ...r,
      savedMatchesCore,
      status: C.describe(here),
      result: C.result(here),
      note:
        "Track.state saved the four frame corners, the three touch points, the derived ellipse and G plus the two display flags, in the page's 400 x 300 board units. The core rebuilds the whole picture from the corners and touch points, so the saved ellipse and G can be checked against what it actually draws; G is where the cevians from the corners opposite the touch points meet, the image under the circle-to-ellipse stretch of the Gergonne point.",
    };
  } catch (err) {
    return {
      stateVersion,
      valid: false,
      saved: { ...state },
      error: err instanceof Error ? err.message : String(err),
      note:
        "A readable position needs four frame corners and three touch points with finite x and y, and, if present, a finite ellipse centre and semi-axes and a finite G.",
    };
  }
}
