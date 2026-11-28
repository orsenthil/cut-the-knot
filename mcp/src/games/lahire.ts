/*
 * run_game_logic actions and saved-position reader for La Hire's Theorem.
 *
 * This is the circle droodle: a circle with centre O through R, two draggable
 * points A and B, and the red polars the applet draws for them. A point's polar
 * passes through its inverse in the circle at right angles to the ray from O,
 * so A lies on polar(B) exactly when (A−O)·(B−O) = R²: the same equation with
 * A and B swapped, which is La Hire's theorem. The inverse points C on ray OB
 * and D on ray OA satisfy OB·OC = OA·OD = R². The applet's CheckTouch is not
 * that exact test: it fires when A is strictly within 1.5 units of polar(B)
 * and A's own polar exists, and never measures B against polar(A) — an
 * asymmetric quirk that these actions expose.
 *
 * Every number below comes from the game's real core (lahire/lahire-core.js),
 * copied into src/generated/cores/ at build time. Coordinates are the applet's
 * 600 x 450 board units, y downward. This is not the sibling "Lahire on
 * Ellipse" droodle, whose ellipse core has its own reader. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Options = { width?: number; height?: number; showNames?: boolean };
type State = { O: Pt; R: Pt; A: Pt; B: Pt; showNames: boolean };
type Circle = { center: Pt; radius: number };
type Polar = { a: Pt; b: Pt; inverse: Pt };
type Geometry = {
  circle: Circle;
  polarA: Polar | null;
  polarB: Polar | null;
  inverseA: Pt | null;
  inverseB: Pt | null;
  distA: number | null;
  distB: number | null;
  touching: boolean;
  C: Pt | null;
  D: Pt | null;
};
interface Core {
  VIEW: { width: number; height: number };
  MIN_DIST: number;
  TOUCH: number;
  DEGENERATE: number;
  start(options?: Options): State;
  moveVertex(state: State, name: string, p: Pt): State;
  moveCircle(state: State, center: Pt): State;
  setShowNames(state: State, on: boolean): State;
  circleOf(state: State): Circle;
  invert(circle: Circle, p: Pt): Pt | null;
  polar(circle: Circle, p: Pt): Polar | null;
  distToLine(p: Pt, line: Polar | null): number | null;
  intersectLines(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null;
  connectToCenter(circle: Circle, p: Pt, line: Polar | null): Pt | null;
  geometry(state: State): Geometry;
  status(state: State, info?: Geometry): string;
  result(): null;
  dist(a: Pt, b: Pt): number;
  sqDist(a: Pt, b: Pt): number;
}

const core = (): Core => cores.lahire.LahireCore as unknown as Core;

const TOL = 1e-6;
const round = (v: number): number => Number(v.toFixed(6));
const r6 = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const offset = (p: Pt, q: Pt): Pt => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (p: Pt, q: Pt): number => p.x * q.x + p.y * q.y;
const cross = (p: Pt, q: Pt): number => p.x * q.y - p.y * q.x;

/** Accept both a tutor's [x, y] and the page's saved { x, y }. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (isObj(raw)) {
    [x, y] = [Number(raw.x), Number(raw.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** The core's start() picture, with any of O, R, A and B overridden. */
function buildState(C: Core, args: Json): State {
  if (!isObj(args)) throw new Error("arguments must be an object with optional O, R, A, B, width, height and showNames");
  const width = num(args, "width", C.VIEW.width);
  const height = num(args, "height", C.VIEW.height);
  if (!(width > 0 && height > 0)) {
    throw new Error('arguments "width" and "height" must be positive board sizes');
  }
  if (width > 5000 || height > 5000) {
    throw new Error('arguments "width" and "height" must not exceed 5000');
  }
  if (args.showNames !== undefined && args.showNames !== null && typeof args.showNames !== "boolean") {
    throw new Error('argument "showNames" must be true or false');
  }
  let s = C.start({
    width, height,
    showNames: args.showNames === undefined || args.showNames === null ? true : args.showNames as boolean,
  });
  for (const name of ["O", "R", "A", "B"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.moveVertex(s, name, readPoint(args[name], name));
    }
  }
  return s;
}

/** Optional signed offsets in board units, for probing near B's polar. */
function offsetsOf(args: Json): number[] {
  const raw = args.probeOffsets;
  if (raw === undefined || raw === null) return [0, 0.5, 1, 1.4, 1.6, 3];
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 10) {
    throw new Error('argument "probeOffsets" must be an array of 1 to 10 numbers');
  }
  return raw.map((v, i) => {
    const n = Number(v);
    if (!Number.isFinite(n) || Math.abs(n) > 200) {
      throw new Error(`argument "probeOffsets[${i}]" must be a finite number between -200 and 200`);
    }
    return n;
  });
}

