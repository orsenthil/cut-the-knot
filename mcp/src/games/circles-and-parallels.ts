/*
 * run_game_logic actions and saved-position reader for Circles And Parallels.
 *
 * P slides on side AB of triangle ABC. PN is drawn parallel to BC (N on AC)
 * and PM parallel to AC (M on BC). The circumcircles of APN and BPM meet at P
 * and again at Q, and the line PQ always passes through one fixed point X:
 * the intersection of the tangents to the circumcircle of ABC at A and at B,
 * equivalently the apex of the isosceles triangle on AB with base angle C.
 * The reason is power of a point: XA and XB are tangents to both circles (by
 * the homothety at A and at B), so X has equal power and lies on their radical
 * axis, which for intersecting circles is the common chord PQ.
 *
 * Every number below comes from the real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circles-and-parallels"].CirclesAndParallelsCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number };
type Triangle = { A: Point; B: Point; C: Point };
type State = Triangle & { P: Point; coefP: number; showNames: boolean; showHint: boolean };

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
/** Print a core number as JSON, turning the core's NaN into null. */
const num6 = (v: number) => (Number.isFinite(v) ? r6(v) : null);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const circleView = (c: Circle | null | undefined) =>
  c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)
    ? { center: { x: r6(c.x), y: r6(c.y) }, radius: r6(c.r) }
    : null;

/** Accept the page's saved {x, y} as well as [x, y] argument arrays. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  if (fallback) return fallback;
  throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
}

function savedPoint(value: unknown): Point | null {
  try {
    return readPoint({ p: value }, "p");
  } catch {
    return null;
  }
}

function savedCircle(value: unknown, key: string): Circle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Json;
  try {
    return { x: num(o, "x"), y: num(o, "y"), r: num(o, "r") };
  } catch {
    throw new Error(`saved ${key} must be a circle { "x": number, "y": number, "r": number }`);
  }
}

/** Keep the tutor's inputs to drawings the page itself can show. */
function readTriangle(C: Core, args: Json): Triangle {
  const d = C.start({}) as unknown as Triangle;
  const A = readPoint(args, "A", d.A);
  const B = readPoint(args, "B", d.B);
  const Cc = readPoint(args, "C", d.C);
  for (const [name, p] of [["A", A], ["B", B], ["C", Cc]] as const) {
    if (p.x < C.MARGIN - 1e-6 || p.x > C.WIDTH - C.MARGIN + 1e-6 ||
        p.y < C.MARGIN - 1e-6 || p.y > C.HEIGHT - C.MARGIN + 1e-6) {
      throw new Error(`${name} is outside the ${C.WIDTH} by ${C.HEIGHT} board (margin ${C.MARGIN})`);
    }
  }
  if (C.dist(A, B) < C.MIN_SIDE) {
    throw new Error("A and B must be at least 20 board units apart to draw the two circles");
  }
  if (Math.abs(C.cross(A, B, Cc)) < C.MIN_AREA) {
    throw new Error("A, B and C are nearly in a line: the triangle has collapsed");
  }
  return { A, B, C: Cc };
}

/** Rebuild a state at one fraction along AB (0 = B, 1 = A, as in the core). */
function makeState(C: Core, tri: Triangle, coef: number): State {
  if (!Number.isFinite(coef) || coef <= 0 || coef >= 1) {
    throw new Error('"coefP" must be a fraction strictly between 0 and 1 (P = A or B makes the drawing degenerate)');
  }
  const s = C.start({ A: tri.A, B: tri.B, C: tri.C, coefP: coef }) as unknown as State;
  if (C.dist(s.P, tri.A) < C.NEAR || C.dist(s.P, tri.B) < C.NEAR) {
    throw new Error(`P is within ${C.NEAR} units of A or B: the page stops drawing the circles there`);
  }
  return s;
}

/** The page's opening triangle is used for missing corners; P may be a point or a fraction. */
function readPicture(args: Json): State {
  const C = core();
  const tri = readTriangle(C, args);
  let coef = num(args, "coefP", C.COEF);
  if (args.P !== undefined) {
    const p = readPoint(args, "P");
    const t = C.projection(tri.A, tri.B, p);
    if (C.dist(p, C.along(tri.A, tri.B, t)) > 1e-3 * Math.max(1, C.dist(tri.A, tri.B))) {
      throw new Error('"P" must lie on the side AB (the page snaps P onto AB)');
    }
    coef = t;
  }
  return makeState(C, tri, coef);
}

