/*
 * run_game_logic actions and saved-position reader for Feuerbach Incidence.
 *
 * The real core is feuerbach-incidence/feuerbach-incidence-core.js, copied into
 * src/generated/cores/ at build time. It transcribes the applet's own Compute():
 * the incenter and three excenters come from rotated half-angle bisectors, each
 * radius is the mean of three distances to the sides, the nine-point circle
 * comes from the three side midpoints, and every touch point is found by
 * scaling the line of centres by (second radius / centre distance).
 *
 * Two incidences are checked against that geometry:
 *   - AFa, BFb and CFc meet at one point F (X(12) in Kimberling's ETC);
 *   - I (= X(1)), N (= X(5), the nine-point centre), Fi (= X(11), the true
 *     Feuerbach point) and F lie on one line, L(1, 5), with F the harmonic
 *     conjugate of Fi with respect to I and N, so (I, N; Fi, F) = -1.
 *
 * Naming slips kept from the original page and reported below: it calls N
 * "the Feuerbach point" even though N is the nine-point centre and Fi is the
 * touch point X(11), and it calls the four collinear points "concurrent".
 * Every number is measured by the real core; coordinates are board units in
 * the page's 400 x 250 viewBox, y down. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };
type Flags = {
  showNames: boolean; showCircles: boolean; showLines: boolean; showLine: boolean;
};
type State = {
  A: Point; B: Point; C: Point; width: number; height: number;
  showNames: boolean; showCircles: boolean; showLines: boolean; showLine: boolean;
};
type Geometry = {
  A: Point; B: Point; C: Point; I: Point; N: Point;
  incircle: Circle; nine: Circle; ca: Circle; cb: Circle; cc: Circle;
  Pa: Point; Pb: Point; Pc: Point; Pi: Point; F: Point; valid: boolean;
};
interface Core {
  WIDTH: number;
  HEIGHT: number;
  start(options?: Json): State;
  reset(state: State): State;
  compute(a: Point, b: Point, c: Point): Geometry;
  flags(state: State): Flags;
  movePoint(state: State, name: string, q: Point): State;
  position(state: State): Json;
  dist(a: Point, b: Point): number;
  lineError(p: Point, a: Point, b: Point): number;
  collinearError(p: Point, q: Point, r: Point): number;
}

const core = (): Core =>
  cores["feuerbach-incidence"].FeuerbachIncidenceCore as unknown as Core;

/* The core is exact up to floating point; only what we print is rounded. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const maybe = (v: number | null | undefined, digits = 9): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v, digits) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) } : null;

/** A board point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string): Point {
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readNumber(args: Json, key: string, fallback: number, min: number, max: number): number {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`argument "${key}" must be a finite number`);
  if (n < min || n > max) throw new Error(`argument "${key}" must be between ${min} and ${max}`);
  return n;
}

/**
 * A real core state. Supplied corners are applied as page drags, so they are
 * clamped to the board exactly as Core.movePoint clamps a handle; omitted
 * corners stay at the applet's opening positions. Flags may be top-level or
 * under a nested "flags" object (as Track.state saves them).
 */
function readState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C points and display options");
  }
  const width = readNumber(args, "width", C.WIDTH, 100, 2000);
  const height = readNumber(args, "height", C.HEIGHT, 100, 2000);
  let s = C.start({ width, height });
  for (const name of ["A", "B", "C"] as const) {
    const v = args[name];
    if (v !== undefined && v !== null) s = C.movePoint(s, name, readPoint(v, name));
  }
  const flagSrc: Json = args.flags && typeof args.flags === "object" && !Array.isArray(args.flags)
    ? args.flags as Json : args;
  for (const key of ["showNames", "showCircles", "showLines", "showLine"] as const) {
    const v = flagSrc[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "boolean") throw new Error(`argument "flags.${key}" must be true or false`);
    s = { ...s, [key]: v };
  }
  return s;
}

