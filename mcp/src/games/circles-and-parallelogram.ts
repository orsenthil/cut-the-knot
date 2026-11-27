/*
 * run_game_logic actions and saved-position reader for Circles And Parallelogram.
 *
 * ABCD is a parallelogram, M lies on AB, N on CD and K slides along MN. The
 * circumcircles of AMK and CNK meet again at P, which always lies on the
 * diagonal AC. As K slides, the line KP keeps the same angle with AC and the
 * line through the two circle centres keeps both its direction and its length;
 * the centre line is the perpendicular bisector of the common chord KP. When
 * P comes within half a unit of K the circles are tangent and the common
 * tangent keeps that same angle. Every number below comes from the game's real
 * core, copied into src/generated/cores/ at build time. See _shared.ts for the
 * shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circles-and-parallelogram"].CirclesAndParallelogramCore;

type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number };
type Picture = {
  A: Point; B: Point; C: Point; D: Point; M: Point; N: Point; K: Point;
  showNames: boolean; showCenterLine: boolean; showHint: boolean; explored: boolean;
};

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const deg = (v: number) => (v * 180) / Math.PI;
/** Print a core number as JSON, turning the core's NaN into null. */
const num6 = (v: number) => (Number.isFinite(v) ? r6(v) : null);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const circleView = (c: Circle | null | undefined) =>
  c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)
    ? { center: { x: r6(c.x), y: r6(c.y) }, radius: r6(c.r) }
    : null;
const close = (a: number, b: number, tol: number) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

function readPoint(value: unknown, key: string): Point {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${key}" must be a point { "x": number, "y": number }`);
  }
  const o = value as Json;
  return { x: num(o, "x"), y: num(o, "y") };
}