/** Everything the core measures about one drawing, in tutor-friendly units. */
function picture(C: Core, s: State) {
  const g = C.compute(s);
  const finiteX = C.finite(g.X), finiteXtan = C.finite(g.Xtan);
  const xGap = finiteX && finiteXtan ? C.dist(g.X, g.Xtan) : NaN;
  const onLine = num6(g.onLine);
  /* The generated core's compute() starts from a base with line: null and
   * fills it in with Object.assign, so TS infers never here; the real value is
   * { p, q } (or null). */
  const line = g.line as unknown as { p: Point; q: Point } | null;
  return {
    P: pt(s.P),
    coefP: r6(s.coefP),
    points: { N: pt(g.N), M: pt(g.M), Q: pt(g.Q), X: pt(g.X), Xtan: pt(g.Xtan) },
    circles: {
      APN: circleView(g.circleAPN),
      BPM: circleView(g.circleBPM),
      circumABC: circleView(g.circum),
    },
    fixedPoint: {
      X: pt(g.X),
      tangentIntersection: pt(g.Xtan),
      distanceBetweenConstructions: num6(xGap),
      samePoint: Number.isFinite(xGap) && xGap < 1e-3,
    },
    linePQ: line && C.finite(line.q)
      ? { through: pt(line.p), toward: pt(line.q) }
      : null,
    passesThroughX: {
      signedDistance: onLine,
      holds: onLine !== null && Math.abs(onLine) < 1e-6,
    },
    tangent: g.tangent === true,
    degenerate: g.degenerate === true,
    noDraw: g.noDraw === true,
    status: C.describe(s),
  };
}

export function actions(): GameActions {
  return {
    circles_and_fixed_point: {
      describe:
        "For triangle ABC and a point P on side AB (give P as {x, y} or as a fraction coefP along AB, 0 = B and 1 = A), report the parallel points N on AC and M on BC, the circumcircles of APN and BPM (centre and radius), their second meeting Q besides P, and the fixed point X that PQ always passes through. Also report X as the intersection of the tangents at A and B to the circumcircle of ABC, the signed distance from X to PQ, and whether the circles are tangent. Omitted corners take the page's opening triangle.",
      args: '{ "A": {"x":85,"y":80}, "B": {"x":240,"y":180}, "C": {"x":320,"y":60}, "coefP": 0.7 }',
      run: (args) => {
        const C = core();
        const s = readPicture(args);
        const v = picture(C, s);
        return {
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          ...v,
          note: v.noDraw
            ? "P is too close to A or B, so the page draws no circles; move P towards the middle of AB."
            : v.degenerate
              ? "The drawing is degenerate: move the corners apart so both circles and X can be drawn."
              : `The circles meet at P and Q, and PQ passes through X at ${JSON.stringify(v.fixedPoint.X)}. ` +
                "X is where the tangents at A and B to the circumcircle of ABC meet; it makes an isosceles triangle on AB with base angle C. " +
                (v.tangent
                  ? "Here the circles touch at P, so their common tangent (perpendicular to the centre line) takes the place of PQ and still goes through X."
                  : "Slide P and X stays put: XA and XB are tangents to both circles, so X lies on their radical axis, the common chord PQ."),
        };
      },
    },

    slide_p_fixed_point: {
      describe:
        "Keep triangle ABC fixed and slide P along AB at several fractions coefP (0 = B, 1 = A). For each position report Q, the fixed point X and the signed distance from X to the line PQ. The spread of X and the largest distance check that X never moves and that PQ always passes through it, including positions where the circles are tangent. Corners may be [x, y] or {x, y}; 3 to 12 fractions strictly between 0 and 1 are accepted.",
      args: '{ "A": {"x":85,"y":80}, "B": {"x":240,"y":180}, "C": {"x":320,"y":60}, "coefP": [0.1, 0.3, 0.5, 0.7, 0.9] }',
      run: (args) => {
        const C = core();
        const tri = readTriangle(C, args);
        const coefs = args.coefP === undefined ? [0.1, 0.3, 0.5, 0.7, 0.9] : numArray(args, "coefP");
        if (coefs.length < 3 || coefs.length > 12) {
          throw new Error('"coefP" must list between 3 and 12 fractions');
        }
        const samples = coefs.map((t) => {
          const s = makeState(C, tri, t);
          const v = picture(C, s);
          return {
            coefP: v.coefP,
            P: v.P,
            Q: v.points.Q,
            X: v.points.X,
            signedDistanceToX: v.passesThroughX.signedDistance,
            tangent: v.tangent,
            degenerate: v.degenerate,
          };
        });
        const usable = samples.filter((sample) => !sample.degenerate && sample.X);
        const xs = usable.map((sample) => sample.X as { x: number; y: number });
        const spread = xs.length
          ? r6(Math.max(...xs.map((p) => Math.hypot(p.x - xs[0].x, p.y - xs[0].y))))
          : null;
        const maxDistance = usable.length
          ? r6(Math.max(...usable.map((sample) => Math.abs(sample.signedDistanceToX as number))))
          : null;
        return {
          triangle: { A: pt(tri.A), B: pt(tri.B), C: pt(tri.C) },
          samples,
          invariants: {
            xSpread: spread,
            xFixed: spread !== null && spread < 1e-6,
            maxDistanceToLine: maxDistance,
            pqAlwaysThroughX: maxDistance !== null && maxDistance < 1e-6,
          },
          note:
            "As P slides, the two circles change but X is the same point each time: the tangents at A and B to the circumcircle of ABC build it from the triangle alone. " +
            `Across ${usable.length} usable positions, X moved at most ${spread} units and PQ missed X by at most ${maxDistance} units. ` +
            "The equal-power argument explains it: XA and XB are tangent to both circles, so X lies on their radical axis PQ.",
        };
      },
    },
  };
}

