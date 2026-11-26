"use strict";

/*
 * Graph and roots of a third degree polynomial, from Alexander Bogomolny's
 * applet PolynomialDegree3.
 *
 * P(x) = a x^3 + b x^2 + c x + d, coefficients stored low to high as
 * [d, c, b, a]. Each comes from a slider from -20 to 20 in steps of 0.01; the
 * applet starts with a = 1 and b, c, d random in [-5, 6).
 *
 * The roots are found the applet's way. FindOneRoot walks from x = 0 in steps
 * of 1 towards the side where P changes sign (P(x) * a > 0 means step left),
 * until the sign flips, and then halves the bracket until |P| < 0.001. Horner's
 * division by (x - r) leaves a quadratic whose two roots are either real or a
 * complex conjugate pair re +/- im i; the applet draws the pair as the points
 * (re, im) and (re, -im). With a = 0 there is no third degree polynomial and
 * no roots are shown.
 *
 * A cubic is symmetric about its inflection point x0 = -b / (3a). Taking away
 * the tangent there leaves a (x - x0)^3, three equal roots: a click on the
 * inflection point shows the tangent and that difference.
 *
 * The position is plain data: { c: [d, c, b, a], tangent }.
 */
const PolynomialDegree3Core = (() => {
  const MIN_C = -20, MAX_C = 20, STEP = 0.01, EPS = 0.001;

  /** Truncate to a slider value: the applet's (int)(v * 100) / 100. */
  const toSlider = (v) => Math.max(MIN_C, Math.min(MAX_C, Math.trunc(Math.round(v * 1e6) / 1e4) / 100));

  function start(options) {
    const o = options || {};
    const random = o.random || Math.random;
    const c = Array.isArray(o.c) && o.c.length === 4 && o.c.every((v) => Number.isFinite(Number(v)))
      ? o.c.map((v) => toSlider(Number(v)))
      : [0, 1, 2].map(() => toSlider(random() * 11 - 5)).concat([1]);
    return { c, tangent: !!o.tangent };
  }

  /** Horner: c[n] x^n + ... + c[0]. */
  const value = (c, x) => c.reduceRight((acc, k) => acc * x + k, 0);
  const derivative = (c) => c.slice(1).map((k, i) => (i + 1) * k);

  /** The applet's RootByHalves. */
  function rootByHalves(c, lo, hi, eps) {
    let flo = value(c, lo), mid = hi, fm = value(c, hi);
    while (Math.abs(fm) > eps) {
      mid = (lo + hi) / 2;
      fm = value(c, mid);
      if (Math.abs(fm) < eps) break;
      if (flo * fm > 0) { lo = mid; flo = fm; } else { hi = mid; }
    }
    return mid;
  }

  /** The applet's FindOneRoot: NaN when the leading coefficient is 0. */
  function findOneRoot(c, eps = EPS) {
    const lead = c[c.length - 1];
    if (lead === 0) return NaN;
    let x = 0, v = value(c, x);
    while (v === 0) { x += 1; v = value(c, x); }
    if (Math.abs(v) < eps) return x;
    const from = x;
    const step = v * lead > 0 ? -1 : 1;
    x += step;
    let w = value(c, x);
    while (w * v > 0) {
      x += step;
      w = value(c, x);
      if (Math.abs(w) < eps) return x;
    }
    return rootByHalves(c, x, from, eps);
  }

  /** Horner's division of the cubic by (x - r): the quadratic [q0, q1, q2]. */
  function divide(c, r) {
    const q2 = c[3], q1 = q2 * r + c[2], q0 = q1 * r + c[1];
    return [q0, q1, q2];
  }

  /**
   * All three roots: { real: r, others: [{re, im}, {re, im}] } (im = 0 for real
   * ones), or null with a = 0.
   */
  function roots(state) {
    const c = state.c;
    const r = findOneRoot(c);
    if (Number.isNaN(r)) return null;
    const [q0, q1, q2] = divide(c, r);
    const disc = q1 * q1 - 4 * q2 * q0;
    let others;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      others = [{ re: (-q1 - s) / (2 * q2), im: 0 }, { re: (-q1 + s) / (2 * q2), im: 0 }];
    } else {
      const re = -q1 / (2 * q2), im = Math.sqrt(-disc) / Math.abs(2 * q2);
      others = [{ re, im }, { re, im: -im }];
    }
    return { real: r, others, complex: disc < 0 };
  }

  /** The inflection point, the tangent there (y = slope x + intercept) and P minus the tangent. */
  function inflection(state) {
    const c = state.c;
    if (c[3] === 0) return null;
    const d2 = derivative(derivative(c));
    const x0 = -d2[0] / d2[1];
    const y0 = value(c, x0), slope = value(derivative(c), x0);
    const intercept = y0 - slope * x0;
    return { x: x0, y: y0, slope, intercept, difference: [c[0] - intercept, c[1] - slope, c[2], c[3]] };
  }

  /** Moves: { type: "coef", index, value }, { type: "tangent", value }. */
  function move(state, m) {
    if (!m) return null;
    if (m.type === "coef" && m.index >= 0 && m.index <= 3 && Number.isFinite(Number(m.value))) {
      const c = state.c.slice();
      c[m.index] = toSlider(Number(m.value));
      return { ...state, c };
    }
    if (m.type === "tangent") return { ...state, tangent: !!m.value };
    return null;
  }

  /** The formula as the applet writes it, with two decimals: "P(x) = x³ − 2.5x² + ...". */
  function formula(state) {
    const sup = ["", "", "²", "³"];
    const parts = [];
    for (let k = 3; k >= 0; k--) {
      const v = state.c[k];
      if (v === 0) continue;
      const mag = Math.abs(v), sign = v < 0 ? "−" : "+";
      const num = k > 0 && mag === 1 ? "" : mag.toFixed(2).replace(/\.?0+$/, "");
      parts.push({ sign, text: `${num}${k > 0 ? "x" + sup[k] : ""}` });
    }
    if (!parts.length) return "P(x) = 0";
    return "P(x) = " + parts.map((p, i) => (i === 0 ? (p.sign === "−" ? "−" : "") + p.text : ` ${p.sign} ${p.text}`)).join("");
  }

  return { MIN_C, MAX_C, STEP, EPS, start, value, derivative, findOneRoot, rootByHalves, divide, roots, inflection, move, formula, toSlider };
})();
