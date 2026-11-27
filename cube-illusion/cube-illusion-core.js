"use strict";

/*
 * Cube Illusion, from Alexander Bogomolny's applet CubeIllusion.
 *
 * The drawing is one set of straight lines with no shading or hidden edges:
 * it can be read as a small cube in the corner of three tiled walls, or as a
 * big cube with one corner cut away. The code below transcribes the applet's
 * geometry: ComputePoints() fixes fourteen vertices from one angle and two
 * integer sizes, and Draw() emits the heavy cube edges plus the optional
 * long and short tiling lines. Every point is an affine image of a cube grid,
 * which is exactly why both readings fit the same strokes.
 *
 * DOM-free: no document, no window, one global. Positions are plain data.
 */
const CubeIllusionCore = (() => {
  "use strict";

  /* The applet's scrollbars: new Scrollbar(orientation, value, visible, min, max). */
  const RANGES = Object.freeze({
    angle: Object.freeze({ min: 15, max: 60, step: 5 }), // value 45, visible 5
    n: Object.freeze({ min: 2, max: 10, step: 1 }),     // value 6, visible 1
    m: Object.freeze({ min: 1, max: 10, step: 1 }),     // value 3, visible 1
  });
  const DEFAULTS = Object.freeze({
    angle: 45, n: 6, m: 3,
    longLines: true, shortLines: true,
    width: 400, height: 300,
  });
  const MAX_N = 20; // the applet's fixed divisor for the unit length

  /* The two readings of the same heavy strokes, as edge names from Draw(). */
  const READINGS = Object.freeze({
    small: Object.freeze(["Ap-Bp", "Bp-Ep", "Ep-Fp", "Fp-Gp", "Dp-Gp", "Dp-Ap",
                          "Bp-Cp", "Dp-Cp", "Fp-Cp"]),
    cut: Object.freeze(["A-B", "B-E", "E-F", "F-G", "D-G", "D-A",
                        "A-Ap", "E-Ep", "G-Gp"]),
  });

  const clampInt = (value, lo, hi) => {
    const v = Math.round(Number(value));
    return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo;
  };
  const I = Math.round; // the applet's I(double): Math.round then l2i

  /** A new position. Options are applied the way the applet's listeners do. */
  function start(options) {
    return adjust(DEFAULTS, options || {});
  }

  /**
   * The adjustmentValueChanged rule: set Angle and N from their scrollbars,
   * then M = N > M ? M : N (the original clamps M down to N on every event).
   * Returns a new position; checkboxes keep their state unless patched.
   */
  function adjust(state, patch) {
    const s = state || DEFAULTS;
    const p = patch || {};
    const angle = p.angle === undefined ? s.angle : clampInt(p.angle, RANGES.angle.min, RANGES.angle.max);
    const n = p.n === undefined ? s.n : clampInt(p.n, RANGES.n.min, RANGES.n.max);
    let m = p.m === undefined ? s.m : clampInt(p.m, RANGES.m.min, RANGES.m.max);
    m = n > m ? m : n;
    return {
      angle,
      n,
      m,
      longLines: p.longLines === undefined ? Boolean(s.longLines) : Boolean(p.longLines),
      shortLines: p.shortLines === undefined ? Boolean(s.shortLines) : Boolean(p.shortLines),
      width: p.width === undefined ? s.width : Math.max(1, Math.floor(Number(p.width) || 1)),
      height: p.height === undefined ? s.height : Math.max(1, Math.floor(Number(p.height) || 1)),
    };
  }

  /** ComputePoints(), transcribed from the applet's bytecode. */
  function computePoints(state) {
    const s = state || DEFAULTS;
    const w = Math.floor(Number(s.width) || 1);
    const h = Math.floor(Number(s.height) || 1);
    const N = s.n, M = s.m;
    const theta = (s.angle * Math.PI) / 180;
    const A = { x: Math.floor(w / 2), y: Math.floor(w / 8) };
    const unitLength = I(h / 1.4 / MAX_N);
    const slantedUnitW = unitLength * 1.6 * Math.cos(theta);
    const slantedUnitH = unitLength * Math.sin(theta);
    const uw = slantedUnitW, uh = slantedUnitH;

    const B = { x: A.x - N * uw, y: A.y + N * uh };
    const D = { x: A.x + N * uw, y: A.y + N * uh };
    const C = { x: B.x + (D.x - A.x), y: B.y + (D.y - A.y) };
    const E = { x: B.x, y: B.y + (C.y - A.y) };
    const F = { x: C.x, y: C.y + (C.y - A.y) };
    const G = { x: D.x, y: D.y + (C.y - A.y) };

    const Cp = { x: C.x, y: C.y };
    const Bp = { x: Cp.x - M * uw, y: Cp.y - M * uh };
    const Dp = { x: Cp.x + M * uw, y: Cp.y - M * uh };
    const Ap = { x: A.x, y: Bp.y + (Dp.y - Cp.y) };
    const Ep = { x: Bp.x, y: Bp.y + (Cp.y - Ap.y) };
    const Fp = { x: Cp.x, y: Cp.y + (Cp.y - Ap.y) };
    const Gp = { x: Dp.x, y: Dp.y + (Cp.y - Ap.y) };

    return {
      A, B, C, D, E, F, G,
      Ap, Bp, Cp, Dp, Ep, Fp, Gp,
      unitLength, slantedUnitW, slantedUnitH,
    };
  }

  /** Draw(): the 18 heavy edges, then the optional thin lines, in bytecode order. */
  function segments(state) {
    const s = state || DEFAULTS;
    const p = computePoints(s);
    const uw = p.slantedUnitW, uh = p.slantedUnitH;
    const N = s.n, M = s.m;
    const out = [];
    const emit = (x1, y1, x2, y2, kind, name) => {
      out.push({
        a: { x: I(x1), y: I(y1) },
        b: { x: I(x2), y: I(y2) },
        kind,
        name: name || "",
      });
    };
    const edge = (name, u, v) => emit(u.x, u.y, v.x, v.y, "edge", name);

    /* The two cube outlines and the six strokes joining them. */
    edge("A-B", p.A, p.B);
    edge("B-E", p.B, p.E);
    edge("E-F", p.E, p.F);
    edge("F-G", p.F, p.G);
    edge("D-G", p.D, p.G);
    edge("D-A", p.D, p.A);
    edge("Ap-Bp", p.Ap, p.Bp);
    edge("Bp-Ep", p.Bp, p.Ep);
    edge("Ep-Fp", p.Ep, p.Fp);
    edge("Fp-Gp", p.Fp, p.Gp);
    edge("Dp-Gp", p.Dp, p.Gp);
    edge("Dp-Ap", p.Dp, p.Ap);
    edge("A-Ap", p.A, p.Ap);
    edge("E-Ep", p.E, p.Ep);
    edge("G-Gp", p.G, p.Gp);
    edge("Bp-Cp", p.Bp, p.Cp);
    edge("Dp-Cp", p.Dp, p.Cp);
    edge("Fp-Cp", p.Fp, p.Cp);

    if (s.longLines) {
      /* Brush strokes from the top corner down the two sloping walls. */
      for (let i = 0; i < M; i++) {
        emit(p.A.x - (i + 1) * uw, p.A.y + (i + 1) * uh,
             p.Ap.x - (i + 1) * uw, p.Ap.y + (i + 1) * uh, "long");
        emit(p.A.x + (i + 1) * uw, p.A.y + (i + 1) * uh,
             p.Ap.x + (i + 1) * uw, p.Ap.y + (i + 1) * uh, "long");
      }
      /* Rows across the two side walls and the floor. */
      for (let i = 0; i < M; i++) {
        emit(p.Bp.x, p.Bp.y + 2 * i * uh,
             p.B.x, p.B.y + 2 * (N - M + i) * uh, "long");
        emit(p.Dp.x, p.Dp.y + 2 * i * uh,
             p.D.x, p.D.y + 2 * (N - M + i) * uh, "long");
        emit(p.Ep.x + (i + 1) * uw, p.Ep.y + (i + 1) * uh,
             p.E.x + (i + 1) * uw, p.E.y + (i + 1) * uh, "long");
        emit(p.Gp.x - (i + 1) * uw, p.Gp.y + (i + 1) * uh,
             p.G.x - (i + 1) * uw, p.G.y + (i + 1) * uh, "long");
      }
      /* Vertical dividers and horizontal rows outside the small cube's span. */
      for (let i = 1; i < N - M; i++) {
        emit(p.A.x - (M + i) * uw, p.A.y + (M + i) * uh,
             p.A.x - (M + i) * uw, p.A.y + (M + i) * uh + (p.C.y - p.A.y), "long");
        emit(p.A.x + (M + i) * uw, p.A.y + (M + i) * uh,
             p.A.x + (M + i) * uw, p.A.y + (M + i) * uh + (p.C.y - p.A.y), "long");
      }
      for (let i = 1; i < N - M; i++) {
        emit(p.A.x, p.A.y + 2 * i * uh, p.B.x, p.B.y + 2 * i * uh, "long");
        emit(p.A.x, p.A.y + 2 * i * uh, p.D.x, p.D.y + 2 * i * uh, "long");
      }
      /* Diagonals across the tiled floor beyond the small cube. */
      for (let i = 1; i < N - M; i++) {
        emit(p.Ep.x - i * uw, p.Ep.y + i * uh,
             p.Ep.x - i * uw + (p.D.x - p.A.x), p.Ep.y + i * uh + (p.D.y - p.A.y), "long");
        emit(p.Gp.x + i * uw, p.Gp.y + i * uh,
             p.Gp.x + i * uw + (p.B.x - p.A.x), p.Gp.y + i * uh + (p.B.y - p.A.y), "long");
      }
    }

    if (s.shortLines) {
      /* Tiling on the three visible faces of the small cube itself. */
      for (let i = 1; i < M; i++) {
        emit(p.Ap.x - i * uw, p.Ap.y + i * uh, p.Dp.x - i * uw, p.Dp.y + i * uh, "short");
        emit(p.Ap.x + i * uw, p.Ap.y + i * uh, p.Bp.x + i * uw, p.Bp.y + i * uh, "short");
        emit(p.Bp.x + i * uw, p.Bp.y + i * uh, p.Ep.x + i * uw, p.Ep.y + i * uh, "short");
        emit(p.Dp.x - i * uw, p.Dp.y + i * uh, p.Gp.x - i * uw, p.Gp.y + i * uh, "short");
        emit(p.Bp.x, p.Bp.y + 2 * i * uh, p.Cp.x, p.Cp.y + 2 * i * uh, "short");
        emit(p.Dp.x, p.Dp.y + 2 * i * uh, p.Cp.x, p.Cp.y + 2 * i * uh, "short");
      }
    }
    return out;
  }

  /** Bounding box of every stroke, used only to fit the SVG viewBox. */
  function bounds(state) {
    const lines = segments(state);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const line of lines) {
      for (const q of [line.a, line.b]) {
        minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x);
        minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y);
      }
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  /** The plain-English line under the drawing. There is no win or loss. */
  function describe(state) {
    const s = state || DEFAULTS;
    return `Tilt ${s.angle}°. Big cube ${s.n} units, small corner ${s.m} units. ` +
      `Long lines ${s.longLines ? "on" : "off"}, short lines ${s.shortLines ? "on" : "off"}. ` +
      `One drawing, two readings.`;
  }

  /** An illustration has no result; the page marks "done" once both readings were shown. */
  function result() { return null; }

  return {
    RANGES, DEFAULTS, MAX_N, READINGS,
    start, adjust, computePoints, segments, bounds, describe, result,
  };
})();
