"use strict";

/*
 * Area Of Parallelogram, from Alexander Bogomolny's applet AreaOfParallelogram.
 *
 * The applet keeps a parallelogram ABCD whose top side AD and bottom side BC
 * stay horizontal. It drops the perpendiculars from A and D onto the line BC
 * (feet F and G), colours the two right triangles ABF and DCG blue, and, when
 * a foot falls outside the base, colours the overlap triangles CFK and BLG
 * pink. Its own page claims that a parallelogram's area is one side times the
 * distance to its parallel mate, and proves it by moving the blue triangle
 * from one end of the parallelogram to the other to make a rectangle. This
 * core computes every one of those points and quantities: the feet and the
 * intersections with the applet's own 0.1 tolerance, the base, the height, the
 * shoelace area, the two congruent blue triangles and the three area
 * identities the page writes down. No document, no window, no storage: it
 * defines the global AreaOfParallelogramCore and nothing else.
 */
const AreaOfParallelogramCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const MARGIN = 14;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampToBoard = (p) => ({
    x: clamp(p.x, MARGIN, WIDTH - MARGIN),
    y: clamp(p.y, MARGIN, HEIGHT - MARGIN),
  });
  const copy = (p) => ({ x: p.x, y: p.y });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));

  /* Twice the signed area of triangle pqr, and half of it as a plain length. */
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const triangle = (p, q, r) => Math.abs(cross(p, q, r)) / 2;

  /* Signed shoelace area of a polygon. The sign matters for the page's
     Figure 2 identities, where a piece has to be subtracted. */
  function signed(pts) {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum / 2;
  }

  /* GeoSDoub.NearestPoint(p, a, b), from its bytecode: the foot of the
     perpendicular from p to line(a,b), with the applet's |p-a|^2 < 0.1 guard. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return copy(p);
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /* GeoSDoub.Intersect(p1,p2,p3,p4), from its bytecode: cross-product line
     intersection, returning NaN when the determinant is smaller than one. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / d, y: (c1 * a2 - c2 * a1) / d };
  }

  /* AreaOfParallelogramCanvas.Between(p1,p2,p3), from its bytecode: is p2
     between p1 and p3 in either order, allowing 0.1 units either way. */
  function between(p1, p2, p3) {
    const tol = 0.1;
    if (p1.x - tol > p2.x || p2.x - tol > p3.x) {
      if (p1.x < p2.x - tol || p2.x < p3.x - tol) return false;
    }
    if (p1.y - tol > p2.y || p2.y - tol > p3.y) {
      if (p1.y < p2.y - tol || p2.y < p3.y - tol) return false;
    }
    return true;
  }

  /** A clean Figure 1 start: base 160, height 160, feet one on each side. */
  function start(options) {
    const o = options || {};
    return {
      A: { x: 110, y: 70 }, B: { x: 70, y: 230 },
      C: { x: 230, y: 230 }, D: { x: 270, y: 70 },
      showCut: o.showCut === undefined ? true : !!o.showCut,
      showNames: !!o.showNames,
      explored: false,
    };
  }

  /* The applet's init() picks random positions, but always keeps the top and
     bottom sides horizontal. Offer that as a button; open on a fixed picture
     so the illustration and its screenshots are reproducible. */
  function randomize(s) {
    const L = 90 + Math.random() * 80;
    const maxX = WIDTH - 20 - L;
    const ax = 20 + Math.random() * (maxX - 20);
    const bx = 20 + Math.random() * (maxX - 20);
    const topY = 40 + Math.random() * 80;
    const botY = 185 + Math.random() * 65;
    return {
      A: { x: ax, y: topY }, B: { x: bx, y: botY },
      C: { x: bx + L, y: botY }, D: { x: ax + L, y: topY },
      showCut: s.showCut, showNames: s.showNames, explored: false,
    };
  }

  /** Restore the fixed starting picture, keeping the player's options. */
  function reset(s) {
    const fresh = start({ showCut: s.showCut, showNames: s.showNames });
    return fresh;
  }

  const MIN_SIDE = 24; // keep the base and the height from collapsing to zero

  /* One draggable corner moved. A and C are Fix(2) in the applet: only their
     x changes when dragged. Dragging A or B recomputes C = B + D - A; dragging
     C or D recomputes A = D + B - C (the applet's Redefine), so the diagonal
     midpoints stay together and the two horizontal sides stay horizontal.
     The dragged point is clamped so its dependent partner stays on the board
     and neither the base nor the height can shrink to nothing. */
  function movePoint(s, name, p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return s;
    if (!["A", "B", "C", "D"].includes(name)) return s;
    const q = clampToBoard(p);
    const A = s.A, B = s.B, C = s.C, D = s.D;
    let x = q.x, y = q.y, nA = A, nB = B, nC = C, nD = D;
    if (name === "A") {
      x = clamp(x, B.x + D.x - (WIDTH - MARGIN), B.x + D.x - MARGIN);
      x = D.x >= A.x ? Math.min(x, D.x - MIN_SIDE) : Math.max(x, D.x + MIN_SIDE);
      nA = { x, y: A.y };
      nC = { x: B.x + D.x - x, y: B.y + D.y - A.y };
    } else if (name === "B") {
      x = clamp(x, MARGIN + A.x - D.x, WIDTH - MARGIN + A.x - D.x);
      y = B.y >= D.y ? Math.max(y, D.y + MIN_SIDE) : Math.min(y, D.y - MIN_SIDE);
      nB = { x, y };
      nC = { x: x + D.x - A.x, y: y + D.y - A.y };
    } else if (name === "C") {
      x = clamp(x, D.x + B.x - (WIDTH - MARGIN), D.x + B.x - MARGIN);
      x = C.x >= B.x ? Math.max(x, B.x + MIN_SIDE) : Math.min(x, B.x - MIN_SIDE);
      nC = { x, y: C.y };
      nA = { x: D.x + B.x - x, y: D.y + B.y - C.y };
    } else {
      x = D.x >= A.x ? Math.max(x, A.x + MIN_SIDE) : Math.min(x, A.x - MIN_SIDE);
      y = D.y <= B.y ? Math.min(y, B.y - MIN_SIDE) : Math.max(y, B.y + MIN_SIDE);
      nD = { x, y };
      nA = { x: x + B.x - C.x, y: y + B.y - C.y };
      /* A may fall off the board when D slides; shift the whole top side. */
      if (nA.x < MARGIN || nA.x > WIDTH - MARGIN) {
        const shift = nA.x < MARGIN ? MARGIN - nA.x : WIDTH - MARGIN - nA.x;
        nA = { x: nA.x + shift, y: nA.y };
        nD = { x: nD.x + shift, y: nD.y };
      }
    }
    /* Refuse a drag that would leave the board or collapse the picture: a
       zero-length base would make the perpendicular foot undefined. */
    const pts = [nA, nB, nC, nD];
    if (Math.abs(nD.x - nA.x) < MIN_SIDE - 1e-9 ||
        Math.abs(nD.y - nB.y) < MIN_SIDE - 1e-9 ||
        pts.some((p) => p.x < MARGIN - 1e-9 || p.x > WIDTH - MARGIN + 1e-9 ||
          p.y < MARGIN - 1e-9 || p.y > HEIGHT - MARGIN + 1e-9)) return s;
    return Object.assign({}, s, { A: nA, B: nB, C: nC, D: nD, explored: true });
  }

  function setOption(s, key, value) {
    if (key !== "showCut" && key !== "showNames") return s;
    return Object.assign({}, s, { [key]: !!value, explored: true });
  }

  /** Everything the page draws, recomputed from the four corners. */
  function compute(s) {
    const A = s.A, B = s.B, C = s.C, D = s.D;
    const F = nearestPoint(A, B, C);     // foot from A onto line BC
    const G = nearestPoint(D, B, C);     // foot from D onto line BC
    const K = intersect(A, F, C, D);     // line AF meets line CD
    const L = intersect(D, G, A, B);     // line DG meets line AB
    const kBetween = between(A, K, F);
    const lBetween = between(D, L, G);

    const base = dist(B, C);
    const height = dist(A, F);
    const area = Math.abs(signed([A, B, C, D]));
    const rectWidth = dist(F, G);
    const rectArea = rectWidth * height;
    const cyan1 = triangle(A, B, F);
    const cyan2 = triangle(D, C, G);
    const pink1 = kBetween ? triangle(C, K, F) : 0;
    const pink2 = lBetween ? triangle(B, L, G) : 0;

    return {
      A, B, C, D, F, G, K, L, kBetween, lBetween,
      base, height, area, rectWidth, rectArea,
      cyan1, cyan2, pink1, pink2,
      // The page's three equalities, written with signed areas so that the
      // Figure 2 case (a piece subtracted) is covered as well.
      id1: signed([A, F, C, D]) + signed([A, B, F]) - signed([A, B, C, D]),
      id2: signed([A, K, D]) + signed([A, B, F]) + signed([C, K, F]) - signed([A, B, C, D]),
      id2b: signed([D, L, A]) + signed([D, C, G]) + signed([B, L, G]) + signed([A, B, C, D]),
      id3: signed([B, G, D, A]) - signed([D, C, G]) - signed([A, B, C, D]),
      diagonal1: triangle(A, B, D),
      diagonal2: triangle(A, C, D),
      figure: kBetween || lBetween ? 2 : 1,
    };
  }

  /** The line under the drawing. An illustration has no winner to announce. */
  function describe(s) {
    const g = compute(s);
    const r = (v) => Math.round(v);
    const parts = [
      `Base ${r(g.base)} times height ${r(g.height)} = ${r(g.base * g.height)}.`,
      `The two blue triangles are the same size (${r(g.cyan1)} each), so the rectangle has the same area.`,
    ];
    if (g.figure === 2) {
      parts.push("Figure 2: a foot falls outside the base, so a pink overlap is taken away.");
    } else {
      parts.push("Figure 1: the blue piece moves across without any overlap.");
    }
    return parts.join(" ");
  }

  /** No win, loss or finish: this is a demonstration the player explores. */
  function result() {
    return null;
  }

  return {
    WIDTH, HEIGHT, MARGIN,
    clamp, clampToBoard, copy, sqDist, dist, cross, triangle, signed,
    nearestPoint, intersect, between,
    start, randomize, reset, movePoint, setOption,
    compute, describe, result,
  };
})();
