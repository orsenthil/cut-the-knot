/*
 * run_game_logic actions and saved-position reader for ArrangePyth
 * ("Pythagorean Theorem By Rearrangement", Proof #36 in the applet).
 * The core lives in arrange-pyth/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 *
 * The drawing has two squares of the same side S = a + b. The left square is
 * cut into four right triangles (legs a and b) and the square on c; the right
 * square is cut into the same four triangles and the squares on a and b.
 * Removing the four triangles from both squares leaves c² = a² + b².
 * The core's measures() sets c² = a² + b² by definition, so the real check
 * here is the areas measured on the drawn polygons with the shoelace formula.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["arrange-pyth"].ArrangePythCore;

type Point = { x: number; y: number };
type CoreState = { width: number; height: number; m: Point; a: number; b: number };
const TOL = 1e-6;
const near = (x: number, y: number) => Math.abs(x - y) <= TOL * Math.max(1, Math.abs(x), Math.abs(y));

function readPoint(value: unknown, name: string): Point {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${name}" must be a {x, y} point`);
  }
  const p = value as Json;
  return { x: num(p, "x"), y: num(p, "y") };
}

/** The board size and the square side the applet's init() computes for it. */
function board(args: Json) {
  const C = core();
  const width = num(args, "width", C.APPLET.width);
  const height = num(args, "height", C.APPLET.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new Error(`"width" and "height" must be positive integers, got ${width} and ${height}`);
  }
  const g = C.layout(width, height);
  if (g.side < 2) throw new Error(`the board ${width} x ${height} is too small for the two squares`);
  return { width, height, g, start: C.start(width, height) as CoreState };
}

/** Check the split against the side of the squares; M must sit on the bottom edge at x = L0.x + a. */
function checkSplit(a: number, b: number, m: Point, side: number, leftX: number, bottomY: number) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a + b !== side) {
    throw new Error(`"a" and "b" must be non-negative integers with a + b = ${side} (the squares' side); got ${a} and ${b}`);
  }
  if (m.x !== leftX + a || m.y !== bottomY) {
    throw new Error(`M must be on the left square's bottom edge at (${leftX + a}, ${bottomY}); got (${m.x}, ${m.y})`);
  }
}

/** Build the core's state from a split a, b (both default to the applet's starting split). */
function splitState(args: Json): CoreState {
  const C = core();
  const { width, height, g, start } = board(args);
  const a = num(args, "a", start.a);
  const b = num(args, "b", start.b);
  const m = { x: g.L[0].x + a, y: g.L[0].y };
  checkSplit(a, b, m, g.side, g.L[0].x, g.L[0].y);
  return { width, height, m: C.pt(m.x, m.y), a, b };
}

/** The exact state a saved position describes, checked before it is read. */
function savedState(state: Json): CoreState {
  const { width, height, g } = board(state);
  const m = readPoint(state.m, "m");
  const a = num(state, "a");
  const b = num(state, "b");
  checkSplit(a, b, m, g.side, g.L[0].x, g.L[0].y);
  return { width, height, m, a, b };
}