/** Everything the core says about one triangle, in plain JSON. */
function reading(C: Core, g: Geometry) {
  const scale = Math.max(C.dist(g.A, g.B), C.dist(g.B, g.C), C.dist(g.C, g.A));
  const cevianDefs = [
    { name: "AFa", from: g.A, to: g.Pa },
    { name: "BFb", from: g.B, to: g.Pb },
    { name: "CFc", from: g.C, to: g.Pc },
  ] as const;
  const cevians = cevianDefs.map((d) => {
    const miss = C.lineError(g.F, d.from, d.to);
    return {
      name: d.name,
      from: pt(d.from), to: pt(d.to),
      miss: maybe(miss),
      missPctOfLongestSide: maybe(Number.isFinite(miss) && Number.isFinite(scale) && scale > 0
        ? miss / scale * 100 : NaN),
    };
  });
  const missMax = Math.max(...cevians.map((c) => c.miss ?? Infinity));
  const concurrence = {
    F: pt(g.F),
    maxMiss: maybe(missMax),
    tolerance: round(1e-6 * Math.max(1, scale), 9),
    concurrent: g.valid && Number.isFinite(missMax) && missMax <= 1e-6 * Math.max(1, scale),
  };

  /* X(12) in side lengths a = BC, b = CA, c = AB. */
  const a = C.dist(g.B, g.C), b = C.dist(g.C, g.A), c = C.dist(g.A, g.B);
  const den = [b + c - a, c + a - b, a + b - c];
  let x12: { barycentric: number[] | null; point: Point | null; agreement: number | null } = {
    barycentric: null, point: null, agreement: null,
  };
  if (den.every((d) => Math.abs(d) > 1e-9)) {
    const w = [(b + c) ** 2 / den[0], (c + a) ** 2 / den[1], (a + b) ** 2 / den[2]];
    const W = w[0] + w[1] + w[2];
    const p = {
      x: (w[0] * g.A.x + w[1] * g.B.x + w[2] * g.C.x) / W,
      y: (w[0] * g.A.y + w[1] * g.B.y + w[2] * g.C.y) / W,
    };
    x12 = {
      barycentric: w.map((v) => round(v)),
      point: pt(p),
      agreement: maybe(C.dist(p, g.F)),
    };
  }

  const errors = {
    N_F_I: maybe(C.collinearError(g.N, g.F, g.I)),
    N_F_Fi: maybe(C.collinearError(g.N, g.F, g.Pi)),
    I_N_Fi: maybe(C.collinearError(g.I, g.N, g.Pi)),
    I_F_Fi: maybe(C.collinearError(g.I, g.F, g.Pi)),
  };
  const colMax = Math.max(...Object.values(errors).map((v) => v ?? Infinity));
  /* Cross-ratio (I, N; Fi, F) in the coordinate along I -> N (I = 0, N = 1). */
  const dx = g.N.x - g.I.x, dy = g.N.y - g.I.y;
  const len2 = dx * dx + dy * dy;
  let crossRatio: number | null = null;
  if (len2 > 1e-12) {
    const t = (p: Point): number => ((p.x - g.I.x) * dx + (p.y - g.I.y) * dy) / len2;
    const tfi = t(g.Pi), tf = t(g.F);
    if (Math.abs(tfi - 1) > 1e-9 && Math.abs(tf - 1) > 1e-9) {
      crossRatio = maybe((tfi / (tfi - 1)) / (tf / (tf - 1)));
    }
  }
  const collinearity = {
    line: "L(1, 5): the line through I = X(1) and N = X(5)",
    through: { I: pt(g.I), N: pt(g.N), Fi: pt(g.Pi), F: pt(g.F) },
    errors,
    maxError: maybe(colMax),
    collinear: g.valid && Number.isFinite(colMax) && colMax <= 1e-6,
    crossRatio_IFiNF: crossRatio,
    harmonicConjugate: crossRatio !== null && Math.abs(crossRatio + 1) < 1e-6,
  };

  return {
    valid: g.valid,
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    sideLengths: { a: round(a), b: round(b), c: round(c) },
    centres: { I: pt(g.I), N: pt(g.N) },
    circles: {
      incircle: { center: pt(g.incircle.center), radius: maybe(g.incircle.radius, 6) },
      nine: { center: pt(g.nine.center), radius: maybe(g.nine.radius, 6) },
      excircleA: { center: pt(g.ca.center), radius: maybe(g.ca.radius, 6) },
      excircleB: { center: pt(g.cb.center), radius: maybe(g.cb.radius, 6) },
      excircleC: { center: pt(g.cc.center), radius: maybe(g.cc.radius, 6) },
    },
    touchPoints: { Fa: pt(g.Pa), Fb: pt(g.Pb), Fc: pt(g.Pc), Fi: pt(g.Pi) },
    F: pt(g.F),
    cevians,
    concurrence,
    x12,
    collinearity,
  };
}

function requireValid(C: Core, s: State): Geometry {
  const g = C.compute(s.A, s.B, s.C);
  if (!g.valid || !Number.isFinite(g.F.x) || !Number.isFinite(g.F.y)) {
    throw new Error(
      "those three corners do not give a unique Feuerbach touch point: a flat or " +
      "equilateral triangle makes the applet divide by zero; move A, B or C apart",
    );
  }
  return g;
}

