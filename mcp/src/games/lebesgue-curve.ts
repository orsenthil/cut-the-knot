/*
 * run_game_logic actions and saved-position reader for the Lebesgue curve.
 *
 * The real core is lebesgue-curve/lebesgue-curve-core.js, copied into
 * src/generated/cores/ at build time. It never stores a grid: it builds the
 * direction string Str (one letter per segment) plus kStr / mStr (one digit
 * for each long jump between four diminished copies) and walks Str, consuming
 * a kStr digit on '2' and an mStr digit on '3'. At order n the walk joins the
 * centres of the 2^n by 2^n subsquares top-down, left-right: 4^n points and
 * 4^n - 1 segments. In the limit the curve fills the square, yet interlacing
 * Cantor digits gives a map onto the unit square and filling the removed thirds
 * linearly makes it differentiable almost everywhere. Every number below comes
 * from that core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type CurveState = { canvas: number; order: number; step: number };
type Description = {
  canvas: number;
  order: number;
  step: number;
  cellsPerSide: number;
  cells: number;
  segments: number;
  maxOrder: number;
};
type Core = {
  DEFAULT_CANVAS: number;
  MAX_ORDER: number;
  start: (options: Json) => CurveState;
  next: (state: CurveState) => CurveState;
  setOrder: (state: CurveState, order: number) => CurveState;
  points: (state: CurveState) => Point[];
  drawing: (state: CurveState) => { str: string; kStr: string; mStr: string; step: number; x0: number; y0: number };
  geometry: (canvas: number) => { canvas: number; absMaxStep: number; startStep: number; x0: number; y0: number; span: number };
  describe: (state: CurveState) => Description;
};

const core = (): Core => cores["lebesgue-curve"].LebesgueCurveCore as unknown as Core;
const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });

function canvasArg(args: Json, key: string, fallback: number): number {
  const canvas = num(args, key, fallback);
  if (!Number.isInteger(canvas) || canvas < 16 || canvas > 4096) {
    throw new Error(`argument "${key}" must be a whole canvas from 16 to 4096`);
  }
  return canvas;
}

function orderArg(args: Json, key: string, fallback: number, maxOrder: number): number {
  const order = num(args, key, fallback);
  if (!Number.isInteger(order) || order < 1 || order > maxOrder) {
    throw new Error(`argument "${key}" must be a whole order from 1 to ${maxOrder}`);
  }
  return order;
}

type Route = {
  pointCount: number;
  everyCentreVisitedOnce: boolean;
  onGridCentres: boolean;
  distinctCells: number;
  firstPoint: Point;
  lastPoint: Point;
  firstCell: { col: number; row: number };
  lastCell: { col: number; row: number };
  colRange: [number, number];
  rowRange: [number, number];
  wordLength: number;
  leftJumps: number;
  upJumps: number;
  kStrLength: number;
  mStrLength: number;
  wordPreview: string;
  samplePoints: Point[];
};

/** Measure the polyline the core actually returns against its own grid. */
function route(C: Core, state: CurveState): Route {
  const d = C.describe(state);
  const pts = C.points(state);
  const dr = C.drawing(state);
  const g = C.geometry(state.canvas);
  const cellOf = (p: Point) => ({
    col: (p.x - g.x0 - state.step / 2) / state.step,
    row: (p.y - g.y0 - state.step / 2) / state.step,
  });
  const seen = new Set<string>();
  let onGrid = true;
  let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
  for (const p of pts) {
    const c = cellOf(p);
    if (!Number.isInteger(c.col) || !Number.isInteger(c.row) ||
        c.col < 0 || c.col >= d.cellsPerSide || c.row < 0 || c.row >= d.cellsPerSide) {
      onGrid = false;
    }
    minCol = Math.min(minCol, c.col); maxCol = Math.max(maxCol, c.col);
    minRow = Math.min(minRow, c.row); maxRow = Math.max(maxRow, c.row);
    seen.add(`${c.col},${c.row}`);
  }
  let leftJumps = 0, upJumps = 0;
  for (const ch of dr.str) {
    if (ch === "2") leftJumps++;
    else if (ch === "3") upJumps++;
  }
  const stride = Math.max(1, Math.ceil(pts.length / 8));
  const samplePoints = pts.filter((_: Point, i: number) => i % stride === 0 || i === pts.length - 1).map(pt);
  return {
    pointCount: pts.length,
    everyCentreVisitedOnce: onGrid && seen.size === d.cells && pts.length === d.cells,
    onGridCentres: onGrid,
    distinctCells: seen.size,
    firstPoint: pt(pts[0]),
    lastPoint: pt(pts[pts.length - 1]),
    firstCell: cellOf(pts[0]),
    lastCell: cellOf(pts[pts.length - 1]),
    colRange: [minCol, maxCol],
    rowRange: [minRow, maxRow],
    wordLength: dr.str.length,
    leftJumps,
    upJumps,
    kStrLength: dr.kStr.length,
    mStrLength: dr.mStr.length,
    wordPreview: dr.str.length <= 64 ? dr.str : `${dr.str.slice(0, 48)}...`,
    samplePoints,
  };
}

