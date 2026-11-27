/*
 * run_game_logic actions and saved-position reader for Eppstein's Soddy Circles.
 *
 * The real core is eppstein/eppstein-core.js, copied into src/generated/cores/
 * at build time. A state is three corners A, B, C of a triangle on a 400 x 300
 * board (y down) plus the choice of the small inner Soddy circle or the other
 * solution. The radii at the corners are (b+c-a)/2 = s-a and so on, so the
 * three circles touch in pairs at the triangle's incircle touch points. The
 * core solves Apollonius' problem for the fourth circle and joins opposite
 * tangency points; those three joins concur at the weighted centre
 * M = sum(k_i O_i)/sum(k_i). Dropping the fourth circle gives the Gergonne
 * point Ge, and S, M and Ge are collinear.
 *
 * The cut-the-knot page calls the other circle internally tangent with a
 * negative bend. Descartes' bend k4 = k1+k2+k3 - 2*sqrt(k1k2+k2k3+k3k1) is
 * negative only for an acute triangle; an obtuse triangle gives two external
 * circles and a positive second bend. The core's drawing convention still
 * writes that bend with a minus sign, so both numbers are reported below.
 *
 * Every number here is measured by the core; see _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { x: number; y: number; r: number };
type State = { width: number; height: number; A: Pt; B: Pt; C: Pt; inner: boolean };
type Sides = {
  a: number; b: number; c: number; s: number;
  radii: { A: number; B: number; C: number };
};
type Geom = {
  sides: Sides;
  circles: Circle[];
  soddy: Array<Circle & { t: number }>;
  index: number;
  S: Circle;
  curvatures: number[];
  M: Pt;
  Ge: Pt;
  eppstein: Pt;
  tangencies: Record<string, Pt>;
  lines: Array<{ a: Pt; b: Pt }>;
};
type Core = {
  WIDTH: number;
  HEIGHT: number;
  start(options?: Json): State;
  setPoint(state: State, name: string, point: Pt): State;
  setInner(state: State, inner: boolean): State;
  geometry(state: State): Geom | null;
  position(state: State): Json;
  distance(p: Pt, q: Pt): number;
};

const core = (): Core => cores["eppstein"].EppsteinCore as unknown as Core;

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
/** Core values can be NaN at a degenerate figure; JSON cannot carry that. */
const cnt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
/** Residuals are tiny; keep their size and sign rather than rounding to zero. */
const sig = (v: number | null | undefined): string | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : v.toExponential(2);
const pt = (v: unknown): Pt | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Json;
  const x = cnt(o.x), y = cnt(o.y);
  return x === null || y === null ? null : { x, y };
};
const near = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const dist = (p: Pt, q: Pt): number => Math.hypot(p.x - q.x, p.y - q.y);
/** Perpendicular distance from p to the line through a and b. */
const lineDist = (p: Pt, a: Pt, b: Pt): number => {
  const len = dist(a, b);
  if (!Number.isFinite(len) || len < 1e-12) return NaN;
  return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len;
};

/** A corner as the page saves it ({x, y}) or as a short [x, y]. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { "x": number, "y": number }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

function readBool(args: Json, key: string, dflt: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return dflt;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/**
 * A real core state. start() ignores supplied corners, so each given corner
 * is applied with the same setPoint() the page's drags use; inner defaults to
 * true as it does in the applet.
 */
function buildState(C: Core, args: Json): State {
  let s = C.start({});
  for (const name of ["A", "B", "C"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.setPoint(s, name, readPoint(args[name], name));
    }
  }
  return C.setInner(s, readBool(args, "inner", true));
}

function geometryFor(C: Core, args: Json): { s: State; g: Geom } {
  const s = buildState(C, args);
  const g = C.geometry(s);
  if (!g) {
    throw new Error(
      "A, B and C must form a non-degenerate triangle: the core's Apollonius solver refuses collinear points and a near-zero determinant. Move the three corners apart and try again.",
    );
  }
  return { s, g };
}

/** Descartes' two bends from the three vertex bends, with the core's bends. */
function descartes(g: Geom): Json {
  const [ka, kb, kc] = g.curvatures.slice(0, 3);
  const root = Math.sqrt(ka * kb + kb * kc + kc * ka);
  const plus = ka + kb + kc + 2 * root;
  const minus = ka + kb + kc - 2 * root;
  const innerRadius = g.soddy[0].r, outerRadius = g.soddy[1].r;
  return {
    vertexBends: [ka, kb, kc].map(cnt),
    root: cnt(root),
    descartesPlus: cnt(plus),
    descartesMinus: cnt(minus),
    innerRadius: cnt(innerRadius),
    outerRadius: cnt(outerRadius),
    innerBend: cnt(1 / innerRadius),
    outerBendMagnitude: cnt(1 / outerRadius),
    innerFormulaResidual: sig(1 / innerRadius - plus),
    outerMagnitudeResidual: sig(1 / outerRadius - Math.abs(minus)),
    outerDescartesBendIsNegative: minus < 0,
    note:
      "Descartes' theorem gives k4 = k1+k2+k3 ± 2*sqrt(k1k2+k2k3+k3k1): the plus sign is the small inner circle and the minus sign is the other solution. " +
      (minus < 0
        ? "Here the second bend is negative, so the outer circle encloses the three vertex circles as the page describes."
        : "Here the second bend is positive: for this obtuse triangle both Soddy circles touch the three externally, so the page's 'negative bend' sentence is not universal. The core still draws the outer family with a negative bend by convention."),
  };
}

