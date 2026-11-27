/*
 * run_game_logic actions and saved-position reader for Equilateral Triangles
 * (Bogomolny's EquilateralTriangles applet).
 *
 * Three triangles O-Ai-Bi share the centre O of a circle; Bi comes from Ai by
 * a 60-degree rotation about O. Joining B1 to A2, B2 to A3 and B3 to A1 and
 * taking the three midpoints M1, M2, M3 gives a green triangle that is always
 * equilateral. The page's Explanation proves it with complex numbers: put O
 * at 0 and let j be a primitive cube root of 1 (j^3 = 1, j = e^(2pi i/3)).
 * Then Ai + j Bi = 0 and M1 + j M2 + j^2 M3 = 0, where
 * M1 = (B1 + A2)/2, M2 = (B2 + A3)/2, M3 = (B3 + A1)/2.
 *
 * Every length and configuration below comes from the real core in
 * src/generated/cores/; the complex arithmetic is transcribed from the page's
 * criterion. Coordinates are the applet's 400 x 300 board, y down. See
 * _shared.ts for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["equilateral-triangles"].EquilateralTrianglesCore;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;
type Configuration = ReturnType<Core["configuration"]>;
type Point = { x: number; y: number };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** Keep very small residuals as small numbers (rounding to 6 places would print 0). */
const tiny = (v: number): number => (Number.isFinite(v) ? Number(v.toExponential(3)) : NaN);
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });

// A reproducible, non-degenerate opening picture: the page itself uses random angles.
const DEFAULT_ANGLES = [0, 1, 2];
const OFFSETS = [0, 0.9, 2.1];

/** Complex numbers used only for the page's j^3 = 1 criterion. */
type Complex = { re: number; im: number };
const J: Complex = { re: -0.5, im: Math.sqrt(3) / 2 };  // e^(2 pi i / 3)
const J2: Complex = { re: -0.5, im: -Math.sqrt(3) / 2 }; // j^2 = e^(4 pi i / 3)
const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const cAbs = (a: Complex): number => Math.hypot(a.re, a.im);
/** Read a board point as a complex number measured from the centre O. */
const relative = (p: Point, center: Point): Complex => ({ re: p.x - center.x, im: p.y - center.y });

/** |j^3 - 1|, a sanity check on the root of unity used in the criterion. */
const jCubedResidual = (): number => cAbs(cAdd(cMul(cMul(J, J), J), { re: -1, im: 0 }));

/** |M1 + j M2 + j^2 M3|; zero exactly when the midpoint triangle is equilateral. */
function criterion(c: Configuration): number {
  return cAbs(cAdd(
    cAdd(relative(c.M[0], c.center), cMul(J, relative(c.M[1], c.center))),
    cMul(J2, relative(c.M[2], c.center)),
  ));
}

/** |Ai + j Bi| for each triangle, zero because Bi is Ai rotated by 60 degrees. */
function pairResiduals(c: Configuration): number[] {
  return c.A.map((a: Point, i: number) =>
    cAbs(cAdd(relative(a, c.center), cMul(J, relative(c.B[i], c.center)))));
}

/** Accept the page's { x, y } dots and the tutor's [x, y] arguments alike. */
function readPoint(value: unknown, label: string): Point {
  let x = NaN, y = NaN;
  if (Array.isArray(value) && value.length === 2) {
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Optional three handle points; null means use the reproducible opening picture. */
function readPoints(value: unknown): Point[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error('"points" must be exactly three points, each [x, y] or { "x": ..., "y": ... }');
  }
  return value.map((p, i) => readPoint(p, `points[${i}]`));
}

function restrictFlag(value: unknown): boolean {
  if (value === undefined || value === null) return true; // the applet's RestrictToCircle default
  if (typeof value !== "boolean") throw new Error('"restrict" must be true or false');
  return value;
}

/** Start from the core's picture and apply any supplied A1, A2, A3 positions. */
function buildState(args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of points and options");
  }
  const C = core();
  const restrict = restrictFlag(args.restrict);
  const supplied = readPoints(args.points);
  let s = C.start({ restrict, angles: supplied ? undefined : DEFAULT_ANGLES });
  if (supplied) supplied.forEach((p, i) => { s = C.withPoint(s, i, p); });
  return s;
}

/** Everything the core and the j^3 criterion can say about one picture. */
function reading(C: Core, s: State) {
  const c = C.configuration(s);
  const sides = C.sides(c);
  const spread = Math.max(...sides) - Math.min(...sides);
  const residual = criterion(c);
  return {
    valid: true,
    board: {
      width: s.width, height: s.height, center: pt(s.center),
      radius: round(s.radius), restrict: s.restrict,
    },
    A: c.A.map(pt),
    B: c.B.map(pt),
    midpointTriangle: {
      vertices: c.M.map(pt),
      sides: sides.map(round),
      sideSpread: round(spread),
      equilateral: C.equilateral(c),
    },
    sourceTriangles: C.triangleSides(c).map((tri: number[]) => tri.map(round)),
    complexCriterion: {
      j: { re: J.re, im: round(J.im) },
      jCubedMinusOne: tiny(jCubedResidual()),
      pairResiduals: pairResiduals(c).map(tiny),
      midpointResidual: tiny(residual),
      holds: residual < 1e-7,
    },
    result: C.result(s),
  };
}

/** Validate and read the sweep count used by cube_root_identity. */
function samplesArg(args: Json): number {
  const raw = num(args, "samples", 6);
  if (!Number.isInteger(raw) || raw < 1 || raw > 32) {
    throw new Error('"samples" must be a whole number from 1 to 32');
  }
  return raw;
}