function snapshot(C: Core, s: CurveState): Json {
  const d = C.describe(s);
  return { order: d.order, step: d.step, cellsPerSide: d.cellsPerSide, cells: d.cells, segments: d.segments };
}

export function actions(): GameActions {
  return {
    approximation: {
      describe:
        "Build the Lebesgue polygonal approximation at order n (1 to the canvas's maximum) and walk the core's own direction string. Reports how many centres of the 2^n by 2^n grid are joined and checks that every one is visited exactly once top-down, left-right, with the first and last points. These finite paths fill the square in the limit; interlacing alternate Cantor digits maps the Cantor set onto the unit square, and extending linearly across the removed thirds makes the limit differentiable almost everywhere.",
      args: '{ "order": 2, "canvas": 512 }',
      run: (args) => {
        const C = core();
        const canvas = canvasArg(args, "canvas", C.DEFAULT_CANVAS);
        const maxOrder = C.geometry(canvas).absMaxStep;
        const order = orderArg(args, "order", 2, maxOrder);
        const state = C.setOrder(C.start({ canvas }), order);
        const d = C.describe(state);
        const r = route(C, state);
        return {
          order,
          canvas,
          coreDescription: d,
          pointCount: r.pointCount,
          firstPoint: r.firstPoint,
          lastPoint: r.lastPoint,
          firstCell: r.firstCell,
          lastCell: r.lastCell,
          everyCentreVisitedOnce: r.everyCentreVisitedOnce,
          onGridCentres: r.onGridCentres,
          distinctCells: r.distinctCells,
          colRange: r.colRange,
          rowRange: r.rowRange,
          directionWord: {
            length: r.wordLength,
            leftJumps: r.leftJumps,
            upJumps: r.upJumps,
            kStrLength: r.kStrLength,
            mStrLength: r.mStrLength,
            preview: r.wordPreview,
          },
          samplePoints: r.samplePoints,
          nextOrderOnAdvance: C.next(state).order,
          note: `Order ${order} joins ${r.pointCount} cell centres on a ${d.cellsPerSide} by ${d.cellsPerSide} grid in ${d.segments} segments, each centre once, down the first column then the next. "2" consumes a kStr digit (a long jump left), "3" an mStr digit (a jump up); the strings the core builds are the applet's own. The limit fills the square, the Cantor-digit map is onto the unit square, and the linear fill across removed thirds makes the limit curve differentiable almost everywhere.`,
        };
      },
    },
    orders: {
      describe:
        "Follow the applet's Reset from order 1: each click halves the step and quadruples the number of cell centres until the next click would wrap back to order 1. Reports the step, grid side, cells and segments at every order and how many clicks the full cycle takes. The Lebesgue/Moore radio buttons have empty listeners in the applet, so they only change the label and never these numbers.",
      args: '{ "canvas": 512 }',
      run: (args) => {
        const C = core();
        const canvas = canvasArg(args, "canvas", C.DEFAULT_CANVAS);
        const maxOrder = C.geometry(canvas).absMaxStep;
        let state = C.start({ canvas });
        const levels: Json[] = [snapshot(C, state)];
        for (let clicks = 1; clicks <= maxOrder + 2; clicks++) {
          const next = C.next(state);
          if (next.order <= state.order) {
            return {
              canvas,
              maxOrder,
              levels,
              wrapsAfterClicks: clicks,
              wrapsBackTo: snapshot(C, next),
              cellsQuadrupleEachClick: levels.every((level, i) =>
                i === 0 || (level.cells as number) === 4 * (levels[i - 1].cells as number)),
              note: `After ${clicks} clicks a further halving would drop the step below the applet's minimum, so Reset wraps to order 1 with step ${next.step}. Every click doubles the grid side, quadruples the centres joined and keeps the same square; switching the Lebesgue/Moore label changes none of it.`,
            };
          }
          state = next;
          levels.push(snapshot(C, state));
        }
        throw new Error("the order cycle did not wrap back to order 1");
      },
    },
  };
}

