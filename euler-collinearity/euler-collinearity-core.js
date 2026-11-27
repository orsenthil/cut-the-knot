"use strict";

/*
 * Euler Collinearity, from Alexander Bogomolny's applet EulerCollinearity.
 * The applet draws a triangle V0 V1 V2, a point P and, for each vertex, the
 * midpoint Mk of the opposite side and the point Mtk = P + t(Mk - P). It
 * joins Vk to Mtk: the three lines always concur when the slider value t is
 * in the applet's range. The center of that concurrence moves on the line
 * through P and the centroid G. When P is the circumcenter O this line is
 * the Euler line.
 *
 * The reason is that V -> M is a homothety centered at G with factor -1/2
 * and M -> Mt is a homothety centered at P with factor t. Their product is a
 * homothety whose center lies on GP, and it sends Vk to Mtk, so all three
 * joining lines pass through that center.
 *
 * All coordinates are the applet's canvas coordinates (y grows downwards).
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, EulerCollinearityCore, so the page loads it
 * with a plain <script> and the logic test loads it in Node. The position is
 * plain data, so it can be saved and handed to the tutor as it is.
 */
const EulerCollinearityCore = (() => {
  // From EulerCollinearityCanvas.init(), EulerCollinearityPanel() and the
  // archived page's <APPLET WIDTH=500 HEIGHT=500>.
  const APPLET = {
    width: 500,
    height: 500,
    sliderMin: -10,        // scrollbar: new Scrollbar(0, 15, 5, -10, 505)
    sliderMax: 505,
    sliderInitial: 15,     // -> T = 1.5, matching the canvas constructor
    pOffset: { x: 100, y: -20 },  // P = (cx + 100, cy - 20)
    qOffset: { x: -20, y: 30 },   // Q, an unused leftover in the applet
    intersectTolerance: 1, // GeoSDoub.Intersect returns NaN below this
    drawTolerance: 1,      // applet skips a line/vector when the ends are <= 1 apart
  };
  const EPS = 1e-12;

  const pt = (x, y) => ({ x, y });
  const add = (p, q) => pt(p.x + q.x, p.y + q.y);
  const sub = (p, q) => pt(p.x - q.x, p.y - q.y);
  const mul = (p, k) => pt(p.x * k, p.y * k);
  const midpoint = (p, q) => pt((p.x + q.x) / 2, (p.y + q.y) / 2);
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** CTKGeometryPlus.Barycenter: the ordinary average of three points. */
  const barycenter = (a, b, c) =>
    pt((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);

  /** The scrollbar reports an integer; the canvas divides it by ten. */
  const sliderT = (value) => value / 10;

  /**
   * GeoSDoub.Intersect, faithful to its one-pixel tolerance: when the
   * determinant is that small it returns a point whose coordinates are NaN.
   * We return null so the UI can simply leave that object undrawn.
   */
  function intersect(p, q, r, s) {
    const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
    const d = r.y - s.y, e = s.x - r.x, f = r.x * s.y - r.y * s.x;
    const det = a * e - b * d;
    if (!(Math.abs(det) >= APPLET.intersectTolerance)) return null;
    const x = (b * f - c * e) / det;
    const y = (c * d - a * f) / det;
    return pt(x, y);
  }

  /** The position a new illustration starts from, straight from init(). */
  function start() {
    const cx = APPLET.width / 2, cy = APPLET.height / 2;
    const r = Math.min(APPLET.width, APPLET.height) / 3;
    const V = [0, 1, 2].map((k) => {
      const angle = (2 * Math.PI * k) / 3;
      return pt(cx + r * Math.sin(angle), cy - r * Math.cos(angle));
    });
    return {
      V,
      P: add(pt(cx, cy), APPLET.pOffset),
      Q: add(pt(cx, cy), APPLET.qOffset), // never draggable in the applet
      t: sliderT(APPLET.sliderInitial),
      showHint: false,
      showNames: false,
    };
  }

  /** Move a draggable point (V0, V1, V2 or P) inside the canvas. */
  function withPoint(state, name, p) {
    if (name !== "P" && !/^V[012]$/.test(name)) return state;
    const q = pt(clamp(p.x, 4, APPLET.width - 4), clamp(p.y, 4, APPLET.height - 4));
    if (name === "P") return { ...state, P: q };
    const index = Number(name.slice(1));
    const V = state.V.slice();
    V[index] = q;
    return { ...state, V };
  }

  /** Set the homothety factor (the applet's scrollbar value divided by ten). */
  function withT(state, value) {
    return { ...state, t: sliderT(value) };
  }

  /** The two checkboxes in the applet's panel. */
  function withFlag(state, flag, on) {
    if (flag !== "showHint" && flag !== "showNames") return state;
    return { ...state, [flag]: Boolean(on) };
  }

  /**
   * The applet's Compute(), transcribed. The returned objects are the ones
   * the page draws: cevians, vectors, the locus line and the labelled dots.
   * A null means the applet skipped that object (ends less than one pixel
   * apart, or an intersection returned NaN).
   */
  function compute(state) {
    const { V, P, t } = state;
    const G = barycenter(V[0], V[1], V[2]);
    const M = [
      midpoint(V[1], V[2]),
      midpoint(V[0], V[2]),
      midpoint(V[0], V[1]),
    ];
    const Mt = M.map((m) => add(P, mul(sub(m, P), t)));

    // The applet only creates a line/vector when its ends are > 1 apart.
    const lines = Mt.map((m, k) => distance(V[k], m) > APPLET.drawTolerance
      ? { p: V[k], q: m } : null);
    const vectors = Mt.map((m) => distance(m, P) > APPLET.drawTolerance
      ? { p: P, q: m } : null);

    // Barycenter of the three pairwise intersections of the cevians.
    const i01 = lines[0] && lines[1] ? intersect(lines[0].p, lines[0].q, lines[1].p, lines[1].q) : null;
    const i12 = lines[1] && lines[2] ? intersect(lines[1].p, lines[1].q, lines[2].p, lines[2].q) : null;
    const i20 = lines[2] && lines[0] ? intersect(lines[2].p, lines[2].q, lines[0].p, lines[0].q) : null;
    const S = i01 && i12 && i20 ? barycenter(i01, i12, i20) : null;
    const L = S && distance(S, P) > APPLET.drawTolerance ? { p: P, q: S } : null;

    // U = P + t(G - P), the point the applet marks on GP.
    const U = add(P, mul(sub(G, P), t));
    return { G, M, Mt, lines, vectors, S, U, L, i01, i12, i20 };
  }

  /**
   * The center of the product of the two homotheties, worked out directly:
   * S(t) = (2(1 - t)P + 3tG) / (2 + t). For t = -2 the product is a
   * translation and the cevians are parallel; the applet's slider never
   * reaches that value. Used by the logic test to check the page's claim.
   */
  function claimPoint(P, G, t) {
    if (Math.abs(t + 2) < EPS) return null;
    const a = (2 * (1 - t)) / (2 + t);
    const b = (3 * t) / (2 + t);
    return pt(a * P.x + b * G.x, a * P.y + b * G.y);
  }

  /** As t tends to infinity the concurrence point tends to 3G - 2P. */
  const limitPoint = (P, G) => sub(mul(G, 3), mul(P, 2));

  /** Circumcenter of a triangle, used to check that GP is the Euler line. */
  function circumcenter(V) {
    const [A, B, Cc] = V;
    const d = 2 * (A.x * (B.y - Cc.y) + B.x * (Cc.y - A.y) + Cc.x * (A.y - B.y));
    if (Math.abs(d) < EPS) return null;
    const a2 = A.x * A.x + A.y * A.y;
    const b2 = B.x * B.x + B.y * B.y;
    const c2 = Cc.x * Cc.x + Cc.y * Cc.y;
    return pt(
      (a2 * (B.y - Cc.y) + b2 * (Cc.y - A.y) + c2 * (A.y - B.y)) / d,
      (a2 * (Cc.x - B.x) + b2 * (A.x - Cc.x) + c2 * (B.x - A.x)) / d
    );
  }

  /** Orthocenter: O + G relation H = 3G - 2O for a non-degenerate triangle. */
  const orthocenter = (V) => {
    const O = circumcenter(V);
    return O ? limitPoint(O, barycenter(V[0], V[1], V[2])) : null;
  };

  return {
    APPLET, EPS, pt, add, sub, mul, midpoint, distance, cross, clamp,
    barycenter, sliderT, intersect, start, withPoint, withT, withFlag,
    compute, claimPoint, limitPoint, circumcenter, orthocenter,
  };
})();
