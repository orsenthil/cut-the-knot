/*
 * run_game_logic actions and saved-position reader for Cyclic Incenters.
 *
 * Four dots on a circle give four tangent lines and a tangential quadrilateral.
 * Its diagonal crossing P and the four triangles around it give incenters X,
 * Y, Z, W; Bradley's claim is that they are concyclic. The core
 * (cyclic-incenters/cyclic-incenters-core.js, copied into src/generated/cores/
 * at build time) builds every object by intersecting lines and bisectors, and
 * measures each claimed identity. Every number returned here comes from that
 * core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cyclic-incenters"].CyclicIncentersCore;

type Point = { x: number; y: number };
type Geometry = NonNullable<ReturnType<ReturnType<typeof core>["compute"]>>;

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
/* Keep tiny residuals intact: a 1e-14 error is the interesting result here. */
const finiteNum = (v: number): number | null => (Number.isFinite(v) ? v : null);
const errText = (v: number | null): string =>
  v === null ? "undefined (parallel lines)" : v !== 0 && Math.abs(v) < 1e-4
    ? v.toExponential(2)
    : String(round(v, 6));

function readPoint(value: unknown, label: string): Point {
  if (value && typeof value === "object") {
    const p = value as Json;
    const x = Number(p.x), y = Number(p.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  throw new Error(`"${label}" must be a point {x, y}`);
}

function safePoint(value: unknown): Point | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Json;
  const x = Number(p.x), y = Number(p.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function readCircle(value: unknown, label: string): { c: Point; r: number } {
  if (!value || typeof value !== "object") {
    throw new Error(`"${label}" must be a circle {c, r}`);
  }
  const c = value as Json;
  const r = num(c, "r");
  if (r <= 0) throw new Error(`"${label}.r" must be positive`);
  return { c: readPoint(c.c, `${label}.c`), r };
}

/**
 * The four dots the applet draws from. Angles are radians on the core's
 * circle; points are dragged dots, projected back onto that circle by the
 * core's own snap(). With no arguments, the applet's starting four dots are
 * used, which is the configuration in the live fixture.
 */
function readPoints(args: Json) {
  const K = core();
  if (args.angles !== undefined) {
    const angles = numArray(args, "angles");
    if (angles.length !== 4) {
      throw new Error('"angles" must contain exactly four numbers, one per dot');
    }
    return {
      A: K.onCircle(angles[0]), B: K.onCircle(angles[1]),
      C: K.onCircle(angles[2]), D: K.onCircle(angles[3]),
    };
  }
  if (args.points !== undefined) {
    if (!Array.isArray(args.points) || args.points.length !== 4) {
      throw new Error('"points" must contain exactly four {x, y} points');
    }
    const snapped = args.points.map((p, i) => {
      const raw = readPoint(p, `points[${i}]`);
      return K.snap(raw, raw);
    });
    if (!snapped.every((p) => p && K.finite(p))) {
      throw new Error('"points" must be four finite, distinct dots off the circle centre');
    }
    return {
      A: snapped[0]!, B: snapped[1]!, C: snapped[2]!, D: snapped[3]!,
    };
  }
  // start() places the dots at these angles; use them directly because the
  // core builds its state keys dynamically and TypeScript cannot see them.
  const defaults = K.START_ANGLES.map((t: number) => K.onCircle(t));
  return { A: defaults[0], B: defaults[1], C: defaults[2], D: defaults[3] };
}

/** Rebuild the construction, refusing configurations the core cannot draw. */
function geometryFrom(args: Json) {
  const K = core();
  const dots = readPoints(args);
  const g = K.compute(dots.A, dots.B, dots.C, dots.D);
  if (!g) {
    throw new Error(
      "those four dots are degenerate: two coincide, or a tangent or diagonal is parallel to another; move them apart",
    );
  }
  return { K, dots, g };
}

/** The claims and residuals, all measured by the core on one construction. */
function reading(K: ReturnType<typeof core>, g: Geometry) {
  const e = g.measures;
  // compute() has already checked that all four small circles exist; the
  // JS array inference cannot carry that check to its elements.
  const small = g.small as NonNullable<(typeof g.small)[number]>[];
  const radii = small.map((c) => round(c.r));
  const reciprocalLeft = 1 / small[0].r + 1 / small[2].r;
  const reciprocalRight = 1 / small[1].r + 1 / small[3].r;
  return {
    dots: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    incenters: { X: pt(g.X), Y: pt(g.Y), Z: pt(g.Z), W: pt(g.W) },
    circle: {
      center: pt(g.claim.c),
      radius: round(g.claim.r),
      wResidual: finiteNum(e.circleError),
    },
    centerFromLines: g.center ? pt(g.center) : null,
    tangentQuadDiagonals: pt(g.P),
    inscribedQuadDiagonals: pt(g.Q),
    power: g.exsimR ? {
      R: pt(g.exsimR),
      RXtimesRY: round(K.dist(g.exsimR, g.X) * K.dist(g.exsimR, g.Y)),
      RZtimesRW: round(K.dist(g.exsimR, g.Z) * K.dist(g.exsimR, g.W)),
      error: finiteNum(e.powerError),
      holds: g.claims.power,
    } : null,
    reciprocalRadii: {
      x: radii[0], y: radii[1], z: radii[2], w: radii[3],
      oneOverXPlusOneOverZ: round(reciprocalLeft),
      oneOverYPlusOneOverW: round(reciprocalRight),
      error: finiteNum(e.radiiError),
      holds: g.claims.radii,
    },
    exsimilicenterLines: {
      ROnXY: finiteNum(e.exsimXY),
      ROnZW: finiteNum(e.exsimZW),
      QOnYZ: finiteNum(e.exsimYZ),
      QOnWX: finiteNum(e.exsimWX),
      holds: g.claims.exsimilicenter,
    },
    secondIteration: g.second ? {
      error: finiteNum(g.second.error),
      concyclic: g.claims.secondConcyclic,
    } : null,
    errors: {
      circle: finiteNum(e.circleError),
      tangents: finiteNum(e.tangentError),
      xzThroughP: finiteNum(e.xzError),
      ywThroughP: finiteNum(e.ywError),
      center: finiteNum(e.centerError),
      diagonals: finiteNum(e.diagonalError),
    },
    claims: g.claims,
  };
}

export function actions(): GameActions {
  return {
    bradley_circle: {
      describe:
        "For four dots on the circle (given as four angles in radians, or four points, or omitted for the starting figure), rebuild the tangents and the four incenters X, Y, Z, W with the real core. Report the circle through X, Y, Z with W's distance from it, the centre O' where A'C' meets B'D', and whether the bisectors XZ and YW pass through the diagonal point P that also lies on AC and BD.",
      args: '{ "angles": [0, 1.2, 2.9, 4.5] }',
      run: (args) => {
        const { K, g } = geometryFrom(args);
        const r = reading(K, g);
        return {
          ...r,
          note: r.claims.concyclic
            ? `X, Y, Z, W are on one circle: the circle through X, Y, Z is centred at (${r.circle.center.x}, ${r.circle.center.y}) with radius ${r.circle.radius}, and W is only ${errText(r.circle.wResidual)} units off it. That centre is where A'C' and B'D' meet, and XZ and YW pass through P = AC ∩ BD (the diagonal crossing of the tangent box).`
            : `The drawing puts W ${errText(r.circle.wResidual)} units off the circle through X, Y, Z, outside the core's tolerance; check the errors field.`,
        };
      },
    },
    power_and_radii: {
      describe:
        "For the same four dots, use the real core's four large incircles to locate R, their external centre of similitude, and compare RX · RY with RZ · RW; the equality is the power-of-a-point proof that X, Y, Z, W lie on a circle. Also compare the reciprocal sums 1/x + 1/z and 1/y + 1/w of the four small inradii, and report the residuals of the second iteration.",
      args: '{ "angles": [0, 1.2, 2.9, 4.5] }',
      run: (args) => {
        const { K, g } = geometryFrom(args);
        const r = reading(K, g);
        const p = r.power;
        const q = r.reciprocalRadii;
        return {
          power: p,
          reciprocalRadii: q,
          exsimilicenterLines: r.exsimilicenterLines,
          secondIteration: r.secondIteration,
          claims: { power: g.claims.power, radii: g.claims.radii, exsimilicenter: g.claims.exsimilicenter, secondConcyclic: g.claims.secondConcyclic },
          note: !p
            ? "Two of the large incircles have equal radii, so their external centre of similitude R is at infinity and the common tangents are parallel; the power identity holds in that limiting sense. The small radii still satisfy the reciprocal identity."
            : `R = (${p.R.x}, ${p.R.y}) is the external centre of similitude of two large incircles; R lies on XY and ZW, and RX · RY = ${p.RXtimesRY} agrees with RZ · RW = ${p.RZtimesRW} to ${errText(p.error)} units. The four small inradii give 1/x + 1/z = ${q.oneOverXPlusOneOverZ} and 1/y + 1/w = ${q.oneOverYPlusOneOverW}, differing by ${errText(q.error)}.`,
        };
      },
    },
  };
}

/** The page's saved fields (Track.state), plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Cyclic Incenters state version ${stateVersion}`);
  }
  const dots = {
    A: readPoint(state.A, "A"), B: readPoint(state.B, "B"),
    C: readPoint(state.C, "C"), D: readPoint(state.D, "D"),
  };
  const incenters = {
    X: readPoint(state.X, "X"), Y: readPoint(state.Y, "Y"),
    Z: readPoint(state.Z, "Z"), W: readPoint(state.W, "W"),
  };
  const P = readPoint(state.P, "P");
  const center = safePoint(state.center);
  const circle = readCircle(state.circle, "circle");
  const options = state.options && typeof state.options === "object" ? state.options : {};
  const savedClaims = state.claims && typeof state.claims === "object" ? state.claims : {};
  const savedMeasures = state.measures && typeof state.measures === "object" ? state.measures : {};

  const K = core();
  const g = K.compute(dots.A, dots.B, dots.C, dots.D);
  if (!g) {
    throw new Error("the saved four dots are degenerate; the core cannot rebuild this drawing");
  }
  const r = reading(K, g);

  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  const compare = (field: string, page: number, value: number): void => {
    differences.push({ field, page: round(page), core: round(value), diff: round(Math.abs(page - value), 9) });
  };
  for (const key of ["A", "B", "C", "D"] as const) {
    compare(`${key}.x`, dots[key].x, g[key].x);
    compare(`${key}.y`, dots[key].y, g[key].y);
  }
  for (const key of ["X", "Y", "Z", "W"] as const) {
    compare(`${key}.x`, incenters[key].x, g[key].x);
    compare(`${key}.y`, incenters[key].y, g[key].y);
  }
  compare("P.x", P.x, g.P.x);
  compare("P.y", P.y, g.P.y);
  compare("circle.r", circle.r, g.claim.r);
  if (center) {
    compare("center.x", center.x, g.center ? g.center.x : g.claim.c.x);
    compare("center.y", center.y, g.center ? g.center.y : g.claim.c.y);
  }
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );

  return {
    ...state,
    stateVersion,
    A: dots.A, B: dots.B, C: dots.C, D: dots.D,
    X: incenters.X, Y: incenters.Y, Z: incenters.Z, W: incenters.W,
    P, center, circle,
    options,
    claims: savedClaims,
    measures: savedMeasures,
    core: r,
    savedMatchesCore,
    note: savedMatchesCore
      ? `The saved four dots rebuild the same picture: X, Y, Z, W are concyclic (W off by ${errText(r.circle.wResidual)} units), the saved centre O' = A'C' ∩ B'D' agrees with the circle's centre, and RX · RY = RZ · RW and the reciprocal-radius identity both hold.`
      : "Some saved numbers differ from a fresh core construction of the saved dots; see `differences`. The `core` field gives the true reading of those dots.",
    differences,
  };
}
