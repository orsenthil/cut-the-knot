/*
 * run_game_logic actions and saved-position reader for Cabart Collinearity.
 *
 * The real core is cabart-collinearity/cabart-collinearity-core.js, copied into
 * src/generated/cores/ at build time. It follows the applet's Compute and Apex:
 * on each side of ABC it rotates the two ends by a base angle x (and by x-90°
 * for the second triple), intersects the rays to get three tips, and averages
 * the three cevian intersections for each Kiepert point. The nine-point centre
 * N is the circumcenter of the side midpoints. With side lengths a, b, c and
 * corner angles A, B, C, the outer Kiepert point has barycentrics
 *
 *   a/sin(A+x) : b/sin(B+x) : c/sin(C+x),
 *
 * equivalently a[cos(B-C)-cos(B+C+2x)] and its cyclic partners; N is
 * a cos(B-C) : b cos(C-A) : c cos(A-B). If s1, s2 are the sums of the two
 * Kiepert weight triples and s3 that of N's, then s1+s2 = 2s3, so
 * 2 s3 N = s1 K(x) + s2 K(x-90°): N lies on the line through the two Kiepert
 * points. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cabart-collinearity"].CabartCollinearityCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Position = { A: Point; B: Point; C: Point; angle: number };

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
/** Non-finite measurements (a collapsed construction) are reported as null. */
const maybe = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
/** Keep significant digits for tiny errors, which are the interesting part. */
const small = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v)
    ? v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toPrecision(3)) : round(v)
    : null;
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

const cross = (a: Point, b: Point, c: Point): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Accept both the page's saved {x, y} and short [x, y] arguments. */
function pointArg(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or {x, y}`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [num(o, "x"), num(o, "y")];
  } else {
    throw new Error(`argument "${key}" must be [x, y] or {x, y}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${key}" is not a finite point`);
  return { x, y };
}

/** The slider is 0..95 degrees; the core rounds to whole degrees. */
function angleArg(C: Core, args: Json): number {
  const raw = num(args, "angle", C.start().angle);
  if (raw < C.ANGLE.min || raw > C.ANGLE.max) {
    throw new Error(`argument "angle" must be between ${C.ANGLE.min} and ${C.ANGLE.max} degrees, got ${raw}`);
  }
  return C.clampAngle(raw);
}

function readPosition(C: Core, args: Json): Position {
  const seed = C.start();
  return {
    A: pointArg(args, "A", seed.A),
    B: pointArg(args, "B", seed.B),
    C: pointArg(args, "C", seed.C),
    angle: angleArg(C, args),
  };
}

/** The applet passes +1 to Apex, so the sign of the algebraic angle follows the winding. */
function signedAngles(s: Position) {
  const winding = cross(s.A, s.B, s.C) < 0 ? -1 : 1;
  const theta = (s.angle * Math.PI) / 180;
  return {
    outer: -winding * theta,
    inner: -winding * (theta - Math.PI / 2),
  };
}

/** Everything worth telling a tutor about one triangle and base angle. */
function reading(C: Core, s: Position) {
  const m = C.measure(s);
  const cl = C.claims(s);
  const angles = signedAngles(s);
  const wOuter = C.baryWeights(s.A, s.B, s.C, angles.outer);
  const wInner = C.baryWeights(s.A, s.B, s.C, angles.inner);
  const sinOuter = C.baryWeightsSin(s.A, s.B, s.C, angles.outer);
  const sinInner = C.baryWeightsSin(s.A, s.B, s.C, angles.inner);
  const weights = (v: number[]) => v.map(maybe);
  const note = !m.usable
    ? "The construction collapses here: the corners are in a line, or at 0° or 90° the isosceles triangles have parallel rays, so there are no finite Kiepert points or line to check."
    : cl.collinear
      ? `At ${s.angle}° the outer and inner Kiepert points and the nine-point centre are collinear (cross product ${small(m.collinearError)} board units). The two barycentric weight triples reproduce the constructed points, their sums obey s1 + s2 = 2 s3, and N = (s1 Kp + s2 Km)/(s1 + s2). At 45° these are the Vecten points.`
      : "The points exist, but the core did not confirm collinearity at this configuration.";

  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    angleDegrees: s.angle,
    algebraicAnglesDegrees: {
      outer: round((angles.outer * 180) / Math.PI),
      inner: round((angles.inner * 180) / Math.PI),
    },
    apexes: {
      outer: { Ap: pt(m.Ap), Bp: pt(m.Bp), Cp: pt(m.Cp) },
      inner: { Am: pt(m.Am), Bm: pt(m.Bm), Cm: pt(m.Cm) },
    },
    kiepertPoints: {
      outer: pt(m.Kp), inner: pt(m.Km),
      fromCosWeights: { outer: pt(cl.kpBary), inner: pt(cl.kmBary) },
      fromSinWeights: pt(C.weightedPoint(sinOuter, s.A, s.B, s.C)),
    },
    ninePointCenter: {
      center: pt(m.N), radius: maybe(m.radius), fromCosWeights: pt(cl.nBary),
    },
    lineThroughTheThree: m.line ? m.line.map(pt) : null,
    collinearity: {
      holds: cl.collinear === true,
      signedCrossProduct: small(m.collinearError),
      weightedCenter: cl.weightedCenter === true,
      sumsIdentity: cl.sumsIdentity === true,
    },
    barycentric: {
      sides: { a: maybe(wOuter.a), b: maybe(wOuter.b), c: maybe(wOuter.c) },
      cornerAnglesDegrees: {
        A: round((wOuter.Aang * 180) / Math.PI),
        B: round((wOuter.Bang * 180) / Math.PI),
        C: round((wOuter.Cang * 180) / Math.PI),
      },
      cosForm: { outerKiepert: weights(wOuter.k), innerKiepert: weights(wInner.k), ninePointCenter: weights(wOuter.n) },
      sinForm: { outerKiepert: weights(sinOuter), innerKiepert: weights(sinInner) },
      sums: {
        s1: maybe(cl.sums.s1), s2: maybe(cl.sums.s2), s3: maybe(cl.sums.s3),
        s1PlusS2: maybe(cl.sums.s1 + cl.sums.s2), twiceS3: maybe(2 * cl.sums.s3),
      },
    },
    usable: m.usable === true,
    note,
  };
}

