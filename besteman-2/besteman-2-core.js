"use strict";

/*
 * Besteman 2 — the second construction in Bogomolny's "Dividing a Segment
 * into N parts". A, B and C lie on one horizontal line with AB = d and
 * AC = (N-1)d. The two circles have centres A and C and radii d and (N-1)d;
 * their intersection D below the line gives AD = d and CD = (N-1)d. The
 * internal bisector of angle D meets AC at P, and by the angle-bisector
 * theorem AP/PC = AD/CD = 1/(N-1), so AP = AC/N: the dots A + k·AP divide
 * AC into N equal parts. This is the page's claim (1) AP/PC = AD/CD with the
 * special case CD = m·AD, hence AP = AC/(m+1); here m = N-1.
 *
 * The first Besteman construction (the sibling applet/page) is different: it
 * uses a perpendicular chord DE and similar right triangles to get
 * AP = AB²/(2AC), and arrives at AP = AB/N by taking AC = N·(AB/2). This
 * second construction uses the angle bisector instead, and divides the whole
 * segment AC, not the original AB.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, Besteman2Core, so the page loads it with a plain
 * <script> and porting/check-besteman-2.mjs loads it in Node. Functions take
 * plain data and return new objects; nothing passed in is changed.
 */
const Besteman2Core = (() => {
  const MIN_N = 2;   // PVNumeric.setMinValue(2) in Besteman2Panel
  const MAX_N = 20;  // PVNumeric.setMaxValue(20) in Besteman2Panel
  const EPS = 1e-9;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clampN = (n) => {
    const v = Math.trunc(Number(n));
    return Number.isFinite(v) ? Math.max(MIN_N, Math.min(MAX_N, v)) : 3;
  };

  /** The starting diagram, placed as Besteman2Canvas.init places it. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 250 : o.height;
    const step = Math.min(width, height) / 5;
    const A = o.A ? { ...o.A } : { x: (width - 4 * step) / 2, y: height / 2 - 10 };
    const B = o.B ? { ...o.B } : { x: A.x + step, y: A.y };
    return {
      A, B, width, height,
      N: o.N === undefined ? 3 : clampN(o.N),
      showNames: o.showNames !== false, // applet parameter "show" defaults to "1"
      showHint: o.showHint === true,
    };
  }

  /**
   * Move a handle. mouseDragged/mouseReleased keep A and B at the same y:
   * dragging A vertically moves B with it, and dragging B moves A with it.
   */
  function withPoint(s, name, p) {
    const q = { x: p.x, y: p.y };
    if (name === "A") return { ...s, A: q, B: { x: s.B.x, y: q.y } };
    if (name === "B") return { ...s, B: q, A: { x: s.A.x, y: q.y } };
    return s;
  }

  /** The N spin/edit: an integer clamped to the applet's 2..20 range. */
  function setN(s, n) {
    const v = clampN(n);
    return v === s.N ? s : { ...s, N: v };
  }

  function angleAt(v, p, q) {
    const u = { x: p.x - v.x, y: p.y - v.y };
    const w = { x: q.x - v.x, y: q.y - v.y };
    const cos = (u.x * w.x + u.y * w.y) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y));
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  /** Everything the page draws: circles, D, P and the N division dots. */
  function construction(s) {
    const A = s.A, B = s.B, N = s.N;
    const AB = distance(A, B);
    if (AB < EPS) return null; // the two circles would coincide

    // C = A + (i+1)(B-A) for i = 0..N-2 in DrawConstruction, so i ends at N-2.
    const C = { x: A.x + (B.x - A.x) * (N - 1), y: A.y };
    const rA = AB, rC = (N - 1) * AB;
    const AC = distance(A, C), AD = AB, CD = (N - 1) * AB;

    // GeoSDoub.Intersect(circle A, circle C)[1]: the lower of the two
    // intersections. The radical line is x = A + (B-A)/(2(N-1)).
    const dx = (B.x - A.x) / (2 * (N - 1));
    const height = Math.sqrt(Math.max(0, rA * rA - dx * dx));
    const D = { x: A.x + dx, y: A.y - height };

    // The bisector theorem gives AP/AC = AD/(AD+CD) = 1/N.
    const P = { x: A.x + (B.x - A.x) * (N - 1) / N, y: A.y };
    const AP = distance(A, P), PC = distance(P, C);
    const marks = [];
    for (let k = 0; k < N; k++) {
      marks.push({ x: A.x + (P.x - A.x) * k, y: A.y });
    }

    return {
      A, B, C, D, P, marks,
      rA, rC, AB, AC, AD, CD, AP, PC,
      ratioAP_PC: AP / PC,
      ratioAD_CD: AD / CD,
      halfA: angleAt(D, A, P),
      halfC: angleAt(D, P, C),
      step: AP,
    };
  }

  /** The page's second theorem: CD = m·AD implies AP = AC/(m+1). */
  function secondClaim(m, ac) {
    return ac / (m + 1);
  }

  /** The first Besteman construction's different theorem: AP = AB/N. */
  function firstClaim(n, ab) {
    return ab / n;
  }

  /** The page's claims, checked on the current diagram. */
  function claims(s) {
    const c = construction(s);
    if (!c) {
      return { nonDegenerate: false, bisectorRatio: false, pageSecond: false,
        equalParts: false, equalAngles: false, firstContrast: false };
    }
    const tol = 1e-7 * Math.max(1, c.AC);
    // DrawConstruction draws marks at A + k·AP for k = 0..N-1; C is the
    // next (undrawn) mark, so the last mark is one step short of C.
    const equalParts = c.marks.length === s.N &&
      Math.abs(distance(c.marks[s.N - 1], c.C) - c.step) < tol &&
      c.marks.slice(1).every((q, i) => Math.abs(distance(q, c.marks[i]) - c.step) < tol);
    return {
      nonDegenerate: true,
      bisectorRatio: Math.abs(c.ratioAP_PC - c.ratioAD_CD) < 1e-12,
      pageSecond: Math.abs(c.AP - secondClaim(s.N - 1, c.AC)) < tol,
      equalParts,
      equalAngles: Math.abs(c.halfA - c.halfC) < 1e-9,
      firstContrast: Math.abs(firstClaim(s.N, c.AB) - c.AB * c.AB / (2 * (s.N * c.AB / 2))) < 1e-9,
    };
  }

  /** This illustration has no win or loss, like the original droodle. */
  function result() {
    return null;
  }

  return { MIN_N, MAX_N, start, withPoint, setN, construction, secondClaim,
    firstClaim, claims, result, distance };
})();
