/*
 * run_game_logic actions and saved-position reader for Hinged Pythagoras 2
 * (applet HingedPythagoras2, the second hinged dissection). The core lives in
 * hinged-pythagoras-2/ and is copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 *
 * The left square of side c is cut by four turned sides into four congruent
 * right triangles (legs a = c·cos B, b = c·sin B) and a middle square of side
 * |a−b|. Swinging two triangles about the hinges is a rigid turn, so the
 * pieces' area cannot change. Proof #10's identity is
 *   c² = (a−b)² + 4(ab/2) = (a−b)² + 2ab = a² + b².
 * One quirk of the applet is kept: the shape slider runs to 95°, but past 90°
 * the cuts leave the square, so the algebra still holds while the drawn
 * pieces no longer tile it.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["hinged-pythagoras-2"].HingedPythagoras2Core;

type State = { angle: number; beta: number };
type Point = { x: number; y: number };

const TOL = 1e-6;
const near = (x: number, y: number) => Math.abs(x - y) <= TOL * Math.max(1, Math.abs(x), Math.abs(y));

/** The exact state a pair of slider values produces, as in the page's input handlers. */
function sliderState(args: Json): { requested: State; state: State } {
  const C = core();
  const start = C.start() as State;
  const angle = num(args, "angle", start.angle);
  const beta = num(args, "beta", start.beta);
  const state = C.withBeta(C.withAngle(start, angle), beta) as State;
  return { requested: { angle, beta }, state };
}

/** Everything the core can tell us about one saved or requested position. */
function reading(state: State) {
  const C = core();
  const id = C.identity(state.beta);
  const g = C.geometry(state);
  const triangleAreas = (list: Point[][]) => list.map((t) => C.area(t));
  const leftAreas = triangleAreas(g.left.triangles);
  const rightAreas = triangleAreas(g.right.triangles);
  const holeArea = C.area(g.left.inner);
  const rightHoleArea = C.area(g.right.inner);
  const pieceTotal = leftAreas.reduce((sum, a) => sum + a, 0) + holeArea;
  const fromPieces = id.hole * id.hole + 4 * id.tri;
  const tilesSquare = near(pieceTotal, id.c2);

  const quirk = state.beta > 90
    ? `At ${state.beta}° the cut leg a = c·cos(B) is negative, so the four pieces cover ${pieceTotal.toFixed(2)} rather than c² = ${id.c2.toFixed(2)}. The original slider allowed 30°–95° and this port keeps it: the algebra holds, the picture does not.`
    : state.beta === 90
      ? "At 90° the middle square is the whole square (a = 0); the four triangles have shrunk to slivers, and the identity still holds."
      : "For 30°–90° the cut pieces fill the square exactly, so the dissection is a visible proof of the identity.";

  return {
    sliders: { angle: state.angle, beta: state.beta, limits: C.LIMITS },
    triangle: {
      count: 4,
      legs: { a: id.a, b: id.b },
      hypotenuse: id.c,
      eachArea: id.tri,
      fourAreas: leftAreas,
      measuredAreasOnRight: rightAreas,
    },
    middleSquare: { side: id.hole, area: holeArea, vertices: g.left.inner },
    algebra: {
      formula: "c² = (a−b)² + 4(ab/2) = (a−b)² + 2ab = a² + b²",
      holeSquared: id.hole * id.hole,
      fourTriangles: 4 * id.tri,
      sum: fromPieces,
      c2: id.c2,
      a2PlusB2: id.a2 + id.b2,
      holds: id.holds && fromPieces <= id.c2 + TOL && fromPieces >= id.c2 - TOL,
      algebraicError: id.algebraicError,
    },
    tiling: {
      squareArea: id.c2,
      leftPiecesArea: pieceTotal,
      rightPiecesArea: rightAreas.reduce((sum, a) => sum + a, 0) + rightHoleArea,
      error: id.tilingError,
      tilesSquare,
    },
    hinges: {
      corners: g.right.hinges,
      swingDegrees: [state.angle, -state.angle],
      // The applet fills the middle square and draws its dashed guide past
      // about 269.4° (DrawRPyth's Angle threshold).
      lateSwing: g.right.showInset,
      dashedGuide: g.right.showInset ? g.right.dashed : null,
    },
    quirk: { pastNinety: state.beta > 90, note: quirk },
    note:
      "The left square is cut into four right triangles of legs a, b and a square of side |a−b|. Removing those pieces from both copies leaves c² = (a−b)² + 2ab = a² + b²; turning the hinged triangles only moves the pieces, so their areas stay the same.",
  };
}

export function actions(): GameActions {
  return {
    proof10: {
      describe:
        "The Proof #10 hinge for triangle-shape angle B (30–95°, default 30°) and swing angle (0–275°, default 0°), with whole degrees clamped like the applet's sliders. Reports a = c·cos(B), b = c·sin(B), the four right triangles and the middle square of side |a−b|, the measured shoelace areas of the pieces, and the identity c² = (a−b)² + 2ab = a² + b². Past 90° the algebra still holds but tiling.tilesSquare is false and tiling.error shows the pieces leaving the square.",
      args: '{ "beta": 30, "angle": 0 }',
      run: (args) => {
        const { requested, state } = sliderState(args);
        return { requested, ...reading(state) };
      },
    },
    set_sliders: {
      describe:
        "Set the applet's two sliders: Rotation (0–275°) and Triangle shape (30–95°). Values are rounded to whole degrees and clamped by the real core, as they are on the page; the 'Turn to the end' button uses Rotation 275. Reports the requested and applied values, the resulting a, b, |a−b|, the identity's four-triangle sum, and whether the late-swing inset or the past-90° cut quirk is showing.",
      args: '{ "angle": 275, "beta": 95 }',
      run: (args) => {
        const { requested, state } = sliderState(args);
        const r = reading(state);
        return {
          sliders: {
            requested,
            applied: { angle: state.angle, beta: state.beta },
            clamped: requested.angle !== state.angle || requested.beta !== state.beta,
          },
          legs: r.triangle.legs,
          middleSquareSide: r.middleSquare.side,
          identity: r.algebra,
          lateSwing: r.hinges.lateSwing,
          pastNinety: r.quirk.pastNinety,
          quirk: r.quirk.note,
        };
      },
    },
  };
}

/** The saved fields (angle and beta) plus the core's reading of that drawing. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Hinged Pythagoras 2 state version ${stateVersion}`);
  }
  const C = core();
  const angle = num(state, "angle");
  const beta = num(state, "beta");
  const applied = C.withBeta(C.withAngle(C.start(), angle), beta) as State;
  return {
    stateVersion,
    angle,
    beta,
    sliders: { angle: applied.angle, beta: applied.beta },
    reading: reading(applied),
  };
}
