"use strict";

/*
 * Koch's Snowflake, from Alexander Bogomolny's applet NoLimit ("NoLimit's
 * Paradox").
 *
 * Start with an equilateral triangle: three line segments. Cut every segment
 * into three equal parts, keep the two outer ones and replace the middle one
 * by the two sides of an equilateral "tent" built on it, pointing outward. Each
 * step turns every segment into four segments a third as long, so the broken
 * line has 4/3 times the length of the one before. The curves get closer and
 * closer to a limit curve, the Koch snowflake, that sits in a bounded region and
 * yet has no finite length.
 *
 * The applet's N goes from 1 (the triangle itself) to 8 (its scroll bar
 * 1..10 with a visible amount of 2). The page's iteration number n is N - 1.
 * The triangle has its apex at the top and radius R about the centre; its
 * points are built by the applet's CollectPoints, which splits a segment
 * AB into A, A + (B - A)/3, the tent's apex, A + 2(B - A)/3 and B, and
 * recurses on the four pieces.
 *
 * Position (plain data): { n } with n = the applet's N. One global, KochCore,
 * no DOM. The geometry is in a plain coordinate system with y pointing up and
 * the circle of radius 1 through the triangle's corners.
 */
const KochCore = (() => {
  const MIN_N = 1, MAX_N = 8, DEFAULT_N = 1;

  const SQRT3 = Math.sqrt(3);

  function start() { return { n: DEFAULT_N }; }

  function setN(state, n) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n)) return null;
    return { ...state, n: Math.max(MIN_N, Math.min(MAX_N, n)) };
  }

  /** The three corners of the starting triangle, counter-clockwise from the top: angle 90 degrees + 120 k, radius 1. */
  function triangle() {
    return [0, 1, 2].map((k) => { const a = Math.PI / 2 + (2 * Math.PI * k) / 3; return { x: Math.cos(a), y: Math.sin(a) }; });
  }

  /**
   * The applet's CollectPoints: the start points of the pieces of segment ab
   * after n - 1 divisions, appended to `out`. With n = 1 that is a alone.
   * The tent's apex is the point P1 turned by 60 degrees about P3, the
   * direction that points away from a counter-clockwise triangle.
   */
  function collect(out, a, b, n) {
    if (--n === 0) { out.push(a); return; }
    const p1 = { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 };
    const p3 = { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 };
    // turn p1 about p3 by +60 degrees (anticlockwise, y up): outward for this triangle, as the snowflake needs
    const c = Math.cos(Math.PI / 3), s = Math.sin(Math.PI / 3);
    const dx = p1.x - p3.x, dy = p1.y - p3.y;
    const apex = { x: p3.x + dx * c - dy * s, y: p3.y + dx * s + dy * c };
    const pts = [a, p1, apex, p3, b];
    for (let i = 0; i < 4; i++) collect(out, pts[i], pts[i + 1], n);
  }

  /** The corners of the closed broken line for N: 3 * 4^(N - 1) points, in order. */
  function points(n) {
    n = Math.max(MIN_N, Math.min(MAX_N, Math.round(n)));
    const t = triangle(), out = [];
    for (let i = 0; i < 3; i++) collect(out, t[i], t[(i + 1) % 3], n);
    return out;
  }

  /** How many segments the broken line has: 3 * 4^(N - 1). */
  const segments = (n) => 3 * Math.pow(4, n - 1);

  /** The length of one segment, in the units where the triangle's side is 1: 1 / 3^(N - 1). */
  const segmentLength = (n) => Math.pow(1 / 3, n - 1);

  /** The total length, again with the triangle's side 1: 3 (4/3)^(N - 1). */
  const perimeter = (n) => 3 * Math.pow(4 / 3, n - 1);

  /** The enclosed area as a multiple of the triangle's area: 8/5 - (3/5)(4/9)^(N - 1). */
  const areaRatio = (n) => 8 / 5 - (3 / 5) * Math.pow(4 / 9, n - 1);

  /** The limit of the area ratio, 8/5. */
  const AREA_LIMIT = 8 / 5;

  /** The measured area of a polygon, by the shoelace formula. */
  function polygonArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p.x * q.y - q.x * p.y; }
    return Math.abs(s) / 2;
  }

  /** The measured length of the closed broken line. */
  function polygonLength(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += Math.hypot(q.x - p.x, q.y - p.y); }
    return s;
  }

  /** The side of the starting triangle for radius 1: sqrt 3. */
  const SIDE = SQRT3;

  return { MIN_N, MAX_N, DEFAULT_N, AREA_LIMIT, SIDE, start, setN, triangle, points, segments, segmentLength, perimeter, areaRatio, polygonArea, polygonLength };
})();