/** All the measurements, every one of them made with the core. */
function reading(C: Core, s: State) {
  const g = C.geometry(s);
  const circle = g.circle;
  const power = circle.radius * circle.radius;
  const ao = offset(s.A, circle.center);
  const bo = offset(s.B, circle.center);
  const dotAB = dot(ao, bo);
  const oa = C.dist(circle.center, s.A);
  const ob = C.dist(circle.center, s.B);
  const od = g.inverseA ? C.dist(circle.center, g.inverseA) : null;
  const oc = g.inverseB ? C.dist(circle.center, g.inverseB) : null;
  const productA = od === null ? null : oa * od;
  const productB = oc === null ? null : ob * oc;
  const linkA = C.connectToCenter(circle, s.A, g.polarA);
  const linkB = C.connectToCenter(circle, s.B, g.polarB);
  const collinearA = g.inverseA && oa > 0
    ? Math.abs(cross(ao, offset(g.inverseA, circle.center))) / (oa * (od || 1))
    : null;
  const collinearB = g.inverseB && ob > 0
    ? Math.abs(cross(bo, offset(g.inverseB, circle.center))) / (ob * (oc || 1))
    : null;
  const residual = Math.abs(dotAB - power) / Math.max(1, power);
  const productsOK = productA !== null && productB !== null &&
    Math.abs(productA - power) <= TOL * Math.max(1, power) &&
    Math.abs(productB - power) <= TOL * Math.max(1, power);

  return {
    circle: {
      center: pt(circle.center), rim: pt(s.R),
      radius: round(circle.radius), power: round(power),
    },
    points: { O: pt(s.O), R: pt(s.R), A: pt(s.A), B: pt(s.B), C: pt(g.C), D: pt(g.D) },
    polars: {
      A: g.polarA
        ? { through: [pt(g.polarA.a), pt(g.polarA.b)], inverse: pt(g.polarA.inverse) }
        : null,
      B: g.polarB
        ? { through: [pt(g.polarB.a), pt(g.polarB.b)], inverse: pt(g.polarB.inverse) }
        : null,
    },
    distances: {
      aToPolarB: r6(g.distA), bToPolarA: r6(g.distB), touchLimit: C.TOUCH,
    },
    inverses: {
      OA: round(oa), OD: r6(od), oaTimesOd: r6(productA),
      OB: round(ob), OC: r6(oc), obTimesOc: r6(productB),
      collinearWithA: r6(collinearA), collinearWithB: r6(collinearB),
      connectMatchesInverseA: linkA && g.inverseA ? r6(C.dist(linkA, g.inverseA)) : null,
      connectMatchesInverseB: linkB && g.inverseB ? r6(C.dist(linkB, g.inverseB)) : null,
    },
    checks: {
      dotMinusPower: round(dotAB - power),
      relativeResidual: round(residual),
      exactReciprocity: residual <= TOL,
      polarADrawn: Boolean(g.polarA), polarBDrawn: Boolean(g.polarB),
      aWithinTouchOfPolarB: g.distA !== null && g.distA < C.TOUCH,
      bWithinTouchOfPolarA: g.distB !== null && g.distB < C.TOUCH,
      touching: g.touching,
      productsEqualPower: productsOK,
    },
    status: C.status(s, g),
  };
}

/**
 * B's polar is perpendicular to ray OB through inverse(B). Moving A along
 * that normal by delta makes the core report A's distance from polar(B)
 * exactly delta, which lets us compare its touch test with B's distance from
 * polar(A).
 */
function shiftAAlongPolarB(C: Core, s: State, delta: number): State {
  const g = C.geometry(s);
  if (!g.polarB || !g.inverseB) {
    throw new Error('B is too close to O for a polar; move B at least 0.5 units from O');
  }
  const b = offset(s.B, g.circle.center);
  const len = Math.hypot(b.x, b.y);
  if (!(len > 0)) throw new Error("B coincides with O, so it has no polar");
  const target = {
    x: g.inverseB.x + (delta * b.x) / len,
    y: g.inverseB.y + (delta * b.y) / len,
  };
  if (![target.x, target.y].every(Number.isFinite)) {
    throw new Error('the requested offset sends A outside the board');
  }
  return C.moveVertex(s, "A", target);
}

