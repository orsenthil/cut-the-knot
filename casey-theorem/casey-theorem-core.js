"use strict";

/*
 * Casey's theorem, from Alexander Bogomolny's applet CaseyTheorem.
 *
 * Four small circles touch one big circle from either side. Write t(ij) for
 * the length of their common tangent segment (the outer one when the two
 * circles touch the big circle on the same side, the inner one otherwise).
 * Casey's theorem says t(12)t(34) + t(14)t(23) = t(13)t(24), so long as the
 * four circles come in order around the big circle. When every radius is 0
 * the tangent segments are chords and this is Ptolemy's theorem.
 *
 * The one idea the code relies on: if S is the big circle's centre, R its
 * radius and P_i a small circle's centre at distance d_i from S, the applet
 * gives the small circle radius |d_i - R|. Its signed radius is rho_i =
 * d_i - R, and the common tangent segment of i and j has length
 *     t(ij) = sqrt(|P_i P_j|^2 - (rho_i - rho_j)^2)
 *               = 2 sqrt(d_i d_j) |sin((theta_i - theta_j)/2)|.
 * So the tangent length does not even depend on R: after dividing every
 * length by 2 sqrt(d_1 d_2 d_3 d_4), Casey's identity becomes Ptolemy's
 * identity for the four directions of the points from S.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, CaseyTheoremCore, so the page loads it with
 * a plain <script> and porting/check-casey-theorem.mjs loads it in Node. The
 * position is plain data, so the player's record and the tutor can use it as
 * it is. Functions take a position and return new objects; inputs are never
 * changed.
 */
