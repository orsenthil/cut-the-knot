"use strict";

/*
 * Barycentric — the illustration behind Bogomolny's "Barycentric Coordinates: A Tool".
 *
 * Drag the triangle's corners A, B, C and the point P. The three cevians AP,
 * BP, CP cut the far sides at A', B', C'. The three numbers beside P are its
 * barycentric coordinates: weights at A, B, C whose balance point is P. The
 * same three numbers, read in pairs, give the pieces into which the cevians
 * cut each side.
 *
 * The one idea the code relies on is taken straight from the applet's
 * Compute() method: A' is the intersection of line AP with BC, and
 *   aa = |P A'| / |A A'|
 * is P's first (normalized) coordinate, made negative when A' lies between A
 * and P. Likewise for B' and C'. This is exactly (α, β, γ)/(α+β+γ) from the
 * article, so the three numbers always add to 1.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BarycentricCore, so the page loads it with a plain
 * <script> and porting/check-barycentric.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const BarycentricCore = (() => {
  const EPS = 1e-9;
  const NEAR = 2;            // applet: a point within 2 units of a vertex is that vertex
  const DIGITS_MIN = 1;      // PVNumeric.setMinValue(1)
  const DIGITS_MAX = 15;     // PVNumeric.setMaxValue(15.0)
  const MODES = ["inherited", "addTo1", "routh"]; // INHERITED=0, ADD_TO_1=1, ROUTH=2
  const DEFAULT_OPTIONS = {
    showNames: false, showBary: false, showCeva: false,
    mode: "inherited", digits: 2,
  };

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const copy = (p) => ({ x: p.x, y: p.y });

  /** InsideTest.IsInside(q, a, b): (q-a)·(q-b) <= 0, a betweenness test on a line. */
  const inside = (q, a, b) =>
    (q.x - a.x) * (q.x - b.x) + (q.y - a.y) * (q.y - b.y) <= 0;

  /**
   * GeoSDoub.Intersect(p1,p2,p3,p4), transcribed literally from the bytecode.
   * The applet returns a point with NaN coordinates when |denominator| < 1;
   * null here means the same "no usable intersection".
   */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const numX = b1 * c2 - b2 * c1;
    const numY = c1 * a2 - c2 * a1;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1 || !Number.isFinite(den)) return null;
    return { x: numX / den, y: numY / den };
  }

  /** Normalize the panel's checkboxes, mode and significant-digit spinner. */
  function options(o) {
    const src = o || {};
    let digits = Math.round(Number(src.digits === undefined ? DEFAULT_OPTIONS.digits : src.digits));
    if (!Number.isFinite(digits)) digits = DEFAULT_OPTIONS.digits;
    return {
      showNames: Boolean(src.showNames),
      showBary: Boolean(src.showBary),
      showCeva: Boolean(src.showCeva),
      mode: MODES.indexOf(src.mode) >= 0 ? src.mode : DEFAULT_OPTIONS.mode,
      digits: Math.max(DIGITS_MIN, Math.min(DIGITS_MAX, digits)),
    };
  }

  /** The starting triangle, placed just as BarycentricCanvas.init places it. */
  function start(o) {
    const src = o || {};
    if (src.points) {
      return {
        A: copy(src.points.A), B: copy(src.points.B),
        C: copy(src.points.C), P: copy(src.points.P),
      };
    }
    const w = src.width === undefined ? 400 : src.width;
    const h = src.height === undefined ? 300 : src.height;
    const cx = w / 2, cy = h / 2, r = w / 4;
    const A = { x: w / 4, y: cy + cy / 3 };
    const B = { x: cx + r, y: A.y };
    const C = { x: cx + r * Math.cos(Math.PI / 3), y: cy - r * Math.sin(Math.PI / 3) };
    return {
      A, B, C,
      P: { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 },
    };
  }

  /** A new position with one named point moved. */
  function withPoint(pos, name, p) {
    const next = { A: copy(pos.A), B: copy(pos.B), C: copy(pos.C), P: copy(pos.P) };
    if (!next[name]) return next;
    next[name] = copy(p);
    return next;
  }

  /**
   * The applet's Compute(). Returns the normalized coordinates and the three
   * feet. Near a vertex the applet short-circuits to (1,0,0) etc. and leaves
   * the feet null; a degenerate or parallel configuration does the same here.
   */
  function compute(pos) {
    const { A, B, C, P } = pos;
    const blank = { coords: { aa: 1, bb: 0, cc: 0 }, feet: { Ap: null, Bp: null, Cp: null }, vertex: "A" };
    if (distance(P, A) < NEAR) return blank;
    if (distance(P, B) < NEAR) {
      return { coords: { aa: 0, bb: 1, cc: 0 }, feet: { Ap: null, Bp: null, Cp: null }, vertex: "B" };
    }
    if (distance(P, C) < NEAR) {
      return { coords: { aa: 0, bb: 0, cc: 1 }, feet: { Ap: null, Bp: null, Cp: null }, vertex: "C" };
    }
    const Ap = intersect(A, P, B, C);
    const Bp = intersect(B, P, C, A);
    const Cp = intersect(C, P, A, B);
    const feet = { Ap, Bp, Cp };
    if (!Ap || !Bp || !Cp) return { coords: { aa: NaN, bb: NaN, cc: NaN }, feet, vertex: null };
    const dAAp = distance(A, Ap), dBBp = distance(B, Bp), dCCp = distance(C, Cp);
    if (dAAp < EPS || dBBp < EPS || dCCp < EPS) {
      return { coords: { aa: NaN, bb: NaN, cc: NaN }, feet, vertex: null };
    }
    let aa = distance(P, Ap) / dAAp;
    let bb = distance(P, Bp) / dBBp;
    let cc = distance(P, Cp) / dCCp;
    if (inside(Ap, A, P)) aa = -aa;
    if (inside(Bp, B, P)) bb = -bb;
    if (inside(Cp, C, P)) cc = -cc;
    return { coords: { aa, bb, cc }, feet, vertex: null };
  }

  /** Where a point on line a-b sits, as a signed fraction t of the way from a to b. */
  function sideParam(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return NaN;
    return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  }

  /**
   * The three side ratios of the article, signed like the coordinates:
   * BA'/A'C = γ/β, CB'/B'A = α/γ, AC'/C'B = β/α. They are computed from
   * the feet, so they stay meaningful when P is outside the triangle.
   */
  function sideRatios(pos, calc) {
    const { aa, bb, cc } = calc.coords;
    if (!calc.feet.Ap || !calc.feet.Bp || !calc.feet.Cp || !Number.isFinite(aa + bb + cc)) return null;
    const tAp = sideParam(calc.feet.Ap, pos.B, pos.C);
    const tBp = sideParam(calc.feet.Bp, pos.C, pos.A);
    const tCp = sideParam(calc.feet.Cp, pos.A, pos.B);
    const BA_ApC = tAp / (1 - tAp);
    const CB_BpA = tBp / (1 - tBp);
    const AC_CpB = tCp / (1 - tCp);
    return { BA_ApC, CB_BpA, AC_CpB, product: BA_ApC * CB_BpA * AC_CpB };
  }

  /** Java NumberFormat with maximumFractionDigits(N) and no minimum fraction digits. */
  function format(value, digits) {
    if (!Number.isFinite(value)) return String(value);
    const d = Math.max(DIGITS_MIN, Math.min(DIGITS_MAX, Math.round(Number(digits)) || DIGITS_MIN));
    let s = value.toFixed(d);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s === "-0" ? "0" : s;
  }

  /**
   * The side-partition labels, exactly as Draw() places them for each mode.
   * Each side gives a start/end foot pair: the first value is drawn at the
   * midpoint of (start, foot), the second at the midpoint of (foot, end).
   */
  function partitionLabels(calc, modeName) {
    const { aa, bb, cc } = calc.coords;
    if (!calc.feet.Ap || !calc.feet.Bp || !calc.feet.Cp) return null;
    const { Ap, Bp, Cp } = calc.feet;
    const mode = MODES.indexOf(modeName) >= 0 ? modeName : "inherited";
    let sides;
    if (mode === "addTo1") {
      sides = [
        { side: "BC", start: "C", end: "B", foot: Ap, values: [cc / (1 - aa), 1 - cc / (1 - aa)] },
        { side: "CA", start: "A", end: "C", foot: Bp, values: [aa / (1 - bb), 1 - aa / (1 - bb)] },
        { side: "AB", start: "B", end: "A", foot: Cp, values: [bb / (1 - cc), 1 - bb / (1 - cc)] },
      ];
    } else if (mode === "routh") {
      sides = [
        { side: "BC", start: "B", end: "C", foot: Ap, values: [bb / cc, 1] },
        { side: "CA", start: "C", end: "A", foot: Bp, values: [cc / aa, 1] },
        { side: "AB", start: "A", end: "B", foot: Cp, values: [aa / bb, 1] },
      ];
    } else {
      sides = [
        { side: "BC", start: "B", end: "C", foot: Ap, values: [bb, cc] },
        { side: "CA", start: "C", end: "A", foot: Bp, values: [cc, aa] },
        { side: "AB", start: "A", end: "B", foot: Cp, values: [aa, bb] },
      ];
    }
    return sides;
  }

  /** The text the applet draws when "barycentrics" is checked. */
  function baryText(calc, opts) {
    const { aa, bb, cc } = calc.coords;
    const o = options(opts);
    return (o.showNames ? "P = " : "") +
      "(" + format(aa, o.digits) + "," + format(bb, o.digits) + "," + format(cc, o.digits) + ")";
  }

  /** What the panel switches make visible, plus the text of every label. */
  function display(pos, calc, opts) {
    const o = options(opts);
    const labels = o.showCeva ? partitionLabels(calc, o.mode) : null;
    return {
      options: o,
      showNames: o.showNames,
      showBary: o.showBary,
      showCeva: o.showCeva,
      baryText: o.showBary && Number.isFinite(calc.coords.aa) ? baryText(calc, o) : null,
      labels: labels && labels.every((s) => Number.isFinite(s.values[0] + s.values[1])) ? labels : null,
    };
  }

  /** The center of gravity of weights w at the three corners: article (1). */
  function balance(pos, w) {
    const sum = w[0] + w[1] + w[2];
    if (!Number.isFinite(sum) || Math.abs(sum) < EPS) return null;
    return {
      x: (w[0] * pos.A.x + w[1] * pos.B.x + w[2] * pos.C.x) / sum,
      y: (w[0] * pos.A.y + w[1] * pos.B.y + w[2] * pos.C.y) / sum,
    };
  }

  /**
   * The article's converse: from BA'/A'C = λ, CB'/B'A = μ, AC'/C'B = ν with
   * λμν = 1, three equivalent coordinate triples for the same point P.
   */
  function fromRatios(lambda, mu, nu) {
    const triples = [
      [lambda * mu, 1, lambda],
      [mu, mu * nu, 1],
      [1, nu, lambda * nu],
    ];
    return { ceva: lambda * mu * nu, triples };
  }

  /** Each claim of the article's equations (1)-(8), checked at this position. */
  function claims(pos, calc) {
    const bad = {
      weightedAverage: false, addTo1: false, feetOnSides: false, concurrent: false,
      footIsBarycenter: false, sideRatios: false, ceva: false, converse: false,
    };
    if (!calc.feet.Ap || !calc.feet.Bp || !calc.feet.Cp) return bad;
    if (!Number.isFinite(calc.coords.aa + calc.coords.bb + calc.coords.cc)) return bad;
    const { aa, bb, cc } = calc.coords;
    const tol = 1e-7 * Math.max(
      distance(pos.A, pos.B), distance(pos.B, pos.C), distance(pos.C, pos.A), 1);
    const near = (p, q) => p && Math.hypot(p.x - q.x, p.y - q.y) < tol;
    const onLine = (p, a, b) => Math.abs(cross(a, b, p)) < tol;
    const between = (p, a, b) => {
      const t = sideParam(p, a, b);
      return Number.isFinite(t) && t > -1e-9 && t < 1 + 1e-9;
    };
    const { Ap, Bp, Cp } = calc.feet;
    const r = sideRatios(pos, calc);
    const converse = fromRatios(cc / bb, aa / cc, bb / aa);
    return {
      weightedAverage: near(balance(pos, [aa, bb, cc]), pos.P),
      addTo1: Math.abs(aa + bb + cc - 1) < 1e-9,
      feetOnSides:
        onLine(Ap, pos.B, pos.C) && between(Ap, pos.B, pos.C) &&
        onLine(Bp, pos.C, pos.A) && between(Bp, pos.C, pos.A) &&
        onLine(Cp, pos.A, pos.B) && between(Cp, pos.A, pos.B),
      concurrent:
        onLine(pos.P, pos.A, Ap) && onLine(pos.P, pos.B, Bp) && onLine(pos.P, pos.C, Cp),
      footIsBarycenter:
        near(balance(pos, [0, bb, cc]), Ap) &&
        near(balance(pos, [aa, 0, cc]), Bp) &&
        near(balance(pos, [aa, bb, 0]), Cp),
      sideRatios: Boolean(r) &&
        Math.abs(r.BA_ApC - cc / bb) < 1e-8 &&
        Math.abs(r.CB_BpA - aa / cc) < 1e-8 &&
        Math.abs(r.AC_CpB - bb / aa) < 1e-8,
      ceva: Boolean(r) && Math.abs(r.product - 1) < 1e-8,
      converse: Math.abs(converse.ceva - 1) < 1e-8 && converse.triples.every((t) =>
        near(balance(pos, t), pos.P)),
    };
  }

  /** An illustration has no winner and no loser. */
  function result(/* state */) {
    return null;
  }

  return {
    MODES, DIGITS_MIN, DIGITS_MAX, NEAR,
    options, start, withPoint, compute, sideParam,
    sideRatios, ratios: sideRatios, partitionLabels, format, baryText, display,
    balance, fromRatios, claims,
    distance, dot, cross, intersect, inside, result,
  };
})();
