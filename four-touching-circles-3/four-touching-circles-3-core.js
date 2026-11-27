"use strict";

/*
 * Four Touching Circles III, from Alexander Bogomolny's applet
 * FourTouchingCircles3 and its cut-the-knot page. Four circles can be dragged
 * by their centres and by a point on each rim; where two circles touch, the
 * contact point is marked. If there are three contact points the applet draws
 * the circle through them. The page's claim is that the fourth contact point
 * of a chain of four circles lies on that circle exactly when the number of
 * external tangencies is even.
 *
 * The key idea transcribed here is the applet's own arithmetic: DoubCircle
 * takes its radius from the distance between its two movable points, Common
 * accepts a pair when that distance is within 2 pixels (3 once three contact
 * points have been found) of the sum or the difference of the radii, and
 * GetTangent divides the line of centres in the ratio of the radii (or in the
 * inverse ratio for an internal touch). The circle through the first three
 * contact points uses GeoSDoub.FindCircumcenter and then the mean of its three
 * distances, as the applet does. Circle inversion uses InvLine.InvertCinC.
 *
 * This file is only the logic: no document, no window, no storage. It defines
 * one global, FourTouchingCircles3Core. A position is plain data in board
 * units, so it can be saved by Track.state and handed to the tutor as it is.
 */

