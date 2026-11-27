/*
 * run_game_logic actions and saved-position reader for Two Circles in a Square.
 *
 * ABCD is a square (the page's drags keep a rectangle with horizontal and
 * vertical sides), M lies on the top side AD, N on the bottom side BC, and K
 * slides along MN. The circumcircles of AMK and CNK meet again at P on the
 * diagonal AC. Because AD and BC are parallel, the alternate angles ∠AMK and
 * ∠KNC are equal. In the cyclic quadrilateral AMKP the angles at M and P are
 * opposite, so while the vertices stay in that order ∠APK is the supplement
 * of ∠AMK; then ∠APK + ∠KPC is a straight angle and P lies on AC. Once K
 * slides past P the order on the circle changes and the smaller angle the
 * core measures between PA and PK equals ∠AMK instead — P stays on AC either
 * way. The two circle centres lie on the fixed perpendicular bisectors of AM
 * and CN, so their joining line is the perpendicular bisector of the common
 * chord KP: its direction and length do not change as K slides.
 *
 * Every number below comes from circles-and-square-core.js, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circles-and-square"].CirclesAndSquareCore;
type Core = ReturnType<typeof core>;
type Computed = ReturnType<Core["compute"]>;

type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number };
type Picture = {
  A: Point; B: Point; C: Point; D: Point; M: Point; N: Point; K: Point;
  showNames: boolean; explored: boolean;
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
const clampCos = (v: number) => Math.max(-1, Math.min(1, v));

/** A point as { "x": ..., "y": ... } or [x, y], with a helpful error. */
function readPoint(value: unknown, key: string): Point {
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${key}" must be [x, y]`);
    const x = Number(value[0]), y = Number(value[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`"${key}" must be two finite numbers`);
    }
    return { x, y };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${key}" must be a point { "x": number, "y": number } or [x, y]`);
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
 * Missing points take the opening values; a supplied drawing must obey the
 * constraints the applet's own drag code enforces. */
function readPicture(args: Json): Picture {
  const C = core();
  // start() builds its points in a loop, so TS cannot infer them from start({});
  // the opening drawing really has all seven points.
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

  if (!close(A.y, D.y, 1e-6) || !close(B.y, Cc.y, 1e-6) ||
      !close(A.x, B.x, 1e-6) || !close(D.x, Cc.x, 1e-6)) {
    throw new Error("ABCD must have horizontal top AD and bottom BC and vertical sides AB and CD");
  }
  if (Math.abs(D.x - A.x) < C.MIN_SIDE || Math.abs(A.y - B.y) < C.MIN_SIDE) {
    throw new Error(`the rectangle has collapsed: both its sides must be at least ${C.MIN_SIDE} board units`);
  }
  if (!onSide(M, A, D)) throw new Error("M must lie on the top side AD");
  if (!onSide(N, B, Cc)) throw new Error("N must lie on the bottom side BC");
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
    explored: true,
  };
}

/** Scale for the signed cross product the core uses as the "P is on AC" check. */
const diagonalScale = (C: Core, s: Picture) =>
  Math.max(1, C.dist(s.A, s.D) * C.dist(s.A, s.C));

/** The three angles the core computes, in degrees (NaN becomes null). */
function anglesView(g: Computed) {
  return {
    AMK: num6(deg(g.angleAMK)),
    KNC: num6(deg(g.angleKNC)),
    APK: num6(deg(g.angleAPK)),
    angleAMKMinusKNC: num6(deg(g.angleAMK - g.angleKNC)),
    angleAMKPlusAPK: num6(deg(g.angleAMK + g.angleAPK)),
    equalAtMAndN: close(g.angleAMK, g.angleKNC, 1e-6),
    supplementaryAtP: close(g.angleAMK + g.angleAPK, Math.PI, 1e-6),
  };
}

