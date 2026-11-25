"use strict";

/*
 * Golden Ratio in an Irregular Pentagon, from Alexander Bogomolny's applet
 * NoRegularPentagon.
 *
 * In a pentagon ABCDE every triangle cut off by a diagonal (ABC, BCD, CDE,
 * DEA, EAB) has the same area, say 1. The page proves that each diagonal is
 * then parallel to a side, that two diagonals cut each other in the golden
 * ratio, and that the pentagon has area (5 + sqrt 5)/2 = 3.618... Such
 * pentagons are exactly the affine images of a regular pentagon, so there are
 * plenty of irregular ones.
 *
 * The applet builds one from three free points X, Z and D (Bui Quang Tuan's
 * construction), in this order (its Compute method):
 *   k = 1 / ((1 + sqrt 5)/2 + 1);   Y = Z + k (X - Z)
 *   A = 2X - Y        C = 2Z - D
 *   C' = line CY meets line AD      D' = line DY meets line AC
 *   K = midpoint of Y D'            L = midpoint of Y C'
 *   B = 2K - D        E = 2L - C
 * (ReflectIn(p, q) is the reflection of q in the point p, that is 2p - q.)
 *
 * Position (plain data): { X, Z, D }, each { x, y }. One global,
 * PentagonCore, no DOM.
 */
const PentagonCore = (() => {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const K = 1 / (PHI + 1);                 // = 1 / PHI^2 = 0.381966...
  const AREA_RATIO = (5 + Math.sqrt(5)) / 2; // pentagon area / area of one cut-off triangle
  const W = 500, H = 340;                  // the page's drawing area; the points are kept inside

  const pt = (x, y) => ({ x, y });
  const ext = (p, q, t) => pt(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
  const refl = (p, q) => pt(2 * p.x - q.x, 2 * p.y - q.y);
  const mid = (p, q) => pt((p.x + q.x) / 2, (p.y + q.y) / 2);

  /** The point where line ab meets line cd, or null when they are parallel. */
  function meet(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-12) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
    return pt(a.x + t * rx, a.y + t * ry);
  }

  /** The area of triangle pqr. */
  const area3 = (p, q, r) => Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)) / 2;

  /** The area of a polygon given as a list of points. */
  function polyArea(v) {
    let s = 0;
    for (let i = 0; i < v.length; i++) { const p = v[i], q = v[(i + 1) % v.length]; s += p.x * q.y - q.x * p.y; }
    return Math.abs(s) / 2;
  }

  /** The applet's Compute(): every point from the three free ones, or null when the construction breaks down. */
  function build(state) {
    const { X, Z, D } = state;
    const Y = ext(Z, X, K);
    const A = refl(X, Y), C = refl(Z, D);
    const Cp = meet(C, Y, A, D), Dp = meet(D, Y, A, C);
    if (!Cp || !Dp) return null;
    const Kp = mid(Y, Dp), L = mid(Y, Cp);
    const B = refl(Kp, D), E = refl(L, C);
    return { X, Y, Z, A, B, C, D, E, Cp, Dp, K: Kp, L };
  }

  /** The five corners, in order A B C D E. */
  const corners = (b) => [b.A, b.B, b.C, b.D, b.E];

  /**
   * What the page says about a pentagon given by its five corners:
   * the five cut-off triangles (ABC, BCD, CDE, DEA, EAB), the pentagon's area
   * and its ratio to one triangle, whether each diagonal is parallel to the
   * side it leaves out, and where the diagonals cut each other.
   */
  function measure(v) {
    const ears = v.map((_, i) => area3(v[i], v[(i + 1) % 5], v[(i + 2) % 5]));   // triangle on corners i, i+1, i+2
    const area = polyArea(v);
    // diagonal v[i]v[i+2] is parallel to the side v[i+3]v[i+4]
    const parallel = v.map((_, i) => {
      const a = v[i], b = v[(i + 2) % 5], c = v[(i + 3) % 5], d = v[(i + 4) % 5];
      const cross = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
      const len = Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(d.x - c.x, d.y - c.y);
      return Math.abs(cross) / len;
    });
    // the five inner points: diagonal i (v[i] to v[i+2]) meets diagonal i+1 (v[i+1] to v[i+3])
    const inner = v.map((_, i) => meet(v[i], v[(i + 2) % 5], v[(i + 1) % 5], v[(i + 3) % 5]));
    return { ears, area, ratio: area / ears[0], parallel, inner };
  }

  /** How the diagonal v[i]v[i+2] is cut by the diagonals through v[i+1] and through v[i-1]: the ratios of the longer part to the shorter. */
  function diagonalCuts(v) {
    const out = [];
    for (let i = 0; i < 5; i++) {
      const a = v[i], b = v[(i + 2) % 5];
      const p = meet(a, b, v[(i + 1) % 5], v[(i + 3) % 5]);      // with the diagonal from the next corner
      const q = meet(a, b, v[(i + 4) % 5], v[(i + 1) % 5]);      // with the diagonal from the corner before
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const da = Math.hypot(p.x - a.x, p.y - a.y), db = Math.hypot(q.x - b.x, q.y - b.y);
      const mid3 = L - da - db; // the part between the two cuts
      out.push({ whole: L, ends: [da, db], middle: mid3 });
    }
    return out;
  }

  /** The pentagon the diagonals make (its corners are the five inner points). */
  function innerPentagon(v) { return measure(v).inner; }

  /** The star points: each side's line meets the line of the side two further on. */
  function starPoints(v) {
    return v.map((_, i) => meet(v[i], v[(i + 1) % 5], v[(i + 2) % 5], v[(i + 3) % 5]));
  }

  /** A regular pentagon with the given centre and radius, point A at the top (screen coordinates). */
  function regular(cx, cy, r) {
    return Array.from({ length: 5 }, (_, i) => pt(cx + r * Math.sin((2 * Math.PI * i) / 5), cy - r * Math.cos((2 * Math.PI * i) / 5)));
  }

  /** The three free points that build the given pentagon A, C, D (and so B, E when it has the page's property). */
  function freePoints(v) {
    const A = v[0], Cc = v[2], D = v[3];
    const Z = mid(Cc, D);
    // Y = (1 - k) Z + k X and X = (A + Y)/2  gives  Y (1 - k/2) = (1 - k) Z + (k/2) A
    const Y = pt(((1 - K) * Z.x + (K / 2) * A.x) / (1 - K / 2), ((1 - K) * Z.y + (K / 2) * A.y) / (1 - K / 2));
    const X = mid(A, Y);
    return { X, Z, D };
  }

  /** The starting position: a slanted, squashed regular pentagon, so it is visibly irregular. */
  function start() {
    const v = regular(W / 2, H / 2 + 5, 125).map((p) => pt(p.x + 0.28 * (p.y - H / 2) , (p.y - H / 2) * 0.88 + H / 2));
    return freePoints(v);
  }

  const clampPt = (x, y) => pt(Math.max(8, Math.min(W - 8, x)), Math.max(8, Math.min(H - 8, y)));

  /** Move one of the free points ("X", "Z" or "D"); null when that gives no pentagon or the name is wrong. */
  function move(state, which, x, y) {
    if (which !== "X" && which !== "Z" && which !== "D") return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const next = { ...state, [which]: clampPt(x, y) };
    return build(next) ? next : null;
  }

  return { PHI, K, AREA_RATIO, W, H, start, build, corners, measure, diagonalCuts, innerPentagon, starPoints, regular, freePoints, move, meet, polyArea, area3 };
})();