/** The chosen family, with the concurrency and collinearity measurements. */
function family(C: Core, g: Geom): Json {
  const distances = g.lines.map((l) => lineDist(g.M, l.a, l.b));
  const meetResidual = dist(g.eppstein, g.M);
  const collinearResidual = lineDist(g.S, g.Ge, g.M);
  const gaps = g.circles.map((c, i) => dist(g.S, c));
  const externallyTangent = gaps.every((d, i) => near(d, g.S.r + g.circles[i].r));
  const enclosing = gaps.every(
    (d, i) => near(d, Math.abs(g.S.r - g.circles[i].r)) && g.S.r > g.circles[i].r,
  );
  return {
    family: g.index === 0 ? "inner" : "outer",
    S: pt(g.S),
    radius: cnt(g.S.r),
    bend: cnt(g.curvatures[3]),
    touches: externallyTangent ? "externally tangent to all three" :
      enclosing ? "encloses all three" : "mixed or degenerate",
    M: pt(g.M),
    Gergonne: pt(g.Ge),
    tangentPoints: {
      SA: pt(g.tangencies.SA), SB: pt(g.tangencies.SB), SC: pt(g.tangencies.SC),
      AB: pt(g.tangencies.AB), BC: pt(g.tangencies.BC), CA: pt(g.tangencies.CA),
    },
    concurrence: {
      distancesFromMToLines: distances.map(sig),
      meetMinusM: sig(meetResidual),
      concurrent: distances.every((d) => near(d, 0)) && near(meetResidual, 0),
    },
    collinearity: {
      distanceOfSToLineGeM: sig(collinearResidual),
      collinear: near(collinearResidual, 0),
    },
    note:
      `The three joins between opposite tangency points pass through M = (${round(g.M.x)}, ${round(g.M.y)}), the weighted centre of the four circles; the core's line intersection agrees with M to ${sig(meetResidual)}. ` +
      `Leaving out the fourth circle gives Ge = (${round(g.Ge.x)}, ${round(g.Ge.y)}), and S, M and Ge are collinear to ${sig(collinearResidual)}. ` +
      `The vertex circles still touch in pairs: radius at A is s-a = ${round(g.sides.radii.A)}.`,
  };
}

/** Side lengths, corner radii and the three pairwise-touch residuals. */
function triangle(C: Core, s: State, g: Geom): Json {
  const [ra, rb, rc] = g.circles.map((c) => c.r);
  return {
    board: { width: s.width, height: s.height },
    sides: { a: cnt(g.sides.a), b: cnt(g.sides.b), c: cnt(g.sides.c), s: cnt(g.sides.s) },
    vertexRadii: { A: cnt(g.sides.radii.A), B: cnt(g.sides.radii.B), C: cnt(g.sides.radii.C) },
    vertexPairTouchResiduals: {
      AB: sig(dist(g.circles[0], g.circles[1]) - (ra + rb)),
      BC: sig(dist(g.circles[1], g.circles[2]) - (rb + rc)),
      CA: sig(dist(g.circles[2], g.circles[0]) - (rc + ra)),
    },
  };
}

const cornersDescription =
  "Give the three corners A, B, C of the triangle (each [x, y] or { x, y } in the page's 400 x 300 board, y down; omit any to use the applet's opening figure).";