/** Track.state saved { order, mode, cellsPerSide, hint, points }; the core rebuilds the drawing from the order. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Lebesgue Curve state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Lebesgue Curve position must be an object");
  }
  const C = core();
  const canvas = C.DEFAULT_CANVAS; // the page starts the core with C.start({})
  const maxOrder = C.geometry(canvas).absMaxStep;
  const order = orderArg(state, "order", 1, maxOrder);
  const savedCells = Math.trunc(num(state, "cellsPerSide", 2));
  const savedPoints = Math.trunc(num(state, "points", 4));

  let mode = "lebesgue";
  if (state.mode !== undefined && state.mode !== null) {
    if (state.mode !== "lebesgue" && state.mode !== "moore") {
      throw new Error('saved field "mode" must be "lebesgue" or "moore"');
    }
    mode = state.mode;
  }

  let hint: Point | null = null;
  if (state.hint !== undefined && state.hint !== null) {
    if (typeof state.hint !== "object" || Array.isArray(state.hint)) {
      throw new Error('saved field "hint" must be { "x": ..., "y": ... } or null');
    }
    const h = state.hint as Json;
    hint = { x: num(h, "x", 0), y: num(h, "y", 0) };
  }

  const here = C.setOrder(C.start({ canvas }), order);
  const d = C.describe(here);
  const r = route(C, here);
  const g = C.geometry(canvas);
  const cells = d.cellsPerSide;
  const hintCell = hint
    ? { x: Math.max(0, Math.min(cells - 1, Math.trunc(hint.x))),
        y: Math.max(0, Math.min(cells - 1, Math.trunc(hint.y))) }
    : null;
  const hintCentre = hintCell
    ? pt({ x: g.x0 + (hintCell.x + 0.5) * here.step, y: g.y0 + (hintCell.y + 0.5) * here.step })
    : null;

  return {
    stateVersion,
    saved: { order, mode, cellsPerSide: savedCells, hint, points: savedPoints },
    effective: { canvas, order, step: d.step, cellsPerSide: cells, cells: d.cells, segments: d.segments, maxOrder: d.maxOrder },
    reading: {
      coreDescription: d,
      pointCount: r.pointCount,
      everyCentreVisitedOnce: r.everyCentreVisitedOnce,
      firstPoint: r.firstPoint,
      lastPoint: r.lastPoint,
      firstCell: r.firstCell,
      lastCell: r.lastCell,
      directionWord: { length: r.wordLength, leftJumps: r.leftJumps, upJumps: r.upJumps },
      nextOrderOnAdvance: C.next(here).order,
      hintCell,
      hintCellCentre: hintCentre,
      modeChangesDrawing: false,
      note: `The page saved order ${order}, the ${mode} label, a ${savedCells} by ${savedCells} grid, the cursor cell and ${savedPoints} points. The core rebuilds the same polygonal approximation from the order: ${r.pointCount} centres of a ${cells} by ${cells} grid joined in ${d.segments} segments, every centre once. The mode only changes the label, because the applet's Lebesgue/Moore and Curve/Maze checkboxes have empty listeners.`,
    },
    savedCellsPerSideMatchesCore: savedCells === cells,
    savedPointsMatchesCore: savedPoints === r.pointCount && savedPoints === d.cells,
  };
}