function savedPoint(value: unknown): Point | null {
  try {
    return readPoint(value, "point");
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

/** A point lies on a horizontal side if its y matches and its x is between the ends. */
function onSide(p: Point, from: Point, to: Point): boolean {
  const lo = Math.min(from.x, to.x) - 1e-3, hi = Math.max(from.x, to.x) + 1e-3;
  return Math.abs(p.y - from.y) <= 1e-3 && p.x >= lo && p.x <= hi;
}

/* The seven draggable points of the page, in its 400 by 300 board units.
 * Missing points take the page's opening values; a supplied drawing must obey
 * the constraints the applet's own drag code enforces. */
function readPicture(args: Json): Picture {
  const C = core();
  // The generated JS builds these properties in a loop, so TS cannot infer
  // them from start({}); the opening drawing really has all seven points.
  const d = C.start({}) as unknown as {
    A: Point; B: Point; C: Point; D: Point; M: Point; N: Point; K: Point;
  };
  const A = args.A === undefined ? d.A : readPoint(args.A, "A");
  const B = args.B === undefined ? d.B : readPoint(args.B, "B");
  const Cc = args.C === undefined ? d.C : readPoint(args.C, "C");
  const D = args.D === undefined ? d.D : readPoint(args.D, "D");
  const M = args.M === undefined ? d.M : readPoint(args.M, "M");
  const N = args.N === undefined ? d.N : readPoint(args.N, "N");
  const K = args.K === undefined ? d.K : readPoint(args.K, "K");

  if (!close(A.y, B.y, 1e-6) || !close(Cc.y, D.y, 1e-6)) {
    throw new Error("A and B must share a y and C and D a y: the page keeps two horizontal sides");
  }
  if (!close(B.x - A.x, Cc.x - D.x, 1e-6)) {
    throw new Error("AB and DC must be equally long: ABCD must be a parallelogram");
  }
  if (Math.abs(B.x - A.x) < 20 || Math.abs(A.y - Cc.y) < 20) {
    throw new Error("the parallelogram has collapsed: both its base and its height must be at least 20 board units");
  }
  if (!onSide(M, A, B)) throw new Error("M must lie on side AB");
  if (!onSide(N, D, Cc)) throw new Error("N must lie on side CD");
  const lineGap = Math.abs(C.cross(M, N, K)) / Math.max(1e-9, C.dist(M, N));
  if (lineGap > 1e-3) throw new Error("K must lie on the line MN: the applet snaps K onto that line");
  for (const [name, p] of [["A", A], ["B", B], ["C", Cc], ["D", D], ["M", M], ["N", N], ["K", K]] as const) {
    if (p.x < C.MARGIN - 1e-6 || p.x > C.WIDTH - C.MARGIN + 1e-6 ||
        p.y < C.MARGIN - 1e-6 || p.y > C.HEIGHT - C.MARGIN + 1e-6) {
      throw new Error(`${name} is outside the ${C.WIDTH} by ${C.HEIGHT} board (margin ${C.MARGIN})`);
    }
  }
  return {
    A, B, C: Cc, D, M, N, K,
    showNames: args.showNames === true,
    showCenterLine: args.showCenterLine === true,
    showHint: args.showHint === true,
    explored: true,
  };
}

/** Scale for the signed cross product the core uses as the "P is on AC" check. */
const diagonalScale = (C: ReturnType<typeof core>, s: Picture) =>
  Math.max(1, C.dist(s.A, s.B) * C.dist(s.A, s.C));

export function actions(): GameActions {
  return {
    circles_and_second_intersection: {
      describe:
        "For a parallelogram ABCD, M on AB, N on CD and K on MN, report the two circumcircles of AMK and CNK (centre and radius), their second intersection P besides K, and whether P lies on the diagonal AC. Also report the angle KP makes with AC, the direction and length of the line joining the circle centres, and whether the circles are tangent. Omitted points take the page's opening drawing.",
      args: '{ "A": {"x":125,"y":225}, "B": {"x":313,"y":225}, "C": {"x":275,"y":75}, "D": {"x":87,"y":75}, "M": {"x":250.333333,"y":225}, "N": {"x":243.666667,"y":75}, "K": {"x":248.111111,"y":175} }',
      run: (args) => {
        const C = core();
        const s = readPicture(args);
        const g = C.compute(s);
        const onDiagonal = !g.degenerate && !!g.P &&
          Math.abs(g.acResidual) <= 1e-6 * diagonalScale(C, s);
        return {
          corners: { A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D) },
          sidePoints: { M: pt(s.M), N: pt(s.N), K: pt(s.K) },
          circles: { AMK: circleView(g.circleAMK), CNK: circleView(g.circleCNK) },
          P: pt(g.P),
          onDiagonalAC: { crossProductResidual: num6(g.acResidual), holds: onDiagonal },
          kpAngle: { radians: num6(g.kpAngle), degrees: num6(deg(g.kpAngle)) },
          centerLine: {
            O: pt(g.circleAMK),
            Q: pt(g.circleCNK),
            directionRadians: num6(g.centerAngle),
            directionDegrees: num6(deg(g.centerAngle)),
            length: num6(g.centerLength),
          },
          tangent: g.tangent,
          tangentAngleDegrees: num6(deg(g.tangentAngle)),
          degenerate: g.degenerate,
          note: g.degenerate
            ? "The drawing is degenerate: move the points apart so that both circles can be drawn."
            : `The two circles meet at K and again at P on the diagonal AC; KP meets AC at ${num6(deg(g.kpAngle))}°. ` +
              "The centre line is perpendicular to the common chord KP, and its ends are fixed by the perpendicular bisectors of AM and CN, so it keeps the same direction and length as K slides." +
              (g.tangent ? " Here P nearly coincides with K: the circles are tangent and the common tangent keeps that angle with AC." : ""),
          status: C.describe(s),
        };
      },
    },

    slide_k_invariants: {
      describe:
        "Keep ABCD, M and N fixed and slide K along MN at several fractions t (0 = M, 1 = N). For each position report P, the angle KP makes with AC, and the direction and length of the centre line; the reported spreads check that the angle and the centre line do not change with K. Positions that make the drawing degenerate are reported but left out of the spreads.",
      args: '{ "A": {"x":125,"y":225}, "B": {"x":313,"y":225}, "C": {"x":275,"y":75}, "D": {"x":87,"y":75}, "M": {"x":250.333333,"y":225}, "N": {"x":243.666667,"y":75}, "ts": [0.1, 0.25, 0.5, 0.75, 0.9] }',
      run: (args) => {
        const C = core();
        const s = readPicture(args);
        const ts = args.ts === undefined ? [0.1, 0.25, 0.5, 0.75, 0.9] : numArray(args, "ts");
        if (ts.length < 2 || ts.length > 12) throw new Error('"ts" must list between 2 and 12 positions');
        if (ts.some((t) => !(t > 0 && t < 1))) {
          throw new Error('every t must lie strictly between 0 and 1 (K = M or K = N makes the drawing degenerate)');
        }
        const samples = ts.map((t) => {
          const K = { x: s.M.x + t * (s.N.x - s.M.x), y: s.M.y + t * (s.N.y - s.M.y) };
          const q = C.compute({ ...s, K });
          return {
            t: r6(t),
            K: pt(K),
            P: pt(q.P),
            onDiagonalAC: !q.degenerate && !!q.P &&
              Math.abs(q.acResidual) <= 1e-6 * diagonalScale(C, s),
            kpAngleDegrees: num6(deg(q.kpAngle)),
            centerLineDirectionDegrees: num6(deg(q.centerAngle)),
            centerLineLength: num6(q.centerLength),
            tangent: q.tangent,
            degenerate: q.degenerate,
          };
        });
        const usable = samples.filter((sample) => !sample.degenerate);
        const spread = (values: (number | null)[]) => {
          const present = values.filter((v): v is number => v !== null);
          return present.length ? r6(Math.max(...present) - Math.min(...present)) : null;
        };
        const kpSpread = spread(usable.map((sample) => sample.kpAngleDegrees));
        const directionSpread = spread(usable.map((sample) => sample.centerLineDirectionDegrees));
        const lengthSpread = spread(usable.map((sample) => sample.centerLineLength));
        return {
          corners: { A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D) },
          sidePoints: { M: pt(s.M), N: pt(s.N) },
          samples,
          invariants: {
            kpAngleSpreadDegrees: kpSpread,
            centerLineDirectionSpreadDegrees: directionSpread,
            centerLineLengthSpread: lengthSpread,
            kpAngleConstant: kpSpread !== null && kpSpread < 1e-4,
            centerLineConstant: directionSpread !== null && lengthSpread !== null &&
              directionSpread < 1e-4 && lengthSpread < 1e-4,
          },
          note:
            "Slide K: P runs along the diagonal AC, yet KP always meets AC at the same angle. " +
            "The centre line stays at the same direction and length because it is the perpendicular bisector of KP with its ends pinned to the fixed bisectors of AM and CN. " +
            `${usable.length} of ${samples.length} positions gave a non-degenerate drawing.`,
        };
      },
    },
  };
}

