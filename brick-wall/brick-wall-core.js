"use strict";

/*
 * BrickWall — the geometry behind Bogomolny's Brick Wall Illusion applet.
 *
 * The applet paints staggered rows of bricks in two alternating greys, then
 * paints grey mortar lines along the boundaries between the rows. The lines
 * are exactly parallel; the illusion is that they do not look parallel when
 * the vertical joints of one row cross the middle of the bricks in the next.
 * Every quantity here is a plain number, so this file has no DOM, no storage
 * and no colours: the page decides how to paint the bricks and the mortar.
 *
 * BrickWallCanvas.SetHeight/SetWidth turn a slider percentage into a size with
 * Java integer division (truncation toward zero), and SetShift makes the
 * horizontal offset a percentage of the brick width. Draw() offsets every
 * other row by that amount and flips the starting colour on each row. The
 * mortar loop paints 2*Separation+1 grey lines at each row boundary. All of
 * that is transcribed literally below and checked against a second reading
 * of the bytecode in porting/check-brick-wall.mjs.
 *
 * The file defines one global, BrickWallCore, so a page loads it with a plain
 * <script> and porting/check-brick-wall.mjs evaluates it in Node.
 */
const BrickWallCore = (() => {
  /* The five AWT scrollbars, as value ranges: (min, max-visibleAmount). */
  const LIMITS = Object.freeze({
    widthPct: [5, 100],    // Scrollbar(0, 10, 5, 5, 105)
    heightPct: [5, 100],   // Scrollbar(0, 10, 5, 5, 105)
    shiftPct: [0, 99],     // Scrollbar(0, 0, 5, 0, 104)
    shadeDiff: [0, 255],   // Scrollbar(0, 255, 5, 0, 260)
    separation: [0, 10],   // Scrollbar(0, 0, 5, 0, 15)
  });
  const NAMES = Object.keys(LIMITS);

  /* init(): SetHeight(10), SetWidth(10), SetColors(255), Separation=Shift=0. */
  const DEFAULTS = Object.freeze({
    widthPct: 10, heightPct: 10, shiftPct: 0, shadeDiff: 255, separation: 0,
  });

  const idiv = (a, b) => Math.trunc(a / b); // Java's int division
  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

  /** A new position; unknown or out-of-range settings are ignored or clamped. */
  function start(options) {
    const s = { ...DEFAULTS };
    if (options) {
      for (const name of NAMES) {
        if (options[name] !== undefined) s[name] = clampInt(options[name], ...LIMITS[name]);
      }
    }
    return s;
  }

  /** A copy with one setting changed; the input position is not modified. */
  function withSetting(state, name, value) {
    const next = { ...state };
    if (Object.prototype.hasOwnProperty.call(LIMITS, name)) {
      next[name] = clampInt(value, ...LIMITS[name]);
    }
    return next;
  }

  /** BrickWallCanvas.SetHeight / SetWidth / SetShift, in the applet's order. */
  function metrics(state, canvas) {
    // The applet's canvas is at least a few hundred pixels, so with a slider
    // minimum of 5 its integer brick sizes never reach 0. The floors here only
    // keep the core safe if someone hands it a toy canvas.
    const canvasWidth = Math.max(1, Math.round(canvas.width));
    const canvasHeight = Math.max(1, Math.round(canvas.height));
    const width = Math.max(1, idiv(canvasWidth * state.widthPct, 100));
    const height = Math.max(1, idiv(canvasHeight * state.heightPct, 100));
    const shift = idiv(width * state.shiftPct, 100);
    return { canvasWidth, canvasHeight, width, height, shift };
  }

  /** SetColors: d = max(0,(255-ShadeDiff)/2), l = min(255,d+ShadeDiff). */
  function shades(state) {
    let dark = idiv(255 - state.shadeDiff, 2);
    if (dark < 0) dark = 0;
    let light = dark + state.shadeDiff;
    if (light > 255) light = 255;
    return { dark, light };
  }

  /**
   * Draw()'s fix-up of the row's first x: subtract Width while x > 0, then
   * once more when x < 0. Kept as the literal loop, including its extra step.
   */
  function startX(shift, width) {
    let x = shift;
    while (x > 0) x -= width;
    if (x < 0) x -= width;
    return x;
  }

  /** Every brick and mortar line the applet would draw, in board units. */
  function layout(state, canvas) {
    const m = metrics(state, canvas);
    const { dark, light } = shades(state);
    const bricks = [];
    let y = 0;
    let flag = true;
    while (y < m.canvasHeight) {
      let x = flag ? m.shift : 0;
      while (x > 0) x -= m.width;
      if (x < 0) x -= m.width;
      let darkBrick = flag;
      while (x < m.canvasWidth) {
        bricks.push({ x, y, w: m.width, h: m.height, light: !!darkBrick });
        x += m.width;
        darkBrick = !darkBrick;
      }
      y += m.height;
      flag = !flag;
    }
    const thickness = 2 * state.separation + 1;
    const mortar = [];
    for (let center = m.height; center < m.canvasHeight; center += m.height) {
      const ys = [];
      for (let s = -state.separation; s <= state.separation; s++) ys.push(center + s);
      mortar.push({ center, top: center - state.separation, bottom: center + state.separation, ys });
    }
    return {
      ...m, dark, light, bricks, mortar, thickness,
      rows: Math.ceil(m.canvasHeight / m.height),
    };
  }

  /** Do vertical joints of one row fall inside bricks of the next row? */
  function crosses(state, canvas) {
    const L = layout(state, canvas);
    const edges = new Map();
    for (const b of L.bricks) {
      if (!edges.has(b.y)) edges.set(b.y, new Set());
      edges.get(b.y).add(b.x);
      edges.get(b.y).add(b.x + b.w);
    }
    const rows = [...edges.keys()].sort((a, b) => a - b);
    for (let i = 1; i < rows.length; i++) {
      const lower = edges.get(rows[i - 1]);
      const upper = edges.get(rows[i]);
      for (const x of lower) {
        if (x <= 0 || x >= L.canvasWidth) continue;
        if (!upper.has(x)) return true;
      }
      for (const x of upper) {
        if (x <= 0 || x >= L.canvasWidth) continue;
        if (!lower.has(x)) return true;
      }
    }
    return false;
  }

  /** The page's claims, reduced to facts a test can measure. */
  function claims(state, canvas) {
    const L = layout(state, canvas);
    const byRow = new Map();
    for (const b of L.bricks) {
      if (!byRow.has(b.y)) byRow.set(b.y, []);
      byRow.get(b.y).push(b);
    }
    const rows = [...byRow.keys()].sort((a, b) => a - b);
    let alternating = true;
    let staggered = true;
    for (let i = 0; i < rows.length; i++) {
      const row = byRow.get(rows[i]).slice().sort((a, b) => a.x - b.x);
      for (let j = 1; j < row.length; j++) {
        if (row[j].light === row[j - 1].light) alternating = false;
      }
      if (row.length && row[0].light !== (i % 2 === 0)) alternating = false;
      const expected = i % 2 === 0 ? startX(L.shift, L.width) : 0;
      if (row.length && row[0].x !== expected) staggered = false;
    }
    // Exact tiling: each row starts at or before x=0, ends past the right
    // edge, its bricks touch with no gap, and the rows stack with no gap.
    const covered = rows.every((yy, i) => {
      if (yy !== i * L.height) return false;
      const row = byRow.get(yy).slice().sort((a, b) => a.x - b.x);
      return row.length > 0 && row[0].x <= 0 &&
        row[row.length - 1].x + row[row.length - 1].w >= L.canvasWidth &&
        row.every((b, j) => j === 0 || b.x === row[j - 1].x + row[j - 1].w);
    });
    const mortarOnBoundaries = L.mortar.every((band) =>
      band.center % L.height === 0 &&
      band.center - band.top === state.separation &&
      band.bottom - band.center === state.separation &&
      band.ys.length === L.thickness &&
      band.ys.every((line, i) => line === band.top + i));
    const monotonicMortar = Array.from({ length: 11 }, (_, s) =>
      2 * withSetting(state, "separation", s).separation + 1).every((t, i, all) => i === 0 || t > all[i - 1]);
    return {
      linesParallel: mortarOnBoundaries, // each mortar line is horizontal at a fixed y
      alternating,
      staggered,
      covered,
      mortarOnBoundaries,
      monotonicMortar,
      shadesOrdered: L.dark <= L.light,
      joinsCrossRows: crosses(state, canvas),
    };
  }

  /** An illustration has no win or loss. */
  function result(/* state */) {
    return null;
  }

  return {
    LIMITS, DEFAULTS, start, withSetting, metrics, shades, startX,
    layout, crosses, claims, result,
  };
})();
