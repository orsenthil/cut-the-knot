"use strict";

/*
 * Coupled Impossible Fork — Bogomolny's applet CoupledImpossibleFork.
 *
 * The page calls the picture an "impossible frame": two 3D letters Pi, each of
 * which can be built, coupled so that the whole cannot be. The Java canvas
 * builds one seven-point skeleton (p2..p8), draws it, draws its half-turn image
 * (q2..q8) about the canvas centre, and then draws beams of a chosen length
 * from each skeleton towards the other. The beams are placed with
 * FixedLength(p, q, L) = p + (q - p) L / |q - p|, so they are straight strokes
 * of a controlled length rather than full lines. With the slider at its
 * maximum, L is half the distance from p8 to q2, so the two opposing beams end
 * at the same point: that is the "coupling". The LessReal parameter adds the
 * rear edges that the default picture masks with background-coloured quads.
 *
 * This file is the picture's geometry and nothing else: no document, no window,
 * no storage. It defines one global, CoupledImpossibleForkCore, so the page
 * loads it with a plain <script> and the logic test can load it in Node. Every
 * function takes a plain-data state and returns plain data. There is no win and
 * no loss: the page is an illustration.
 */
const CoupledImpossibleForkCore = (() => {
  /* Bytecode: Scrollbar(0, 500, 1, 250, 501) is
     Scrollbar(VERTICAL, value=500, visible=1, minimum=250, maximum=501),
     so the slider runs 250..500 and starts at 500. The canvas field W also
     starts at 500. The applet's page embeds it at 600 by 350 pixels. */
  const W_MIN = 250;
  const W_MAX = 500;
  const W_DEFAULT = 500;
  const LESS_REAL_DEFAULT = false;
  const WIDTH = 600;
  const HEIGHT = 350;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const num = (v, fallback) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

  function dist(p, q) {
    const dx = p.x - q.x, dy = p.y - q.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* Reflect(p, cx, cy): new DoubPoint(2*cx - p.x, 2*cy - p.y). */
  function reflect(p, cx, cy) {
    return { x: 2 * cx - p.x, y: 2 * cy - p.y };
  }

  /* FixedLength(p, q, len): scale = dist(p,q)/len; p + (q-p)/scale. */
  function fixedLength(p, q, len) {
    const scale = dist(p, q) / len;
    return { x: p.x + (q.x - p.x) / scale, y: p.y + (q.y - p.y) / scale };
  }

  function start(options) {
    const o = options || {};
    return {
      w: clamp(Math.round(num(o.w, W_DEFAULT)), W_MIN, W_MAX),
      lessReal: o.lessReal === undefined ? LESS_REAL_DEFAULT : !!o.lessReal,
      width: Math.max(1, Math.round(num(o.width, WIDTH))),
      height: Math.max(7, Math.round(num(o.height, HEIGHT))),
    };
  }

  function setW(state, value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return state;
    return Object.assign({}, state, { w: clamp(Math.round(value), W_MIN, W_MAX) });
  }

  function toggleLessReal(state) {
    return Object.assign({}, state, { lessReal: !state.lessReal });
  }

  /**
   * The whole of CoupledImpossibleForkCanvas.Draw as plain data.
   * `lines` is in the applet's painting order; `faces` are the two polygons
   * it fills with the background colour before overdrawing their edges.
   */
  function geometry(state) {
    const width = state.width, height = state.height;
    const w = state.w, lessReal = !!state.lessReal;

    /* Canvas.init(): t = height / 7 (integer division in Java), then the
       doubles X0, Y0, X, Y and the unused Z = width * 7 / 15. */
    const t = Math.floor(height / 7);
    const X0 = t / 2;
    const Y0 = height - 2 * t;
    const X = t / 2;
    const Y = t / Math.sqrt(3);
    const Z = (width * 7) / 15;
    const cx = width / 2;
    const cy = height / 2;

    /* The seven points of Draw(), in the bytecode's own order. */
    const p = {};
    p.p2 = { x: X0 + 2 * X, y: Y0 };
    p.p3 = { x: X0 + X, y: Y0 - Y };
    p.p4 = { x: X0 + 4 * X, y: Y0 - 2 * Y };
    p.p5 = { x: p.p4.x + 2 * X, y: p.p4.y };
    p.p6 = { x: p.p5.x + X, y: p.p5.y - Y };
    p.p7 = { x: p.p6.x - X, y: p.p6.y - Y };
    p.p8 = { x: X0 + 5 * X, y: Y0 - 5 * Y };

    const q = {};
    for (let i = 2; i <= 8; i++) q["q" + i] = reflect(p["p" + i], cx, cy);

    /* GeoSDoub.Dist(p2, q8) * W / 1000. */
    const L = dist(p.p2, q.q8) * w / 1000;

    /* The sixteen FixedLength endpoints, numbered as the applet's locals. */
    const j = {};
    j.j23 = fixedLength(p.p8, q.q2, L);
    j.j24 = fixedLength(p.p7, q.q3, L - 2 * X);
    j.j25 = fixedLength(p.p7, q.q3, L);
    j.j26 = fixedLength(p.p6, q.q6, L - 2 * X);
    j.j27 = fixedLength(p.p4, q.q4, L - 2 * X);
    j.j28 = fixedLength(p.p3, q.q7, L);
    j.j29 = fixedLength(p.p3, q.q7, L + 2 * X);
    j.j30 = fixedLength(p.p2, q.q8, L);
    j.j31 = fixedLength(q.q2, p.p8, L);
    j.j32 = fixedLength(q.q3, p.p7, L);
    j.j33 = fixedLength(q.q3, p.p7, L + 2 * X);
    j.j34 = fixedLength(q.q6, p.p6, L - 4 * X);
    j.j35 = fixedLength(q.q4, p.p4, L - 2 * X);
    j.j36 = fixedLength(q.q7, p.p3, L);
    j.j37 = fixedLength(q.q7, p.p3, L - 2 * X);
    j.j38 = fixedLength(q.q8, p.p2, L);

    const lines = [];
    const line = (a, b, kind) => lines.push({ a: a, b: b, kind: kind });
    const faces = [];

    /* The two seven-point skeletons. */
    line(p.p2, p.p3, "skeleton");
    line(p.p3, p.p8, "skeleton");
    line(p.p4, p.p7, "skeleton");
    line(p.p5, p.p6, "skeleton");
    line(p.p6, p.p7, "skeleton");
    line(q.q2, q.q3, "skeleton");
    line(q.q3, q.q8, "skeleton");
    line(q.q4, q.q7, "skeleton");
    line(q.q5, q.q6, "skeleton");
    line(q.q6, q.q7, "skeleton");

    if (w < 498) {
      line(j.j32, j.j34, "outline");
      line(j.j34, j.j33, "outline");
      line(j.j33, j.j31, "outline");
      line(j.j31, j.j32, "outline");

      faces.push([j.j24, j.j26, j.j25, j.j23]);
      if (lessReal) {
        line(j.j24, j.j26, "detail");
        line(j.j23, j.j24, "detail");
      }
      line(j.j26, j.j25, "detail");
      line(j.j25, j.j23, "detail");

      faces.push([j.j36, j.j38, j.j37, j.j35]);
      if (lessReal) {
        line(j.j36, j.j38, "detail");
        line(j.j35, j.j36, "detail");
        line(j.j37, j.j38, "detail");
        line(j.j35, j.j37, "detail");
      } else {
        line(j.j38, j.j36, "detail");
        line(j.j36, j.j35, "detail");
      }
    } else if (lessReal) {
      line(j.j36, j.j37, "detail");
      line(j.j32, j.j33, "detail");
    }

    /* The beams that couple the two halves. */
    line(p.p2, j.j30, "beam");
    line(p.p3, j.j28, "beam");
    line(p.p4, j.j27, "beam");
    line(p.p6, j.j26, "beam");
    line(p.p7, lessReal ? j.j24 : j.j25, "beam");
    line(p.p8, j.j23, "beam");
    line(q.q2, j.j31, "beam");
    line(q.q3, j.j32, "beam");
    line(q.q4, j.j34, "beam");
    line(q.q6, j.j35, "beam");
    line(q.q7, lessReal ? j.j37 : j.j36, "beam");
    line(q.q8, j.j38, "beam");

    return {
      t: t, X0: X0, Y0: Y0, X: X, Y: Y, Z: Z, cx: cx, cy: cy,
      w: w, lessReal: lessReal, width: width, height: height,
      L: L, front: p, back: q, join: j, lines: lines, faces: faces,
      gap: dist(j.j23, j.j31),
    };
  }

  /** What the status line says for a configuration. */
  function describe(state) {
    const g = geometry(state);
    const closed = g.gap < 1e-6;
    return {
      closed: closed,
      text: (g.lessReal ? "Hidden rear edges shown; " : "Default drawing; ") +
        "beam length " + g.w + " of 500. " +
        (closed
          ? "The two middle beams meet exactly: the pieces are coupled."
          : "A small gap remains between the two middle beams."),
    };
  }

  return {
    W_MIN: W_MIN, W_MAX: W_MAX, W_DEFAULT: W_DEFAULT,
    LESS_REAL_DEFAULT: LESS_REAL_DEFAULT, WIDTH: WIDTH, HEIGHT: HEIGHT,
    start: start, setW: setW, toggleLessReal: toggleLessReal,
    geometry: geometry, describe: describe,
    dist: dist, reflect: reflect, fixedLength: fixedLength,
  };
})();
