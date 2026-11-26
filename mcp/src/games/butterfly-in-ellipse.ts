/*
 * run_game_logic actions and saved-position reader for Butterfly In Ellipse.
 *
 * Vertices P[0..n-1] sit on an ellipse, and the crossing L[i] is where side
 * P[i]--P[i-1] meets a fixed straight line. Drag one vertex: the core slides
 * the other vertices back onto the ellipse using those fixed crossings, and
 * for an even n the last side still passes through its own crossing. The page
 * proves this with two applications of Pascal's hexagon theorem and notes that
 * the statement is projective, so an ellipse is no harder than a circle.
 *
 * Every number below comes from the real core
 * (butterfly-in-ellipse/butterfly-in-ellipse-core.js), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 * Coordinates are board units in the page's 400 x 300 viewBox, y down.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["butterfly-in-ellipse"].ButterflyInEllipseCore as any;

type Pt = { x: number; y: number };
type State = {
  view: { width: number; height: number };
  n: number; seed: number;
  V: Pt[]; P: Pt[]; L: Pt[];
  line: { p: Pt; q: Pt };
  names: boolean; explored: boolean;
};
type Claims = {
  onEllipse: boolean; collinear: boolean; sides: boolean[]; holds: boolean; tol: number;
};
type Ellipse = { center: Pt; A: number; B: number };

const round = (v: number): number => Number(v.toFixed(4));
/** A core point, rounded for JSON; NaN from the Cramer guard becomes null. */
const pt = (p: any): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (p: any): boolean => Boolean(p && Number.isFinite(p.x) && Number.isFinite(p.y));

/** Accept both the tutor's [x, y] and the page's saved { x, y }. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

function readPoints(v: unknown, count: number, label: string): Pt[] {
  if (!Array.isArray(v) || v.length !== count) {
    throw new Error(`"${label}" must be exactly ${count} points`);
  }
  return v.map((p, i) => readPoint(p, `${label}[${i}]`));
}

/** n is the polygon's side count; the core allows 4 to 20. */
function readN(args: Json): number {
  const C = core();
  const n = num(args, "n", 4);
  if (!Number.isInteger(n)) throw new Error('"n" must be a whole number');
  if (n < C.N_MIN || n > C.N_MAX) {
    throw new Error(`"n" must be between ${C.N_MIN} and ${C.N_MAX}`);
  }
  return n;
}

/** The opening picture for a requested n, seed and board size. */
function startState(args: Json): State {
  const C = core();
  const n = readN(args);
  const width = num(args, "width", C.VIEW.width);
  const height = num(args, "height", C.VIEW.height);
  if (!(width > 0 && height > 0)) throw new Error('"width" and "height" must be positive');
  return C.start({
    width, height, n, seed: num(args, "seed", 1),
    names: n === 4 && args.names === true,
    explored: args.explored === true,
  }) as State;
}

/** start() keeps custom L empty unless it is given; measure it from the sides. */
function withMeasuredL(C: any, state: State): State {
  return { ...state, L: C.adjustPointsOnLine(state) as Pt[] };
}

/** The names the page prints: letters for the first four handles, numbers after. */
const vertexName = (C: any, i: number): string => (i < 4 ? C.POINT_NAMES[i] : `P${i + 1}`);
const crossingName = (C: any, i: number): string =>
  (i < 4 ? `F ${C.L_NAMES[i]}` : `F${i + 1}`);

/** The real test: where each side crosses the line now, versus its fixed dot. */
function crossings(C: any, state: State) {
  const measured = C.adjustPointsOnLine(state) as Pt[];
  const claims = C.claims(state) as Claims;
  return state.P.map((_, i) => {
    const j = (i + state.n - 1) % state.n;
    const hit = measured[i], dot = state.L[i];
    const drift = finite(hit) && finite(dot) ? dist(hit, dot) : null;
    return {
      side: `${vertexName(C, i)}${vertexName(C, j)}`,
      crossing: crossingName(C, i),
      at: pt(hit),
      fixedDot: pt(dot),
      drift: drift === null ? null : Number(drift.toExponential(3)),
      pinned: claims.sides[i] === true,
    };
  });
}

/** Exercise the applet's own Cramer guard on two nearly parallel lines. */
function guard(C: any, hits: Pt[]) {
  const nearly = pt(C.intersect(
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 1e-7 }, { x: 100, y: 2e-7 },
  ));
  const tilted = pt(C.intersect(
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 100 },
  ));
  return {
    firesInThisPicture: hits.some((p) => !finite(p)),
    nearlyParallelGivesNoPoint: nearly === null,
    tiltedLinesGiveFinitePoint: tilted !== null,
    rule: "GeoSDoub.Intersect returns NaN when |det| < 1; a nearly parallel side then has no usable crossing dot.",
  };
}

