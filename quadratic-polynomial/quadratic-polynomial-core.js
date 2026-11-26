"use strict";

/*
 * Graph and roots of a quadratic polynomial, from Alexander Bogomolny's
 * applet QuadraticPolynomial.
 *
 * P(x) = a x^2 + b x + c, coefficients stored low to high as [c, b, a], each
 * from a slider from -10 to 10 in steps of 0.01; the applet starts with a = 1
 * and b, c random in [-5, 6). The roots come from the quadratic formula
 *
 *     x = (-b +/- sqrt(D)) / 2a,   D = b^2 - 4ac,
 *
 * two real ones when D > 0, one double root when D = 0, and a complex
 * conjugate pair re +/- im i when D < 0, which the applet draws as the points
 * (re, im) and (re, -im). Either way a dashed line marks x = -b/2a, the axis
 * of the parabola. With a = 0 the applet shows the single root -c/b (none if
 * b = 0 too).
 *
 * The position is plain data: { c: [c, b, a] }.
 */
const QuadraticPolynomialCore = (() => {
  const MIN_C = -10, MAX_C = 10, STEP = 0.01;

  /** A slider value: the applet's (int)(v * 100) / 100, kept in range. */
  const toSlider = (v) => Math.max(MIN_C, Math.min(MAX_C, Math.trunc(Math.round(v * 1e6) / 1e4) / 100));

  function start(options) {
    const o = options || {};
    const random = o.random || Math.random;
    const c = Array.isArray(o.c) && o.c.length === 3 && o.c.every((v) => Number.isFinite(Number(v)))
      ? o.c.map((v) => toSlider(Number(v)))
      : [0, 1].map(() => toSlider(random() * 11 - 5)).concat([1]);
    return { c };
  }

  const value = (c, x) => c.reduceRight((acc, k) => acc * x + k, 0);
  const discriminant = (s) => s.c[1] * s.c[1] - 4 * s.c[2] * s.c[0];

  /**
   * The roots: { kind: "real" | "double" | "complex" | "linear" | "none",
   * points: [{x, y}] as the applet plots them, axis: x of the dashed line or null }.
   */
  function roots(s) {
    const [c, b, a] = s.c;
    if (a === 0) {
      if (b === 0) return { kind: "none", points: [], axis: null };
      return { kind: "linear", points: [{ x: -c / b, y: 0 }], axis: null };
    }
    const D = discriminant(s), axis = -b / (2 * a);
    if (D > 0) {
      const r = Math.sqrt(D) / (2 * a);
      return { kind: "real", points: [{ x: axis - r, y: 0 }, { x: axis + r, y: 0 }].sort((p, q) => p.x - q.x), axis };
    }
    if (D === 0) return { kind: "double", points: [{ x: axis, y: 0 }, { x: axis, y: 0 }], axis };
    const im = Math.sqrt(-D) / Math.abs(2 * a);
    return { kind: "complex", points: [{ x: axis, y: im }, { x: axis, y: -im }], axis };
  }

  /** The vertex of the parabola, or null with a = 0. */
  function vertex(s) {
    const [c, b, a] = s.c;
    if (a === 0) return null;
    const x = -b / (2 * a);
    return { x, y: value(s.c, x) };
  }

  /** Moves: { type: "coef", index (0 = c, 1 = b, 2 = a), value }. */
  function move(s, m) {
    if (!m || m.type !== "coef" || !(m.index >= 0 && m.index <= 2) || !Number.isFinite(Number(m.value))) return null;
    const c = s.c.slice();
    c[m.index] = toSlider(Number(m.value));
    return { ...s, c };
  }

  function formula(s) {
    const sup = ["", "", "²"];
    const parts = [];
    for (let k = 2; k >= 0; k--) {
      const v = s.c[k];
      if (v === 0) continue;
      const mag = Math.abs(v), sign = v < 0 ? "−" : "+";
      const num = k > 0 && mag === 1 ? "" : mag.toFixed(2).replace(/\.?0+$/, "");
      parts.push({ sign, text: `${num}${k > 0 ? "x" + sup[k] : ""}` });
    }
    if (!parts.length) return "P(x) = 0";
    return "P(x) = " + parts.map((p, i) => (i === 0 ? (p.sign === "−" ? "−" : "") + p.text : ` ${p.sign} ${p.text}`)).join("");
  }

  return { MIN_C, MAX_C, STEP, start, value, discriminant, roots, vertex, move, formula, toSlider };
})();