const CaseyTheoremCore = (() => {
  const EPS = 1e-9;
  const TWO_PI = 2 * Math.PI;
  /* Applet Draw(): consecutive pairs and the two diagonals, with the third
   * circle that selects which of the two possible tangents is drawn. */
  const PAIRS = [[0, 1, 2], [1, 2, 3], [2, 3, 0], [3, 0, 1], [0, 2, 3], [1, 3, 0]];

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const orientation = (a, b, c) => (cross(a, b, c) > 0 ? 1 : -1);
  const wrap = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

  /** The starting picture, placed exactly as CaseyTheoremCanvas.Reset() does. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        S: { ...o.S },
        R: o.R,
        points: o.points.map((p) => ({ x: p.x, y: p.y })),
      };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const S = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    const R = Math.floor(Math.min(width, height) / 4);
    /* pi/6, 5pi/6, 3.765191430678208, 5pi/3. The second point is 0.1px to
     * the right in the applet, a harmless quirk that leaves it a hair inside
     * the big circle (radius about 0.087) instead of exactly on it. */
    const angles = [Math.PI / 6, (5 * Math.PI) / 6, 3.765191430678208, (5 * Math.PI) / 3];
    const points = angles.map((a, i) => ({
      x: S.x + (i === 1 ? 0.1 : 0) + R * Math.cos(a),
      y: S.y + R * Math.sin(a),
    }));
    return { S, R, points };
  }

  /** The four circles just as Compute() makes them. */
  function circles(s) {
    return s.points.map((p) => {
      const d = distance(s.S, p);
      const signed = d - s.R; // rho: positive outside the big circle
      return {
        center: { x: p.x, y: p.y },
        distance: d,
        radius: Math.abs(signed),
        signedRadius: signed,
        inside: d > s.R, // the applet's CaseyCircle.Inside flag
      };
    });
  }

  /** Length of the common tangent segment of two circles, or null if none. */
  function tangentLength(s, i, j) {
    const cs = circles(s);
    const a = cs[i], b = cs[j];
    if (!a || !b) return null;
    const d = distance(a.center, b.center);
    const delta = Math.abs(a.signedRadius - b.signedRadius);
    if (d + EPS < delta || d < EPS) return null;
    return Math.sqrt(Math.max(0, d * d - delta * delta));
  }

  /**
   * The two tangent segments and the one the applet draws: the midpoint of
   * the chosen one lies on the same side of P_iP_j as the third circle (that
   * is Tangents.SelectTangent's orientation test). Returns null when no real
   * common tangent exists.
   */
  function tangentSegment(s, i, j, k) {
    const cs = circles(s);
    const a = cs[i], b = cs[j];
    if (!a || !b) return null;
    const dx = b.center.x - a.center.x, dy = b.center.y - a.center.y;
    const d = Math.hypot(dx, dy);
    if (d < EPS) return null;
    const delta = (a.signedRadius - b.signedRadius) / d;
    if (Math.abs(delta) > 1 + EPS) return null;
    const across = Math.sqrt(Math.max(0, 1 - delta * delta));
    const ux = dx / d, uy = dy / d;
    const normals = [
      { x: delta * ux - across * uy, y: delta * uy + across * ux },
      { x: delta * ux + across * uy, y: delta * uy - across * ux },
    ];
    const candidates = normals.map((n) => ({
      p: {
        x: a.center.x + a.signedRadius * n.x,
        y: a.center.y + a.signedRadius * n.y,
      },
      q: {
        x: b.center.x + b.signedRadius * n.x,
        y: b.center.y + b.signedRadius * n.y,
      },
    }));
    let chosen = candidates[0];
    if (k !== undefined && cs[k]) {
      const side = orientation(a.center, b.center, cs[k].center);
      const mid = {
        x: (chosen.p.x + chosen.q.x) / 2,
        y: (chosen.p.y + chosen.q.y) / 2,
      };
      if (orientation(a.center, b.center, mid) * side < 0) chosen = candidates[1];
    }
    return {
      p: chosen.p,
      q: chosen.q,
      external: a.inside === b.inside,
      length: distance(chosen.p, chosen.q),
    };
  }

  /** true when A, B, C, D come in that order around the big circle. */
  function cyclicOrder(s) {
    const angles = s.points.map((p) => {
      if (distance(s.S, p) < EPS) return NaN;
      return wrap(Math.atan2(p.y - s.S.y, p.x - s.S.x));
    });
    if (angles.some((a) => !Number.isFinite(a))) return false;
    let total = 0;
    for (let i = 0; i < 4; i++) {
      const stepAngle = wrap(angles[(i + 1) % 4] - angles[i]);
      if (stepAngle <= 1e-6 || stepAngle >= TWO_PI - 1e-6) return false;
      total += stepAngle;
    }
    /* Exactly one lap: A -> B -> C -> D -> A in that order. */
    return Math.abs(total - TWO_PI) < 1e-6;
  }

  /** The six drawn pairs, their tangent segments and Casey's two products. */
  function measurements(s) {
    const tangents = PAIRS.map(([i, j, k]) => {
      const seg = tangentSegment(s, i, j, k);
      return {
        i, j, k,
        external: Boolean(seg && seg.external),
        length: seg ? seg.length : null,
        segment: seg ? { p: seg.p, q: seg.q } : null,
      };
    });
    const length = (i, j) => {
      const t = tangents.find((x) => (x.i === i && x.j === j) || (x.i === j && x.j === i));
      return t ? t.length : null;
    };
    const t01 = length(0, 1), t12 = length(1, 2), t23 = length(2, 3);
    const t03 = length(0, 3), t02 = length(0, 2), t13 = length(1, 3);
    const have = [t01, t12, t23, t03, t02, t13].every((v) => v !== null);
    return {
      circles: circles(s),
      tangents,
      cyclic: cyclicOrder(s),
      /* 12*34 + 14*23 = 13*24, in the page's numbering A=1, B=2, ... */
      left: have ? t01 * t23 + t03 * t12 : null,
      right: have ? t02 * t13 : null,
      difference: have ? t01 * t23 + t03 * t12 - t02 * t13 : null,
    };
  }

  /** Each claim the page makes, checked numerically at this configuration. */
  function claims(s) {
    const m = measurements(s);
    const scale = Math.max(m.circles.reduce((a, c) => Math.max(a, c.distance), 0), s.R, 1);
    const tol = 1e-8 * scale * scale;
    const allTangents = m.tangents.every((t) => t.length !== null && Number.isFinite(t.length));
    return {
      /* Every small circle really touches the big one, from one side or the other. */
      circlesTouchBig: m.circles.every((c) =>
        Math.abs(c.distance - (c.inside ? s.R + c.radius : s.R - c.radius)) < 1e-7 * scale),
      /* All six common tangents are real: no circle swallows another. */
      tangentsExist: allTangents,
      /* The order around the big circle is A, B, C, D. */
      cyclicOrder: m.cyclic,
      /* The page's identity t12*t34 + t14*t23 = t13*t24. */
      caseyIdentity: allTangents && m.left !== null &&
        Math.abs(m.difference) <= tol * Math.max(1, Math.abs(m.left), Math.abs(m.right)),
    };
  }

  /** A new position with one named point moved. Names are A-D or 0-3. */
  function withPoint(s, name, p) {
    const index = { A: 0, B: 1, C: 2, D: 3 }[name] ?? (typeof name === "number" ? name : -1);
    const points = s.points.map((q) => ({ x: q.x, y: q.y }));
    if (index >= 0 && index < points.length) points[index] = { x: p.x, y: p.y };
    return { S: { x: s.S.x, y: s.S.y }, R: s.R, points };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    PAIRS, start, circles, tangentLength, tangentSegment, cyclicOrder,
    measurements, claims, withPoint, result,
  };
})();