/** What the core says about the illustration the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circles And Parallelogram state version ${stateVersion}`);
  }
  const C = core();
  const s = readPicture(state);
  const g = C.compute(s);
  const savedP = savedPoint(state.P);
  const savedC1 = savedCircle(state.circleAMK, "circleAMK");
  const savedC2 = savedCircle(state.circleCNK, "circleCNK");
  const savedKp = num(state, "kpAngle", g.kpAngle);
  const savedCenterAngle = num(state, "centerAngle", g.centerAngle);
  const savedCenterLength = num(state, "centerLength", g.centerLength);
  const circleGap = (a: Circle | null, b: Circle | null) =>
    a && b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.r)
      ? r6(Math.max(C.dist(a, b), Math.abs(a.r - b.r)))
      : null;
  const gaps = {
    P: savedP && g.P ? r6(C.dist(savedP, g.P)) : null,
    circleAMK: circleGap(savedC1, g.circleAMK),
    circleCNK: circleGap(savedC2, g.circleCNK),
    kpAngle: r6(Math.abs(savedKp - g.kpAngle)),
    centerAngle: r6(Math.abs(savedCenterAngle - g.centerAngle)),
    centerLength: r6(Math.abs(savedCenterLength - g.centerLength)),
  };
  const agrees = Object.values(gaps).every((gap) => gap !== null && gap < 1e-3);
  const onDiagonal = !g.degenerate && !!g.P &&
    Math.abs(g.acResidual) <= 1e-6 * diagonalScale(C, s);
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged.
    A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D),
    M: pt(s.M), N: pt(s.N), K: pt(s.K),
    P: pt(savedP),
    circleAMK: circleView(savedC1),
    circleCNK: circleView(savedC2),
    kpAngle: savedKp,
    centerAngle: savedCenterAngle,
    centerLength: savedCenterLength,
    tangent: state.tangent === true,
    degenerate: state.degenerate === true,
    reading: {
      P: pt(g.P),
      circles: { AMK: circleView(g.circleAMK), CNK: circleView(g.circleCNK) },
      onDiagonalAC: { crossProductResidual: num6(g.acResidual), holds: onDiagonal },
      kpAngle: { radians: num6(g.kpAngle), degrees: num6(deg(g.kpAngle)) },
      centerLine: {
        directionRadians: num6(g.centerAngle),
        directionDegrees: num6(deg(g.centerAngle)),
        length: num6(g.centerLength),
      },
      tangentAngleDegrees: num6(deg(g.tangentAngle)),
      tangent: g.tangent,
      degenerate: g.degenerate,
      status: C.describe(s),
    },
    agreement: {
      gaps,
      matchesSaved: agrees,
    },
    note: agrees
      ? `The saved drawing is reproduced: P lies on AC and KP meets AC at ${num6(deg(g.kpAngle))}°. Sliding K leaves that angle and the centre line (length ${num6(g.centerLength)}) unchanged.`
      : "The core recomputes a drawing that differs from the saved one; compare the agreement gaps and the recomputed reading with the saved fields.",
  };
}
