"use strict";

/*
 * Every Trapezoid Is Para, from Alexander Bogomolny's applet EveryTrapezoidIsPara.
 *
 * The applet draws a trapezoid ABCD with AD parallel to BC, then extends BC
 * to E with CE = AD and AD to F with FA = BC. It finds G = AC ∩ BD and
 * H = AC ∩ EF. The page shows a "proof" that |AD| = |BC| which would make
 * every trapezoid a parallelogram; its mistake is dividing by z - x, which
 * is zero. The true conclusion is x = z (AG = CH), whatever the base lengths.
 *
 * This core transcribes the applet's Compute() arithmetic: E and F from the
 * corner coordinates, G and H from GeoSDoub.Intersect's cross-product formula
 * with its |determinant| < 1 guard, and the two length guards of 2 units.
 * Dragging keeps the two horizontal sides in the pictured order (the applet's
 * UpgradePoints copies y between the paired corners). No document, no window,
 * no storage: one global, EveryTrapezoidIsParaCore, holding plain data.
 */
const EveryTrapezoidIsParaCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 250;
  const MARGIN = 14;
  const MIN_SIDE = 24; // keep both bases and the height non-degenerate

  const copy = (p) => ({ x: p.x, y: p.y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampToBoard = (p) => ({
    x: clamp(p.x, MARGIN, WIDTH - MARGIN),
    y: clamp(p.y, MARGIN, HEIGHT - MARGIN),
  });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /* GeoSDoub.Intersect(p1,p2,p3,p4): the applet's own determinant and its
     NaN guard, transcribed from its bytecode. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / d, y: (c1 * a2 - c2 * a1) / d };
  }

  /* The applet's init(), with its own "(400 seems optimal)" canvas size. */
  function start(options) {
    const o = options || {};
    const w = WIDTH / 2 - 20;
    const h = HEIGHT / 2 - 20;
    const dx = WIDTH / 6;
    const dy = HEIGHT / 8;
    return {
      A: { x: w - dx / 2, y: h - dy },
      B: { x: w - dx, y: h + dy },
      C: { x: w + dx, y: h + dy },
      D: { x: w + dx / 3, y: h - dy },
      showNames: o.showNames === undefined ? true : !!o.showNames,
      showStatement: !!o.showStatement,
      showPremise: !!o.showPremise,
      showHint: !!o.showHint,
      explored: false,
    };
  }

  /* A fresh trapezoid with unequal bases, so the apparent paradox shows. */
  function randomize(s) {
    const top = 40 + Math.random() * 45;
    const bottom = 155 + Math.random() * 40;
    const a = 45 + Math.random() * 60;
    const b = Math.max(a + 20, 95 + Math.random() * 55);
    const ax = MARGIN + Math.random() * (WIDTH - 2 * MARGIN - b - a);
    const bx = clamp(ax + (Math.random() - 0.5) * 40, MARGIN, WIDTH - MARGIN - b);
    return {
      A: { x: ax, y: top }, B: { x: bx, y: bottom },
      C: { x: bx + b, y: bottom }, D: { x: ax + a, y: top },
      showNames: s.showNames, showStatement: s.showStatement,
      showPremise: s.showPremise, showHint: s.showHint,
      explored: true,
    };
  }

  function reset(s) {
    const fresh = start({
      showNames: s.showNames, showStatement: s.showStatement,
      showPremise: s.showPremise, showHint: s.showHint,
    });
    return fresh;
  }

  /* One corner dragged to p. The applet's UpgradePoints makes the partner at
     the other end of a horizontal side share the new y. The clamp keeps the
     two bases ordered and nonzero and all four corners on the board, so the
     intersections stay defined and the drawing still shows the page's puzzle. */
  function movePoint(s, name, p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return s;
    if (!["A", "B", "C", "D"].includes(name)) return s;
    const q = clampToBoard(p);
    const A = copy(s.A), B = copy(s.B), C = copy(s.C), D = copy(s.D);
    if (name === "A") {
      A.x = clamp(q.x, MARGIN, D.x - MIN_SIDE);
      A.y = clamp(q.y, MARGIN, B.y - MIN_SIDE);
      D.y = A.y;
    } else if (name === "D") {
      D.x = clamp(q.x, A.x + MIN_SIDE, WIDTH - MARGIN);
      D.y = clamp(q.y, MARGIN, B.y - MIN_SIDE);
      A.y = D.y;
    } else if (name === "B") {
      B.x = clamp(q.x, MARGIN, C.x - MIN_SIDE);
      B.y = clamp(q.y, A.y + MIN_SIDE, HEIGHT - MARGIN);
      C.y = B.y;
    } else {
      C.x = clamp(q.x, B.x + MIN_SIDE, WIDTH - MARGIN);
      C.y = clamp(q.y, A.y + MIN_SIDE, HEIGHT - MARGIN);
      B.y = C.y;
    }
    const pts = [A, B, C, D];
    if (pts.some((v) => v.x < MARGIN - 1e-9 || v.x > WIDTH - MARGIN + 1e-9 ||
                   v.y < MARGIN - 1e-9 || v.y > HEIGHT - MARGIN + 1e-9)) return s;
    return Object.assign({}, s, { A, B, C, D, explored: true });
  }

  const OPTION_KEYS = ["showNames", "showStatement", "showPremise", "showHint"];
  function setOption(s, key, value) {
    if (!OPTION_KEYS.includes(key)) return s;
    return Object.assign({}, s, { [key]: !!value, explored: true });
  }

  /* Everything the applet's Compute() and Draw() derive from the four corners.
     a and b are the base lengths AD and BC; x, y, z are the page's AG, GH, CH.
     `signedY` puts GH back in order along AC (negative when AD is the longer
     base), which is the sense the page's formulas (1) and (2) need. */
  function compute(s) {
    const A = s.A, B = s.B, C = s.C, D = s.D;
    const out = { A, B, C, D, valid: false };
    if (dist(A, D) < 2 || dist(A, B) < 2) return out; // applet's guard

    const E = { x: C.x + D.x - A.x, y: C.y };
    const F = { x: A.x + B.x - C.x, y: A.y };
    const G = intersect(A, C, B, D);
    const H = intersect(A, C, E, F);
    const a = D.x - A.x;
    const b = C.x - B.x;
    const AC = dist(A, C);
    const BF = dist(B, F);
    const tG = a / (a + b);
    const tH = b / (a + b);
    const finite = [E, F, G, H, a, b, AC, tG, tH].every((v) =>
      typeof v === "number" ? Number.isFinite(v) : Number.isFinite(v.x) && Number.isFinite(v.y));
    if (!finite) return Object.assign(out, { E, F, G, H, a, b, AC, BF });

    const x = dist(A, G);
    const y = dist(G, H);
    const z = dist(C, H);
    const signedY = (tH - tG) * AC;
    const f = (w) => w * w + w * y;
    return Object.assign(out, {
      valid: true, E, F, G, H, a, b, AC, BF, tG, tH,
      x, y, z, signedY,
      // AFBC and ACED are parallelograms: opposite vertices sum alike.
      paraAFBC: [A.x + B.x - F.x - C.x, A.y + B.y - F.y - C.y],
      paraACED: [A.x + E.x - C.x - D.x, A.y + E.y - C.y - D.y],
      ratioCGAG: dist(C, G) / x,
      ratioAHCH: dist(A, H) / z,
      predictedX: BF * a / (a + b),
      predictedZ: BF * a / (a + b),
      eq1: (a / b) * (y + z),
      eq2: (a / b) * (x + y),
      eq1Signed: (a / b) * (signedY + z),
      eq2Signed: (a / b) * (x + signedY),
      fX: f(x), fZ: f(z),
      pictured: b >= a,
      parallelogram: Math.abs(a - b) < 1e-9,
    });
  }

  /* The status line: an illustration has no winner, but it can say what the
     picture shows. `result` is always null (there is no win or loss here). */
  function describe(s) {
    const g = compute(s);
    if (!g.valid) return "Drag the corners farther apart to see the construction.";
    const r = (v) => Math.round(v);
    const same = Math.abs(g.x - g.z) < 1e-6;
    const ends = g.parallelogram
      ? "The bases are equal, so this one is a parallelogram."
      : `The bases are different (${r(g.a)} and ${r(g.b)}), yet AG and CH still match.`;
    return `AG = CH = ${r(g.x)} (${r(g.tG * 100)}% of AC). ${ends}${same ? "" : " Move a corner again."}`;
  }

  function result() {
    return null;
  }

  return {
    WIDTH, HEIGHT, MARGIN, MIN_SIDE, OPTION_KEYS,
    clamp, clampToBoard, copy, dist, intersect,
    start, randomize, reset, movePoint, setOption,
    compute, describe, result,
  };
})();
