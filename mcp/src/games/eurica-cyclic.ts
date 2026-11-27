/*
 * run_game_logic actions and saved-position reader for EuricaCyclic.
 *
 * Four corners A,B,C,D make two side intersections P = AB ∩ CD and
 * Q = BC ∩ AD. The four circumcircles C(ABQ), C(BCP), C(CDQ) and C(ADP)
 * always share the Miquel point K (Miquel's theorem), and when ABCD is on a
 * circle P, K and Q are collinear. The applet's Other() shortcut only rejects
 * an intersection near P, so it often names B instead; the core keeps both
 * its raw pick (`K`) and the true concurrence point (`Ktrue`). Every number
 * below comes from the real core (eurica-cyclic/eurica-cyclic-core.js),
 * copied into src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number };

/* The generated core is plain JS with a dynamic start() shape and two
 * construct() return shapes; give the tutor the calls it actually uses. */
interface EuricaCyclicCoreShape {
  start(options?: Json): any;
  circlePoint(t: number, c?: Circle, r?: number): Point;
  construct(a: Point, b: Point, c: Point, d: Point, circle: Circle, previous?: Json): any;
  dist(p: Point, q: Point): number;
}
const core = (): EuricaCyclicCoreShape =>
  cores["eurica-cyclic"].EuricaCyclicCore as unknown as EuricaCyclicCoreShape;

/** A required point argument: reject missing or non-numeric coordinates. */
function readPoint(value: unknown, label: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return fallback;
    throw new Error(`missing required point "${label}"`);
  }
  const p = value as Json;
  if (typeof p !== "object" || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
    throw new Error(`${label} must have numeric x and y`);
  }
  return { x: Number(p.x), y: Number(p.y) };
}

/** A point saved by the page may be null when the picture was degenerate. */
function maybePoint(value: unknown): Point | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Json;
  if (!Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) return null;
  return { x: Number(p.x), y: Number(p.y) };
}

function readCircle(value: unknown, fallback: Circle): Circle {
  if (value === undefined || value === null) return fallback;
  const c = value as Json;
  if (typeof c !== "object") throw new Error("circle must have numeric x, y and r");
  const r = num(c, "r");
  if (!(r > 0)) throw new Error("circle radius must be positive");
  return { x: num(c, "x"), y: num(c, "y"), r };
}

/**
 * Corners from four explicit points, or from four angles (degrees) on the
 * given circle. The defaults are the applet's Reset() position.
 */
function readCorners(C: ReturnType<typeof core>, args: Json) {
  const start = C.start();
  const circle = readCircle(args.circle, start.circle);
  if (args.anglesDegrees !== undefined) {
    const raw = args.anglesDegrees;
    if (!Array.isArray(raw) || raw.length !== 4) {
      throw new Error("anglesDegrees must be an array of four numbers");
    }
    const angles = raw.map((v: unknown, i: number) => {
      const a = Number(v);
      if (!Number.isFinite(a)) throw new Error(`anglesDegrees[${i}] is not a number`);
      return a;
    });
    return {
      A: C.circlePoint(angles[0] * Math.PI / 180, circle, circle.r),
      B: C.circlePoint(angles[1] * Math.PI / 180, circle, circle.r),
      C: C.circlePoint(angles[2] * Math.PI / 180, circle, circle.r),
      D: C.circlePoint(angles[3] * Math.PI / 180, circle, circle.r),
      circle,
    };
  }
  return {
    A: readPoint(args.A, "A", start.A),
    B: readPoint(args.B, "B", start.B),
    C: readPoint(args.C, "C", start.C),
    D: readPoint(args.D, "D", start.D),
    circle,
  };
}

function geometry(C: ReturnType<typeof core>, args: Json) {
  const corners = readCorners(C, args);
  const g = C.construct(corners.A, corners.B, corners.C, corners.D, corners.circle);
  if (!g || !g.ok) {
    throw new Error("those corners make a degenerate construction: move them apart and retry");
  }
  return { corners, g };
}

const r2 = (n: number) => Number(n.toFixed(2));

function pickNote(g: ReturnType<ReturnType<typeof core>["construct"]>): string {
  return g.claims.appletKIsMiquel
    ? "The applet's Other() shortcut happens to find the Miquel point here."
    : "The applet's Other() shortcut names B instead of K: it rejects a point near P, but the point to reject is B.";
}

