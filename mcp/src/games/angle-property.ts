/*
 * run_game_logic actions and saved-position reader for Angle Property.
 *
 * The picture inverts a circle in a second circle of radius R about O: the
 * green circle becomes the red one. Inversion keeps the size of angles, so the
 * tangents where the line OT cuts the two circles make the same angles with
 * OT. Every number below comes from the game's real core
 * (angle-property/angle-property-core.js), copied into src/generated/cores/ at
 * build time. See _shared.ts for the shape of a game module.
 *
 * The page offers only a positive power R^2. The formula for a negative power
 * (|k| in place of R^2) is checked only in porting/check-angle-property.mjs —
 * there is no control for it in the UI.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["angle-property"].AnglePropertyCore;

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };
type CircleView = { kind: "circle"; center: Point; radius: number };
type LineView = { kind: "line"; point: Point | null; direction: Point | null };
type ImageView = CircleView | LineView;

const r4 = (v: number): number => Number(v.toFixed(4));
const pt = (p: Point): Point => ({ x: r4(p.x), y: r4(p.y) });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });

/** Accept both the page's {x, y} points and [x, y] tool arguments. */
function readPoint(value: unknown, name: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return fallback;
    throw new Error(`missing argument "${name}"`);
  }
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${name}" must be [x, y]`);
    x = Number(value[0]);
    y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`"${name}" must be [x, y] or {"x": ..., "y": ...}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${name}" must have finite numeric x and y`);
  }
  return { x, y };
}

function readCircle(value: unknown, name: string): Circle {
  if (!value || typeof value !== "object") {
    throw new Error(`"${name}" must be {"center": [x, y], "radius": r}`);
  }
  const o = value as Json;
  const center = readPoint(o.center, `${name}.center`);
  const radius = num(o, "radius");
  if (!(radius > 0)) throw new Error(`"${name}.radius" must be positive`);
  return { center, radius };
}

function positiveRadius(args: Json, key: string): number {
  const value = num(args, key);
  if (!(value > 0)) throw new Error(`"${key}" must be positive`);
  return value;
}

/** A plain-JSON view of the core's circle-or-line image. */
function imageView(image: unknown): ImageView {
  const im = (image ?? {}) as Json;
  if (im.kind === "circle") {
    return { kind: "circle", center: pt(readPoint(im.center, "image centre")), radius: r4(num(im, "radius")) };
  }
  if (im.kind === "line") {
    return {
      kind: "line",
      point: im.point ? pt(readPoint(im.point, "image line point")) : null,
      direction: im.direction ? pt(readPoint(im.direction, "image line direction")) : null,
    };
  }
  throw new Error(`the core returned an unknown image kind ${JSON.stringify(im.kind)}`);
}

/** The two tangent angles where a line through O cuts a circle and its image. */
function crossingAngles(C: ReturnType<typeof core>, O: Point, T: Point, target: Circle, image: Circle) {
  const u = sub(T, O);
  if (Math.hypot(u.x, u.y) < 1e-9) throw new Error('"T" must not be the centre O');
  const original = C.lineCircleIntersections(O, T, target) as Point[];
  const inverted = C.lineCircleIntersections(O, T, image) as Point[];
  if (original.length !== 2 || inverted.length !== 2) return null;
  // Inversion swaps the near and far crossings of a line through O.
  const nearFirst = (ps: Point[]) => ps.slice().sort((a, b) => C.dist(O, a) - C.dist(O, b));
  const a = nearFirst(original);
  const b = nearFirst(inverted).reverse();
  return a.map((p, i) => {
    const q = b[i];
    const t1 = C.tangentEnds(p, target) as Point[];
    const t2 = C.tangentEnds(q, image) as Point[];
    const first = C.angleBetween(sub(t1[0], t1[1]), u) as number;
    const second = C.angleBetween(sub(t2[0], t2[1]), u) as number;
    return {
      point: pt(p), imagePoint: pt(q),
      original: r4(first), inverted: r4(second),
      equal: Math.abs(first - second) < 1e-6,
    };
  });
}