/** What the core says about the drawing the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circles And Parallels state version ${stateVersion}`);
  }
  const C = core();
  const s = readPicture(state);
  const g = C.compute(s);
  const savedN = savedPoint(state.N);
  const savedM = savedPoint(state.M);
  const savedQ = savedPoint(state.Q);
  const savedX = savedPoint(state.X);
  const savedAPN = savedCircle(state.circleAPN, "circleAPN");
  const savedBPM = savedCircle(state.circleBPM, "circleBPM");
  const savedOnLine = num(state, "onLine", g.onLine);
  const view = picture(C, s);
  const gap = (a: Point | null, b: Point | null) =>
    a && b && C.finite(b) ? r6(C.dist(a, b)) : null;
  const circleGap = (a: Circle | null, b: Circle | null) =>
    a && b && C.finite(b) && Number.isFinite(b.r)
      ? r6(Math.max(C.dist(a, b), Math.abs(a.r - b.r)))
      : null;
  const gaps = {
    N: gap(savedN, g.N),
    M: gap(savedM, g.M),
    Q: gap(savedQ, g.Q),
    X: gap(savedX, g.X),
    circleAPN: circleGap(savedAPN, g.circleAPN),
    circleBPM: circleGap(savedBPM, g.circleBPM),
    onLine: r6(Math.abs(savedOnLine - g.onLine)),
  };
  const agrees = Object.values(gaps).every((v) => v !== null && v < 1e-3);
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged.
    A: pt(s.A), B: pt(s.B), C: pt(s.C), P: pt(s.P),
    N: pt(savedN), M: pt(savedM), Q: pt(savedQ), X: pt(savedX),
    coefP: r6(s.coefP),
    circleAPN: circleView(savedAPN),
    circleBPM: circleView(savedBPM),
    onLine: savedOnLine,
    tangent: state.tangent === true,
    noDraw: state.noDraw === true,
    reading: {
      ...view,
      note: view.noDraw
        ? "P is too close to A or B, so no circles are drawn; move P towards the middle of AB."
        : view.degenerate
          ? "The saved drawing is degenerate: the circles or X cannot be constructed."
          : `X is fixed at ${JSON.stringify(view.fixedPoint.X)}, and PQ passes through it to within ${view.passesThroughX.signedDistance} units. ` +
            "X is the intersection of the tangents at A and B to the circumcircle of ABC; it never changes as P slides on AB.",
    },
    agreement: { gaps, matchesSaved: agrees },
    note: agrees
      ? `The saved drawing is reproduced: the circles meet again at Q and PQ passes through the fixed point X, the intersection of the tangents at A and B.`
      : "The core recomputes a drawing that differs from the saved one; compare the agreement gaps with the recomputed reading.",
  };
}
