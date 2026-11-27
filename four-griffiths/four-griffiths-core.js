"use strict";

/*
 * Four Griffiths, from Alexander Bogomolny's applet FourGriffiths.
 *
 * The picture is a demonstration, not a game: ABCD is a quadrilateral whose
 * vertices A, B, C stay on one circle (D is kept there too, except while it
 * is being dragged), and l is the line through the circle's centre O and the
 * point L. For each of the four triangles made from three of A, B, C, D the
 * applet draws the Griffiths point on l: the point that its nine-point circle
 * and the pedal circle of any point of l have in common. The four points lie
 * on one line, and the four pedal circles have a common point on that line.
 *
 * The code follows the applet's own Compute() chain: GetCircle (circumcentre
 * plus the mean of the three radii), NinePointCircle, PotentialGriffiths
 * (pedal circle from NearestPoint feet), FindCommon of two such intersections,
 * GetLine, Other() and the average that gives P. It has no DOM and defines one
 * global so the page and porting/check-four-griffiths.mjs can both use it.
 */
const FourGriffithsCore = (() => {
  // The page embeds the applet with WIDTH=600 HEIGHT=550.
  const VIEW = { width: 600, height: 550 };
  const MAX_R = 20000; // applet's MaxR: circles larger than this are clipped

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const distanceToLine = (p, a, b) =>
    distance(a, b) < 1e-12 ? distance(p, a) : Math.abs(cross(a, b, p)) / distance(a, b);

  function clampPoint(p) {
    return {
      x: clamp(Number(p.x) || 0, 0, VIEW.width),
      y: clamp(Number(p.y) || 0, 0, VIEW.height),
    };
  }

  /** GeoSDoub.FindCircumcenter + GetCircle: centre, then the mean radius. */
  function circleOf(a, b, c) {
    if (!a || !b || !c) return null;
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const d1 = { x: b.x - a.x, y: b.y - a.y };
    const d2 = { x: c.x - b.x, y: c.y - b.y };
    const det = d1.x * d2.y - d1.y * d2.x;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null; // collinear
    const q = { x: m2.x - m1.x, y: m2.y - m1.y };
    const t = (q.x * d2.x + q.y * d2.y) / det;
    const ctr = { x: m1.x - d1.y * t, y: m1.y + d1.x * t };
    const r = (distance(ctr, a) + distance(ctr, b) + distance(ctr, c)) / 3;
    if (!Number.isFinite(r) || r > MAX_R) return null;
    return { c: ctr, r };
  }

  /** GeoSDoub.NearestPoint: the foot of the perpendicular from p onto ab. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.1) return p; // the applet returns p for an almost-zero side
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.Intersect(DoubCircle, DoubCircle), written as a quadratic. */
  function circleIntersections(c0, r0, c1, r1) {
    const dx = c1.x - c0.x, dy = c1.y - c0.y;
    const d = Math.hypot(dx, dy);
    if (!d || d > r0 + r1 + 1e-9 || d < Math.abs(r0 - r1) - 1e-9) return [];
    const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    const h2 = r0 * r0 - a * a;
    if (h2 < -1e-7) return [];
    const h = Math.sqrt(Math.max(0, h2));
    const ux = dx / d, uy = dy / d;
    const base = { x: c0.x + ux * a, y: c0.y + uy * a };
    if (h < 1e-9) return [base];
    return [
      { x: base.x - uy * h, y: base.y + ux * h },
      { x: base.x + uy * h, y: base.y - ux * h },
    ];
  }

  /** GeoSDoub.Intersect(DoubCircle, DoubLine): two points, or none. */
  function circleLineIntersections(a, b, circle) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return [];
    const fx = a.x - circle.c.x, fy = a.y - circle.c.y;
    const B = 2 * (fx * dx + fy * dy);
    const C = fx * fx + fy * fy - circle.r * circle.r;
    const disc = B * B - 4 * len2 * C;
    if (disc < -1e-7) return [];
    const s = Math.sqrt(Math.max(0, disc));
    return [
      { x: a.x + dx * (-B + s) / (2 * len2), y: a.y + dy * (-B + s) / (2 * len2) },
      { x: a.x + dx * (-B - s) / (2 * len2), y: a.y + dy * (-B - s) / (2 * len2) },
    ];
  }

  /** NinePointCircle: the circle through three side midpoints. */
  function ninePointCircle(a, b, c) {
    return circleOf(midpoint(a, b), midpoint(b, c), midpoint(c, a));
  }

  /** PotentialGriffiths: the pedal circle of q with respect to triangle abc. */
  function pedalCircle(q, a, b, c) {
    return circleOf(foot(q, b, c), foot(q, c, a), foot(q, a, b));
  }

  /** Other(points, vertex): the intersection that is not this vertex. */
  function other(points, vertex) {
    if (!points || points.length < 2) return null;
    return distance(points[0], vertex) >= 1 ? points[0] : points[1];
  }

  /*
   * FindCommon: the pairs closer than one screen pixel. The applet breaks a
   * tie with the Griffiths line from the previous repaint, which can pick a
   * near miss when L is close to O and the two pedal circles nearly coincide;
   * taking the closest pair is the unambiguous common point of the circles
   * and agrees with the page's formula in every tested configuration.
   */
  function findCommon(s, t) {
    let best = null, bestD = 1;
    for (const p of s || []) {
      for (const q of t || []) {
        const d = distance(p, q);
        if (d < bestD) { bestD = d; best = midpoint(p, q); }
      }
    }
    return best;
  }

  /** Griffiths: common point of the nine-point and two pedal circles. */
  function griffiths(a, b, c, lPoint, circle) {
    const nine = ninePointCircle(a, b, c);
    if (!nine) return { g: null, pedal: null, nine };
    const pedal = pedalCircle(lPoint, a, b, c);
    const pedal2 = pedalCircle(midpoint(circle.c, lPoint), a, b, c);
    if (!pedal || !pedal2) return { g: null, pedal, nine };
    const first = circleIntersections(nine.c, nine.r, pedal.c, pedal.r);
    const second = circleIntersections(nine.c, nine.r, pedal2.c, pedal2.r);
    return { g: findCommon(first, second), pedal, nine };
  }

  /** GetLine: the farthest pair among the three points, clipped to the view. */
  function getLine(p, q, r) {
    const pairs = [[p, q], [p, r], [q, r]].filter(([a, b]) => a && b);
    if (!pairs.length) return null;
    pairs.sort((u, v) => distance(v[0], v[1]) - distance(u[0], u[1]));
    return clipLine(pairs[0][0], pairs[0][1]);
  }

  /** DoubLine.SetBounds: extend a line to the sides of the board rectangle. */
  function clipLine(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) + Math.abs(dy) < 1e-12) return [a, b];
    let lo = -Infinity, hi = Infinity;
    // The line stays inside the board for t between the two boundary values
    // of each coordinate; intersect the x-interval with the y-interval.
    if (Math.abs(dx) >= 1e-12) {
      const t0 = -a.x / dx, t1 = (VIEW.width - a.x) / dx;
      lo = Math.max(lo, Math.min(t0, t1));
      hi = Math.min(hi, Math.max(t0, t1));
    }
    if (Math.abs(dy) >= 1e-12) {
      const t0 = -a.y / dy, t1 = (VIEW.height - a.y) / dy;
      lo = Math.max(lo, Math.min(t0, t1));
      hi = Math.min(hi, Math.max(t0, t1));
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [a, b];
    return [
      { x: a.x + dx * lo, y: a.y + dy * lo },
      { x: a.x + dx * hi, y: a.y + dy * hi },
    ];
  }

  /** The starting points from Canvas.init(), with D projected as CheckForABC does. */
  function start(options) {
    const A = { x: VIEW.width / 2 - VIEW.width / 5, y: VIEW.height / 2 - VIEW.height / 5 };
    const B = { x: VIEW.width / 2 + VIEW.width / 5, y: VIEW.height / 2 + VIEW.height / 5 };
    const C = { x: VIEW.width / 2 + VIEW.width / 5, y: VIEW.height / 2 - VIEW.height / 5 };
    const D0 = { x: A.x, y: A.y - VIEW.height / 6 };
    const state = {
      A, B, C, D: D0,
      L: { x: VIEW.width * 6 / 11, y: VIEW.height * 3 / 4 },
      options: Object.assign({ names: false, circles: false, lines: false }, options || {}),
      explored: false,
    };
    state.D = projectD(state, D0);
    return state;
  }

  /** CheckForABC: D is the second meeting of line CD with the new circle. */
  function projectD(state, from) {
    const circle = circleOf(state.A, state.B, state.C);
    if (!circle) return from;
    const points = circleLineIntersections(state.C, from, circle);
    const d = other(points, state.C);
    if (!d) return from;
    const scale = circle.r / distance(circle.c, d);
    return { x: circle.c.x + (d.x - circle.c.x) * scale,
             y: circle.c.y + (d.y - circle.c.y) * scale };
  }

  /** Drag one handle; A, B or C pull D back onto their new circumcircle. */
  function move(state, name, point) {
    if (!["A", "B", "C", "D", "L"].includes(name)) return state;
    const p = clampPoint(point);
    const next = Object.assign({}, state, { [name]: p, explored: true });
    if (name === "A" || name === "B" || name === "C") next.D = projectD(next, state.D);
    return next;
  }

  function setOption(state, name, value) {
    if (!["names", "circles", "lines"].includes(name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: Boolean(value) }),
      explored: true,
    });
  }

  /** Reset the diagram, keeping the player's chosen show options. */
  function reset(state) {
    return start(state.options);
  }

  function legalMoves() {
    return ["A", "B", "C", "D", "L"];
  }

  /** Demos have no win or loss; their record ends when they are explored. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  /* Compute(), method for method. */
  function geometry(state) {
    const circle = circleOf(state.A, state.B, state.C);
    if (!circle) return null;
    const triangles = [[state.B, state.C, state.D], [state.A, state.C, state.D],
                       [state.A, state.B, state.D], [state.A, state.B, state.C]];
    const line = clipLine(circle.c, state.L); // l, through the centre
    const G = [], pedalCircles = [], nineCircles = [];
    for (const t of triangles) {
      const r = griffiths(t[0], t[1], t[2], state.L, circle);
      G.push(r.g);
      pedalCircles.push(r.pedal);
      nineCircles.push(r.nine);
    }
    const lineG = getLine(G[1], G[2], G[3]) || getLine(G[0], G[2], G[3]) ||
                  getLine(G[0], G[1], G[3]) || getLine(G[0], G[1], G[2]);

    // P: average of the "other" meetings of the pedal circles with the
    // Griffiths line; the applet computes it whether or not circles are shown.
    let sx = 0, sy = 0, count = 0;
    if (lineG) {
      for (let i = 0; i < 4; i++) {
        if (!G[i] || !pedalCircles[i]) continue;
        const p = other(circleLineIntersections(lineG[0], lineG[1], pedalCircles[i]), G[i]);
        if (p) { sx += p.x; sy += p.y; count++; }
      }
    }
    return {
      circle, O: circle.c, A: state.A, B: state.B, C: state.C, D: state.D, L: state.L,
      G, line, lineG, P: count ? { x: sx / count, y: sy / count } : null,
      pedalCircles, nineCircles, triangles,
    };
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "The three chosen points lie on a straight line, so no circle can be drawn.";
    const found = g.G.filter(Boolean).length;
    if (Math.abs(distance(g.D, g.circle.c) - g.circle.r) > 1) {
      return "D is off the circle; move A, B or C to bring it back and restore the four points.";
    }
    if (found < 4) return `${found} Griffiths points could be drawn; move a point away from a straight line.`;
    const bad = g.pedalCircles.filter(Boolean).length;
    return `Four Griffiths points lie on one line. ${bad} pedal circles of L meet in one point on that line; the four nine-point circles meet in one point too.`;
  }

  return {
    VIEW, MAX_R, start, move, setOption, reset, legalMoves, result, geometry, describe,
    circleOf, foot, midpoint, distance, distanceToLine, cross, clampPoint,
    ninePointCircle, pedalCircle, circleIntersections, circleLineIntersections,
    griffiths, findCommon, other, getLine, clipLine, projectD,
  };
})();