export function actions(): GameActions {
  return {
    invert_circle: {
      describe:
        "Invert a circle (centre and radius) in the circle of radius R about O. Reports the power d = OC^2 - r^2, the image: a circle, or a straight line when |d| <= 100 (the applet's drawing tolerance), and a check that points moved from the original circle to the image obey OX * OX' = R^2. If a line OT is given, also reports the tangent angles at its two crossings with the original and image circles: they are equal because inversion preserves angles. The page offers only a positive power; a negative power is checked only in the logic test, not in the UI.",
      args: '{ "O": [50, 150], "R": 110, "circle": { "center": [120, 150], "radius": 20 } }',
      run: (args) => {
        const C = core();
        const O = readPoint(args.O, "O");
        const R = positiveRadius(args, "R");
        const target = readCircle(args.circle, "circle");
        const power = R * R;
        const d = C.sqDist(O, target.center) - target.radius * target.radius;
        const image = C.invertCircle(O, power, target);
        const view = imageView(image);

        // Sixteen points on the original circle must land on the image.
        const samples = 16;
        let worst = 0;
        let used = 0;
        for (let i = 0; i < samples; i++) {
          const a = (i * 2 * Math.PI) / samples;
          const p = {
            x: target.center.x + target.radius * Math.cos(a),
            y: target.center.y + target.radius * Math.sin(a),
          };
          const q = C.invertPoint(O, power, p) as Point | null;
          if (!q) continue;
          used++;
          if (view.kind === "circle") {
            worst = Math.max(worst, Math.abs(C.dist(q, view.center) - view.radius) / Math.max(1, view.radius));
          } else if (view.point && view.direction) {
            const dir = Math.hypot(view.direction.x, view.direction.y);
            worst = Math.max(worst,
              Math.abs((q.x - view.point.x) * view.direction.y - (q.y - view.point.y) * view.direction.x) / dir);
          }
        }

        // A line through both centres cuts both circles, so it always shows
        // the two crossing angles in the circle-image case.
        const T = args.T === undefined || args.T === null
          ? { x: 2 * target.center.x - O.x, y: 2 * target.center.y - O.y }
          : readPoint(args.T, "T");
        const asCircle = view.kind === "circle" ? (image as Circle) : null;
        const angles = asCircle ? crossingAngles(C, O, T, target, asCircle) : null;

        return {
          O: pt(O), radius: R, power,
          circle: { center: pt(target.center), radius: r4(target.radius) },
          powerOfO: r4(d),
          lineBranch: Math.abs(d) <= (C.EPS as number),
          image: view,
          sampledPoints: {
            tried: samples, inverted: used, skipped: samples - used,
            worstError: r4(worst), allOnImage: used > 0 && worst < 1e-6,
          },
          lineThroughO: { a: pt(O), b: pt(T) },
          crossingAngles: angles,
          crossingAnglesPreserved: angles !== null && angles.length === 2 && angles.every((a) => a.equal),
          note: view.kind === "line"
            ? `Here d = ${r4(d)}, so the applet's |d| <= ${C.EPS} tolerance draws the image as a straight line: a circle through O inverts to a line. In that case the logic test checks that circles tangent at O become parallel lines and circles crossing at O keep their crossing angle.`
            : `Here d = ${r4(d)} and the image is a circle with centre (${view.center.x}, ${view.center.y}) and radius ${view.radius}. The two tangent angles where OT cuts the circles match: inversion is conformal (angle-preserving).`,
        };
      },
    },

    distances_and_angles: {
      describe:
        "Invert two points P and Q in a circle of radius R about O and check the similarity formula P'Q' = R^2 PQ / (OP OQ), the matching ratios of triangles OPQ and OQ'P', and that the angle between two rays from P is unchanged between the tangents to their images at P'. Also shows the negative power k = -R^2 case, where |k| replaces R^2; that case is verified only in the logic test, not in the UI, which has no control for a negative power.",
      args: '{ "O": [100, 150], "R": 100, "P": [160, 150], "Q": [130, 180] }',
      run: (args) => {
        const C = core();
        const O = readPoint(args.O, "O");
        const R = positiveRadius(args, "R");
        const P = readPoint(args.P, "P");
        const Q = readPoint(args.Q, "Q");
        const power = R * R;
        const Pp = C.invertPoint(O, power, P) as Point | null;
        const Qq = C.invertPoint(O, power, Q) as Point | null;
        if (!Pp || !Qq) throw new Error("P and Q must not be the centre O: the centre has no image");

        const OP = C.dist(O, P) as number;
        const OQ = C.dist(O, Q) as number;
        const PQ = C.dist(P, Q) as number;
        const measured = C.dist(Pp, Qq) as number;
        const expected = (power * PQ) / (OP * OQ);
        const relativeError = Math.abs(measured - expected) / Math.max(1, expected);

        const ratios = [OP / (C.dist(O, Qq) as number), OQ / (C.dist(O, Pp) as number), PQ / measured];

        // Two tiny rays from P, 30 degrees apart. Their finite chords map to
        // curves through P', so a tiny step is needed to read the tangents
        // whose angle inversion really preserves.
        const outward = { x: (P.x - O.x) / OP, y: (P.y - O.y) / OP };
        const a = Math.atan2(outward.y, outward.x);
        const h = OP * 1e-7;
        const Q2 = { x: P.x + h * Math.cos(a + Math.PI / 6), y: P.y + h * Math.sin(a + Math.PI / 6) };
        const nearP = { x: P.x + h * Math.cos(a), y: P.y + h * Math.sin(a) };
        const Qq2 = C.invertPoint(O, power, Q2) as Point | null;
        const nearPq = C.invertPoint(O, power, nearP) as Point | null;
        let before: number | null = null;
        let after: number | null = null;
        if (Qq2 && nearPq) {
          before = C.angleBetween(sub(nearP, P), sub(Q2, P)) as number;
          after = C.angleBetween(sub(nearPq, Pp), sub(Qq2, Pp)) as number;
        }

        // The negative power is supported by the core, but has no UI control.
        const Pn = C.invertPoint(O, -power, P) as Point | null;
        const Qn = C.invertPoint(O, -power, Q) as Point | null;
        const negative = Pn && Qn
          ? {
              power: -power,
              imageP: pt(Pn), imageQ: pt(Qn),
              measured: r4(C.dist(Pn, Qn) as number), expected: r4(expected),
              agrees: Math.abs((C.dist(Pn, Qn) as number) - expected) / Math.max(1, expected) < 1e-9,
            }
          : null;

        return {
          O: pt(O), radius: R, power,
          P: pt(P), Q: pt(Q), imageP: pt(Pp), imageQ: pt(Qq),
          distances: {
            OP: r4(OP), OQ: r4(OQ), PQ: r4(PQ),
            OimageP: r4(C.dist(O, Pp) as number), OimageQ: r4(C.dist(O, Qq) as number), imagePimageQ: r4(measured),
          },
          formula: {
            stated: "P'Q' = R^2 * PQ / (OP * OQ)",
            expected: r4(expected), measured: r4(measured),
            relativeError, agrees: relativeError < 1e-9,
          },
          similarTriangles: {
            OP_over_OimageQ: r4(ratios[0]), OQ_over_OimageP: r4(ratios[1]), PQ_over_imagePimageQ: r4(ratios[2]),
            agrees: Math.max(...ratios) - Math.min(...ratios) < 1e-9,
            note: "Triangles OPQ and OQ'P' share the turn at O and have sides in the same ratio.",
          },
          angle: {
            raySeparationDegrees: 30, before: before === null ? null : r4(before),
            after: after === null ? null : r4(after),
            differenceDegrees: before !== null && after !== null ? Math.abs(before - after) : null,
            preserved: before !== null && after !== null && Math.abs(before - after) < 1e-4,
            note: "A ray from P maps to a curve through P'; the compared directions are tangents at P', read with a tiny step from P, because finite chords of the image curves are not tangents. The 1e-4 degree tolerance allows for that finite difference.",
          },
          negativePower: negative,
          note: `OP * OP' = OQ * OQ' = R^2 = ${power}, so P'Q' = ${r4(expected)} from the formula and ${r4(measured)} from the inverted points. The negative-power row uses |k| = ${power} in the same formula; it is checked only in porting/check-angle-property.mjs, not in the UI, which offers no control for it.`,
        };
      },
    },
  };
}