export function actions(): GameActions {
  return {
    collinearity: {
      describe:
        "For a triangle with corners A, B, C (each {x, y} or [x, y] in page coordinates, y downward; omit a corner to keep the page's starting one) and a base angle from 0 to 95 degrees (rounded to whole degrees as on the slider; default 45), report the three apexes of each isosceles triple, the two Kiepert points, the nine-point centre and its radius, the drawn line through the three points, their scaled cross product, and the barycentric weights (cos and sin forms) that reproduce the points. The sign of the algebraic angle flips with the triangle's winding, as in the applet. At 0° or 90° the construction collapses and the points are null.",
      args: '{ "A": [83, 220], "B": [220, 160], "C": [200, 94], "angle": 45 }',
      run: (args) => {
        const C = core();
        return reading(C, readPosition(C, args));
      },
    },
    check_claims: {
      describe:
        "Test every claim on the illustration's page for a triangle A, B, C and base angle (0..95 degrees, default 45): both barycentric formulas for the outer Kiepert point, the inner one, the nine-point centre formula, the weight-sum identity s1+s2 = 2s3, the weighted-centre formula for N, the collinearity of the three points, and whether 45° gives the Vecten points. Returns a boolean for each (vectenAt45 is null away from 45°, where it does not apply), the names of any that fail, and a plain-language note.",
      args: '{ "A": [83, 220], "B": [220, 160], "C": [200, 94], "angle": 30 }',
      run: (args) => {
        const C = core();
        const s = readPosition(C, args);
        const claims = C.claims(s);
        const names = [
          "outerKiepert", "sinForm", "innerKiepert", "ninePointCenter",
          "sumsIdentity", "weightedCenter", "collinear",
        ] as const;
        const failed = names.filter((k) => claims[k] !== true);
        /* The Vecten claim only applies at 45°, so it is not a failure elsewhere. */
        const vectenAt45 = s.angle === 45 ? claims.vectenAt45 === true : null;
        return {
          angleDegrees: s.angle,
          usable: claims.usable === true,
          ...Object.fromEntries(names.map((k) => [k, claims[k] === true])),
          vectenAt45,
          allHold: failed.length === 0 && vectenAt45 !== false,
          failed,
          note: !claims.usable
            ? "This configuration is collapsed (corners in a line, or a 0°/90° angle): there are no finite Kiepert points to check."
            : failed.length
              ? `These claims do not hold at this position: ${failed.join(", ")}.`
              : vectenAt45 === false
                ? "Every geometry claim holds here; the points are not the Vecten points because that needs a 45° base angle."
                : vectenAt45 === null
                  ? "Every geometry claim holds here; the Vecten case applies only at 45°."
                  : "Every page claim holds here: both weight formulas give the Kiepert points, N has its barycentrics, the sums identity puts N on their line, and 45° gives the Vecten points.",
        };
      },
    },
  };
}

/** The page's saved triangle, angle and checkboxes, read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = readPosition(C, state);
  return {
    stateVersion,
    saved: {
      A: pt(s.A), B: pt(s.B), C: pt(s.C), angle: s.angle,
      showOuter: state.showOuter === true,
      showInner: state.showInner === true,
      show9PC: state.show9PC === true,
      showNames: state.showNames === true,
    },
    reading: reading(C, s),
    isIllustration: C.result() === null,
    note:
      "Track.state saves the three dragged corners, the base angle and the four checkboxes. The reading recomputes both Kiepert points, the nine-point centre and their line with the page's own core, so a tutor can see the geometry behind whatever the player has on screen. This is an illustration: there is no win or loss.",
  };
}