/** Facts about OQ, the line joining the two circle centres. */
function centreLineView(C: Core, s: Picture, g: Computed) {
  // The generated JS types the compute() fields from their initial values in
  // base, so cast them to the genuine point/circle shapes they hold here.
  const O = g.circleAMK as Circle | null;
  const Q = g.circleCNK as Circle | null;
  const P = g.P as Point | null;
  if (!O || !Q) {
    return {
      O: null, Q: null,
      directionRadians: null, directionDegrees: null, length: null,
      angleWithKP: null, perpendicularToKP: false, circumcentreGap: null,
    };
  }
  const dx = Q.x - O.x, dy = Q.y - O.y;
  const length = Math.hypot(dx, dy);
  const direction = Math.atan2(dy, dx);
  const kx = P ? P.x - g.K.x : NaN;
  const ky = P ? P.y - g.K.y : NaN;
  const chord = Math.hypot(kx, ky);
  const cosine = length && chord ? (dx * kx + dy * ky) / (length * chord) : NaN;
  /* A true circumcentre is equidistant from its three points; the core gets
   * its radius as the mean of those distances, so this gap should be ~0. */
  const spread = (a: number, b: number, c: number) =>
    Math.max(Math.abs(a - b), Math.abs(b - c), Math.abs(a - c));
  const circumcentreGap = Math.max(
    spread(C.dist(O, s.A), C.dist(O, s.M), C.dist(O, s.K)),
    spread(C.dist(Q, s.C), C.dist(Q, s.N), C.dist(Q, s.K)),
  );
  return {
    O: pt(O), Q: pt(Q),
    directionRadians: num6(direction),
    directionDegrees: num6(deg(direction)),
    length: num6(length),
    angleWithKP: num6(deg(Math.acos(clampCos(cosine)))),
    perpendicularToKP: Number.isFinite(cosine) && Math.abs(cosine) < 1e-6,
    circumcentreGap: num6(circumcentreGap),
  };
}

export function actions(): GameActions {
  return {
    circles_and_second_intersection: {
      describe:
        "For a rectangle ABCD with M on the top side AD, N on the bottom side BC and K on MN, report the two circumcircles (centre and radius) of AMK and CNK, their second intersection P besides K, and whether P lies on the diagonal AC (with the signed cross-product residual). Also report the angles ∠AMK, ∠KNC and ∠APK in degrees and the facts about the line joining the circle centres: its direction, length and perpendicularity to the common chord KP. Omitted points take the page's opening square; points may be given as {x,y} or [x,y].",
      args: '{ "A": {"x":127.5,"y":77.5}, "B": {"x":127.5,"y":222.5}, "C": {"x":272.5,"y":222.5}, "D": {"x":272.5,"y":77.5}, "M": {"x":225,"y":77.5}, "N": {"x":150,"y":222.5}, "K": {"x":200.431034,"y":125} }',
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
          PKDistance: num6(g.P ? C.dist(g.P, g.K) : NaN),
          onDiagonalAC: { crossProductResidual: num6(g.acResidual), holds: onDiagonal },
          angles: anglesView(g),
          centreLine: centreLineView(C, s, g),
          tangent: g.tangent,
          degenerate: g.degenerate,
          note: g.degenerate
            ? "The drawing is degenerate: move the points apart so that both circles can be drawn."
            : "The circles meet at K and again at P on the diagonal AC. AD ∥ BC gives ∠AMK = ∠KNC; in the cyclic quadrilateral AMKP the angles at M and P are supplementary while K stays on the M side of P, so ∠APK + ∠KPC is a straight angle and P lies on AC. The centre line is the perpendicular bisector of the common chord KP.",
          status: C.describe(s),
        };
      },
    },

    slide_k_angle_invariants: {
      describe:
        "Keep ABCD, M and N fixed and slide K along MN at fractions ts (0 = M, 1 = N). For each position report P, its distance from K, whether P is on AC, the angles ∠AMK, ∠KNC and ∠APK, and the centre-line direction and length. Then report the spreads: ∠AMK, ∠KNC and the centre line stay constant as K moves, P runs along AC, and the core's smaller angle at P switches from the supplement of ∠AMK to ∠AMK itself when K passes P. Degenerate positions are reported but left out of the spreads.",
      args: '{ "A": {"x":125,"y":75}, "B": {"x":125,"y":225}, "C": {"x":275,"y":225}, "D": {"x":275,"y":75}, "M": {"x":225,"y":75}, "N": {"x":150,"y":225}, "ts": [0.1, 0.25, 0.5, 0.75, 0.9] }',
      run: (args) => {
        const C = core();
        const s = readPicture(args);
        const ts = args.ts === undefined ? [0.1, 0.25, 0.5, 0.75, 0.9] : numArray(args, "ts");
        if (ts.length < 2 || ts.length > 12) {
          throw new Error('"ts" must list between 2 and 12 positions');
        }
        if (ts.some((t) => !(t > 0 && t < 1))) {
          throw new Error("every t must lie strictly between 0 and 1 (K = M or K = N makes the drawing degenerate)");
        }
        const samples = ts.map((t) => {
          const K = { x: s.M.x + t * (s.N.x - s.M.x), y: s.M.y + t * (s.N.y - s.M.y) };
          const q = C.compute({ ...s, K });
          const line = centreLineView(C, s, q);
          return {
            t: r6(t),
            K: pt(K),
            P: pt(q.P),
            PKDistance: num6(q.P ? C.dist(q.P, K) : NaN),
            onDiagonalAC: !q.degenerate && !!q.P &&
              Math.abs(q.acResidual) <= 1e-6 * diagonalScale(C, s),
            angles: anglesView(q),
            centreLine: {
              directionDegrees: line.directionDegrees,
              length: line.length,
              perpendicularToKP: line.perpendicularToKP,
            },
            tangent: q.tangent,
            degenerate: q.degenerate,
          };
        });
        const usable = samples.filter((sample) => !sample.degenerate);
        const spread = (values: (number | null)[]) => {
          const present = values.filter((v): v is number => v !== null);
          return present.length ? r6(Math.max(...present) - Math.min(...present)) : null;
        };
        const amkSpread = spread(usable.map((sample) => sample.angles.AMK));
        const kncSpread = spread(usable.map((sample) => sample.angles.KNC));
        const directionSpread = spread(usable.map((sample) => sample.centreLine.directionDegrees));
        const lengthSpread = spread(usable.map((sample) => sample.centreLine.length));
        return {
          corners: { A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D) },
          sidePoints: { M: pt(s.M), N: pt(s.N) },
          samples,
          invariants: {
            angleAMKSpreadDegrees: amkSpread,
            angleKNCSpreadDegrees: kncSpread,
            centreLineDirectionSpreadDegrees: directionSpread,
            centreLineLengthSpread: lengthSpread,
            angleAMKEqualsKNC: usable.length > 0 && usable.every((x) => x.angles.equalAtMAndN),
            centreLinePerpendicularToKP: usable.length > 0 && usable.every((x) => x.centreLine.perpendicularToKP),
            allOnDiagonalAC: usable.length > 0 && usable.every((x) => x.onDiagonalAC),
          },
          note:
            "Slide K and P runs along the diagonal AC. Because K stays on the fixed line MN, ∠AMK and ∠KNC never change, and the circle centres stay on the fixed perpendicular bisectors of AM and CN, so their joining line keeps its direction and length and stays perpendicular to KP. " +
            `${usable.length} of ${samples.length} positions gave a non-degenerate drawing.`,
        };
      },
    },
  };
}

