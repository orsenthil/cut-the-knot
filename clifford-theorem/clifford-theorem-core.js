"use strict";

/*
 * CliffordTheoremCore — Alexander Bogomolny's "Clifford's Lemma".
 *
 * Four circles, each held by two points: V[i][0] is its centre and V[i][1]
 * a point on it, so its radius is Dist(centre, rim).  Chain the circles so
 * that the first meets the second, the second the third, the third the fourth
 * and the fourth the first.  Each neighbouring pair then cuts in two points
 * z_k and w_k.  Clifford's lemma says: if one point from each pair (the z's)
 * lies on a circle, then the four others (the w's) lie on a circle too.
 *
 * This is a direct transcription of CliffordTheoremCanvas from the bytecode:
 *   init()                  - the four circles around the middle of the board
 *   CheckCliffordCondition  - the three cyclic orderings 0123, 0132, 0213;
 *                             the first one whose four neighbour pairs meet
 *   CheckForCircles         - the eight choices of which crossing is a z;
 *                             GetCircle through three z's, Contains(z4),
 *                             then the complementary (blue) circle through
 *                             the three w's, with the fourth w marked too
 *   DoTheyIntersect         - strict triangle inequalities on radii
 *   Contains                - distance to circle within 0.1 drawing units
 * The geometry underneath comes from GeoSDoub: IntersectCirclesX/Y are used
 * according to which coordinate gap exceeds 1; FindCircumcenter cuts two
 * perpendicular bisectors, and a line intersection with determinant below 1
 * returns NaN.  GetCircle's radius is the mean of the three distances from
 * the circumcentre, just as in the applet (not the exact circumradius).
 *
 * No document, no window, no storage: one global, plain data in and out.
 */
