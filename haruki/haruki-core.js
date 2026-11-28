"use strict";

/*
 * Haruki — Hiroshi Haruki's Lemma, from Alexander Bogomolny's Java applet.
 *
 * Two chords AB and CD of a circle and a point P on the circle determine
 * Q = PC ∩ AB and R = PD ∩ AB.  The circle through P, Q, D meets AB again at
 * E, and the circle through P, R, C meets AB again at F.  The page claims
 * BE = AF and that both equal AQ·RB/QR; neither E nor F moves when P slides
 * round the circle.  The code below is geometry only: it never touches the
 * document, and it defines one global so Node can load it for the logic test.
 *
 * Every construction step mirrors the applet: GetCircle averages three
 * centre-to-vertex distances, GeoSDoub.FindCircumcenter cuts the perpendicular
 * bisectors of AB and BC, GeoSDoub.Rotate places D and P at the start, the
 * circle/line intersection uses GeoSDoub.IntersectX/IntersectY, and Other()
 * keeps the intersection more than one unit away from a known point.  D and P
 * are glued to the starting circle, as CTKMoveableDoub.RestrictToCircle did.
 */

const HarukiCore = (() => {
  const VIEW = { x: 0, y: 0, width: 480, height: 440 };
  /* The applet used a 600x550 canvas, centre (300,275), radius 75, A and B
   * twenty units below the centre, C eight units below its sine offset.  The
   * board here is that construction scaled by 0.8. */
  const HOME = { c: { x: 240, y: 220 }, r: 60, aOffset: 16, cOffset: 8 };
  const PAD = 14;

  const point = (x, y) => ({ x: x, y: y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.Rotate: screen-coordinate rotation, sign from the applet. */
  function rotate(center, p, t, sign) {
    const co = Math.cos(t), si = Math.sin(t);
    const dx = p.x - center.x, dy = p.y - center.y;
    return point(center.x + co * dx - sign * si * dy,
                 center.y + sign * si * dx + co * dy);
  }

  /** GeoSDoub.Intersect(line,line), including its one-unit parallel guard. */
  function intersectLines(a, b, c, d) {
    const l4 = a.y - b.y, l6 = b.x - a.x;
    const l8 = a.x * b.y - a.y * b.x;
    const l10 = c.y - d.y, l12 = d.x - c.x;
    const l14 = c.x * d.y - c.y * d.x;
    const den = l4 * l12 - l10 * l6;
    if (!Number.isFinite(den) || Math.abs(den) < 1) return null;
    return point((l6 * l14 - l12 * l8) / den, (l8 * l10 - l14 * l4) / den);
  }

  /** GeoSDoub.FindCircumcenter(a,b,c): perpendicular bisectors of AB and BC. */
  function circumcenter(a, b, c) {
    const m1 = point((a.x + b.x) / 2, (a.y + b.y) / 2);
    const m2 = point((b.x + c.x) / 2, (b.y + c.y) / 2);
    return intersectLines(
      m1, point(m1.x + (b.y - a.y), m1.y - (b.x - a.x)),
      m2, point(m2.x + (c.y - b.y), m2.y - (c.x - b.x)),
    );
  }

  /** HarukiCanvas.GetCircle: mean of the three centre-to-vertex distances. */
  function circle(a, b, c) {
    const o = circumcenter(a, b, c);
    if (!finite(o)) return null;
    const r = (dist(o, a) + dist(o, b) + dist(o, c)) / 3;
    return Number.isFinite(r) && r > 1e-9 ? { c: o, r: r } : null;
  }

  /** GeoSDoub.Intersect(DoubLine,DoubCircle) for the line through p and q. */
  function lineCircle(p, q, circ) {
    const dx = p.x - q.x, dy = p.y - q.y;
    if (!circ || (!Number.isFinite(dx) || !Number.isFinite(dy))) return null;
    if (Math.abs(dy) > 1) {
      // IntersectX: x = m*y + b.
      const m = dx / dy, b = q.x - m * q.y;
      const A = m * m + 1;
      const B = 2 * (m * (b - circ.c.x) - circ.c.y);
      const C = circ.c.y * circ.c.y + (b - circ.c.x) * (b - circ.c.x) - circ.r * circ.r;
      const disc = B * B - 4 * A * C;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      const t1 = (-B + s) / (2 * A), t2 = (-B - s) / (2 * A);
      return [point(m * t1 + b, t1), point(m * t2 + b, t2)];
    }
    if (Math.abs(dx) > 1) {
      // IntersectY: y = m*x + b (nearly horizontal chords).
      const m = dy / dx, b = q.y - m * q.x;
      const A = m * m + 1;
      const B = 2 * (m * (b - circ.c.y) - circ.c.x);
      const C = circ.c.x * circ.c.x + (b - circ.c.y) * (b - circ.c.y) - circ.r * circ.r;
      const disc = B * B - 4 * A * C;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      const t1 = (-B + s) / (2 * A), t2 = (-B - s) / (2 * A);
      return [point(t1, m * t1 + b), point(t2, m * t2 + b)];
    }
    return null;
  }

  /** HarukiCanvas.Other: the intersection at least one unit from `known`. */
  function other(points, known) {
    if (!points || !points.length) return null;
    return dist(points[0], known) < 1 ? points[1] : points[0];
  }

  /** CTKMoveableDoub's circle glide: move along the ray from the centre. */
  function projectToCircle(p, circ) {
    if (!circ || !finite(p)) return null;
    const v = sub(p, circ.c);
    const n = Math.hypot(v.x, v.y);
    if (!(n > 1e-12)) return null;
    return add(circ.c, mul(v, circ.r / n));
  }

  /** Keep a dragged A, B or C inside the board with room for its label. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /** HarukiCanvas.init, scaled to this board. */
  function start(options) {
    const o = options || {};
    const A = point(HOME.c.x - HOME.r, HOME.c.y + HOME.aOffset);
    const B = point(HOME.c.x + HOME.r, HOME.c.y + HOME.aOffset);
    const C = point(HOME.c.x - HOME.r * Math.cos(Math.PI / 3),
                    HOME.c.y + HOME.r * Math.sin(Math.PI / 3) + HOME.cOffset);
    const base = circle(A, B, C);
    const D = rotate(base.c, C, -Math.PI / 4, -1);
    const P = rotate(base.c, A, 2 * Math.PI / 3, 1);
    return {
      A: A, B: B, C: C, D: D, P: P,
      options: {
        names: o.names === undefined ? true : !!o.names,
        statement: !!o.statement,
        hint: !!o.hint,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  /** A/B/C may be dragged freely; D and P glide on the circle through A,B,C.
   * When A, B or C moves, CheckForABC re-anchors D and P on the new circle
   * along the old rays CD and CP. */
  function move(state, name, p) {
    if (!["A", "B", "C", "D", "P"].includes(name) || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      return state;
    }
    const next = Object.assign({}, state, { explored: true });
    if (name === "D" || name === "P") {
      const circ = circle(state.A, state.B, state.C);
      const onCircle = projectToCircle(p, circ);
      if (!onCircle) return state;
      next[name] = onCircle;
      return next;
    }
    next[name] = clamp(point(p.x, p.y));
    const circ = circle(next.A, next.B, next.C);
    if (!circ) return next;
    const dPair = lineCircle(next.C, state.D, circ);
    const pPair = lineCircle(next.C, state.P, circ);
    const dNew = other(dPair, next.C);
    const pNew = other(pPair, next.C);
    if (finite(dNew)) next.D = projectToCircle(dNew, circ) || state.D;
    if (finite(pNew)) next.P = projectToCircle(pNew, circ) || state.P;
    return next;
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** HarukiCanvas.Compute, from five points on one circle. */
  function compute(A, B, C, D, P) {
    const Q = intersectLines(A, B, P, C);
    const R = intersectLines(A, B, P, D);
    if (!finite(Q) || !finite(R)) return null;
    const circleE = circle(P, Q, D);      // circumcircle PQD
    const circleF = circle(P, R, C);      // circumcircle PRC
    if (!circleE || !circleF) return null;
    const E = other(lineCircle(A, B, circleE), Q);
    const F = other(lineCircle(A, B, circleF), R);
    if (!finite(E) || !finite(F)) return null;
    const qr = dist(Q, R);
    return {
      A: A, B: B, C: C, D: D, P: P, Q: Q, R: R, E: E, F: F,
      circleE: circleE, circleF: circleF,
      BE: dist(B, E), AF: dist(A, F),
      ratio: qr > 1e-12 ? dist(A, Q) * dist(R, B) / qr : NaN,
      gapE: dist(E, Q), gapF: dist(F, R),
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D, state.P);
  }

  /** Angle at the first point, as GeoSDoub.ComputeAngle did for the hint. */
  function angle(v, p, q) {
    const a = dist(v, p), b = dist(v, q), c = dist(p, q);
    if (!(a * b > 0)) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b))));
  }

  /* This is a picture, not a game: there is no win and no loss. */
  function result(state) {
    return null;
  }

  /** What the status line says. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move the points so that the chords and circles are well defined.";
    const deg = 180 / Math.PI;
    if (state.options.statement) {
      return `BE = AF = AQ·RB/QR = ${g.BE.toFixed(2)} board units.`;
    }
    if (state.options.hint) {
      const a = angle(g.F, g.A, g.C) * deg;
      const b = angle(g.P, g.C, g.D) * deg;
      const c = angle(g.E, g.D, g.B) * deg;
      return `Hint angles: at F ${a.toFixed(1)}°, at P ${b.toFixed(1)}°, at E ${c.toFixed(1)}°.`;
    }
    if (state.options.names) {
      return "E and F sit on AB; drag P and watch BE and AF stay equal.";
    }
    return "Two chords, two extra circles, and two lengths that stay equal.";
  }

  return {
    VIEW: VIEW, HOME: HOME, PAD: PAD,
    point: point, add: add, sub: sub, mul: mul, dot: dot, dist: dist, finite: finite,
    rotate: rotate, intersectLines: intersectLines, circumcenter: circumcenter,
    circle: circle, lineCircle: lineCircle, other: other, projectToCircle: projectToCircle,
    clamp: clamp, start: start, reset: reset, move: move, setOption: setOption,
    compute: compute, geometry: geometry, angle: angle, result: result, describe: describe,
  };
})();
