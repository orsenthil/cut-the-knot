/*
 * run_game_logic actions and saved-position reader for Chasles Tangents.
 *
 * Four points A, B, C, D on a circle have four tangents. The fixed tangent at
 * T cuts those four lines at A', B', C', D', and the cross-ratio read along t
 * is (A'B'C'D'). Draw the pencil from any fifth point K of the circle to
 * A, B, C, D: its cross-ratio K(ABCD) is the same number, whatever K is.
 * Every number below comes from the game's real core
 * (chasles-tangents/chasles-tangents-core.js), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 * Coordinates are board units in the page's 400 x 300 viewBox, y down.
 *
 * The page's quoted proof (Eves) also claims AKT = 1/2 AOT. That holds only
 * for K on one of the two arcs from A to T; on the other arc AKT is the
 * supplement of that half-angle. The core reports both facts separately:
 * the supplement changes no sine, so the cross-ratio equality survives.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["chasles-tangents"].ChaslesTangentsCore as any;

type Point = { x: number; y: number };
type Circle = { center: Point; r: number };
type State = {
  width: number;
  height: number;
  circle: Circle;
  points: Record<string, Point>;
  showNames: boolean;
  allowHint: boolean;
};

const NAMES = ["T", "A", "B", "C", "D", "K"];
const BASE = ["A", "B", "C", "D"];
const PRIME = ["Ap", "Bp", "Cp", "Dp"];
const TOL = 1e-7;

const round = (v: number, digits = 4): number => Number(v.toFixed(digits));
/** Keep a small cross-ratio difference visible instead of rounding it away. */
const precise = (v: number): number | null =>
  Number.isFinite(v) ? Number(v.toPrecision(6)) : null;
const deg = (radians: number): number | null =>
  Number.isFinite(radians) ? round((radians * 180) / Math.PI, 3) : null;
const near = (a: number, b: number, tol = TOL): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function pt(p: any): Point | null {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
}

const line = (l: any): { a: Point | null; b: Point | null } | null =>
  l ? { a: pt(l.a), b: pt(l.b) } : null;

/** Tool arguments use [x, y]; a saved position from the page uses { x, y }. */
function readPoint(v: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(v[0]);
    y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

function readNamedPoints(v: unknown, label: string): Record<string, Point> {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`argument "${label}" must be an object with keys ${NAMES.join(", ")}`);
  }
  const o = v as Json;
  return Object.fromEntries(NAMES.map((n) => [n, readPoint(o[n], `${label}.${n}`)]));
}

/** Angles are radians around the circle, keyed by the same six point names. */
function readAngles(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`argument "angles" must be an object with keys ${NAMES.join(", ")}`);
  }
  const o = v as Json;
  return Object.fromEntries(NAMES.map((n) => [n, num(o, n)]));
}

function readCircle(v: unknown): Circle {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error('argument "circle" must be { "center": { x, y }, "r": number }');
  }
  const o = v as Json;
  const center = readPoint(o.center, "circle.center");
  const r = num({ radius: o.r === undefined ? o.radius : o.r }, "radius");
  if (!(r > 0)) throw new Error('argument "circle.r" must be positive');
  return { center, r };
}

/**
 * Build a core position. Without angles or points the applet's opening
 * configuration is used; withPoint projects any supplied point onto the
 * circle, just as the page's CorrectPoint does when a dot is dragged.
 */
function readState(args: Json): State {
  const C = core();
  const options: Json = {
    showNames: args.showNames === true,
    allowHint: args.allowHint === true,
  };
  if (args.width !== undefined) options.width = num(args, "width");
  if (args.height !== undefined) options.height = num(args, "height");
  let s = C.start(options) as State;
  if (args.circle !== undefined && args.circle !== null) {
    const c = readCircle(args.circle);
    s = C.withRadius(C.withCenter(s, c.center), { x: c.center.x + c.r, y: c.center.y });
  }
  if (args.angles !== undefined && args.angles !== null &&
      args.points !== undefined && args.points !== null) {
    throw new Error('give "angles" or "points", not both');
  }
  if (args.angles !== undefined && args.angles !== null) {
    const angles = readAngles(args.angles);
    for (const n of NAMES) s = C.withPoint(s, n, C.circleAt(s.circle, angles[n]));
  } else if (args.points !== undefined && args.points !== null) {
    const points = readNamedPoints(args.points, "points");
    for (const n of NAMES) s = C.withPoint(s, n, points[n]);
  }
  return s;
}

