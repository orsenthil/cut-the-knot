"use strict";

/*
 * In And Circumcenter C — the "Proof From The Book" diagram on cut-the-knot.org.
 *
 * Drag the corners of triangle ABC. The applet draws I (incenter), O
 * (circumcenter), the three excenters, the feet K, L, M of the external angle
 * bisectors, and the points D and E obtained by laying the side AB along BC
 * and AC. Its claim is that DE is both equal and perpendicular to IO when
 * angle C is 30°; the page adds that the perpendicularity does not depend on
 * angle C. This port keeps that separation: it never declares a win.
 *
 * The idea behind the code is the applet's own construction, transcribed from
 * InAndCircumcenterCCanvas.Compute and GeoSDoub: I and the excenters come from
 * weighted averages of the corners, O from the perpendicular bisectors, K/L/M
 * from the external bisectors, and D/E from one point placed a side-length
 * away from another. Two of the applet's own thresholds are kept: lines whose
 * determinant is under 1 give no point, and the inradius is the average of the
 * three distances from I to the nearest points on the sides.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, InAndCircumcenterCCore, so the page loads it with a
 * plain <script> and porting/check-in-and-circumcenter-c.mjs loads it in Node.
 * Positions are plain data and nothing passed in is changed.
 */
const InAndCircumcenterCCore = (() => {
  const WIDTH = 400;                 // the Java applet's square drawing area
  const HEIGHT = 400;
  const MARGIN = 12;                 // keep handles off the edge like SetPoint
  const MIN_SIDE = 2;                // Compute's first three guards
  const MIN_CENTERS = 2;             // Compute's guard on |O - O'|
  const PARALLEL = 1;                // GeoSDoub.Intersect's |det| < 1 guard
  const NEAR_VERTEX = 0.1;           // GeoSDoub.NearestPoint's squared-distance guard
  const OPTIONS = ["names", "circleA", "circleB", "circleC", "centerLine"];

  const point = (x, y) => ({ x, y });
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const sqdist = (p, q) => {
    const dx = p.x - q.x, dy = p.y - q.y;
    return dx * dx + dy * dy;
  };
  const dist = (p, q) => Math.sqrt(sqdist(p, q));
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const onBoard = (p) => finite(p) && p.x >= 0 && p.x <= WIDTH && p.y >= 0 && p.y <= HEIGHT;

  /** The opening triangle from InAndCircumcenterCCanvas.init (w = h = 400). */
  function start() {
    const cx = WIDTH / 2, cy = HEIGHT / 2 - 20;
    const radius = Math.min(WIDTH, HEIGHT) / 12;
    const A = point(cx + radius * Math.sin(0), cy + radius * Math.cos(0));
    const B = point(A.x + WIDTH / 10, A.y - HEIGHT / 8);
    const C = point(A.x - WIDTH / 12, A.y - HEIGHT / 15);
    const state = { A, B, C, moves: 0, explored: false };
    for (const name of OPTIONS) state[name] = false;
    return state;
  }

  /** Everything a player may press or drag. */
  function legalMoves() {
    return [
      { type: "point", name: "A" },
      { type: "point", name: "B" },
      { type: "point", name: "C" },
      ...OPTIONS.map((name) => ({ type: name })),
      { type: "reset" },
    ].map((m) => ({ ...m }));
  }

  /** The handles are clamped inside the drawing, as in the Java canvas. */
  function limit(state, name, q) {
    if (!state || !["A", "B", "C"].includes(name) || !finite(q)) return null;
    return point(
      Math.max(MARGIN, Math.min(WIDTH - MARGIN, q.x)),
      Math.max(MARGIN, Math.min(HEIGHT - MARGIN, q.y)),
    );
  }

  /** Apply one move; return a new state, or null when the move is not allowed. */
  function move(state, m) {
    if (!state || !m || typeof m !== "object") return null;
    if (m.type === "reset") return start();
    if (m.type === "point") {
      const q = limit(state, m.name, m);
      if (!q) return null;
      const next = { ...state, [m.name]: q, moves: state.moves + 1, explored: true };
      next[m.name] = q;
      return next;
    }
    if (OPTIONS.includes(m.type) && typeof m.value === "boolean") {
      return { ...state, [m.type]: m.value, explored: state.explored || m.value };
    }
    return null;
  }

  /** A picture can be explored but never won or lost. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /* -------------------------------------------------- the applet's geometry */

  /** GeoSDoub.Intersect(a,b,c,d), including its NaN answer for parallel lines. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < PARALLEL) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** Foot of the perpendicular from p to the line a-b (GeoSDoub.NearestPoint). */
  function nearest(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqdist(a, p) < NEAR_VERTEX) return p;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return point(a.x + t * dx, a.y + t * dy);
  }

  /** GeoSDoub.FindCircumcenter, written as the intersection of two bisectors. */
  function circumcenter(a, b, c) {
    const d = 2 * cross(sub(b, a), sub(c, a));
    if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return null;
    const aa = dot(a, a), bb = dot(b, b), cc = dot(c, c);
    return point(
      (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d,
      (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d,
    );
  }

  /** GetCircumcircle: centre O and the mean of its three distances (applet rule). */
  function circumcircle(a, b, c) {
    const centre = circumcenter(a, b, c);
    if (!centre) return null;
    return { centre, radius: (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3 };
  }

  /** The feet of the internal bisectors, from the angle-bisector theorem. */
  function bisectorFoot(vertex, q, r) {
    const u = dist(vertex, q), v = dist(vertex, r);
    return add(mul(q, v / (u + v)), mul(r, u / (u + v)));
  }

  /** GetExBisector: turn the internal bisector through a right angle. */
  function externalBisector(vertex, q, r) {
    const foot = bisectorFoot(vertex, q, r);
    const direction = sub(foot, vertex);
    return { a: vertex, b: add(vertex, point(-direction.y, direction.x)) };
  }

  /** PlacePoint(P, Q, R): from P towards R, |PQ| away. */
  function place(p, q, r) {
    const length = dist(p, q);
    const factor = length / dist(p, r);
    return point(p.x + (r.x - p.x) * factor, p.y + (r.y - p.y) * factor);
  }

  /** All the objects Compute builds, or null for a triangle it refuses to draw. */
  function construct(state) {
    if (!state) return null;
    const A = state.A, B = state.B, C = state.C;
    if (!finite(A) || !finite(B) || !finite(C)) return null;
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    if (a < MIN_SIDE || b < MIN_SIDE || c < MIN_SIDE) return null;

    const perimeter = a + b + c;
    const incenter = mul(add(add(mul(A, a), mul(B, b)), mul(C, c)), 1 / perimeter);
    const exA = mul(sub(add(mul(B, b), mul(C, c)), mul(A, a)), 1 / (b + c - a));
    const exB = mul(sub(add(mul(C, c), mul(A, a)), mul(B, b)), 1 / (c + a - b));
    const exC = mul(sub(add(mul(A, a), mul(B, b)), mul(C, c)), 1 / (a + b - c));

    const abcCircle = circumcircle(A, B, C);
    const exCircle = circumcircle(exA, exB, exC);
    if (!abcCircle || !exCircle) return null;
    const O = abcCircle.centre, Op = exCircle.centre;
    if (dist(O, Op) < MIN_CENTERS) return null;

    const incircle = {
      centre: incenter,
      radius: (
        dist(incenter, nearest(incenter, A, B)) +
        dist(incenter, nearest(incenter, B, C)) +
        dist(incenter, nearest(incenter, C, A))
      ) / 3,
    };
    const circleA = circumcircle(B, C, exB); // B, C, Ib
    const circleB = circumcircle(C, A, exC); // C, A, Ic
    const circleC = circumcircle(A, B, exA); // A, B, Ia
    if (!circleA || !circleB || !circleC) return null;

    const sa = externalBisector(A, B, C);
    const sb = externalBisector(B, C, A);
    const sc = externalBisector(C, A, B);
    const K = intersect(sa.a, sa.b, B, C);
    const L = intersect(sb.a, sb.b, C, A);
    const M = intersect(sc.a, sc.b, A, B);
    const D = place(B, A, C);            // BD = AB, along BC
    const E = place(A, B, C);            // AE = AB, along AC

    return {
      A, B, C, a, b, c,
      I: incenter, O, Op, Ia: exA, Ib: exB, Ic: exC,
      D, E, K, L, M,
      incircle, circumcircle: abcCircle, exCircle,
      circleA, circleB, circleC,
      sa, sb, sc,
      de: { a: D, b: E }, kl: { a: K, b: L }, oo: { a: O, b: Op },
    };
  }

  /** The angle at C, in degrees; the page's 30° case is where DE = IO. */
  function angleC(state) {
    if (!state) return NaN;
    const u = sub(state.A, state.C), v = sub(state.B, state.C);
    const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
    if (!nu || !nv) return NaN;
    const cos = Math.max(-1, Math.min(1, dot(u, v) / (nu * nv)));
    return (Math.acos(cos) * 180) / Math.PI;
  }

  /** The line under the board: lengths, the right angle, and the 30° case. */
  function status(state) {
    const g = construct(state);
    if (!g) return "Move the corners apart: this triangle is too thin to draw.";
    const angle = angleC(state);
    const de = dist(g.D, g.E), io = dist(g.I, g.O);
    const denom = de * io;
    const right = denom > 0 && Math.abs(dot(sub(g.E, g.D), sub(g.O, g.I))) / denom < 1e-6;
    const equal = Math.abs(de - io) <= 1e-6 * Math.max(de, io);
    return (
      `Angle C is ${angle.toFixed(1)}°. DE is ${de.toFixed(1)} and IO is ${io.toFixed(1)}; ` +
      `${right ? "they meet at right angles" : "the picture is too thin to measure the angle"}. ` +
      `${equal ? "Here DE equals IO." : "DE equals IO only when angle C is 30°."}`
    );
  }

  return {
    WIDTH, HEIGHT, MARGIN, MIN_SIDE, MIN_CENTERS, PARALLEL, NEAR_VERTEX, OPTIONS,
    start, legalMoves, limit, move, result, construct, angleC, status,
    point, sub, add, mul, dot, cross, dist, sqdist, finite, onBoard,
  };
})();