export function actions(): GameActions {
  return {
    concurrence: {
      describe:
        "For a triangle A, B, C (each [x, y] or { x, y } on the page's 400 x 250 board, y downward; omit any to keep the applet's opening picture), run the real core and report the incircle, nine-point circle and three excircles, the touch points Fa, Fb, Fc, Fi, the centres I and N, and the point F where AFa, BFb and CFc concur, with each cevian's miss and a comparison to the X(12) barycentric formula; optional width, height and flags do not change the geometry. Note the original page's slip: it calls N 'the Feuerbach point', but N is the nine-point centre X(5) while Fi = X(11) is the true Feuerbach point.",
      args: '{ "A": [200, 20], "B": [30, 210], "C": [340, 170] }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const g = requireValid(C, s);
        const r = reading(C, g);
        return {
          ...r,
          flags: C.flags(s),
          note:
            `AFa, BFb and CFc meet at F = (${r.F!.x}, ${r.F!.y}): the largest miss of F from the three lines is ` +
            `${r.concurrence.maxMiss} board units, ${r.cevians.reduce((m, c) =>
              Math.max(m, c.missPctOfLongestSide ?? Infinity), 0)}% of the longest side. ` +
            (r.x12.point
              ? `The core's F agrees with the X(12) barycentric point to ${r.x12.agreement} board units. `
              : "The side lengths make the X(12) formula degenerate here. ") +
            `The page calls N = (${r.centres.N!.x}, ${r.centres.N!.y}) "the Feuerbach point", but N is the nine-point centre X(5); the touch point Fi = (${r.touchPoints.Fi!.x}, ${r.touchPoints.Fi!.y}) is X(11). ` +
            "This is an illustration rather than a game, so there is no win or loss.",
        };
      },
    },

    collinear_line: {
      describe:
        "For a triangle A, B, C (each [x, y] or { x, y }; omit any to keep the applet's opening picture), run the real core and report I = X(1), N = X(5), Fi = X(11) and F, their pairwise collinearity errors and the cross-ratio (I, N; Fi, F) = -1 that makes F the harmonic conjugate of Fi with respect to I and N on L(1, 5). The original page calls four points 'concurrent' (meaning collinear) and misnames N as the Feuerbach point; Fi is X(11).",
      args: '{ "A": [200, 20], "B": [30, 210], "C": [340, 170] }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const g = requireValid(C, s);
        const r = reading(C, g);
        return {
          ...r,
          flags: C.flags(s),
          note:
            `The core puts I, N, Fi and F on one line, L(1, 5): the largest sine of the angle between pairs of them is ` +
            `${r.collinearity.maxError}. The cross-ratio (I, N; Fi, F) is ${r.collinearity.crossRatio_IFiNF}, ` +
            `so F = (${r.F!.x}, ${r.F!.y}) ${r.collinearity.harmonicConjugate
              ? "is" : "is not measured as"} the harmonic conjugate of Fi with respect to I and N. ` +
            "The original page says these four points are 'concurrent'; for points that word means collinear, " +
            "and its 'Feuerbach point' is actually N, the nine-point centre, while Fi is the touch point X(11). " +
            "This is an illustration: there is no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Feuerbach Incidence state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Feuerbach Incidence position must be an object");
  }
  const C = core();
  let savedReadable = true;
  let s: State;
  try {
    s = readState(C, state);
  } catch {
    savedReadable = false;
    s = C.start({});
  }
  const g = C.compute(s.A, s.B, s.C);
  const r = reading(C, g);
  return {
    ...state,
    stateVersion,
    savedReadable,
    saved: {
      A: pt(s.A), B: pt(s.B), C: pt(s.C),
      width: s.width, height: s.height,
      flags: C.flags(s),
    },
    valid: g.valid,
    centres: r.centres,
    circles: r.circles,
    touchPoints: r.touchPoints,
    F: r.F,
    concurrence: r.concurrence,
    x12: r.x12,
    collinearity: r.collinearity,
    isIllustration: true,
    note: !savedReadable
      ? "The saved fields could not be read as three board points, so the core's opening triangle was reconstructed; the reading below is of that picture."
      : !g.valid
        ? "Track.state saved the three corners, the board size and the four display flags, but those corners are flat or equilateral, so there is no unique Feuerbach touch point and the core draws nothing."
        : "Track.state saved A, B, C, the 400 x 250 board size and the four display flags (concurrence and collinearity are gated on circles being shown). The core rebuilds the five circles, the four touch points and the two incidences from those corners. N is the nine-point centre X(5), not the 'Feuerbach point' the original page names it; Fi = X(11) is the true touch point. This is an illustration: there is no win or loss.",
  };
}
