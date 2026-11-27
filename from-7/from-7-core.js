"use strict";

/*
 * From 7, from Alexander Bogomolny's applet From7 ("Areas in Triangle II").
 *
 * Each side of triangle ABC is continued past its end by N copies of its own
 * length, going round the triangle in one order. The three new points are the
 * corners of a larger triangle. The page says its area is 7, 19, 37, ... times
 * the original: in general 3N^2 + 3N + 1 times. Because every construction
 * step is an affine one, the ratio does not depend on the shape of ABC.
 *
 * This is the applet's own geometry, not a new construction: Extend(a,b,n)
 * returns b + n*(b-a), LinComb(a,b,t) returns t*a + (1-t)*b, and the XX
 * points go the other way round each side. The grid lines and the three
 * parallelograms are built in the bytecode's order. There is no game to win:
 * this is a demonstration, so result() is always null.
 *
 * No document, no window, no storage: one global, plain data in and out.
 */
const From7Core = (() => {
  const WIDTH = 400;
  const HEIGHT = 250;
  const MIN_N = 1;
  const ANGLE = Math.PI / 6; // 0.5235987755982988 in From7Canvas.init()
  const EPS = 1e-9;
  const NAMES = ["A", "B", "C"];
  const OPTION_KEYS = ["showGrid", "addColor"];

  const close = (a, b, tol = 1e-7) =>
    Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

  /** The applet's opening corners at a given canvas size (integer /10). */
  function initialPoints(width, height) {
    const r = Math.min(Math.floor(width / 10), Math.floor(height / 10));
    return {
      A: { x: width / 2 - r / 4, y: height / 2 },
      B: { x: width / 2 + r * Math.cos(ANGLE), y: height / 2 - r * Math.sin(ANGLE) },
      C: { x: width / 2 + r * Math.cos(ANGLE), y: height / 2 + r * Math.sin(ANGLE) },
    };
  }

  /** A fresh picture; the applet starts with Num = 1 and both boxes unticked. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const n = o.N === undefined ? MIN_N : o.N;
    return Object.assign(initialPoints(width, height), {
      width, height, N: n, showGrid: false, addColor: false,
    });
  }

  /*
   * From7Panel's controls. "<" is disabled at Min, so it never changes that
   * value; ">" always adds one; typing a number below Min puts the old value
   * back. The core keeps those rules so the page cannot drift from the applet.
   */
  function less(n) { return n > MIN_N ? n - 1 : n; }
  function more(n) { return n + 1; }
  function typed(text, current) {
    const n = Number.parseInt(text, 10);
    return Number.isFinite(n) && n >= MIN_N ? n : current;
  }

  /** Illegal moves change nothing; legal ones return a new position. */
  function move(state, m) {
    if (!state || !m) return null;
    if (m.type === "reset") {
      // The page's Reset restores the opening corners; it leaves the player's
      // Num and tick boxes as they are, like the applet's redraw.
      return Object.assign(start({ width: state.width, height: state.height, N: state.N }), {
        showGrid: state.showGrid, addColor: state.addColor,
      });
    }
    if (m.type === "point") {
      if (!NAMES.includes(m.name) || !m.point) return null;
      const { x, y } = m.point;
      // PointIsEligible: strictly inside the canvas, with no border pixels.
      if (!Number.isFinite(x) || !Number.isFinite(y) ||
          x <= 0 || y <= 0 || x >= state.width || y >= state.height) return null;
      return Object.assign({}, state, { [m.name]: { x, y } });
    }
    if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      return Object.assign({}, state, { [m.key]: m.value });
    }
    if (m.type === "step") {
      if (m.delta !== -1 && m.delta !== 1) return null;
      const n = m.delta === 1 ? more(state.N) : less(state.N);
      return Object.assign({}, state, { N: n });
    }
    if (m.type === "N") {
      if (!Number.isInteger(m.value) || m.value < MIN_N) return null;
      return Object.assign({}, state, { N: m.value });
    }
    return null;
  }

  /** A demonstration never ends in a win, a loss or a finished round. */
  function result(state) { return null; }

  /** DoubPoint Extend(a, b, n) = b + n*(b-a), straight from the bytecode. */
  function extend(a, b, n) {
    return {
      x: b.x + n * (b.x - a.x),
      y: b.y + n * (b.y - a.y),
    };
  }

  /** DoubPoint LinComb(a, b, t) = t*a + (1-t)*b (note the reversed weights). */
  function linComb(a, b, t) {
    return {
      x: t * a.x + (1 - t) * b.x,
      y: t * a.y + (1 - t) * b.y,
    };
  }

  /** Signed polygon area by the shoelace formula. */
  function signedArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum / 2;
  }

  /** The six DrawGrid calls; each draws count+1 lines, i = 0 ... count. */
  function gridLines(n, X, XX) {
    const calls = [
      [n,     XX[0], X[2],  XX[1], X[0]],
      [n + 1, XX[0], X[1],  XX[2], X[0]],
      [n,     XX[1], X[0],  XX[2], X[1]],
      [n + 1, XX[1], X[2],  XX[0], X[1]],
      [n,     XX[2], X[1],  XX[0], X[2]],
      [n + 1, XX[2], X[0],  XX[1], X[2]],
    ];
    const lines = [];
    for (const [count, p3, p4, p5, p6] of calls) {
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        lines.push({ a: linComb(p3, p4, t), b: linComb(p6, p5, t) });
      }
    }
    return lines;
  }

  /** Everything the picture needs, in the applet's own order. */
  function compute(state) {
    const { A, B, C, N } = state;
    const X = [extend(A, B, N), extend(B, C, N), extend(C, A, N)];
    const XX = [extend(B, A, N), extend(C, B, N), extend(A, C, N)];
    const parallelograms = [
      [X[1], B, X[0], XX[2]],
      [X[2], C, X[1], XX[0]],
      [X[0], A, X[2], XX[1]],
    ];
    const small = signedArea([A, B, C]);
    const big = signedArea(X);
    const smallArea = Math.abs(small);
    const bigArea = Math.abs(big);
    const degenerate = smallArea <= EPS;
    return {
      A, B, C, N, X, XX,
      grid: gridLines(N, X, XX),
      parallelograms,
      small, big, smallArea, bigArea,
      ratio: degenerate ? null : bigArea / smallArea,
      expectedRatio: 3 * N * N + 3 * N + 1,
      degenerate,
    };
  }

  /** The page's claim: for every non-flat triangle, ratio = 3N^2 + 3N + 1. */
  function areaClaim(g) {
    return !g.degenerate && g.ratio !== null && close(g.ratio, g.expectedRatio, 1e-8);
  }

  return {
    WIDTH, HEIGHT, MIN_N, ANGLE, EPS, NAMES, OPTION_KEYS,
    close, initialPoints, start, less, more, typed, move, result,
    extend, linComb, signedArea, gridLines, compute, areaClaim,
  };
})();
