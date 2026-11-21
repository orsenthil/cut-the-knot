"use strict";

/*
 * Coordinates — the logic behind Alexander Bogomolny's applet "Coordinates"
 * (cut-the-knot.org/Curriculum/Calculus/Coordinates.shtml).
 *
 * A square board (360 by 360 pixels) shows a Cartesian coordinate system whose
 * axes are marked at every unit. Two handles can be dragged: the origin, which
 * moves the whole system, and the point (1, 0), which changes the unit length
 * (the distance in pixels from the origin to that handle, never below 10). A
 * cursor over the board reads off the coordinates of the lattice point nearest
 * to it, written either as an ordered pair "(x,y)" or in complex form "x +yi".
 * Two ticks add "Show grid" (a dot at every lattice point) and "Trace cursor"
 * (draw the reading at the cursor).
 *
 * The applet's facts, from its bytecode: the origin starts at pixel (180, 180)
 * and the unit at 40 pixels (CTKAxesDoub's defaults; the page's own parameters
 * are not in the archive); the reading of a pixel is the pair
 * (round((px - ox)/unit), round((oy - py)/unit)), rounding halves up, as Java's
 * Math.round does; the complex form leaves out a zero real part, leaves out
 * the 1 of a unit imaginary part, writes " +" or " -" before the imaginary
 * part with no space after it, and writes "0" for the origin. A drag of the
 * unit handle snaps back onto the x axis one unit from the origin, so the
 * handle always sits at (1, 0).
 *
 * No document, no window, no storage. The position is plain data; every
 * function returns a new one.
 */
const CoordinatesCore = (() => {
  const SIZE = 360; // the board is square
  const START_ORIGIN = { x: 180, y: 180 };
  const START_UNIT = 40;
  const MIN_UNIT = 10; // MinTickLength: the unit is never shorter than this

  /** A new position: the applet as it opens. */
  function start(options) {
    const o = options || {};
    const state = {
      ox: START_ORIGIN.x, oy: START_ORIGIN.y, unit: START_UNIT,
      grid: false, trace: false, format: "pair",
      moves: 0, explored: false,
    };
    if (Number.isFinite(Number(o.ox))) state.ox = clampPx(Number(o.ox));
    if (Number.isFinite(Number(o.oy))) state.oy = clampPx(Number(o.oy));
    if (Number.isFinite(Number(o.unit))) state.unit = Math.max(MIN_UNIT, Math.min(SIZE, Math.round(Number(o.unit))));
    if (o.grid === true) state.grid = true;
    if (o.trace === true) state.trace = true;
    if (o.format === "complex") state.format = "complex";
    return state;
  }

  const clampPx = (v) => Math.max(0, Math.min(SIZE, Math.round(v)));

  /** The lattice point the applet reads off at a pixel: CTKAxesDoub.ModelCoordinates. */
  function modelCoordinates(state, px, py) {
    return { x: Math.round((px - state.ox) / state.unit), y: Math.round((state.oy - py) / state.unit) };
  }

  /** The pixel of a lattice point: CTKAxesDoub.GetRealPoint. */
  function pixelOf(state, x, y) {
    return { x: state.ox + x * state.unit, y: state.oy - y * state.unit };
  }

  /** "(x,y)": CoordinatesForShow. */
  function pairText(p) {
    return "(" + p.x + "," + p.y + ")";
  }

  /** The complex form: RealAxes.ShowComplex, literally. */
  function complexText(p) {
    let s = "";
    if (p.x !== 0) s += p.x;
    if (p.y !== 0) {
      if (p.y > 0) {
        s += " +";
        if (p.y !== 1) s += p.y;
      } else {
        s += " -";
        if (p.y !== -1) s += -p.y;
      }
      s += "i";
    } else if (p.x === 0) {
      s += "0";
    }
    return s;
  }

  /** The reading at a pixel, in the chosen form. */
  function reading(state, px, py) {
    const p = modelCoordinates(state, px, py);
    return state.format === "complex" ? complexText(p) : pairText(p);
  }

  /** The distance between two points: formula (2) on the page. */
  function distance(p, q) {
    return Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
  }

  /** The moves: drag the origin, drag the unit handle, tick a box, choose the form, reset. */
  function legalMoves() {
    return [
      { type: "origin", x: START_ORIGIN.x, y: START_ORIGIN.y },
      { type: "unit", x: START_ORIGIN.x + START_UNIT },
      { type: "grid", value: true }, { type: "trace", value: true },
      { type: "format", value: "pair" }, { type: "format", value: "complex" },
      { type: "reset" },
    ];
  }

  /** The position after a move, or null if it is not allowed. */
  function move(state, m) {
    if (!m) return null;
    let next = null;
    if (m.type === "origin") {
      if (!Number.isFinite(Number(m.x)) || !Number.isFinite(Number(m.y))) return null;
      next = { ...state, ox: clampPx(Number(m.x)), oy: clampPx(Number(m.y)) };
    } else if (m.type === "unit") {
      // UpdateScale: the unit is the distance from the origin to the mouse, if it is long enough.
      if (!Number.isFinite(Number(m.x))) return null;
      const u = Math.abs(clampPx(Number(m.x)) - state.ox);
      if (u < MIN_UNIT) return null;
      next = { ...state, unit: u };
    } else if (m.type === "grid" || m.type === "trace") {
      if (typeof m.value !== "boolean") return null;
      next = { ...state, [m.type]: m.value };
    } else if (m.type === "format") {
      if (m.value !== "pair" && m.value !== "complex") return null;
      next = { ...state, format: m.value };
    } else if (m.type === "reset") {
      // Back to the untouched opening picture (the ticked boxes stay), so a new look begins.
      return { ...start(), grid: state.grid, trace: state.trace, format: state.format };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A demo: nothing to win; "done" once the player has changed something. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  /** The lattice points inside the board, for the grid dots and the tick labels. */
  function latticeRange(state) {
    return {
      xmin: Math.ceil((0 - state.ox) / state.unit), xmax: Math.floor((SIZE - state.ox) / state.unit),
      ymin: Math.ceil((state.oy - SIZE) / state.unit), ymax: Math.floor(state.oy / state.unit),
    };
  }

  return {
    SIZE, START_ORIGIN, START_UNIT, MIN_UNIT,
    start, legalMoves, move, result, modelCoordinates, pixelOf, pairText, complexText, reading, distance, latticeRange,
  };
})();