/** The core's measure of the diagram, shared by both actions and position(). */
function reading(s: State) {
  const C = core();
  const g = C.compute(s);
  const cl = C.claims(s);
  const p = s.points;
  const kAngle = C.signedAngle(p.K, p.A, p.T);
  const primeAngle = pt(g.primes.Ap)
    ? C.signedAngle(s.circle.center, g.primes.Ap, p.T)
    : NaN;
  const kFromHalf = C.angleDifference(kAngle, cl.half);
  const primeFromHalf = C.angleDifference(primeAngle, cl.half);
  const tangentRatio = precise(cl.cr);
  const pencilRatio = precise(cl.crK);

  return {
    width: s.width,
    height: s.height,
    circle: { center: pt(s.circle.center), r: round(s.circle.r) },
    points: Object.fromEntries(NAMES.map((n) => [n, pt(p[n])])),
    showNames: s.showNames === true,
    allowHint: s.allowHint === true,
    tangents: {
      T: line(g.tangents.T),
      ...Object.fromEntries(BASE.map((n) => [n, line(g.tangents[n])])),
    },
    tangentCuts: Object.fromEntries(PRIME.map((n) => [n, pt(g.primes[n])])),
    crossRatios: {
      pencilAtK: pencilRatio,
      cutsOnTangent: tangentRatio,
    },
    equality: {
      holds: cl.regular === true && cl.equal === true,
      independentOfK: cl.independent === true,
      regular: cl.regular === true,
    },
    angleStep: {
      halfOfAOT: { radians: round(cl.half, 6), degrees: deg(cl.half) },
      atPrime: {
        angleAprimeOT: { radians: round(primeAngle, 6), degrees: deg(primeAngle) },
        equalsHalf: cl.atPrime === true,
        differenceFromHalfRadians: Number.isFinite(primeFromHalf) ? round(primeFromHalf, 6) : null,
      },
      atK: {
        angleAKT: { radians: round(kAngle, 6), degrees: deg(kAngle) },
        equalsHalf: cl.angleAtK === true,
        isSupplementOfHalf: near(Math.abs(kFromHalf), Math.PI),
        differenceFromHalfRadians: Number.isFinite(kFromHalf) ? round(kFromHalf, 6) : null,
      },
    },
  };
}

export function actions(): GameActions {
  return {
    tangent_cross_ratio: {
      describe:
        "Build the Chasles Tangents illustration for four points A, B, C, D on a circle, a fixed tangent at T and a fifth point K. Accept angles (radians, an object with keys T, A, B, C, D, K), or points ([x, y] or { x, y } per name), or neither for the applet's opening picture; an optional circle { center, r }, width and height set the board. Report the tangents, their crossings A', B', C', D' with the tangent at T, K(ABCD) (cross-ratio of the pencil from K), (A'B'C'D') along t, whether they agree, and the core's check of the equality at 24 further positions of K. Also report the angle-hint caveat: angle A'OT is half of angle AOT, but angle AKT is that half on one arc from A to T and its supplement on the other — the cross-ratio is unchanged either way. A tangent parallel to t or two coincident points makes the cross-ratio undefined and is reported as null.",
      args:
        '{ "angles": { "T": -1.5707963268, "A": 0.7853981634, "B": 0.2617993878, "C": -0.2617993878, "D": -0.7853981634, "K": 2.617993878 }, "allowHint": true }',
      run: (args) => {
        const r = reading(readState(args));
        const { pencilAtK, cutsOnTangent } = r.crossRatios;
        return {
          ...r,
          note: !r.equality.regular
            ? "Two points coincide or a tangent is parallel to t, so the four cuts or their cross-ratio are undefined. Move the points apart and try again."
            : `The tangents at A, B, C, D cut t at A', B', C', D' with (A'B'C'D') = ${cutsOnTangent}; the pencil from K has K(ABCD) = ${pencilAtK}. They ${r.equality.holds ? "agree" : "do not agree"}, and the core's 24 further choices of K ${r.equality.independentOfK ? "give the same number" : "do not all give the same number"}. Angle A'OT ${r.angleStep.atPrime.equalsHalf ? "is" : "is not"} half of angle AOT; angle AKT ${r.angleStep.atK.equalsHalf ? "is" : r.angleStep.atK.isSupplementOfHalf ? "is the supplement of" : "differs from"} that half here. The inscribed-angle step can fail on one arc, but the cross-ratio it was used to prove does not.`,
        };
      },
    },

    move_k: {
      describe:
        "Keep A, B, C, D and the tangent at T fixed and sweep K around the circle, measuring K(ABCD) at each new K against the fixed tangent cross-ratio (A'B'C'D'). Supply K_angles (an array of radians around the circle) or K_points (an array of [x, y]), plus the same angles / points / circle arguments as tangent_cross_ratio. For each K also report the signed angle AKT and whether it equals half of angle AOT or its supplement, showing why the quoted proof's angle step is not always true while Chasles' equality is. Positions where K lands on A or T give no pencil and report null.",
      args:
        '{ "K_angles": [-2.4, -1.4, -0.6, 0.2, 1.1, 2.2, 2.8] }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const cl = C.claims(s);
        const target = precise(cl.cr);
        if (args.K_angles !== undefined && args.K_points !== undefined &&
            args.K_angles !== null && args.K_points !== null) {
          throw new Error('give "K_angles" or "K_points", not both');
        }
        let samples: Array<{ angle: number; point: Point }>;
        if (args.K_points !== undefined && args.K_points !== null) {
          if (!Array.isArray(args.K_points) || args.K_points.length === 0) {
            throw new Error('argument "K_points" must be a non-empty array of points');
          }
          samples = args.K_points.map((v, i) => ({
            angle: C.angleOn(s.circle, readPoint(v, `K_points[${i}]`)),
            point: readPoint(v, `K_points[${i}]`),
          }));
        } else {
          const raw = args.K_angles === undefined || args.K_angles === null
            ? [-2.4, -1.4, -0.6, 0.2, 1.1, 2.2, 2.8]
            : args.K_angles;
          if (!Array.isArray(raw) || raw.length === 0) {
            throw new Error('argument "K_angles" must be a non-empty array of radians');
          }
          samples = raw.map((v, i) => {
            const angle = num({ angle: v }, "angle");
            if (i >= 100) throw new Error('argument "K_angles" is too long');
            return { angle, point: C.circleAt(s.circle, angle) as Point };
          });
        }

        const measured = samples.map(({ angle, point }) => {
          const at = C.withPoint(s, "K", point) as State;
          const value = C.crossRatioPencil(
            at.points.K, at.points.A, at.points.B, at.points.C, at.points.D,
          ) as number;
          const signed = C.signedAngle(at.points.K, at.points.A, at.points.T) as number;
          const difference = C.angleDifference(signed, cl.half) as number;
          return {
            angleRadians: round(angle, 6),
            angleDegrees: deg(angle),
            K: pt(at.points.K),
            pencilAtK: precise(value),
            equalsTangentCrossRatio: near(value, cl.cr),
            angleAKTDegrees: deg(signed),
            angleAKTEqualsHalf: C.sameAngle(signed, cl.half, TOL) === true,
            angleAKTIsSupplement: near(Math.abs(difference), Math.PI),
            usable: Number.isFinite(value),
          };
        });
        const usable = measured.filter((m) => m.usable);
        return {
          circle: { center: pt(s.circle.center), r: round(s.circle.r) },
          fixedTangentCrossRatio: target,
          pencilAtSavedK: precise(cl.crK),
          halfOfAOTDegrees: deg(cl.half),
          angleAprimeOTEqualsHalf: cl.atPrime === true,
          regular: cl.regular === true,
          independentOfK: cl.independent === true,
          allSamplesEqual: cl.regular === true && usable.length > 0 &&
            usable.every((m) => m.equalsTangentCrossRatio),
          samples: measured,
          note: !cl.regular
            ? "The diagram is degenerate (two points together or a parallel tangent), so no cross-ratio can be read."
            : `The four tangent cuts fix (A'B'C'D') = ${target}. Every usable K in the sweep gives the same pencil cross-ratio, even where angle AKT is the supplement of half of angle AOT: the supplement changes no sine, so Chasles' theorem holds on both arcs. The quoted proof's angle step holds at A' but not at every K.`,
        };
      },
    },
  };
}