export function actions(): GameActions {
  return {
    midpoint_triangle: {
      describe:
        "Rotate each of three points A1,A2,A3 about the centre O by 60 degrees to get B1,B2,B3, then report the triangle of midpoints M1=(B1+A2)/2, M2=(B2+A3)/2, M3=(B3+A1)/2: its vertices, its three side lengths and whether it is equilateral. Also reports the page's complex test |M1+jM2+j^2 M3| with j=e^(2 pi i/3), j^3=1, and the three |Ai+jBi| residuals; points are optional [x,y] or {x,y} on the 400x300 board (defaults to a reproducible picture) and 'restrict':true (default) keeps them on the circle while false drags them off — the triangle is equilateral either way.",
      args: '{ "points": [[192.6776818216562, 50.26844202312341], [100.62885103571506, 138.80291316824363], [107.26275788966538, 112.58604637612888]], "restrict": true }',
      run: (args) => {
        const C = core();
        return reading(C, buildState(args));
      },
    },

    cube_root_identity: {
      describe:
        "Sweep `samples` rotations of the three handles (1 to 32, default 6) and test the midpoint triangle both with the points on the circle (the applet's RestrictToCircle default) and off it (radii 1.6r, r and 0.55r). Reports how many placements stayed equilateral and the worst |M1+jM2+j^2 M3| residual in each case: the j^3=1 identity cancels using only the 60-degree rotations, never the circle's radius, so both cases hold at every sample.",
      args: '{ "samples": 6 }',
      run: (args) => {
        const C = core();
        const samples = samplesArg(args);
        const rows: Json[] = [];
        let onCount = 0, offCount = 0;
        let onWorst = 0, offWorst = 0;
        for (let k = 0; k < samples; k++) {
          const t = (2 * Math.PI * k) / samples;
          const angles = OFFSETS.map((o) => t + o);
          let on = C.start({ angles, restrict: true });
          let off = C.start({ angles, restrict: false });
          const radii = [1.6, 1, 0.55].map((f) => f * off.radius);
          for (let i = 0; i < 3; i++) {
            off = C.withPoint(off, i, {
              x: off.center.x + radii[i] * Math.sin(angles[i]),
              y: off.center.y - radii[i] * Math.cos(angles[i]),
            });
          }
          const measure = (s: State) => {
            const c = C.configuration(s);
            const sides = C.sides(c);
            return {
              equilateral: C.equilateral(c),
              spread: Math.max(...sides) - Math.min(...sides),
              residual: criterion(c),
            };
          };
          const a = measure(on), b = measure(off);
          if (a.equilateral) onCount++;
          if (b.equilateral) offCount++;
          onWorst = Math.max(onWorst, a.residual);
          offWorst = Math.max(offWorst, b.residual);
          rows.push({
            k,
            onCircle: { sides: C.sides(C.configuration(on)).map(round), residual: tiny(a.residual) },
            offCircle: { sides: C.sides(C.configuration(off)).map(round), residual: tiny(b.residual) },
          });
        }
        return {
          samples,
          angleOffsetsRadians: OFFSETS,
          offCircleRadii: [1.6, 1, 0.55],
          onCircle: { held: onCount, of: samples, worstResidual: tiny(onWorst) },
          offCircle: { held: offCount, of: samples, worstResidual: tiny(offWorst) },
          jCubedMinusOne: tiny(jCubedResidual()),
          rows,
          note:
            "With O at 0, j = e^(2 pi i/3) gives Ai + j Bi = 0 for each 60-degree rotation, so the three terms of 2(M1+jM2+j^2 M3) = (B1-jB2)+(jB2-j^2 B3)+(j^2 B3-B1) cancel for any A1,A2,A3. No radius appears in that calculation: moving the points off the circle changes the side lengths but leaves M1M2M3 equilateral, which the equal side spreads and near-zero residuals above confirm.",
        };
      },
    },
  };
}

/** Track.state saves the board, centre, radius, the RestrictToCircle flag and three points. */
function savedState(state: Json): State {
  const C = core();
  const seed = C.start({ angles: DEFAULT_ANGLES });
  const width = num(state, "width", seed.width);
  const height = num(state, "height", seed.height);
  const radius = num(state, "radius", seed.radius);
  if (width <= 0 || height <= 0 || radius <= 0) {
    throw new Error('"width", "height" and "radius" must be positive');
  }
  const center = readPoint(state.center, "center");
  const restrict = restrictFlag(state.restrict);
  const raw = state.points;
  if (!Array.isArray(raw) || raw.length !== 3) {
    throw new Error('saved "points" must be exactly three points');
  }
  const points = raw.map((p, i) => readPoint(p, `points[${i}]`));
  return { width, height, center, radius, restrict, points };
}

/** The saved fields plus a fresh core reading of that exact position. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equilateral Triangles state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Equilateral Triangles position must be an object");
  }
  const C = core();
  try {
    const s = savedState(state);
    return {
      stateVersion,
      saved: { ...state },
      ...reading(C, s),
      note:
        "Track.state saved the 400x300 board size, centre, radius, the RestrictToCircle flag and the three draggable points. The core rebuilds each 60-degree partner Bi and the midpoint triangle M1M2M3 from those points, and the j^3=1 test M1+jM2+j^2 M3 = 0 confirms the green triangle is equilateral even when the points have been dragged off the circle.",
    };
  } catch (err) {
    return {
      stateVersion,
      valid: false,
      saved: { ...state },
      error: err instanceof Error ? err.message : String(err),
      note: "The saved position needs a positive board size and radius, a finite centre and exactly three finite points.",
    };
  }
}