export function actions(): GameActions {
  return {
    pinned_crossings: {
      describe:
        "Build the butterfly picture with n sides (4 to 20) and drag one vertex to the given point. For every side report where it crosses the fixed line, the fixed crossing dot, the drift after the drag, and whether the crossing stayed pinned. The core slides the other vertices onto the ellipse using those fixed dots: for an even n all crossings stay put (the butterfly porism, proved with Pascal's theorem); for an odd n the last side fails the claim. A side almost parallel to the fixed line loses its crossing to the applet's |det| < 1 NaN guard.",
      args: '{ "n": 4, "seed": 1, "vertex": 0, "to": [120, 100] }',
      run: (args) => {
        const C = core();
        const state = startState(args);
        const vertex = num(args, "vertex", 0);
        if (!Number.isInteger(vertex) || vertex < 0 || vertex >= state.n) {
          throw new Error(`"vertex" must be a whole number from 0 to ${state.n - 1}`);
        }
        const to = readPoint(args.to, "to");
        const before = C.adjustPointsOnLine(state) as Pt[];
        const moved = C.move(state, `P${vertex}`, to) as State;
        const after = C.adjustPointsOnLine(moved) as Pt[];
        const c = C.claims(moved) as Claims;
        const rows = crossings(C, moved);
        const broken = rows.filter((r) => !r.pinned).length;
        const beforeRows = before.map((p, i) => ({
          crossing: crossingName(C, i), at: pt(p),
        }));
        const allPinned = c.holds === true;
        return {
          n: state.n,
          evenN: state.n % 2 === 0,
          seed: state.seed,
          dragged: { vertex: vertexName(C, vertex), to: pt(to) },
          fixedLine: { from: pt(state.line.p), to: pt(state.line.q) },
          crossings: rows,
          beforeDrag: beforeRows,
          claims: {
            onEllipse: c.onEllipse === true,
            collinear: c.collinear === true,
            sides: c.sides,
            holds: allPinned,
            tolerance: c.tol,
          },
          guard: guard(C, after),
          status: C.describe(moved) as string,
          note: state.n % 2 === 0
            ? `Even n = ${state.n}: after dragging ${vertexName(C, vertex)} the core keeps all ${state.n} side crossings at their dots${allPinned ? "" : " except where a near-parallel side loses its crossing"}. This is the butterfly porism: two applications of Pascal's hexagon theorem pin the last side.`
            : `Odd n = ${state.n}: the page's claim needs an even number of sides. The core keeps most crossings, but ${broken} side${broken === 1 ? "" : "s"} no longer pass${broken === 1 ? "es" : ""} through ${broken === 1 ? "its" : "their"} own dot, so the porism fails here.`,
        };
      },
    },

    affine_circle: {
      describe:
        "Take a circle of radius r centred at (cx, cy) with n vertices, then apply the axis-aligned affine map (sx*x + tx, sy*y + ty) to its rectangle, vertices and fixed line. The image is an ellipse with radii sx*r and sy*r, and every side crossing is carried to the image of the circle's crossing: incidence is preserved by affine maps, so the circle proof proves the ellipse case. The core models an ellipse as a unit circle stretched by (A, B), with points (cx + A cos t, cy + B sin t). Coordinates are board units; r, sx and sy must be positive and n must be from 4 to 20.",
      args: '{ "cx": 200, "cy": 150, "r": 80, "sx": 1.5, "sy": 0.7, "tx": 30, "ty": -20 }',
      run: (args) => {
        const C = core();
        const cx = num(args, "cx", 200), cy = num(args, "cy", 150);
        const r = num(args, "r", 80);
        const sx = num(args, "sx", 1.5), sy = num(args, "sy", 0.7);
        const tx = num(args, "tx", 30), ty = num(args, "ty", -20);
        if (!(r > 0)) throw new Error('"r" must be positive');
        if (!(sx > 0 && sy > 0)) throw new Error('"sx" and "sy" must be positive stretches');
        const n = readN(args);
        const view = {
          width: num(args, "width", C.VIEW.width),
          height: num(args, "height", C.VIEW.height),
        };
        /* start() would size the opening rectangle by width/3, so set the four
           corners explicitly: a true circle of radius r at (cx, cy). Its
           starting vertices are rescaled from a square board's circle. */
        const base = C.start({ width: 2 * r, height: 2 * r, n, seed: num(args, "seed", 1) }) as State;
        const V: Pt[] = [
          { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r },
          { x: cx + r, y: cy - r }, { x: cx - r, y: cy - r },
        ];
        const grow = (p: Pt): Pt => ({
          x: cx + (3 * (p.x - r)) / 2,
          y: cy + (3 * (p.y - r)) / 2,
        });
        const circle = withMeasuredL(C, {
          ...base, view, V, P: base.P.map(grow),
          line: { p: { x: cx - r, y: cy - r / 2 }, q: { x: cx + r, y: cy + (3 * r) / 4 } },
        });
        const map = (p: Pt): Pt => ({ x: tx + sx * p.x, y: ty + sy * p.y });
        const ellipse = withMeasuredL(C, C.start({
          width: view.width, height: view.height, n,
          V: circle.V.map(map), P: circle.P.map(map),
          line: { p: map(circle.line.p), q: map(circle.line.q) },
        }) as State);
        const e = C.ellipseFrom(ellipse.V) as Ellipse;
        const before = C.adjustPointsOnLine(circle) as Pt[];
        const after = C.adjustPointsOnLine(ellipse) as Pt[];
        const sides = before.map((hit, i) => {
          const expected = map(hit), got = after[i];
          const error = finite(expected) && finite(got) ? dist(expected, got) : null;
          const tolerance = 1e-6 * Math.max(1, Math.hypot(expected.x, expected.y));
          return {
            crossing: crossingName(C, i),
            circleHit: pt(hit),
            mappedHit: pt(expected),
            ellipseHit: pt(got),
            error: error === null ? null : Number(error.toExponential(3)),
            preserved: error !== null && error < tolerance,
          };
        });
        const preserved = sides.every((s) => s.preserved);
        return {
          affine: { sx, sy, tx, ty },
          circle: { center: { x: cx, y: cy }, radius: r, crossings: sides.map((s) => s.circleHit) },
          ellipse: {
            center: pt(e.center), A: round(Math.abs(e.A)), B: round(Math.abs(e.B)),
            expectedRadii: { A: round(sx * r), B: round(sy * r) },
            crossings: sides.map((s) => s.ellipseHit),
          },
          sides,
          allCrossingsMapCorrectly: preserved,
          guard: guard(C, after),
          note: preserved
            ? `The circle's crossings map exactly to the ellipse's: the stretch (${sx}, ${sy}) and shift (${tx}, ${ty}) carry each side crossing with the vertices. Because incidence survives affine maps, the Pascal proof for a circle proves the butterfly porism for this ellipse (which needs an even number of sides).`
            : "Some crossings are missing or did not map: a side is nearly parallel to the fixed line, so the core's |det| < 1 guard returns no point. Move the line or choose gentler stretches.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh reading by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Butterfly In Ellipse state version ${stateVersion}`);
  const C = core();
  let here: State = C.start({}) as State;
  let savedReadable = false;
  try {
    const n = readN(state);
    const view = (state.view && typeof state.view === "object" ? state.view : {}) as Json;
    const line = (state.line && typeof state.line === "object" ? state.line : {}) as Json;
    here = C.start({
      width: num(view, "width", C.VIEW.width),
      height: num(view, "height", C.VIEW.height),
      n, seed: num(state, "seed", 1),
      V: readPoints(state.V, 4, "V"),
      P: readPoints(state.P, n, "P"),
      L: readPoints(state.L, n, "L"),
      line: { p: readPoint(line.p, "line.p"), q: readPoint(line.q, "line.q") },
      names: state.names === true,
      explored: state.explored === true,
    }) as State;
    savedReadable = true;
  } catch { /* unusable saved data: fall back to the opening picture */ }

  const e = C.ellipseFrom(here.V) as Ellipse;
  const c = C.claims(here) as Claims;
  const rows = crossings(C, here);
  return {
    stateVersion,
    savedReadable,
    saved: {
      view: here.view, n: here.n, seed: here.seed,
      V: here.V.map(pt), P: here.P.map(pt), L: here.L.map(pt),
      line: { p: pt(here.line.p), q: pt(here.line.q) },
      names: here.names, explored: here.explored,
    },
    ellipse: { center: pt(e.center), A: round(Math.abs(e.A)), B: round(Math.abs(e.B)) },
    crossings: rows,
    claims: {
      onEllipse: c.onEllipse === true,
      collinear: c.collinear === true,
      sides: c.sides,
      holds: c.holds === true,
      tolerance: c.tol,
    },
    status: C.describe(here) as string,
    note: !savedReadable
      ? "The saved position could not be read, so the opening picture is shown instead."
      : here.n % 2 === 0
        ? "The saved vertices lie on the saved ellipse and each side still meets the fixed line at its own dot; for an even number of sides the butterfly porism holds."
        : "The picture has an odd number of sides, for which the butterfly porism is not guaranteed; check the last crossing against its dot.",
  };
}
