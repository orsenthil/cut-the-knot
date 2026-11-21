"use strict";

/*
 * Inflection points of fourth degree polynomials, from Alexander Bogomolny's applet FourthDegree
 * (after McMullin and Weeks).
 *
 * p(x) = m4 x^4 + m3 x^3 + m2 x^2 + m1 x + m0. When p has two inflection points a < b, the line L through
 * (a, p(a)) and (b, p(b)) (the "inflection line") meets the graph in two more points xL < a < b < xR, and
 *   (1) xL, xR = ((a + b) -/+ (b - a) sqrt 5) / 2, so (b - a) / (a - xL) is the golden ratio,
 *   (2) a + b = xL + xR (the midpoints of (a, b) and (xL, xR) coincide, so p - L is symmetric),
 *   (5) the three regions between the graph and the line have areas in the ratio 1 : 2 : 1.
 * The proof: p'' = 12 m4 (x - a)(x - b), p - L has the coefficients (*) of the page and the roots a, b, xL, xR.
 *
 * The applet: five sliders for the coefficients, a graph, the inflection line and the difference p - L, each
 * shown by a check box. The slider range is not in the bytecode I read: here -10 to 10 in steps of 0.1. The window is
 * -10 to 10 on both axes by default. The position is plain data.
 */
const FourthDegreeCore = (() => {
  const MIN_C = -10, MAX_C = 10, STEP = 0.1;
  const NAMES = ["m0", "m1", "m2", "m3", "m4"];

  /** A new position: p = x^4 - 6x^2 + x (inflection points -1 and 1). */
  function start(options) {
    const o = options || {};
    const c = Array.isArray(o.c) && o.c.length === 5 ? o.c.map((v) => clampC(Number(v))) : [0, 1, -6, 0, 1];
    return { c, showGraph: o.showGraph !== false, showLine: o.showLine !== false, showDiff: !!o.showDiff, moves: 0, explored: false };
  }
  const clampC = (v) => (Number.isFinite(v) ? Math.max(MIN_C, Math.min(MAX_C, Math.round(v / STEP) * STEP)) : 0);

  /** Evaluate a polynomial given its coefficients c[0..n]. */
  const evalPoly = (c, x) => c.reduceRight((acc, k) => acc * x + k, 0);

  /** The inflection points a < b of the quartic, or null (needs m4 != 0 and two real roots of p'' = 12 m4 x^2 + 6 m3 x + 2 m2). */
  function inflection(c) {
    const [, , m2, m3, m4] = c;
    if (m4 === 0) return null;
    const A = 12 * m4, B = 6 * m3, Cc = 2 * m2;
    const disc = B * B - 4 * A * Cc;
    if (disc <= 1e-12) return null;
    const r = Math.sqrt(disc);
    const x1 = (-B - r) / (2 * A), x2 = (-B + r) / (2 * A);
    return { a: Math.min(x1, x2), b: Math.max(x1, x2) };
  }

  /** The inflection line y = s x + t, and the difference polynomial p - L (coefficients c0..c4). */
  function line(c) {
    const f = inflection(c);
    if (!f) return null;
    const pa = evalPoly(c, f.a), pb = evalPoly(c, f.b);
    const s = (pb - pa) / (f.b - f.a), t = pa - s * f.a;
    return { ...f, s, t, diff: [c[0] - t, c[1] - s, c[2], c[3], c[4]] };
  }

  /** The other two intersections xL < a < b < xR, by the formula (1), and the golden-ratio fact. */
  function crossings(c) {
    const l = line(c);
    if (!l) return null;
    const { a, b } = l, m = (a + b) / 2, h = ((b - a) * Math.sqrt(5)) / 2;
    return { ...l, xL: m - h, xR: m + h, phi: (1 + Math.sqrt(5)) / 2 };
  }

  /** The areas of the three regions between the graph and the line: from xL to a, a to b, b to xR. */
  function areas(c) {
    const k = crossings(c);
    if (!k) return null;
    const d = k.diff;
    const anti = d.map((v, i) => v / (i + 1)); // coefficients of the antiderivative (without the constant)
    const F = (x) => anti.reduceRight((acc, v) => (acc + v) * x, 0);
    const area = (u, v) => Math.abs(F(v) - F(u));
    return { left: area(k.xL, k.a), middle: area(k.a, k.b), right: area(k.b, k.xR) };
  }

  /** Moves: {type:"coef", index, value}, {type:"show", which:"graph"|"line"|"diff", value}, {type:"reset"}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "coef") {
      if (!(m.index >= 0 && m.index <= 4) || !Number.isFinite(Number(m.value))) return null;
      const c = s.c.slice(); c[m.index] = clampC(Number(m.value));
      return { ...s, c, moves: s.moves + 1, explored: true };
    }
    if (m.type === "show") {
      const key = { graph: "showGraph", line: "showLine", diff: "showDiff" }[m.which];
      if (!key) return null;
      return { ...s, [key]: !!m.value };
    }
    if (m.type === "reset") return start({});
    return null;
  }

  const legalMoves = () => [0, 1, 2, 3, 4].map((index) => ({ type: "coef", index }));
  const result = (s) => (s.explored ? "done" : null);

  return { MIN_C, MAX_C, STEP, NAMES, start, evalPoly, inflection, line, crossings, areas, move, legalMoves, result };
})();
