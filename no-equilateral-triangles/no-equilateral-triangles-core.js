"use strict";

/*
 * No Equilateral Triangles, from Alexander Bogomolny's applet
 * NoEquilateralTriangles.
 *
 * Ten dots sit in a triangular grid with rows of 1, 2, 3 and 4 dots. Each dot
 * is one of two colours. Every set of three dots that are the corners of an
 * equilateral triangle and have the same colour is "monochromatic". The
 * puzzle: colour the dots so that none is. The answer is that it cannot be
 * done: there are exactly 15 equilateral triangles among the ten dots, and
 * every one of the 1,024 colourings has at least one monochromatic.
 *
 * The dots are numbered 0..9 row by row (0 on top; 1, 2; 3, 4, 5; 6, 7, 8, 9)
 * and the 15 triangles are the applet's own list, in its own order. The
 * position is { colours: [0|1 x 10] }.
 */
const NoEquilateralTrianglesCore = (() => {
  const N = 10;

  /** Where the dots are: rows of 1..4, unit spacing 2 across, sqrt(3) down. */
  const DOTS = (() => {
    const out = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c <= r; c++) out.push({ x: 2 * c - r, y: r * Math.sqrt(3) });
    return out;
  })();

  /** The applet's fifteen triangles, as dot numbers. */
  const TRIANGLES = [
    [0, 1, 2], [1, 3, 4], [2, 4, 5], [3, 6, 7], [4, 7, 8], [5, 8, 9],
    [1, 4, 2], [3, 7, 4], [4, 8, 5], [0, 3, 5], [1, 6, 8], [2, 7, 9],
    [2, 3, 8], [1, 7, 5], [0, 6, 9],
  ];

  /** The position a new game starts from: each dot gets a random colour, as in the applet. */
  function start(options) {
    const rand = (options && options.random) || Math.random;
    return { colours: Array.from({ length: N }, () => (rand() < 0.5 ? 0 : 1)) };
  }

  /** The position after clicking dot i (its colour flips), or null for no such dot. */
  function toggle(state, i) {
    if (!Number.isInteger(i) || i < 0 || i >= N) return null;
    const colours = state.colours.slice();
    colours[i] = (colours[i] + 1) % 2;
    return { colours };
  }

  /** The indices (into TRIANGLES) of the triangles whose three dots share a colour. */
  function mono(state, triangles = TRIANGLES) {
    const c = state.colours, out = [];
    triangles.forEach((t, k) => { if (c[t[0]] === c[t[1]] && c[t[1]] === c[t[2]]) out.push(k); });
    return out;
  }

  /** The colouring whose bits are the colours of dots 0..9. */
  const fromBits = (bits) => ({ colours: Array.from({ length: N }, (_, i) => (bits >> i) & 1) });

  /**
   * Every colouring of all ten dots: how many there are, how many have no
   * monochromatic triangle, the fewest and the most monochromatic triangles,
   * and how many colourings reach the fewest.
   */
  function allColourings() {
    let none = 0, min = Infinity, max = 0, atMin = 0;
    for (let b = 0; b < 1 << N; b++) {
      const n = mono(fromBits(b)).length;
      if (n === 0) none++;
      if (n < min) { min = n; atMin = 0; }
      if (n === min) atMin++;
      if (n > max) max = n;
    }
    return { total: 1 << N, none, min, max, atMin };
  }

  /**
   * Is some colouring of just the dots in `dots` free of monochromatic triangles
   * that lie inside `dots`? (The other dots are ignored.)
   */
  function canAvoid(dots) {
    const inside = TRIANGLES.filter((t) => t.every((v) => dots.includes(v)));
    for (let b = 0; b < 1 << N; b++) if (mono(fromBits(b), inside).length === 0) return true;
    return false;
  }

  return { N, DOTS, TRIANGLES, start, toggle, mono, fromBits, allColourings, canAvoid };
})();