/** The page's saved fields, plus the core's reading of the picture on screen. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Angle Property state version ${stateVersion}`);
  const C = core();
  const start = C.START as { O: Point; S: Point; P: Point; R: Point; T: Point };
  const O = readPoint(state.O, "O", start.O);
  const S = readPoint(state.S, "S", start.S);
  const P = readPoint(state.P, "P", start.P);
  const R = readPoint(state.R, "R", start.R);
  const T = readPoint(state.T, "T", start.T);
  const savedOptions = (state.options ?? {}) as Json;
  const options = { names: savedOptions.names === true, hint: savedOptions.hint === true };
  const touches = num(state, "touches", 0);

  const built = { O, S, P, R, T, options, touches };
  const g = C.geometry(built);
  const view = imageView(g.image);
  const angles = (g.angles as { original: number; inverted: number }[]).map((a) => ({
    original: r4(a.original), inverted: r4(a.inverted),
    equal: Math.abs(a.original - a.inverted) < 1e-6,
  }));

  return {
    // The fields the page saved with Track.state, with the same names.
    stateVersion,
    O, S, P, R, T, options, touches,
    // What the core adds.
    inversionCircle: { center: pt(g.inversion.center as Point), radius: r4(g.inversion.radius as number) },
    targetCircle: { center: pt(g.target.center as Point), radius: r4(g.target.radius as number) },
    image: view,
    power: r4(g.power as number),
    powerOfO: r4(g.d as number),
    lineBranch: Math.abs(g.d as number) <= (C.EPS as number),
    originalCrossings: (g.originalHits as Point[]).map(pt),
    imageCrossings: (g.imageHits as Point[]).map(pt),
    pairs: (g.pairs as { point: Point; image: Point }[]).map((pair) => ({
      point: pt(pair.point), image: pt(pair.image),
      inverseProduct: r4((C.dist(O, pair.point) as number) * (C.dist(O, pair.image) as number)),
    })),
    angles,
    crossingAnglesPreserved: g.valid === true,
    status: C.status(built, g),
    note: view.kind === "line"
      ? "The green circle passes through (or very near) O, so its red image is a straight line. Move P or R away from O to bring the circle image back."
      : `The line OT cuts both circles in matched pairs with OX * OX' = ${r4(g.power as number)}. The tangent angles are ${angles.map((a) => `${a.original}° / ${a.inverted}°`).join(" and ")}: dragging a dot changes both together, never one alone. This is an illustration with no win or loss; the negative-power formula is checked only in the logic test, not in the UI.`,
  };
}