export function actions(): GameActions {
  return {
    miquel_point: {
      describe:
        "For four corners A,B,C,D (given as points or as anglesDegrees on a circle), report P = AB ∩ CD, Q = BC ∩ AD and the true Miquel point K common to circles C(ABQ), C(BCP), C(CDQ) and C(ADP); say whether P,K,Q are collinear and whether the applet's Other() shortcut found the same K.",
      args: '{ "anglesDegrees": [0, 22.5, 45, 247.5] }',
      run: (args) => {
        const C = core();
        const { corners, g } = geometry(C, args);
        return {
          A: corners.A, B: corners.B, C: corners.C, D: corners.D, circle: corners.circle,
          P: g.P, Q: g.Q,
          K: g.Ktrue,
          appletK: g.K,
          circleRadii: {
            QKBA: g.circles.QKBA.r,
            BKPC: g.circles.BKPC.r,
            KCDQ: g.circles.KCDQ.r,
            AKPD: g.circles.AKPD.r,
          },
          concurrent: g.claims.concurrent,
          collinear: g.claims.collinear,
          cyclic: g.claims.cyclic,
          appletKIsMiquel: g.claims.appletKIsMiquel,
          concurrencyError: g.measures.concurrencyError,
          collinearError: g.measures.collinearError,
          note:
            `K = (${r2(g.Ktrue.x)}, ${r2(g.Ktrue.y)}) lies on all four circles. `
            + (g.claims.collinear ? "P, K and Q are collinear. " : "P, K and Q are not collinear here. ")
            + pickNote(g),
        };
      },
    },
    applet_shortcut: {
      describe:
        "Compare the two intersections of circles C(ABQ) and C(BCP): the applet's Other() rejects the one within one unit of P and keeps the other, but the shared point of those circles is B, not P. Returns both candidates, which is B, which really lies on all four circles, and what the applet drew.",
      args: '{ "anglesDegrees": [0, 22.5, 45, 247.5] }',
      run: (args) => {
        const C = core();
        const { corners, g } = geometry(C, args);
        const keys = ["QKBA", "BKPC", "KCDQ", "AKPD"];
        const candidates = g.pair.map((p: Point) => ({
          point: p,
          distanceToB: C.dist(p, corners.B),
          distanceToP: C.dist(p, g.P),
          errorToAllFour: Math.max.apply(null, keys.map((key) =>
            Math.abs(C.dist(p, { x: g.circles[key].x, y: g.circles[key].y }) - g.circles[key].r))),
        }));
        return {
          B: corners.B, P: g.P, Q: g.Q,
          candidates,
          appletK: g.K,
          trueK: g.Ktrue,
          appletPickIsB: C.dist(g.K, corners.B) < 1e-6,
          appletKIsMiquel: g.claims.appletKIsMiquel,
          distanceFromAppletPickToK: C.dist(g.K, g.Ktrue),
          note:
            `C(ABQ) and C(BCP) meet at B and at K = (${r2(g.Ktrue.x)}, ${r2(g.Ktrue.y)}). `
            + (g.claims.appletKIsMiquel
              ? "The first listed intersection was K, so the shortcut drew K. "
              : "The first listed intersection was B, so the shortcut drew B. ")
            + "The one-unit test against P does not find the point to discard.",
        };
      },
    },
  };
}

/** The saved fields, plus a fresh reading of them through the real core. */
export function position(state: Json, stateVersion?: number): unknown {
  const C = core();
  const start = C.start();
  const A = readPoint(state.A, "A", start.A);
  const B = readPoint(state.B, "B", start.B);
  const Cc = readPoint(state.C, "C", start.C);
  const D = readPoint(state.D, "D", start.D);
  const circle = maybePoint(state.circle)
    ? { ...maybePoint(state.circle)!, r: num(state.circle as Json, "r", start.circle.r) }
    : start.circle;
  const g = C.construct(A, B, Cc, D, circle);
  const savedK = maybePoint(state.K);
  const savedAppletK = maybePoint(state.appletK);

  return {
    stateVersion: stateVersion ?? 1,
    // The fields the page saved with Track.state, echoed unchanged.
    A, B, C: Cc, D, circle,
    P: maybePoint(state.P),
    Q: maybePoint(state.Q),
    K: savedK,
    appletK: savedAppletK,
    circles: state.circles ?? null,
    options: state.options ?? null,
    claims: state.claims ?? null,
    // What the core makes of that saved picture.
    derived: {
      ok: !!g && g.ok,
      P: g && g.P,
      Q: g && g.Q,
      K: g && g.Ktrue,
      appletK: g && g.K,
      circles: g && g.circles,
      concurrent: !!(g && g.claims.concurrent),
      collinear: !!(g && g.claims.collinear),
      cyclic: !!(g && g.claims.cyclic),
      appletKIsMiquel: !!(g && g.claims.appletKIsMiquel),
      appletPickIsB: !!g && C.dist(g.K, B) < 1e-6,
      savedKIsMiquel: savedK === null || !g ? null : C.dist(savedK, g.Ktrue) < 1e-6,
      savedAppletKMatches: savedAppletK === null || !g ? null : C.dist(savedAppletK, g.K) < 1e-6,
      concurrencyError: g && g.measures.concurrencyError,
      collinearError: g && g.measures.collinearError,
      note: !g || !g.ok
        ? "The saved corners make a degenerate picture: no four circles can be drawn."
        : `All four circles pass through K = (${r2(g.Ktrue.x)}, ${r2(g.Ktrue.y)}). `
          + (g.claims.collinear
            ? "P, K and Q line up. "
            : `P, K and Q miss collinearity by ${r2(g.measures.collinearError)} units`
              + (g.claims.cyclic
                ? ", although the applet's one-unit on-circle test still calls ABCD cyclic. "
                : ", as happens once a corner leaves the circle. "))
          + pickNote(g),
    },
  };
}
