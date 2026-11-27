"use strict";

/*
 * CenterCircle — the hierarchy of circles in Bogomolny's article on Morley's
 * "metric geometry of the plane n-line".
 *
 * The player drags the two endpoints of up to seven lines. Three lines make a
 * triangle: its circumcircle is the first "center-circle". With four lines,
 * take the four center-circles of the four triples; their centers lie on a new
 * circle and all four circles pass through one point. The same step repeats:
 * the n center-circles of the (n-1)-line subsets meet at one point, their
 * centers lie on the next circle, and that circle passes through the point.
 * The article calls the whole chain of circles "Clifford's chain".
 *
 * The one idea the code relies on is the recursion in the applet's
 * DoDrawCircles / DrawCircle: a center-circle of an n-line is the circle
 * through the centers of three of the n center-circles of its (n-1)-subsets;
 * the common point is an intersection shared by two pairs of those circles.
 * Lines, circles and points are plain data; this file has no document, no
 * window and no storage. It defines one global, CenterCircleCore.
 */

const CenterCircleCore = (() => {
  const EPS = 1e-9;
  const N_LINES = 7;          // applet: m_NLines = 7
  const SHOWN_AT_START = 4;   // applet: m_ShowWhich[0..3] = true
  const MARGIN = 20;          // applet: m_A = 20
  const EQ2 = 0.1;            // DoubPoint.Equals: squared distance < 0.1

  const clonePoint = (p) => ({ x: p.x, y: p.y });
  const cloneLine = (l) => ({ a: clonePoint(l.a), b: clonePoint(l.b) });
  const dist2 = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(dist2(p, q));
  const finitePoint = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const finiteCircle = (c) =>
    Boolean(c) && finitePoint(c) && Number.isFinite(c.radius);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

  /** The intersection of the lines AB and CD; null for parallel or equal lines. */
  function lineIntersection(l, m) {
    const a1 = l.a.y - l.b.y, b1 = l.b.x - l.a.x;
    const c1 = l.a.x * l.b.y - l.a.y * l.b.x;
    const a2 = m.a.y - m.b.y, b2 = m.b.x - m.a.x;
    const c2 = m.a.x * m.b.y - m.a.y * m.b.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < EPS) return null;
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** The circle through three points; null when they are nearly collinear. */
  function circumcircle(p, q, r) {
    const d = 2 * (p.x * (q.y - r.y) + q.x * (r.y - p.y) + r.x * (p.y - q.y));
    if (Math.abs(d) < EPS) return null;
    const p2 = dist2(p, { x: 0, y: 0 });
    const q2 = dist2(q, { x: 0, y: 0 });
    const r2 = dist2(r, { x: 0, y: 0 });
    const center = {
      x: (p2 * (q.y - r.y) + q2 * (r.y - p.y) + r2 * (p.y - q.y)) / d,
      y: (p2 * (r.x - q.x) + q2 * (p.x - r.x) + r2 * (q.x - p.x)) / d,
    };
    if (!finitePoint(center)) return null;
    return { x: center.x, y: center.y, radius: dist(center, p) };
  }

  /** The two points where two circles meet; null if they do not meet. */
  function circleIntersections(c0, c1) {
    const dx = c1.x - c0.x, dy = c1.y - c0.y;
    const d = Math.hypot(dx, dy);
    if (d < EPS || d > c0.radius + c1.radius + EPS) return null;
    if (d < Math.abs(c0.radius - c1.radius) - EPS) return null;
    const a = (c0.radius ** 2 - c1.radius ** 2 + d * d) / (2 * d);
    const h2 = c0.radius ** 2 - a * a;
    if (h2 < -EPS) return null;
    const h = Math.sqrt(Math.max(0, h2));
    const xm = c0.x + (a * dx) / d, ym = c0.y + (a * dy) / d;
    return [
      { x: xm + (h * dy) / d, y: ym - (h * dx) / d },
      { x: xm - (h * dy) / d, y: ym + (h * dx) / d },
    ];
  }

  /** The point shared by the first three circles, if there is one. */
  function commonPoint(circles) {
    const p = circleIntersections(circles[0], circles[1]);
    const q = circleIntersections(circles[0], circles[2]);
    if (!p || !q) return null;
    for (const u of p) {
      for (const v of q) {
        if (dist2(u, v) < EQ2) return midpoint(u, v);
      }
    }
    return null;
  }

  /**
   * The whole circle hierarchy for a set of lines, as a tree. A node of order
   * k has one child for each (k-1)-subset. Its circle passes through the
   * centers of three children; its point is shared by three children. Exactly
   * what DoDrawCircles and DrawCircle build in the applet.
   */
  function build(lines, indices) {
    if (lines.length < 3) return null;
    if (lines.length === 3) {
      const p01 = lineIntersection(lines[0], lines[1]);
      const p12 = lineIntersection(lines[1], lines[2]);
      const p20 = lineIntersection(lines[2], lines[0]);
      const circle = p01 && p12 && p20 ? circumcircle(p01, p12, p20) : null;
      return {
        order: 3, subset: indices.slice(), circle,
        corners: [p01, p12, p20],
        children: [], point: null,
      };
    }
    const children = [];
    for (let i = 0; i < lines.length; i++) {
      const subLines = [], subIndices = [];
      for (let j = 0; j < lines.length; j++) {
        if (j !== i) { subLines.push(lines[j]); subIndices.push(indices[j]); }
      }
      const child = build(subLines, subIndices);
      if (child && finiteCircle(child.circle)) children.push(child);
    }
    const circle = children.length >= 3
      ? circumcircle(children[0].circle, children[1].circle, children[2].circle)
      : null;
    const point = children.length >= 3
      ? commonPoint(children.slice(0, 3).map((c) => c.circle))
      : null;
    return { order: lines.length, subset: indices.slice(), circle, corners: [], children, point };
  }

  /** Flatten a node tree, parents before children, for drawing. */
  function flatten(node, out) {
    if (!node) return out;
    out.push(node);
    for (const child of node.children) flatten(child, out);
    return out;
  }

  /** One of the applet's four edge bands, used for a new random line. */
  function randomPoint(width, height, rand) {
    const horizontal = Math.floor(rand() * 2) === 0;
    const inset = rand() * MARGIN;
    if (horizontal) {
      const x = rand() * width;
      return { x, y: rand() * height - inset };
    }
    const left = Math.floor(rand() * 2) === 0;
    return { x: left ? inset : width - inset, y: rand() * height };
  }

  /** The position a new game starts from. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 250 : o.height;
    const rand = o.random || Math.random;
    const n = o.lines ? o.lines.length : (o.nLines === undefined ? N_LINES : o.nLines);
    const lines = o.lines
      ? o.lines.map(cloneLine)
      : Array.from({ length: n }, () => ({
          a: randomPoint(width, height, rand),
          b: randomPoint(width, height, rand),
        }));
    const shown = Array.from({ length: lines.length }, (_, i) =>
      o.shown ? Boolean(o.shown[i]) : i < Math.min(SHOWN_AT_START, lines.length));
    return {
      lines, shown, width, height,
      showCircles: Boolean(o.showCircles),
      showCenters: Boolean(o.showCenters),
      showCommon: Boolean(o.showCommon),
    };
  }

  /** The shown lines and their full circle hierarchy. */
  function diagram(state) {
    const lines = [], indices = [], points = [];
    for (let i = 0; i < state.lines.length; i++) {
      if (!state.shown[i]) continue;
      lines.push(state.lines[i]);
      indices.push(i);
      points.push(state.lines[i].a, state.lines[i].b);
    }
    const root = build(lines, indices);
    const nodes = flatten(root, []);
    const scale = nodes.reduce((m, n) =>
      finiteCircle(n.circle) ? Math.max(m, n.circle.radius) : m, 0);
    return { lines, indices, points, root, nodes, scale };
  }

  /**
   * The article's claims at this position, each a plain true/false.
   * "P also lies on the next circle" is a fact for four lines (the Miquel
   * point on the Steiner circle); it is not true from five lines on, so only
   * the order-four nodes are asked that question here.
   */
  function claims(state) {
    const d = diagram(state);
    // Circles deep in the hierarchy can be enormous, so the same absolute
    // tolerance is used throughout: a fraction of the largest radius on display.
    // The exact, tight comparison is in porting/check-center-circle.mjs.
    const tol = 2e-3 * Math.max(1, d.scale);
    const onCircle = (p, c) =>
      finitePoint(p) && finiteCircle(c) && Math.abs(dist(p, c) - c.radius) <= tol;
    const higher = d.nodes.filter((n) => n.order >= 4);
    return {
      threeLinesMakeACircle: d.nodes.some((n) => n.order === 3 && finiteCircle(n.circle)),
      circlesThroughTheirCorners: d.nodes
        .filter((n) => n.order === 3)
        .every((n) => finiteCircle(n.circle) && n.corners.every((p) => onCircle(p, n.circle))),
      centersConcyclic: higher
        .filter((n) => finiteCircle(n.circle))
        .every((n) => n.children.every((c) => onCircle(c.circle, n.circle))),
      commonOnEveryCircle: higher
        .filter((n) => finitePoint(n.point))
        .every((n) => n.children.every((c) => onCircle(n.point, c.circle))),
      miquelOnSteinerCircle: higher
        .filter((n) => n.order === 4 && finitePoint(n.point) && finiteCircle(n.circle))
        .every((n) => onCircle(n.point, n.circle)),
      pointFoundAtEveryLevel: higher.every((n) => finitePoint(n.point)),
    };
  }

  /** A new position with one endpoint of one line moved. */
  function withPoint(state, lineIndex, end, p) {
    const next = {
      lines: state.lines.map(cloneLine),
      shown: state.shown.slice(),
      width: state.width, height: state.height,
      showCircles: state.showCircles, showCenters: state.showCenters,
      showCommon: state.showCommon,
    };
    if (!next.lines[lineIndex] || (end !== "a" && end !== "b")) return next;
    next.lines[lineIndex][end] = clonePoint(p);
    return next;
  }

  /** A new position with one line shown or hidden. */
  function withShown(state, i, on) {
    const next = {
      lines: state.lines.map(cloneLine),
      shown: state.shown.slice(),
      width: state.width, height: state.height,
      showCircles: state.showCircles, showCenters: state.showCenters,
      showCommon: state.showCommon,
    };
    if (i >= 0 && i < next.shown.length) next.shown[i] = Boolean(on);
    return next;
  }

  /** A new position with one of the applet's three display checkboxes set. */
  function withFlag(state, key, on) {
    const next = {
      lines: state.lines.map(cloneLine),
      shown: state.shown.slice(),
      width: state.width, height: state.height,
      showCircles: state.showCircles, showCenters: state.showCenters,
      showCommon: state.showCommon,
    };
    if (key === "showCircles" || key === "showCenters" || key === "showCommon") {
      next[key] = Boolean(on);
    }
    return next;
  }

  /** Nothing can be won or lost in an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    N_LINES, SHOWN_AT_START, MARGIN, EQ2,
    dist, dist2, finitePoint, finiteCircle,
    lineIntersection, circumcircle, circleIntersections, commonPoint,
    build, flatten, diagram, claims, start,
    withPoint, withShown, withFlag, result,
  };
})();