const CliffordTheoremCore = (() => {
  const WIDTH = 600, HEIGHT = 450; // the <applet WIDTH=600 HEIGHT=450> on the page
  const ORDERS = [[0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3]];
  const TRIES = [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1],
    [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]];
  const ON_CIRCLE = 0.1;
  /* mouseTracker rectangles: x, y, width, height; the second hangs off the edge. */
  const EYES = (w) => [[30, 20, 40, 20], [w - 100, 80, 40, 20], [200, 10, 60, 30]];

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const copyPoint = (p) => ({ x: p.x, y: p.y });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.Intersect(p1,p2,p3,p4): lines, NaN when |det| < 1. */
  function intersectLines(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindCircumcenter: the two perpendicular bisectors meet here. */
  function findCircumcenter(a, b, c) {
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const o1 = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const o2 = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return intersectLines(m1, o1, m2, o2);
  }

  /** Canvas.GetCircle: centre from FindCircumcenter, mean of three distances. */
  function getCircle(P, i, j, k) {
    const a = P[0][i], b = P[1][j], c = P[2][k];
    const centre = findCircumcenter(a, b, c);
    return { x: centre.x, y: centre.y,
      r: (distance(centre, a) + distance(centre, b) + distance(centre, c)) / 3 };
  }

  /** GeoSDoub.IntersectCirclesX: solve x = slope*y + intercept for y. */
  function intersectCirclesX(c1, c2) {
    const slope = -(c1.y - c2.y) / (c1.x - c2.x);
    const intercept = (c1.x * c1.x - c2.x * c2.x + c1.y * c1.y - c2.y * c2.y
      - c1.r * c1.r + c2.r * c2.r) / (2 * (c1.x - c2.x));
    const u = intercept - c1.x;
    const quadA = slope * slope + 1;
    const halfB = slope * u - c1.y;
    const quadC = u * u + c1.y * c1.y - c1.r * c1.r;
    const disc = halfB * halfB - quadA * quadC;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const y1 = (-halfB + root) / quadA, y2 = (-halfB - root) / quadA;
    return [{ x: slope * y1 + intercept, y: y1 }, { x: slope * y2 + intercept, y: y2 }];
  }

  /** GeoSDoub.IntersectCirclesY: the same with x and y swapped. */
  function intersectCirclesY(c1, c2) {
    const slope = -(c1.x - c2.x) / (c1.y - c2.y);
    const intercept = (c1.x * c1.x - c2.x * c2.x + c1.y * c1.y - c2.y * c2.y
      - c1.r * c1.r + c2.r * c2.r) / (2 * (c1.y - c2.y));
    const u = intercept - c1.y;
    const quadA = slope * slope + 1;
    const halfB = slope * u - c1.x;
    const quadC = u * u + c1.x * c1.x - c1.r * c1.r;
    const disc = halfB * halfB - quadA * quadC;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const x1 = (-halfB + root) / quadA, x2 = (-halfB - root) / quadA;
    return [{ x: x1, y: slope * x1 + intercept }, { x: x2, y: slope * x2 + intercept }];
  }

  /** GeoSDoub.Intersect(DoubCircle,DoubCircle), with touching circles doubled. */
  function intersectCircles(c1, c2) {
    if (Math.abs(c1.x - c2.x) > 1) return intersectCirclesX(c1, c2);
    if (Math.abs(c1.y - c2.y) > 1) return intersectCirclesY(c1, c2);
    return [copyPoint(c1), copyPoint(c1)];
  }

  /** Canvas.DoTheyIntersect: d < r1+r2, r1 < d+r2, r2 < d+r1 (all strict). */
  function meet(c1, c2) {
    const d = distance(c1, c2);
    return d < c1.r + c2.r && c1.r < d + c2.r && c2.r < d + c1.r;
  }

  /** Canvas.Contains: on a circle to within 0.1 drawing units. */
  function contains(c, p) {
    return Math.abs(distance(c, p) - c.r) < ON_CIRCLE;
  }

  /** Canvas.init(): four equal circles around the middle of a 600x450 board. */
  function start(options) {
    const o = options || {};
    if (o.circles) return o.circles.map((c) => ({ center: copyPoint(c.center), rim: copyPoint(c.rim) }));
    const w = o.width === undefined ? WIDTH : o.width;
    const h = o.height === undefined ? HEIGHT : o.height;
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    const k = Math.min(Math.floor(w / 10), Math.floor(h / 10)) + 10, far = 2 * k + 10;
    const signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    return signs.map(([sx, sy]) => ({
      center: { x: cx + sx * k, y: cy + sy * k },
      rim: { x: cx + sx * far, y: cy + sy * far },
    }));
  }

  const copy = (s) => s.map((c) => ({ center: copyPoint(c.center), rim: copyPoint(c.rim) }));

  /** Move one of circle i's two defining points. */
  function withPoint(s, i, which, p) {
    if (!s[i] || (which !== "center" && which !== "rim") || !finite(p)) return s;
    const next = copy(s);
    next[i][which] = copyPoint(p);
    return next;
  }

  /** Move a whole circle (centre and rim together). */
  function shiftCircle(s, i, dx, dy) {
    const next = copy(s);
    if (next[i] && Number.isFinite(dx) && Number.isFinite(dy)) {
      next[i].center = { x: next[i].center.x + dx, y: next[i].center.y + dy };
      next[i].rim = { x: next[i].rim.x + dx, y: next[i].rim.y + dy };
    }
    return next;
  }

  /** UpdateRadii: centre and radius of every circle. */
  function circles(s) {
    return s.map((c) => ({ x: c.center.x, y: c.center.y, r: distance(c.center, c.rim) }));
  }

  /** CheckCliffordCondition + CheckForCircles over the given circles. */
  function analyse(s) {
    const C = circles(s);
    const order = ORDERS.find((o) =>
      [0, 1, 2, 3].every((k) => meet(C[o[k]], C[o[(k + 1) % 4]]))) || null;
    if (!order) return { circles: C, order: null, pairs: [], found: [], valid: false };
    const P = [];
    for (let k = 0; k < 4; k++) {
      const pair = intersectCircles(C[order[k]], C[order[(k + 1) % 4]]);
      if (!pair || !pair.every(finite)) return { circles: C, order, pairs: [], found: [], valid: false };
      P.push(pair.map(copyPoint));
    }
    const found = [];
    for (const [t0, t1, t2] of TRIES) {
      /* The bytecode fixes the first pair at index 0 and leaves the choice
         to the other three bits: GetCircle(P, 0, t0, t1), test P[3][t2]. */
      const red = getCircle(P, 0, t0, t1);
      if (!finite(red) || !Number.isFinite(red.r) || !contains(red, P[3][t2])) continue;
      const blue = getCircle(P, 1, 1 - t0, 1 - t1);
      found.push({
        tries: [t0, t1, t2],
        red, blue,
        z: [P[0][0], P[1][t0], P[2][t1], P[3][t2]],
        w: [P[0][1], P[1][1 - t0], P[2][1 - t1], P[3][1 - t2]],
      });
    }
    return { circles: C, order, pairs: P, found, valid: true };
  }

  /** The applet's three mouseTrackers: eye centres, radii and irises. */
  function eyes(width, mouse, open) {
    const m = finite(mouse) ? mouse : { x: 0, y: 0 };
    return EYES(width).map(([x, y, w, h]) => {
      const R = Math.floor(Math.min(w, h) / 2), r = Math.floor(R / 2);
      return [{ x: x + R, y: y + R }, { x: x + w - R, y: y + R }].map((c) => {
        const dx = m.x - c.x, dy = m.y - c.y, d = Math.hypot(dx, dy);
        const reach = R - r, k = d > reach ? (d ? reach / d : 0) : 1;
        return { center: c, R, r, iris: { x: c.x + dx * k, y: c.y + dy * k }, open: Boolean(open) };
      });
    }).flat();
  }

  /** An illustration has neither a win nor a loss. */
  function result(/* state */) {
    return null;
  }

  return {
    WIDTH, HEIGHT, ORDERS, TRIES, ON_CIRCLE,
    start, withPoint, shiftCircle, circles, analyse, eyes, result,
    distance, intersectLines, findCircumcenter, getCircle,
    intersectCircles, intersectCirclesX, intersectCirclesY, meet, contains,
  };
})();
