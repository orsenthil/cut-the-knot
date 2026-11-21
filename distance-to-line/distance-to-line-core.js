"use strict";

/*
 * Distance from a point to a line, from Alexander Bogomolny's applet DistanceToLine.
 *
 * A line is given by two points; its general equation is Ax + By + C = 0 with the
 * normal n = (A, B). The distance from P = (u, v) to the line is
 * |Au + Bv + C| / ||n||. That is because f(x, y) = Ax + By + C changes by exactly
 * ||n|| for every unit step along the normal, and is 0 on the line.
 *
 * The plane is the model plane -6..6 on both axes. The position is plain data;
 * functions return new objects and never touch the DOM.
 */
const DistanceToLineCore = (() => {
  const LIM = 6;
  const MIN_DIGITS = 0;
  const MAX_DIGITS = 6;

  const clamp = (v) => Math.max(-LIM, Math.min(LIM, v));
  const cut = (v, digits) => { const f = Math.pow(10, digits); return Math.round(v * f) / f; };

  /** A new position (the applet opens with the line sloping and P off to one side). */
  function start(options) {
    const o = options || {};
    const digits = Number.isFinite(Number(o.digits)) ? Math.max(MIN_DIGITS, Math.min(MAX_DIGITS, Math.trunc(Number(o.digits)))) : 2;
    return { p1: [-4, -2], p2: [3, 3], p: [-1, 3], normalize: false, levels: false, digits, moves: 0, explored: false };
  }

  /** The general equation of the line through two points: [A, B, C]. */
  function equation(p1, p2) {
    const A = p1[1] - p2[1], B = p2[0] - p1[0];
    return [A, B, -(A * p1[0] + B * p1[1])];
  }

  const norm = (e) => Math.hypot(e[0], e[1]);

  /** Everything the page shows for a position. */
  function measure(s) {
    let [A, B, C] = equation(s.p1, s.p2);
    const n = norm([A, B]);
    if (s.normalize && n > 0) { A /= n; B /= n; C /= n; }
    const nn = Math.hypot(A, B);
    const f = A * s.p[0] + B * s.p[1] + C;
    const dist = nn === 0 ? Math.hypot(s.p[0] - s.p1[0], s.p[1] - s.p1[1]) : Math.abs(f) / nn;
    const foot = nn === 0 ? s.p1.slice() : [s.p[0] - (f * A) / (nn * nn), s.p[1] - (f * B) / (nn * nn)];
    return { A, B, C, norm: nn, f, dist, foot, side: f > 0 ? "positive" : f < 0 ? "negative" : "on the line" };
  }

  /** The foot of the perpendicular found the applet's way (GeoSDoub.NearestPoint), for the logic test. */
  function nearestPoint(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
    return [a[0] + t * dx, a[1] + t * dy];
  }


  /** moves: {type:"p1"|"p2"|"p", x, y}, {type:"shift", dx, dy} (the whole line), {type:"normalize"|"levels", value}, {type:"digits", value}, {type:"reset"} */
  function move(s, m) {
    if (!m) return null;
    const next = { ...s, p1: s.p1.slice(), p2: s.p2.slice(), p: s.p.slice(), moves: s.moves + 1, explored: true };
    if (m.type === "p1" || m.type === "p2" || m.type === "p") {
      if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return null;
      next[m.type] = [clamp(m.x), clamp(m.y)];
      if (m.type !== "p" && next.p1[0] === next.p2[0] && next.p1[1] === next.p2[1]) return null; // two points make a line
    } else if (m.type === "shift") {
      const dx = Math.max(-LIM - Math.min(s.p1[0], s.p2[0]), Math.min(LIM - Math.max(s.p1[0], s.p2[0]), m.dx));
      const dy = Math.max(-LIM - Math.min(s.p1[1], s.p2[1]), Math.min(LIM - Math.max(s.p1[1], s.p2[1]), m.dy));
      next.p1 = [s.p1[0] + dx, s.p1[1] + dy];
      next.p2 = [s.p2[0] + dx, s.p2[1] + dy];
    } else if (m.type === "normalize" || m.type === "levels") {
      next[m.type] = !!m.value;
    } else if (m.type === "digits") {
      const d = Math.trunc(Number(m.value));
      if (!Number.isFinite(d) || d < MIN_DIGITS || d > MAX_DIGITS) return null;
      next.digits = d;
    } else if (m.type === "reset") {
      return { ...start({ digits: s.digits }), explored: false };
    } else return null;
    return next;
  }

  const result = (s) => (s.explored ? "done" : null);
  const legalMoves = () => [{ type: "p1" }, { type: "p2" }, { type: "p" }, { type: "shift" }, { type: "normalize" }, { type: "levels" }, { type: "digits" }, { type: "reset" }];

  /** The equation as the applet writes it, rounded to `digits` places. */
  function equationText(s) {
    const m = measure(s);
    const f = (v) => String(cut(v, s.digits));
    const sign = (v) => (v < 0 ? " − " + f(-v) : " + " + f(v));
    return `${f(m.A)}x${sign(m.B)}y${sign(m.C)} = 0`;
  }

  return { LIM, MIN_DIGITS, MAX_DIGITS, start, equation, measure, nearestPoint, move, result, legalMoves, equationText, cut };
})();