/** What the core says about the illustration the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Two Circles in a Square state version ${stateVersion}`);
  }
  const C = core();
  const s = readPicture(state);
  const g = C.compute(s);
  const savedP = savedPoint(state.P);
  const savedC1 = savedCircle(state.circleAMK, "circleAMK");
  const savedC2 = savedCircle(state.circleCNK, "circleCNK");
  const savedAMK = num(state, "angleAMK", g.angleAMK);
  const savedKNC = num(state, "angleKNC", g.angleKNC);
  const savedResidual = num(state, "acResidual", g.acResidual);
  const circleGap = (a: Circle | null, b: Circle | null) =>
    a && b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.r)
      ? r6(Math.max(C.dist(a, b), Math.abs(a.r - b.r)))
      : null;
  const gaps = {
    P: savedP && g.P ? r6(C.dist(savedP, g.P)) : null,
    circleAMK: circleGap(savedC1, g.circleAMK),
    circleCNK: circleGap(savedC2, g.circleCNK),
    angleAMK: num6(Math.abs(savedAMK - g.angleAMK)),
    angleKNC: num6(Math.abs(savedKNC - g.angleKNC)),
    acResidual: num6(Math.abs(savedResidual - g.acResidual)),
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
    acResidual: num6(savedResidual),
    angleAMK: num6(savedAMK),
    angleKNC: num6(savedKNC),
    tangent: state.tangent === true,
    degenerate: state.degenerate === true,
    reading: {
      P: pt(g.P),
      circles: { AMK: circleView(g.circleAMK), CNK: circleView(g.circleCNK) },
      onDiagonalAC: { crossProductResidual: num6(g.acResidual), holds: onDiagonal },
      angles: anglesView(g),
      centreLine: centreLineView(C, s, g),
      tangent: g.tangent,
      degenerate: g.degenerate,
      status: C.describe(s),
    },
    agreement: {
      gaps,
      matchesSaved: agrees,
    },
    note: agrees
      ? "The saved drawing is reproduced by the core: P lies on the diagonal AC, ∠AMK = ∠KNC, and the centre line is the perpendicular bisector of KP."
      : "The core recomputes a drawing that differs from the saved one; compare the agreement gaps and the recomputed reading with the saved fields.",
  };
}
