/*
 * run_game_logic actions and saved-position reader for Carpet With Hole.
 *
 * Bogomolny's applet CarpetWithHole cuts an N by (N-3) carpet (the page's
 * buttons are 3x6 ... 15x18, so the long side N is 6, 8, ..., 18) with an
 * (N-4) by 1 hole into two staircase pieces. Slide one piece two cells
 * sideways and one cell up or down and the teeth mesh: the same material
 * tiles an (N-2) by (N-2) square. The identity
 *
 *     N(N-3) - (N-4) = (N-2)^2
 *
 * is the whole puzzle, and each staircase piece has (N-2)^2 / 2 cells.
 *
 * Versions of this carpet puzzle are due to Sam Loyd and Henry Dudeney, and
 * it appears in G. N. Frederickson's book on dissections; Bogomolny's page
 * supplies the rules and the cell geometry that the port follows. Every
 * number returned here comes from the real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["carpet-with-hole"].CarpetWithHoleCore;

type Point = { x: number; y: number };
type Shift = Point;
type Box = { x: number; y: number; w: number; h: number };
type State = {
  nx: number;
  width: number;
  height: number;
  showGrid: boolean;
  shiftL: Shift;
  shiftR: Shift;
  explored: boolean;
};

/* Coordinates come from integer cell counts; tidy only for float noise. */
const tidy = (v: number) => Math.round(v * 1e6) / 1e6;
const pt = (p: Point) => ({ x: tidy(p.x), y: tidy(p.y) });
const box = (r: Box) => ({ x: tidy(r.x), y: tidy(r.y), w: tidy(r.w), h: tidy(r.h) });

/** N is the long side: only the seven sizes on the page's buttons are valid. */
function readNx(args: Json, fallback: number): number {
  const C = core();
  const nx = num(args, "nx", fallback);
  if (!C.NX_OPTIONS.includes(nx)) {
    throw new Error(`nx must be one of ${C.NX_OPTIONS.join(", ")} (the page's 3x6 ... 15x18 buttons)`);
  }
  return nx;
}

function readShift(v: unknown, key: string): Shift {
  if (v === undefined || v === null) return { x: 0, y: 0 };
  if (typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`"${key}" must be a point { "x": number, "y": number }`);
  }
  const o = v as Json;
  return { x: num(o, "x", 0), y: num(o, "y", 0) };
}

/** A fresh opening position on a usable board, as Core.start makes on the page. */
function fresh(args: Json): State {
  const C = core();
  const nx = readNx(args, C.DEFAULT_NX);
  const width = num(args, "width", C.WIDTH);
  const height = num(args, "height", C.HEIGHT);
  if (!(width > 2 * C.MARGIN) || !(height > 2 * C.MARGIN)) {
    throw new Error(`width and height must exceed twice the ${C.MARGIN}-unit margin`);
  }
  if (!(C.cell(nx, width, height).a > 0)) {
    throw new Error(`the ${width} by ${height} board is too small for a cell at nx = ${nx}`);
  }
  return C.start({
    nx,
    width,
    height,
    showGrid: args.showGrid === undefined ? true : args.showGrid === true,
  });
}

/** The whole position the page saves with Track.state, checked before use. */
function saved(state: Json): State {
  const C = core();
  const nx = readNx(state, C.DEFAULT_NX);
  const width = num(state, "width", C.WIDTH);
  const height = num(state, "height", C.HEIGHT);
  if (!(width > 0) || !(height > 0)) throw new Error("saved width and height must be positive");
  if (!(C.cell(nx, width, height).a > 0)) {
    throw new Error(`the saved ${width} by ${height} board is too small for a cell at nx = ${nx}`);
  }
  return {
    nx,
    width,
    height,
    showGrid: state.showGrid === true,
    shiftL: readShift(state.shiftL, "shiftL"),
    shiftR: readShift(state.shiftR, "shiftR"),
    explored: state.explored === true,
  };
}