export function actions(): GameActions {
  return {
    soddy_concurrence: {
      describe:
        `${cornersDescription} With an optional boolean "inner" (default true), run the real Eppstein core for that corner circle configuration: report the three mutually tangent corner circles (radii s-a, s-b, s-c), both Soddy solutions from Descartes' bend formula, and for the chosen one its centre S, radius, bend, the weighted centre M = sum(k_i O_i)/sum(k_i) where the three chords joining opposite tangency points concur, and the Gergonne point Ge with the S-M-Ge collinearity. Residuals show how nearly the lines pass through M; the note flags that the outer circle's bend is not always negative.`,
      args: '{ "A": { "x": 201.248, "y": 90.026 }, "B": { "x": 160.781, "y": 195.408 }, "C": { "x": 258.804, "y": 138.080 }, "inner": true }',
      run: (args) => {
        const C = core();
        const { s, g } = geometryFor(C, args);
        return {
          A: pt(s.A), B: pt(s.B), C: pt(s.C), inner: s.inner,
          ...triangle(C, s, g),
          descartes: descartes(g),
          chosen: family(C, g),
          note:
            "The corner circle at A has radius (b+c-a)/2 = s-a, so the three circles just touch and Apollonius' problem has two solutions. " +
            "Eppstein's point is the common point of the three opposite-tangency chords, and it equals the bend-weighted average of the four circle centres. " +
            'The core keeps the applet\'s two choices, so switch "inner" to false to inspect the other circle.',
        };
      },
    },

    compare_families: {
      describe:
        `${cornersDescription} Run the real Eppstein core twice, once with the small inner Soddy circle and once with the other solution, and compare their centres, radii, bends, tangency type, concurrency at M = sum(k_i O_i)/sum(k_i) and S-M-Ge collinearity, alongside Descartes' two bends. Use this to see the obtuse-triangle caveat: when Descartes' smaller bend is positive the second circle is another external circle, not an enclosing one with a negative bend, although the core still draws that family with a minus sign.`,
      args: '{ "A": [200, 260], "B": [30, 150], "C": [370, 150] }',
      run: (args) => {
        const C = core();
        const { s, g } = geometryFor(C, args);
        const inner = C.geometry(C.setInner(s, true));
        const outer = C.geometry(C.setInner(s, false));
        if (!inner || !outer) {
          throw new Error("the core could not solve both Soddy circles for these corners");
        }
        const i = family(C, inner), o = family(C, outer);
        const d = descartes(inner);
        return {
          A: pt(s.A), B: pt(s.B), C: pt(s.C),
          ...triangle(C, s, g),
          descartes: d,
          inner: {
            S: i.S, radius: i.radius, bend: i.bend, touches: i.touches,
            M: i.M, Gergonne: i.Gergonne, concurrence: i.concurrence,
            collinearity: i.collinearity,
          },
          outer: {
            S: o.S, radius: o.radius, bend: o.bend, touches: o.touches,
            M: o.M, Gergonne: o.Gergonne, concurrence: o.concurrence,
            collinearity: o.collinearity,
          },
          bothConcurrent: (i.concurrence as Json).concurrent === true &&
            (o.concurrence as Json).concurrent === true,
          bothCollinear: (i.collinearity as Json).collinear === true &&
            (o.collinearity as Json).collinear === true,
          note:
            "Both Soddy circles make the three opposite-tangency chords concur at their own weighted centre, and S, M and Ge stay collinear. " +
            (d.outerDescartesBendIsNegative === true
              ? "The smaller Descartes bend here is negative, so the outer solution encloses the three corner circles."
              : "The smaller Descartes bend here is positive: this is an obtuse triangle with two externally tangent Soddy circles. The page's claim of a negative bend for the outer circle fails here, even though the core's drawing convention assigns it a minus sign."),
        };
      },
    },
  };
}

/** Track.state saved the three corners and the inner/outer choice; rebuild the picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Eppstein state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  let savedReadable = true;
  let s: State;
  try {
    s = buildState(C, src);
  } catch {
    s = C.start({});
    savedReadable = false;
  }
  const saved = {
    A: pt(src.A), B: pt(src.B), C: pt(src.C),
    inner: typeof src.inner === "boolean" ? src.inner : null,
  };
  const g = C.geometry(s);
  if (!g) {
    return {
      stateVersion, savedReadable, saved, valid: false,
      A: pt(s.A), B: pt(s.B), C: pt(s.C), inner: s.inner,
      note: !savedReadable
        ? "The saved position could not be read, and the opening figure is also degenerate; the core cannot draw the Soddy circles."
        : "The saved corners are collinear or too close to a line, so the core cannot draw the Soddy circles at this position.",
    };
  }
  const canonical = C.position(s);
  return {
    stateVersion,
    savedReadable,
    saved,
    A: pt(s.A), B: pt(s.B), C: pt(s.C), inner: s.inner,
    positionFromCore: {
      A: pt((canonical as Json).A), B: pt((canonical as Json).B),
      C: pt((canonical as Json).C), inner: (canonical as Json).inner === true,
    },
    valid: true,
    ...triangle(C, s, g),
    descartes: descartes(g),
    reading: family(C, g),
    note:
      (!savedReadable
        ? "The saved position could not be read, so the core's opening figure is used for the reading below. "
        : "") +
      "Track.state saved only the three corner centres and the inner/outer choice; the core rebuilds the radii, both Soddy circles, the bend-weighted centre M where the opposite-tangency chords concur, the Gergonne point and the S-M-Ge line. " +
      "This is an illustration rather than a game, so there is no win or loss.",
  };
}