const FourTouchingCircles3Core = (() => {
  const WIDTH = 480;
  const HEIGHT = 320;
  const EDGE = 2;

  // FourTouchingCircles3Canvas.Compute visits the six pairs in this order.
  const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  // The cyclic chain the theorem on the page talks about.
  const CHAIN = [[0, 1], [1, 2], [2, 3], [3, 0]];

  /*
   * The Java applet chooses random centres and radii in Add(). A fixed,
   * reproducible opening chain is used instead: four circles with radii
   * 60, 50, 70, 45 whose consecutive centres are 110, 120, 115 and 105
   * apart. All four touches are external, so the dashed circle is visible
   * as soon as the page opens. Nothing about the rule is changed.
   */
  const START = {
    circles: [
      { c: { x: 150, y: 160 }, b: { x: 210, y: 160 } },
      { c: { x: 194.5455, y: 59.4232 }, b: { x: 244.5455, y: 59.4232 } },
      { c: { x: 260, y: 160 }, b: { x: 330, y: 160 } },
      { c: { x: 195, y: 254.8683 }, b: { x: 240, y: 254.8683 } },
    ],
    inv: { c: { x: 240, y: 160 }, b: { x: 340, y: 160 } },
    show: { circles: true, points: false, inversion: false, centers: false },
  };

  const number = (v, fallback) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const point = (v, fallback) => ({
    x: clamp(number(v && v.x, fallback.x), EDGE, WIDTH - EDGE),
    y: clamp(number(v && v.y, fallback.y), EDGE, HEIGHT - EDGE),
  });

  /** The opening diagram, or a caller's diagram with missing parts filled in. */
  function start(options) {
    const o = options || {};
    const circles = START.circles.map((d, i) => {
      const given = o.circles && o.circles[i];
      return {
        c: point(given && given.c, d.c),
        b: point(given && given.b, d.b),
      };
    });
    return {
      circles,
      inv: { c: point(o.inv && o.inv.c, START.inv.c), b: point(o.inv && o.inv.b, START.inv.b) },
      show: {
        circles: o.show && typeof o.show.circles === "boolean" ? o.show.circles : START.show.circles,
        points: o.show && typeof o.show.points === "boolean" ? o.show.points : START.show.points,
        inversion: o.show && typeof o.show.inversion === "boolean" ? o.show.inversion : START.show.inversion,
        centers: o.show && typeof o.show.centers === "boolean" ? o.show.centers : START.show.centers,
      },
    };
  }

  /** Move one of the ten draggable points; every other point is untouched. */
  function setPoint(state, name, q) {
    const next = start(state);
    if (!q) return next;
    const m = /^(c|b|ic|ib)([0-3]?)$/.exec(name);
    if (!m) return next;
    const d = START.circles[Number(m[2] || 0)];
    if (m[1] === "ic") next.inv.c = point(q, START.inv.c);
    else if (m[1] === "ib") next.inv.b = point(q, START.inv.b);
    else if (m[1] === "c") next.circles[Number(m[2])].c = point(q, d.c);
    else next.circles[Number(m[2])].b = point(q, d.b);
    return next;
  }

  /** Set one of the four panel checkboxes. */
  function setOption(state, name, value) {
    const next = start(state);
    if (name in next.show) next.show[name] = !!value;
    return next;
  }

  /** A compact, JSON-safe position for the player's record and the tutor. */
  function position(state) {
    const s = start(state);
    const round = (p) => ({ x: Number(p.x.toFixed(4)), y: Number(p.y.toFixed(4)) });
    return {
      circles: s.circles.map((d) => ({ c: round(d.c), b: round(d.b) })),
      inv: { c: round(s.inv.c), b: round(s.inv.b) },
      show: Object.assign({}, s.show),
    };
  }

  // GeoSDoub.SqDist / Dist, in the applet's own order of operations.
  const sqDist = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
  const dist = (p, q) => Math.sqrt(sqDist(p, q));

  /*
   * GeoSDoub.FindCircumcenter: the intersection of the perpendicular
   * bisectors, built as two lines through their midpoints. GeoSDoub.Intersect
   * returns a point of NaNs when the denominator is below 1 in absolute
   * value; that quirk matters for almost-collinear contact points.
   */
  function circumcenter(a, b, c) {
    const midAB = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const midBC = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const l1 = { x: midAB.x + (b.y - a.y), y: midAB.y - (b.x - a.x) };
    const l2 = { x: midBC.x + (c.y - b.y), y: midBC.y - (c.x - b.x) };
    const r1 = { x: l1.x - midAB.x, y: l1.y - midAB.y };
    const r2 = { x: l2.x - midBC.x, y: l2.y - midBC.y };
    const den = r1.x * r2.y - r2.x * r1.y;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    const t = ((midBC.x - midAB.x) * r2.y - (midBC.y - midAB.y) * r2.x) / den;
    return { x: midAB.x + r1.x * t, y: midAB.y + r1.y * t };
  }

  /** Canvas.GetCircle: average of the three distances from the circumcentre. */
  function getCircle(a, b, c) {
    const center = circumcenter(a, b, c);
    return {
      x: center.x,
      y: center.y,
      r: (dist(center, a) + dist(center, b) + dist(center, c)) / 3,
    };
  }

  /** Canvas.Common: within 2px of sum or difference, 3px after three dots. */
  function common(c1, c2, found) {
    const eps = found > 2 ? 3 : 2;
    const r1 = c1.r;
    const r2 = c2.r;
    return Math.abs(r1 + r2 - dist(c1, c2)) < eps ||
      Math.abs(Math.abs(r1 - r2) - dist(c1, c2)) < eps;
  }

  /** DoubCircle.Tangent: a point one radius along the tangent at p. */
  function tangentEndpoint(circle, p) {
    if (Math.abs(dist(circle, p) - circle.r) > 1) return null;
    return { x: p.x + (circle.y - p.y), y: p.y - (circle.x - p.x) };
  }

  /*
   * Canvas.GetTangent: divide the line of centres in the ratio r1:r2 for an
   * outside touch, or in the ratio of the smaller radius to the difference
   * for an inside touch. The tangent endpoint is found exactly as in
   * DoubCircle.Tangent; if it fails the applet throws and returns null.
   */
  function getTangent(c1, c2) {
    const eps = 0.1;
    const r1 = c1.r;
    const r2 = c2.r;
    if (r1 < eps || r2 < eps) return null;
    const d = dist(c1, c2);
    let p;
    let external;
    if (d >= r1 && d >= r2) {
      external = true;
      const k = r1 / (r1 + r2);
      p = { x: c1.x + (c2.x - c1.x) * k, y: c1.y + (c2.y - c1.y) * k };
    } else {
      external = false;
      const small = r1 < r2 ? c1 : c2;
      const large = r1 < r2 ? c2 : c1;
      const rsmall = Math.min(r1, r2);
      const k = rsmall / Math.abs(r1 - r2);
      p = { x: small.x + (small.x - large.x) * k, y: small.y + (small.y - large.y) * k };
    }
    const end = tangentEndpoint(c1, p);
    if (!end) return null;
    return { point: p, tangent: end, external };
  }

  /*
   * InvLine.InvertCinC, with flip = false as ShowInversion uses it. When the
   * source circle passes close to the inversion centre its image is a line
   * perpendicular to the line of centres; otherwise it is a circle.
   */
  function invertCircle(c, inv) {
    const R = dist(inv.c, inv.b);
    const power = sqDist(c, inv.c) - c.r * c.r;
    if (Math.abs(power) > 100) {
      const k = (R * R) / power;
      return {
        kind: "circle",
        x: c.x + (inv.c.x - c.x) * k,
        y: c.y + (inv.c.y - c.y) * k,
        r: c.r * Math.abs(k),
      };
    }
    const q = { x: 2 * inv.c.x - c.x, y: 2 * inv.c.y - c.y };
    const dq = dist(inv.c, q);
    const t = (R * R) / (dq * dq);
    const p = { x: inv.c.x + (q.x - inv.c.x) * t, y: inv.c.y + (q.y - inv.c.y) * t };
    const line = DoubLineEnds(p, inv.c);
    return { kind: "line", a: line.a, b: line.b, p };
  }

  /* DoubLine.SetBounds clips the image line to the canvas rectangle. */
  function DoubLineEnds(p, o) {
    const dx = p.y - o.y;
    const dy = -(p.x - o.x);
    const ends = [];
    for (const x of [0, WIDTH]) {
      if (Math.abs(dx) > 1e-12) {
        const t = (x - p.x) / dx;
        const y = p.y + dy * t;
        if (y >= 0 && y <= HEIGHT) ends.push({ x, y });
      }
    }
    for (const y of [0, HEIGHT]) {
      if (Math.abs(dy) > 1e-12) {
        const t = (y - p.y) / dy;
        const x = p.x + dx * t;
        if (x >= 0 && x <= WIDTH) ends.push({ x, y });
      }
    }
    if (ends.length < 2) return { a: p, b: { x: p.x + dx, y: p.y + dy } };
    let best = [ends[0], ends[1]];
    let longest = dist(ends[0], ends[1]);
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        const d = dist(ends[i], ends[j]);
        if (d > longest) { longest = d; best = [ends[i], ends[j]]; }
      }
    }
    return { a: best[0], b: best[1] };
  }

  /** Circles as DoubCircles, with the radius taken from centre to rim. */
  function circleData(state) {
    const s = start(state);
    return s.circles.map((d) => ({
      x: d.c.x, y: d.c.y, c: d.c, b: d.b, r: dist(d.c, d.b),
    }));
  }

  /*
   * Canvas.Compute, instruction for instruction: clear the three lists,
   * visit the six pairs, add a contact point and a centre line for each
   * successful pair, then draw the circle through the first three points.
   */
  function geometry(state) {
    const s = start(state);
    const circles = circleData(s);
    const contacts = [];
    const centerLines = [];
    PAIRS.forEach(([i, j]) => {
      const c1 = circles[i];
      const c2 = circles[j];
      if (!common(c1, c2, contacts.length)) return;
      const tan = getTangent(c1, c2);
      if (!tan) return;
      contacts.push({
        point: tan.point,
        tangent: tan.tangent,
        pair: [i, j],
        external: tan.external,
      });
      centerLines.push([c1, c2]);
    });
    const circle = contacts.length >= 3
      ? getCircle(contacts[0].point, contacts[1].point, contacts[2].point)
      : null;
    const inv = s.inv;
    const inversions = circles.map((c) => invertCircle(c, inv));

    /*
     * The page talks about a cyclic chain of four touches. Report its parity
     * and whether the remaining chain point is on the supplied circle when
     * all four chain pairs were found. This is derived information for the
     * status line and for the logic test; it does not change Compute.
     */
    const chainHits = CHAIN.map(([i, j]) => contacts.find((t) =>
      (t.pair[0] === i && t.pair[1] === j) || (t.pair[0] === j && t.pair[1] === i)));
    const chain = {
      hits: chainHits.length,
      external: chainHits.every(Boolean)
        ? chainHits.filter((t) => t.external).length
        : null,
      onCircle: null,
    };
    if (chain.external !== null && circle && Number.isFinite(circle.r)) {
      const missing = chainHits.find((t) =>
        !contacts.slice(0, 3).some((u) => u.point === t.point));
      if (missing) chain.onCircle = Math.abs(dist(circle, missing.point) - circle.r) < 0.5;
    }
    return { circles, contacts, centerLines, circle, inversions, chain };
  }

  return {
    WIDTH, HEIGHT, EDGE, PAIRS, CHAIN,
    start, setPoint, setOption, position,
    dist, sqDist, circumcenter, getCircle, common, tangentEndpoint, getTangent,
    invertCircle, circleData, geometry,
  };
})();