/** The core's geometry and checks for one position, phrased for a tutor. */
function reading(s: State) {
  const C = core();
  const g = C.compute(s);
  // claims() reads the piece polygons it is given, so check the unshifted cut:
  // whether the pieces tile the holed carpet and the square is a fact of the
  // dissection, not of wherever the player has dragged them right now.
  const checks = C.claims(C.layout(g.nx, s.width, s.height));
  return {
    nx: g.nx,
    button: `${g.nx - 3}x${g.nx}`,
    carpet: {
      longSideCells: g.nx,
      shortSideCells: g.nx - 3,
      areaCells: g.rectArea,
      hole: {
        longSideCells: g.nx - 4,
        shortSideCells: 1,
        areaCells: g.holeArea,
        boardRect: box(g.hole),
      },
      materialCells: g.carpetArea,
      boardRect: box(g.rect),
    },
    square: {
      sideCells: g.nx - 2,
      areaCells: g.squareArea,
      boardRect: box(g.square),
    },
    staircase: {
      stepsPerSide: g.k,
      step: "two cells across and one cell down the page",
      verticesPerPiece: g.vertexCount,
      gridLines: g.grid.length,
    },
    pieces: {
      A: tidy(g.pieceArea1),
      B: tidy(g.pieceArea2),
      expectedEach: tidy(g.squareArea / 2),
      formula: "(N-2)^2 / 2",
      equalHalves: checks.halfAreas,
    },
    identity: {
      statement: "N(N-3) - (N-4) = (N-2)^2",
      rectangleCells: g.rectArea,
      holeCells: g.holeArea,
      materialCells: g.carpetArea,
      squareCells: g.squareArea,
      holds: checks.areaIdentity,
    },
    slide: {
      pieceA: { dxCells: tidy(g.targetL.x / g.a), dyCells: tidy(g.targetL.y / g.a) },
      pieceB: { dxCells: tidy(g.targetR.x / g.a), dyCells: tidy(g.targetR.y / g.a) },
      note:
        "Move the right piece two cells left and one cell up, or the left piece " +
        "two cells right and one cell down (board y grows downwards).",
    },
    shiftsInCells: {
      A: { dx: tidy(s.shiftL.x / g.a), dy: tidy(s.shiftL.y / g.a) },
      B: { dx: tidy(s.shiftR.x / g.a), dy: tidy(s.shiftR.y / g.a) },
    },
    cellSize: g.a,
    assembled: g.assembled,
    checks,
    status: C.describe(s),
    note:
      `For N = ${g.nx} the carpet is ${g.nx} by ${g.nx - 3} = ${g.rectArea} cells with ` +
      `an ${g.nx - 4}-cell hole, leaving ${g.carpetArea} cells. The square has side ` +
      `${g.nx - 2} and ${g.squareArea} cells, so N(N-3) - (N-4) = (N-2)^2 reads ` +
      `${g.rectArea} - ${g.holeArea} = ${g.squareArea}. Each staircase piece has ` +
      `${tidy(g.squareArea / 2)} = (N-2)^2/2 cells. The core also checks that the two ` +
      "pieces tile the holed carpet at the start and the square after the slide, " +
      "with no gap and no overlap. Sam Loyd and Henry Dudeney published versions " +
      "of this puzzle; it also appears in Frederickson's book on dissections.",
  };
}

export function actions(): GameActions {
  return {
    dissection: {
      describe:
        "For one of the page's seven sizes nx (6, 8, 10, 12, 14, 16, 18, the buttons 3x6 ... 15x18), report the carpet's cell dimensions and hole, the two staircase pieces and their areas (each (N-2)^2/2 cells), the square they make, and verify N(N-3) - (N-4) = (N-2)^2 along with the core's gap-and-overlap checks. Optional width and height (default 400 by 300) set the board and showGrid reproduces the checkbox. The puzzle is the Loyd/Dudeney/Frederickson carpet dissection ported from Bogomolny's applet.",
      args: '{ "nx": 12 }',
      run: (args) => reading(fresh(args)),
    },
    slide: {
      describe:
        "Slide one staircase piece into the square using the page's real drag-and-snap move: piece is L (the left piece A) or R (the right piece B), nx is one of 6, 8, 10, 12, 14, 16, 18, and optional width and height set the board. Report the handle's start and end in board coordinates, the displacement in cells (2 sideways and 1 up or down), whether the square is assembled, the piece areas and the core's checks. This is the Loyd/Dudeney/Frederickson carpet puzzle from Bogomolny's applet.",
      args: '{ "nx": 12, "piece": "R" }',
      run: (args) => {
        const C = core();
        const s = fresh(args);
        const g = C.compute(s);
        const name = String(args.piece ?? "R").toUpperCase();
        if (name !== "L" && name !== "R") throw new Error('piece must be "L" (left) or "R" (right)');
        const anchor = name === "L" ? { x: g.mx, y: g.my } : { x: g.mx + 2 * g.a, y: g.my };
        const target = name === "L" ? g.targetL : g.targetR;
        const handle = { x: anchor.x + target.x, y: anchor.y + target.y };
        if (handle.x < 0 || handle.x > s.width || handle.y < 0 || handle.y > s.height) {
          throw new Error(`the snapping handle for piece ${name} is outside the ${s.width} by ${s.height} board; use a larger board`);
        }
        const next = C.move(s, { type: "drag", name, point: handle });
        if (!next) throw new Error("the core refused that drag");
        const after = C.compute(next);
        const shift = name === "L" ? after.shiftL : after.shiftR;
        const checks = C.claims(g); // tiling checks for the unshifted cut
        return {
          nx: after.nx,
          piece: name === "L" ? "A (left)" : "B (right)",
          drag: { from: pt(anchor), to: pt(handle) },
          displacementCells: { dx: tidy(target.x / g.a), dy: tidy(target.y / g.a) },
          snapped: shift.x === target.x && shift.y === target.y,
          assembled: after.assembled,
          squareSideCells: after.nx - 2,
          pieces: { A: tidy(after.pieceArea1), B: tidy(after.pieceArea2), expectedEach: tidy(after.squareArea / 2) },
          identity: { materialCells: after.carpetArea, squareCells: after.squareArea, holds: checks.areaIdentity },
          checks,
          status: C.describe(next),
          note:
            "A translation keeps the piece's area, so the assembled square still has " +
            `${after.squareArea} cells: ${after.nx}(${after.nx - 3}) - (${after.nx - 4}) = ` +
            `(${after.nx - 2})^2. Sam Loyd, Henry Dudeney and G. N. Frederickson ` +
            "all used this carpet dissection.",
        };
      },
    },
  };
}

/** The page's saved fields, plus the core's reading of that same position. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Carpet With Hole state version ${stateVersion}`);
  }
  const s = saved(state);
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged.
    nx: s.nx,
    width: s.width,
    height: s.height,
    showGrid: s.showGrid,
    shiftL: { x: s.shiftL.x, y: s.shiftL.y },
    shiftR: { x: s.shiftR.x, y: s.shiftR.y },
    explored: s.explored,
    reading: reading(s),
  };
}