/** All pieces and areas of one arrangement, measured on the core's own polygons. */
function reading(state: CoreState) {
  const C = core();
  const g = C.layout(state.width, state.height);
  const p = C.pieces(state);
  const m = C.measures(state);
  const pieces = (list: Array<{ name: string; color: string; points: Point[] }>) =>
    list.map((piece) => ({
      name: piece.name,
      color: piece.color,
      vertices: piece.points,
      area: C.area(piece.points),
    }));
  const triangleTotal = m.triangleAreas.reduce((sum: number, area: number) => sum + area, 0);
  const leftRemainder = m.hypotenuseArea;
  const rightRemainder = m.squareAArea + m.squareBArea;
  const holds =
    near(m.leftArea, g.side * g.side) && near(m.rightArea, g.side * g.side) &&
    near(triangleTotal, 2 * m.a * m.b) &&
    near(leftRemainder, m.c2) && near(m.squareAArea, m.a2) && near(m.squareBArea, m.b2) &&
    near(leftRemainder, rightRemainder);

  return {
    a: m.a,
    b: m.b,
    m: state.m,
    side: g.side,
    leftSquare: {
      corners: g.L,
      area: m.leftArea,
      pieces: pieces(p.left),
    },
    rightSquare: {
      corners: g.R,
      area: m.rightArea,
      pieces: pieces(p.right),
    },
    triangles: {
      count: m.triangleAreas.length,
      legs: { a: m.a, b: m.b },
      eachArea: m.a * m.b / 2,
      measuredAreas: m.triangleAreas,
      totalArea: triangleTotal,
    },
    squares: {
      hypotenuse: { side: m.hypotenuseSide, area: leftRemainder, coreC2: m.c2 },
      onA: { side: m.a, area: m.squareAArea, coreA2: m.a2 },
      onB: { side: m.b, area: m.squareBArea, coreB2: m.b2 },
    },
    cancellation: {
      takingAway: `${m.triangleAreas.length} triangles, each ${m.a} × ${m.b} / 2 = ${m.a * m.b / 2}, total ${triangleTotal}`,
      leftRemainder,
      rightRemainder,
      formula: `(${m.a} + ${m.b})² − ${triangleTotal} = ${g.side * g.side} − ${triangleTotal} = ${leftRemainder}`,
      identity: `${m.a}² + ${m.b}² = ${m.a2} + ${m.b2} = ${m.c2} = c² = ${leftRemainder}`,
      holds,
    },
    note:
      "Both large squares have side a + b. After the same four triangles are removed, the left one leaves the square on c and the right one leaves the squares on a and b, so their measured areas agree: c² = a² + b². The core defines c² as a² + b²; the shoelace areas of the drawn squares are the independent check.",
  };
}

export function actions(): GameActions {
  return {
    rearrangement: {
      describe:
        "The rearrangement for a split of the squares' side into a and b (non-negative integers with a + b = 110 on the default 500 x 300 board; both default to the applet's starting 13 and 97). Reports the left square's four right triangles and square on c, the right square's same four triangles and squares on a and b, every polygon's vertices and measured area, and the cancellation of the four triangles that leaves c² = a² + b². Optional width and height set a different board.",
      args: '{ "a": 14, "b": 96 }',
      run: (args) => reading(splitState(args)),
    },
    drag_m: {
      describe:
        "Drag point M along the bottom edge of the left square, as the page does: x is rounded and clamped to the edge, and y must be within 20 pixels of it or M stays where it was (default x, y are the starting point). Reports whether the grab was live, the resulting split a and b, that a + b stays the square's side, and the cancellation reading including the measured square areas.",
      args: '{ "x": 84, "y": 205 }',
      run: (args) => {
        const C = core();
        const { width, height, g, start } = board(args);
        const x = num(args, "x", start.m.x);
        const y = num(args, "y", start.m.y);
        const onBottomEdge = C.canGrab(start, x, y);
        const next = C.withM(start, x, y) as CoreState;
        const r = reading(next);
        return {
          pointer: { x, y },
          onBottomEdge,
          moved: next.m,
          split: { a: next.a, b: next.b, side: g.side, aPlusB: next.a + next.b },
          triangleTotal: r.triangles.totalArea,
          leftRemainder: r.cancellation.leftRemainder,
          rightRemainder: r.cancellation.rightRemainder,
          identity: r.cancellation.identity,
          holds: r.cancellation.holds,
          note: onBottomEdge
            ? "M moved along the bottom edge: a and b change, but their sum and both square areas stay the same."
            : "The pointer was outside the bottom edge's 20-pixel band, so the applet would not grab M; the starting split is reported.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of that same drawing. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Arrange Pyth state version ${stateVersion}`);
  const saved = savedState(state);
  const r = reading(saved);
  return {
    stateVersion,
    width: saved.width,
    height: saved.height,
    m: saved.m,
    a: saved.a,
    b: saved.b,
    side: r.side,
    onBottomEdge: core().canGrab(saved, saved.m.x, saved.m.y),
    reading: r,
  };
}