export function actions(): GameActions {
  return {
    polar_reciprocity: {
      describe:
        "Place the circle centre O and rim R and the draggable points A and B (each [x, y] or { x, y }; the applet's opening picture is the default) and report both polars, A's distance from B's polar, B's distance from A's polar and the exact reciprocity test (A−O)·(B−O) = R². The optional probeOffsets (signed board units, at most 10) shift A by those amounts off B's polar with the real core: CheckTouch fires only when A is strictly within 1.5 units of B's polar and A's own polar exists, so it can declare a touch while B is much farther from A's polar. This is the circle droodle, not Lahire on Ellipse, which has a separate reader.",
      args: '{ "O": [120, 300], "R": [63.75, 300], "A": [220, 271.875], "B": [120, 187.5], "probeOffsets": [0, 0.5, 1.4, 1.6, 3] }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const offsets = offsetsOf(args);
        const base = reading(C, s);
        const power = base.circle.power;
        const probes = offsets.map((delta) => {
          const moved = shiftAAlongPolarB(C, s, delta);
          const g = C.geometry(moved);
          const dotResidual = Math.abs(
            dot(offset(moved.A, g.circle.center), offset(moved.B, g.circle.center)) - power,
          ) / Math.max(1, power);
          return {
            delta,
            A: pt(moved.A),
            aToPolarB: r6(g.distA),
            bToPolarA: r6(g.distB),
            polarADrawn: Boolean(g.polarA),
            touching: g.touching,
            dotRelativeResidual: round(dotResidual),
          };
        });
        return {
          ...base,
          touchProbe: {
            limit: C.TOUCH,
            probes,
            note:
              "Each probe puts A exactly delta units from B's polar along its normal while B and the circle stay put. " +
              "At delta = 0 the core has A on B's polar and B on A's polar, so (A−O)·(B−O) = R² and both distances vanish. " +
              "For a positive delta the two distances differ by the ratio |OB|/|OA|: dist(B, polar A) / dist(A, polar B) = |OB|/|OA|, since dist(A, polar B) = |(A−O)·(B−O) − R²|/|OB| " +
              "and dist(B, polar A) = the same numerator divided by |OA|. The applet checks only the first one against its " +
              C.TOUCH + "-unit limit and ignores the other, which is why it can wake the eyes at an asymmetric position.",
          },
        };
      },
    },

    inverse_points: {
      describe:
        "With the same circle and points (optional O, R, A, B as [x, y] or { x, y }), report the core's inverse points D = inverse(A) on ray OA and C = inverse(B) on ray OB, checking O, P, P′ collinearity, OA·OD = OB·OC = R², and that ConnectToCenter lands on each inverse. It also sets A to inverse(B) to show the collinear case where inversion is an involution (D = B) and probes the applet's guards for a point at O, within 0.5 of O, on the rim and twice the radius away. This is the circle droodle, not Lahire on Ellipse, which has a separate reader.",
      args: '{ "O": [120, 300], "R": [63.75, 300], "A": [300, 271.875], "B": [120, 187.5] }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const base = reading(C, s);
        const g = C.geometry(s);
        const cases = [
          { name: "at O", p: { ...g.circle.center } },
          { name: "0.4 units from O", p: { x: g.circle.center.x + 0.4, y: g.circle.center.y } },
          { name: "on the rim R", p: { ...s.R } },
          { name: "twice the radius", p: { x: g.circle.center.x + 2 * g.circle.radius, y: g.circle.center.y } },
        ].map(({ name, p }) => {
          const inverse = C.invert(g.circle, p);
          const polar = C.polar(g.circle, p);
          return {
            name,
            point: pt(p),
            distanceFromO: round(C.dist(g.circle.center, p)),
            inverse: pt(inverse),
            polarDrawn: Boolean(polar),
            opTimesOp: inverse === null ? null : r6(C.dist(g.circle.center, p) * C.dist(g.circle.center, inverse)),
          };
        });
        let collinearCase: unknown = null;
        if (g.inverseB) {
          const onRay = C.moveVertex(s, "A", g.inverseB);
          const cg = C.geometry(onRay);
          collinearCase = {
            A: pt(onRay.A),
            equalsInverseOfB: r6(C.dist(onRay.A, g.inverseB)),
            D: pt(cg.inverseA),
            equalsB: cg.inverseA ? r6(C.dist(cg.inverseA, onRay.B)) : null,
            oaTimesOb: r6(C.dist(cg.circle.center, onRay.A) * C.dist(cg.circle.center, onRay.B)),
            touching: cg.touching,
            note:
              "A was put at inverse(B), so O, A, C and B lie on one ray and OA·OB = R². " +
              "Inversion is an involution: D = inverse(A) = B, and the core then reports a touch.",
          };
        }
        return {
          ...base,
          collinearCase,
          guards: { minDistance: C.MIN_DIST, degenerateLine: C.DEGENERATE, cases },
          note:
            "Inversion sends P along ray OP to P′ with OP·OP′ = R², so the polar through P′ is perpendicular to OP. " +
            "The core's ConnectToCenter intersections agree with invert() wherever a polar exists; a point within " +
            C.MIN_DIST + " units of O has no polar at all, and the applet's Dist treats a very short polar as distance zero.",
        };
      },
    },
  };
}

/** Echo Track's saved fields, then re-measure the picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported La Hire state version ${stateVersion}`);
  if (!isObj(state)) throw new Error("saved La Hire position must be an object");
  const C = core();
  const s = buildState(C, state);
  const readingHere = reading(C, s);
  return {
    stateVersion,
    O: pt(s.O), R: pt(s.R), A: pt(s.A), B: pt(s.B), showNames: s.showNames,
    reading: readingHere,
    touching: readingHere.checks.touching,
    status: readingHere.status,
    result: C.result(),
    note:
      "Track.state saved the four draggable points O, R, A and B in the applet's 600 x 450 board units, " +
      "plus the showNames display flag. The core rebuilds the circle through R, draws both polars and reports " +
      "the inverse points and the exact La Hire reciprocity. This droodle has no win or loss: the eyes open " +
      "when A comes within 1.5 units of B's polar, using the applet's asymmetric CheckTouch rule.",
  };
}
