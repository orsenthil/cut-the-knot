"use strict";

/*
 * Integer Rectangles: A Proof by Induction, from Bogomolny's applet
 * IntRectRobinson (Raphael Robinson's proof, #9 in Wagon's list).
 *
 * Split every H-tile into unit-width strips and every V-tile into unit-height
 * strips. Pick an H-tile and extend it up and down through abutting H-tiles
 * until a column spans the ambient rectangle. Remove that column and close the
 * gap by shifting the right-hand part one unit left: the new rectangle has
 * fewer H-tiles, and any integer side it has is an integer side of the old one.
 * With no H-tiles left, a stack of unit-height V-tiles gives an integer height.
 * The same operation sideways yields the "reduce the longest side by one"
 * proof (#15.5): assuming both sides non-integer leads to a rectangle with
 * both sides under one, which cannot be tiled.
 *
 * The logic test checks the split, the column/row search, the induction step
 * and the base case on Winkler's tiling and its variants.
 *
 * No document, no window, no storage: one global, RobinsonInductionCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const RobinsonInductionCore = (() => {
  const EPS = 1e-9;
  const near = (a, b) => Math.abs(a - b) < EPS;
  const isInt = (v) => near(v, Math.round(v));

  function start() {
    return {
      ambient: { x: 0, y: 0, w: 2.5, h: 2 },
      tiles: [
        { x: 0, y: 0, w: 1, h: 0.7, kind: "H" },
        { x: 0, y: 0.7, w: 1, h: 1.3, kind: "H" },
        { x: 1, y: 0, w: 1.5, h: 1, kind: "V" },
        { x: 1, y: 1, w: 1.5, h: 1, kind: "V" },
      ],
      path: [],
      gap: null,
      history: [],
      message: "Winkler's starting tiling: two H-tiles on the left, two V-tiles on the right.",
    };
  }

  function split(state) {
    const tiles = [];
    for (const t of state.tiles) {
      if (t.kind === "H" && isInt(t.w)) {
        for (let i = 0; i < Math.round(t.w); i++) tiles.push({ ...t, x: t.x + i, w: 1 });
      } else if (t.kind === "V" && isInt(t.h)) {
        for (let i = 0; i < Math.round(t.h); i++) tiles.push({ ...t, y: t.y + i, h: 1 });
      } else tiles.push({ ...t });
    }
    return { ...state, tiles, path: [], gap: null, history: state.history.concat([state.tiles.length]),
      message: `Split into ${tiles.length} unit-wide H-strips and unit-high V-strips.` };
  }

  function hTiles(state) { return state.tiles.map((t, i) => ({ ...t, i })).filter((t) => t.kind === "H"); }
  function vTiles(state) { return state.tiles.map((t, i) => ({ ...t, i })).filter((t) => t.kind === "V"); }

  /** Find a full H-column through the tile at `index`. */
  function findColumn(state, index) {
    const t = state.tiles[index];
    if (!t || t.kind !== "H") return [];
    const chain = hTiles(state).filter((u) => near(u.x, t.x) && near(u.w, t.w)).sort((a, b) => a.y - b.y);
    if (!chain.length || !near(chain[0].y, state.ambient.y)) return [];
    for (let i = 1; i < chain.length; i++) {
      if (!near(chain[i - 1].y + chain[i - 1].h, chain[i].y)) return [];
    }
    const top = chain[chain.length - 1];
    if (!near(top.y + top.h, state.ambient.y + state.ambient.h)) return [];
    return chain.map((u) => u.i);
  }

  /** Find a full V-row through the tile at `index`. */
  function findRow(state, index) {
    const t = state.tiles[index];
    if (!t || t.kind !== "V") return [];
    const chain = vTiles(state).filter((u) => near(u.y, t.y) && near(u.h, t.h)).sort((a, b) => a.x - b.x);
    if (!chain.length || !near(chain[0].x, state.ambient.x)) return [];
    for (let i = 1; i < chain.length; i++) {
      if (!near(chain[i - 1].x + chain[i - 1].w, chain[i].x)) return [];
    }
    const end = chain[chain.length - 1];
    if (!near(end.x + end.w, state.ambient.x + state.ambient.w)) return [];
    return chain.map((u) => u.i);
  }

  function extend(state, index) {
    const path = findColumn(state, index);
    if (path.length) {
      return { ...state, path, gap: { orientation: "vertical", at: state.tiles[index].x, size: state.tiles[index].w },
        message: `Found a column of ${path.length} H-tiles from the bottom to the top.` };
    }
    const row = findRow(state, index);
    if (row.length) {
      return { ...state, path: row, gap: { orientation: "horizontal", at: state.tiles[index].y, size: state.tiles[index].h },
        message: `Found a row of ${row.length} V-tiles from left to right.` };
    }
    return { ...state, path: [], gap: null, message: "No complete path through this tile. Try another one." };
  }

  function removePath(state) {
    if (!state.path.length) return { ...state, message: "Select a tile and press Extend first." };
    const removed = state.path.length;
    return {
      ...state,
      tiles: state.tiles.filter((_, i) => !state.path.includes(i)),
      path: [],
      history: state.history.concat([removed]),
      message: `Removed ${removed} tiles; the remaining pieces keep their shape.`,
    };
  }

  function closeGap(state) {
    if (!state.gap) return { ...state, message: "There is no gap to close yet." };
    const g = state.gap;
    let tiles;
    let ambient;
    if (g.orientation === "vertical") {
      tiles = state.tiles.map((t) => (t.x >= g.at + g.size - EPS ? { ...t, x: t.x - g.size } : { ...t }));
      ambient = { ...state.ambient, w: state.ambient.w - g.size };
    } else {
      tiles = state.tiles.map((t) => (t.y >= g.at + g.size - EPS ? { ...t, y: t.y - g.size } : { ...t }));
      ambient = { ...state.ambient, h: state.ambient.h - g.size };
    }
    return { ...state, tiles, ambient, gap: null,
      message: `Closed the gap: the new rectangle is ${ambient.w} by ${ambient.h}.` };
  }

  /** Apply the H-column induction until no H-tiles remain. */
  function induct(state, limit = 20) {
    let at = split(state);
    const steps = [];
    while (hTiles(at).length && steps.length < limit) {
      const index = at.tiles.findIndex((t) => t.kind === "H");
      const path = findColumn(at, index);
      if (!path.length) break;
      at = removePath({ ...at, path, gap: { orientation: "vertical", at: at.tiles[index].x, size: at.tiles[index].w } });
      at = closeGap(at);
      steps.push({ w: at.ambient.w, h: at.ambient.h, hCount: hTiles(at).length });
    }
    return { state: at, steps, complete: hTiles(at).length === 0 };
  }

  /** With only V-tiles, a stack of unit heights gives an integer height. */
  function baseCase(state) {
    if (hTiles(state).length) return { holds: false, why: "H-tiles remain." };
    const tiles = vTiles(state);
    if (!tiles.length) return { holds: false, why: "No tiles at all." };
    const heights = [...new Set(tiles.map((t) => t.h))];
    if (heights.length !== 1 || !isInt(heights[0])) return { holds: false, why: "V-tiles have non-integer heights." };
    return { holds: isInt(state.ambient.h), why: `Unit V-tiles stack to height ${state.ambient.h}.`, height: state.ambient.h };
  }

  function validate(state) {
    const area = state.tiles.reduce((s, t) => s + t.w * t.h, 0);
    const ambientArea = state.ambient.w * state.ambient.h;
    let overlap = false;
    for (let i = 0; i < state.tiles.length; i++) {
      for (let j = i + 1; j < state.tiles.length; j++) {
        const a = state.tiles[i]; const b = state.tiles[j];
        if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS &&
            Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS) overlap = true;
      }
    }
    const inside = state.tiles.every((t) =>
      t.x >= state.ambient.x - EPS && t.y >= state.ambient.y - EPS &&
      t.x + t.w <= state.ambient.x + state.ambient.w + EPS &&
      t.y + t.h <= state.ambient.y + state.ambient.h + EPS);
    const exact = near(area, ambientArea);
    return { valid: exact && inside && !overlap, exact, inside, overlap, area, ambientArea };
  }

  function analyze(state) {
    return {
      hCount: hTiles(state).length,
      vCount: vTiles(state).length,
      tiling: validate(state),
      baseCase: baseCase(state),
      ambientSpecial: isInt(state.ambient.w) || isInt(state.ambient.h),
      pathLength: state.path.length,
    };
  }

  return {
    EPS, start, split, hTiles, vTiles, findColumn, findRow, extend, removePath,
    closeGap, induct, baseCase, validate, analyze, isInt,
  };
})();