/** The fields as saved, distinct from the core's projection of them. */
function savedFields(state: Json, fallback: State) {
  const field = (key: string, d: number): number =>
    state[key] === undefined ? d : num(state, key);
  const points = readNamedPoints(state.points, "points");
  const circle = state.circle === undefined || state.circle === null
    ? fallback.circle
    : readCircle(state.circle);
  return {
    width: field("width", fallback.width),
    height: field("height", fallback.height),
    circle: { center: pt(circle.center), r: round(circle.r) },
    points: Object.fromEntries(NAMES.map((n) => [n, pt(points[n])])),
    showNames: state.showNames === true,
    allowHint: state.allowHint === true,
  };
}

/** What the core says about the position saved by Track.state on the page. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Chasles Tangents state version ${stateVersion}`);
  }
  const C = core();
  const opening = C.start({}) as State;
  let saved: ReturnType<typeof savedFields> | null = null;
  try { saved = savedFields(state, opening); } catch { /* unusable saved data */ }
  let here: State = opening;
  if (saved !== null) {
    try { here = readState(state); } catch { /* fall back to the opening picture */ }
  }

  const r = reading(here);
  return {
    stateVersion,
    savedReadable: saved !== null,
    saved: saved === null
      ? {
          width: opening.width, height: opening.height,
          circle: { center: pt(opening.circle.center), r: round(opening.circle.r) },
          points: Object.fromEntries(NAMES.map((n) => [n, pt(opening.points[n])])),
          showNames: false, allowHint: false,
        }
      : saved,
    ...r,
    note: saved === null
      ? "The saved position could not be read, so the applet's opening picture is shown instead."
      : !r.equality.regular
        ? "Two points coincide or a tangent is parallel to t, so the four cuts or their cross-ratio are undefined in this saved picture."
        : r.equality.holds && r.equality.independentOfK
          ? `The saved picture shows K(ABCD) = ${r.crossRatios.pencilAtK} and (A'B'C'D') = ${r.crossRatios.cutsOnTangent}: the same number, as Chasles' theorem says for every position of K. Angle AKT ${r.angleStep.atK.equalsHalf ? "equals" : r.angleStep.atK.isSupplementOfHalf ? "is the supplement of" : "differs from"} half of angle AOT here, which is why the quoted proof's angle step needs care.`
          : "The saved picture is readable but the two cross-ratios do not agree; drag the points apart and check the tangents again.",
  };
}
