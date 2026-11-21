"use strict";

/*
 * Integers and Rectangles: Winkler's Proof, from Bogomolny's applet
 * IntRectWinkler.
 *
 * Green H-tiles have an integer width, red V-tiles an integer height. Decorate
 * each tile with thin strips of the opposite colour along its integer-length
 * sides: green tiles get red strips top and bottom, red tiles get green strips
 * left and right. Then green regions can only be crossed horizontally and red
 * regions only vertically. As in Hex, one of two things must happen: a green
 * path joins the left and right edges, or a red path joins the top and bottom.
 * A green path crosses a whole number of integer widths, so the ambient width
 * is an integer; a red path does the same for the height.
 *
 * The logic test checks the paths on the page's tiling and two other layouts,
 * verifies the exact-one-path property with the decoration, and confirms that
 * the widths/heights along a path add to the ambient side.
 *
 * No document, no window, no storage: one global, WinklerPathProofCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const WinklerPathProofCore = (() => {
  const EPS = 1e-9;
  const near = (a, b) => Math.abs(a - b) < EPS;
  const overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > EPS;

  function start() {
    return {
      ambient: { x: 0, y: 0, w: 2.5, h: 2 },
      tiles: [
        { x: 0, y: 0, w: 1, h: 0.7, kind: "H" },
        { x: 0, y: 0.7, w: 1, h: 1.3, kind: "H" },
        { x: 1, y: 0, w: 1.5, h: 1, kind: "V" },
        { x: 1, y: 1, w: 1.5, h: 1, kind: "V" },
      ],
      decorated: true,
    };
  }

  const PRESETS = {
    winkler: start,
    greenStrip: () => ({
      ambient: { x: 0, y: 0, w: 2, h: 1.5 },
      tiles: [
        { x: 0, y: 0, w: 1, h: 1.5, kind: "H" },
        { x: 1, y: 0, w: 1, h: 1.5, kind: "H" },
      ],
      decorated: true,
    }),
    fourSquares: () => ({
      ambient: { x: 0, y: 0, w: 2, h: 2 },
      tiles: [
        { x: 0, y: 0, w: 1, h: 1, kind: "H" },
        { x: 1, y: 0, w: 1, h: 1, kind: "H" },
        { x: 0, y: 1, w: 1, h: 1, kind: "V" },
        { x: 1, y: 1, w: 1, h: 1, kind: "V" },
      ],
      decorated: true,
    }),
  };

  /** Horizontal adjacency: the tiles share a vertical edge segment. */
  function sideBySide(a, b) {
    const xTouch = near(a.x + a.w, b.x) || near(b.x + b.w, a.x);
    return xTouch && overlap(a.y, a.y + a.h, b.y, b.y + b.h);
  }

  /** Vertical adjacency: the tiles share a horizontal edge segment. */
  function stacked(a, b) {
    const yTouch = near(a.y + a.h, b.y) || near(b.y + b.h, a.y);
    return yTouch && overlap(a.x, a.x + a.w, b.x, b.x + b.w);
  }

  const touches = {
    left: (a, m) => near(a.x, m.x),
    right: (a, m) => near(a.x + a.w, m.x + m.w),
    bottom: (a, m) => near(a.y, m.y),
    top: (a, m) => near(a.y + a.h, m.y + m.h),
  };

  /** Breadth-first search for a chain of same-coloured tiles between edges. */
  function findPath(tiles, ambient, color, from, to, adjacent) {
    const candidates = tiles.map((t, i) => ({ t, i })).filter(({ t }) => t.kind === color && touches[from](t, ambient));
    const goals = tiles.map((t, i) => i).filter((i) => touches[to](tiles[i], ambient) && tiles[i].kind === color);
    for (const start of candidates) {
      const queue = [[start.i]];
      const seen = new Set([start.i]);
      while (queue.length) {
        const path = queue.shift();
        const at = path[path.length - 1];
        if (goals.includes(at)) return path;
        tiles.forEach((t, i) => {
          if (seen.has(i) || t.kind !== color) return;
          if (adjacent(tiles[at], t)) {
            seen.add(i);
            queue.push(path.concat([i]));
          }
        });
      }
    }
    return null;
  }

  function greenPath(state) {
    return findPath(state.tiles, state.ambient, "H", "left", "right", sideBySide);
  }

  function redPath(state) {
    return findPath(state.tiles, state.ambient, "V", "bottom", "top", stacked);
  }

  function pathSum(tiles, path, color) {
    return path.reduce((s, i) => s + (tiles[i].kind === color ? (color === "H" ? tiles[i].w : tiles[i].h) : 0), 0);
  }

  function decide(state) {
    const green = greenPath(state);
    const red = redPath(state);
    if (green && red) return { kind: "both", green, red };
    if (green) return { kind: "green", green, red: null };
    if (red) return { kind: "red", green: null, red };
    return { kind: "none", green: null, red: null };
  }

  /** Strips of the opposite colour along each tile's integer-length sides. */
  function strips(tiles, width = 0.06) {
    const out = [];
    for (const t of tiles) {
      if (t.kind === "H") {
        out.push({ x: t.x, y: t.y, w: t.w, h: width, color: "V" });
        out.push({ x: t.x, y: t.y + t.h - width, w: t.w, h: width, color: "V" });
      } else {
        out.push({ x: t.x, y: t.y, w: width, h: t.h, color: "H" });
        out.push({ x: t.x + t.w - width, y: t.y, w: width, h: t.h, color: "H" });
      }
    }
    return out;
  }

  function validate(state) {
    const area = state.tiles.reduce((s, t) => s + t.w * t.h, 0);
    const ambientArea = state.ambient.w * state.ambient.h;
    let overlapBad = false;
    for (let i = 0; i < state.tiles.length; i++) {
      for (let j = i + 1; j < state.tiles.length; j++) {
        const a = state.tiles[i]; const b = state.tiles[j];
        if (overlap(a.x, a.x + a.w, b.x, b.x + b.w) && overlap(a.y, a.y + a.h, b.y, b.y + b.h)) overlapBad = true;
      }
    }
    return { valid: near(area, ambientArea) && !overlapBad, area, ambientArea, overlap: overlapBad };
  }

  function analyze(state) {
    const verdict = decide(state);
    return {
      verdict,
      greenSum: verdict.green ? pathSum(state.tiles, verdict.green, "H") : 0,
      redSum: verdict.red ? pathSum(state.tiles, verdict.red, "V") : 0,
      strips: state.decorated ? strips(state.tiles) : [],
      tiling: validate(state),
      ambientWidthInteger: near(state.ambient.w, Math.round(state.ambient.w)),
      ambientHeightInteger: near(state.ambient.h, Math.round(state.ambient.h)),
    };
  }

  function toggleKind(state, index) {
    const tiles = state.tiles.slice();
    if (index < 0 || index >= tiles.length) return state;
    tiles[index] = { ...tiles[index], kind: tiles[index].kind === "H" ? "V" : "H" };
    return { ...state, tiles };
  }

  return {
    EPS, start, PRESETS, sideBySide, stacked, touches, findPath, greenPath, redPath,
    pathSum, decide, strips, validate, analyze, toggleKind,
  };
})();
