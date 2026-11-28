"use strict";

/*
 * Isogonal Tangents — Bogomolny's applet IsogonalTangents, "Internal Tangents
 * to Three Circles". Three rays from O carry three circles, each touching the
 * two rays of one angle. The rays are one common internal tangent of each pair
 * of circles; the other internal tangent is the mirror image of the ray in the
 * line joining the two centres. The page's claim is that those three second
 * tangents are concurrent.
 *
 * The geometry is a DOM-free transcription of IsogonalTangentsCanvas.init,
 * Compute, GetSecondTangents, CommonPoint/Tangent and DrawIntersection, plus
 * the shared methods they call (GeoSDoub, Tangents, Inversion). coef = 5 is
 * the applet's own extrapolation along the angle bisectors. The position is
 * plain data so the record and the tutor can keep it as it is; every function
 * returns a new position and never changes its argument.
 */
const IsogonalTangentsCore = (() => {
  const COEF = 5;
  const NAMES = ["O", "U", "V", "W", "P", "Q", "R"];
  const RAY_NAMES = ["O", "U", "V", "W"];
  const CENTRES = ["P", "Q", "R"];
  /* The two rays tangent to each circle, and the other two circles. */
  const CIRCLE_RAYS = { P: ["V", "W"], Q: ["W", "U"], R: ["U", "V"] };
  const PAIRS = [
    { name: "QR", first: "Q", second: "R", ray: "U", crossing: "A" },
    { name: "RP", first: "R", second: "P", ray: "V", crossing: "B" },
    { name: "PQ", first: "P", second: "Q", ray: "W", crossing: "C" },
  ];

  const copy = (p) => ({ x: p.x, y: p.y });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const sqDist = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
  const dist = (a, b) => Math.sqrt(sqDist(a, b));
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;

  /* GeoSDoub.ComputeAngle: the unsigned angle at its first argument. */
  function computeAngle(a, b, c) {
    const cosine = ((sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) / 2) /
      (dist(a, b) * dist(a, c));
    return Math.acos(cosine);
  }

  /* GeoSDoub.FindOrientation: positive signed area, else negative. */
  function orientation(a, b, c) {
    const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return s > 0 ? 1 : -1;
  }

  /* GeoSDoub.Rotate: turn q around p by sense * angle. */
  function rotate(p, q, angle, sense) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return {
      x: p.x + cs * (q.x - p.x) - sense * sn * (q.y - p.y),
      y: p.y + sense * sn * (q.x - p.x) + cs * (q.y - p.y),
    };
  }

  /* GeoSDoub.Intersect of the two infinite lines ab and cd; det < 1 is NaN. */
  function intersect(a, b, c, d) {
    if (![a, b, c, d].every(finite)) return { x: NaN, y: NaN };
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /* GeoSDoub.FindAngleBisector: rotate one side by half the angle, cut the other. */
  function bisector(a, b, c) {
    const ray = rotate(a, b, computeAngle(a, b, c) / 2, orientation(a, b, c));
    return intersect(a, ray, b, c);
  }

  /* O + coef * (bisector point - O): the applet's CreateBisector. */
  function extrapolate(o, p) {
    return { x: o.x + COEF * (p.x - o.x), y: o.y + COEF * (p.y - o.y) };
  }

  /* GeoSDoub.NearestPoint and Dist(DoubPoint, DoubLine). */
  function nearest(p, a, b) {
    if (sqDist(a, p) < 0.1) return copy(p);
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  function distToLine(p, a, b) {
    if (sqDist(a, p) < 0.1) return 0;
    const q = nearest(p, a, b);
    return Math.hypot(q.x - p.x, q.y - p.y);
  }

  /* The three bisector feet, from the current rays. */
  function bisectors(s) {
    const p = s.points || s;
    return {
      R: bisector(p.O, p.U, p.V),
      P: bisector(p.O, p.V, p.W),
      Q: bisector(p.O, p.W, p.U),
    };
  }

  /** The applet's init(): six of the seven points, then the extrapolated centres. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 600 : o.width;
    const height = o.height === undefined ? 500 : o.height;
    const halfW = width / 2, halfH = height / 2, third = width / 3, shoulder = 120;
    const points = {
      O: { x: halfW, y: halfH },
      U: { x: halfW - third, y: halfH + shoulder },
      V: { x: halfW + third, y: halfH + shoulder },
      W: {
        x: halfW + third * Math.cos(Math.PI / 3),
        y: halfH - third * Math.sin(Math.PI / 3) - shoulder / 2,
      },
    };
    const feet = bisectors(points);
    for (const name of CENTRES) points[name] = extrapolate(points.O, feet[name]);
    return {
      width, height, points: {
        O: copy(points.O), U: copy(points.U), V: copy(points.V), W: copy(points.W),
        P: copy(points.P), Q: copy(points.Q), R: copy(points.R),
      },
      /* The page embeds the applet with ShowNames=1. */
      showNames: o.showNames === undefined ? true : Boolean(o.showNames),
    };
  }

  /**
   * Dragging a ray point (or O) rebuilds all three centres, as the applet's
   * mouseDragged/mouseReleased UpdateBisector calls do. Dragging a centre only
   * slides it along its (unchanged) bisector line: RestrictToLine.
   */
  function withPoint(s, name, p) {
    if (!NAMES.includes(name) || !finite(p)) return s;
    const points = { ...s.points, [name]: copy(p) };
    const next = { ...s, points };
    if (RAY_NAMES.includes(name)) {
      const feet = bisectors(next);
      for (const c of CENTRES) points[c] = extrapolate(points.O, feet[c]);
    } else {
      const feet = bisectors(next);
      points[name] = nearest(points[name], points.O, feet[name]);
    }
    return next;
  }

  function withNames(s, on) { return { ...s, showNames: Boolean(on) }; }

  /** GetRadius(P, V, W): the mean of the two (equal) distances to the rays. */
  function circleAt(s, name) {
    const p = s.points[name];
    const rays = CIRCLE_RAYS[name];
    const r = (distToLine(p, s.points.O, s.points[rays[0]]) +
      distToLine(p, s.points.O, s.points[rays[1]])) / 2;
    return { x: p.x, y: p.y, r };
  }

  function circles(s) {
    const out = {};
    for (const name of CENTRES) out[name] = circleAt(s, name);
    return out;
  }

  /* GeoSDoub.IntersectCirclesX: solve y = k*x + b after eliminating x^2. */
  function circleIntersectionsX(a, b) {
    const k = -(a.y - b.y) / (a.x - b.x);
    const intercept = (a.x * a.x - b.x * b.x + a.y * a.y - b.y * b.y -
      a.r * a.r + b.r * b.r) / (2 * (a.x - b.x));
    const d = intercept - a.x;
    const A = k * k + 1;
    const B = k * d - a.y;
    const C = d * d + a.y * a.y - a.r * a.r;
    const disc = B * B - A * C;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-B + root) / A, t2 = (-B - root) / A;
    return [{ x: k * t1 + intercept, y: t1 }, { x: k * t2 + intercept, y: t2 }];
  }

  /* GeoSDoub.IntersectCirclesY: the same with x and y exchanged. */
  function circleIntersectionsY(a, b) {
    const k = -(a.x - b.x) / (a.y - b.y);
    const intercept = (a.y * a.y - b.y * b.y + a.x * a.x - b.x * b.x -
      a.r * a.r + b.r * b.r) / (2 * (a.y - b.y));
    const d = intercept - a.y;
    const A = k * k + 1;
    const B = k * d - a.x;
    const C = d * d + a.x * a.x - a.r * a.r;
    const disc = B * B - A * C;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-B + root) / A, t2 = (-B - root) / A;
    return [{ x: t1, y: k * t1 + intercept }, { x: t2, y: k * t2 + intercept }];
  }

  function circleIntersections(a, b) {
    if (Math.abs(a.x - b.x) > 1) return circleIntersectionsX(a, b);
    if (Math.abs(a.y - b.y) > 1) return circleIntersectionsY(a, b);
    return [copy(a), copy(a)];
  }

  /* Inversion.Tangent(circle, p): the two tangent lines from p to circle. */
  function tangentsFrom(circle, p) {
    const power = sqDist(circle, p) - circle.r * circle.r;
    if (power < 0) return null;
    const t = Math.sqrt(power);
    const aux = { x: p.x, y: p.y, r: t };
    const pts = circleIntersections(circle, aux);
    if (!pts) return null;
    return [{ a: copy(p), b: pts[0] }, { a: copy(p), b: pts[1] }];
  }

  /* Tangents.GetInternalTangents: use a circle of radius r1 + r2 about c1. */
  function internalTangents(c1, c2) {
    const aux = { x: c1.x, y: c1.y, r: c1.r + c2.r };
    const from = tangentsFrom(aux, c2);
    if (!from) return null;
    return from.map((ln) => {
      const dx = ln.b.x - c1.x, dy = ln.b.y - c1.y;
      return {
        a: { x: c1.x + dx * c1.r / aux.r, y: c1.y + dy * c1.r / aux.r },
        b: { x: c2.x - dx * c2.r / aux.r, y: c2.y - dy * c2.r / aux.r },
      };
    });
  }

  /* The internal centre of similitude; the coalesced tangent through it. */
  function commonPoint(c1, c2) {
    const total = c1.r + c2.r;
    return {
      x: (c2.r * c1.x + c1.r * c2.x) / total,
      y: (c2.r * c1.y + c1.r * c2.y) / total,
    };
  }

  function commonTangent(c1, c2) {
    const s = commonPoint(c1, c2);
    return {
      a: s,
      b: { x: s.x + c1.y - c2.y, y: s.y - (c1.x - c2.x) },
    };
  }

  /* One tangent is the ray through O; take the other (the one away from O).
   * The applet's exception handler answers a failed tangent construction with
   * the coalesced CommonTangent exactly when the circles touch. */
  function secondTangent(s, c1, c2) {
    let lines = null;
    try {
      lines = internalTangents(c1, c2);
    } catch (e) {
      lines = null;
    }
    if (!lines) {
      return Math.abs(dist(c1, c2) - c1.r - c2.r) < 1 ? commonTangent(c1, c2) : null;
    }
    if (dist(lines[0].a, lines[1].a) < 2) return commonTangent(c1, c2);
    for (const ln of lines) {
      if (distToLine(s.points.O, ln.a, ln.b) > 1) return ln;
    }
    return commonTangent(c1, c2);
  }

  /** IsogonalTangentsCanvas.Compute and DrawIntersection. */
  function compute(s) {
    const cs = circles(s);
    const lines = {};
    const crossings = {};
    for (const pair of PAIRS) {
      const ln = secondTangent(s, cs[pair.first], cs[pair.second]);
      lines[pair.name] = ln;
      crossings[pair.crossing] = ln
        ? intersect(s.points.O, s.points[pair.ray], ln.a, ln.b)
        : { x: NaN, y: NaN };
    }
    const order = [lines.QR, lines.RP, lines.PQ];
    const cuts = [];
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < 3; i++) {
      const a = order[i], b = order[(i + 1) % 3];
      if (!a || !b) continue;
      const p = intersect(a.a, a.b, b.a, b.b);
      cuts.push(p);
      sx += p.x; sy += p.y; n++;
    }
    const X = n ? { x: sx / n, y: sy / n } : null;
    return { circles: cs, lines, crossings, cuts, X, regular: Boolean(X) && finite(X) && cuts.length === 3 && cuts.every(finite) && Object.keys(crossings).every((k) => finite(crossings[k])) };
  }

  /* Reflection of p in the infinite line ab, for checking the mirror claim. */
  function reflectPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    const f = { x: a.x + dx * t, y: a.y + dy * t };
    return { x: 2 * f.x - p.x, y: 2 * f.y - p.y };
  }

  /** The page's claims, measured at the current configuration. */
  function claims(s) {
    const g = compute(s);
    let rayResidual = 0, tangentResidual = 0, mirrorResidual = 0;
    for (const name of CENTRES) {
      const c = g.circles[name];
      for (const ray of CIRCLE_RAYS[name]) {
        rayResidual = Math.max(rayResidual,
          Math.abs(distToLine(c, s.points.O, s.points[ray]) - c.r));
      }
    }
    for (const pair of PAIRS) {
      const ln = g.lines[pair.name];
      if (!ln) continue;
      for (const nm of [pair.first, pair.second]) {
        const c = g.circles[nm];
        tangentResidual = Math.max(tangentResidual,
          Math.abs(distToLine(c, ln.a, ln.b) - c.r));
      }
      /* Reflect the ray in the line of centres: it must become the other
       * internal tangent. Compare directions, without depending on the
       * arbitrary positions of the points along those lines. */
      const c1 = g.circles[pair.first], c2 = g.circles[pair.second];
      const q1 = reflectPoint(s.points.O, c1, c2);
      const q2 = reflectPoint(s.points[pair.ray], c1, c2);
      const u = { x: q2.x - q1.x, y: q2.y - q1.y };
      const v = { x: ln.b.x - ln.a.x, y: ln.b.y - ln.a.y };
      const du = Math.hypot(u.x, u.y), dv = Math.hypot(v.x, v.y);
      mirrorResidual = Math.max(mirrorResidual,
        du > 1e-9 && dv > 1e-9 ? Math.abs(cross(u, v) / (du * dv)) : Infinity);
    }
    const cuts = g.cuts.filter(finite);
    let spread = Infinity;
    if (cuts.length === 3) {
      spread = Math.max(dist(cuts[0], cuts[1]), dist(cuts[1], cuts[2]), dist(cuts[0], cuts[2]));
    }
    const gaps = [
      dist(g.circles.P, g.circles.Q) - g.circles.P.r - g.circles.Q.r,
      dist(g.circles.Q, g.circles.R) - g.circles.Q.r - g.circles.R.r,
      dist(g.circles.R, g.circles.P) - g.circles.R.r - g.circles.P.r,
    ];
    const scale = Math.max(1, s.width, s.height);
    /* Tangent or nearly tangent circles and circles collapsed onto O make the
     * applet's "distance from O > 1" tangent choice ill-conditioned. Report
     * those honestly instead of claiming the theorem at a degenerate picture. */
    const degenerate = gaps.some((v) => v < 5) ||
      CENTRES.some((n) => g.circles[n].r < 10 ||
        dist(g.circles[n], s.points.O) < 10);
    return {
      ...g, rayResidual, tangentResidual, mirrorResidual, spread, gaps, degenerate,
      raysTangent: rayResidual < 1e-6 * scale,
      linesTangent: tangentResidual < 1e-6 * scale,
      mirrored: mirrorResidual < 1e-7,
      concurrent: g.regular && !degenerate && cuts.length === 3 && spread < 1e-6 * scale,
    };
  }

  /** An illustration has no win, loss or finish. */
  function result(/* state */) { return null; }

  return {
    COEF, NAMES, RAY_NAMES, CENTRES, CIRCLE_RAYS, PAIRS,
    sqDist, dist, dot, cross, computeAngle, orientation, rotate, intersect,
    bisector, extrapolate, nearest, distToLine, bisectors, start, withPoint,
    withNames, circleAt, circles, circleIntersectionsX, circleIntersectionsY,
    circleIntersections, tangentsFrom, internalTangents, commonPoint,
    commonTangent, secondTangent, compute, reflectPoint, claims, result,
  };
})();
