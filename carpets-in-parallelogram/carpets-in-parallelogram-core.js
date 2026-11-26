"use strict";

/*
 * Carpets In Parallelogram, from Alexander Bogomolny's applet
 * CarpetsInParallelogram. The page (problem #53 of "Which Way Did the Bicycle
 * Go?") puts P on BC, Q on CD and R on AD of a parallelogram ABCD. The four
 * lines AQ, BR, AP and PR cut out four red pieces, an orange triangle ABW, a
 * blue pentagon STUVW and, when the hint is on, two pink triangles RST and
 * PUV. This core is the geometry behind the picture: the applet's five
 * GeoSDoub.Intersect calls, its |d| < 1 NaN guard, its moveable-point
 * coefficients, and the two equalities the page writes down,
 *
 *   Area(RST) + BLUE + Area(PUV) = Area(ABW)
 *   (RED - Area(RST) - Area(PUV) + Area(ABW)) - BLUE = RED = Area(ABCD)/2.
 *
 * It is DOM-free and defines exactly one global, CarpetsInParallelogramCore,
 * so porting/check-carpets-in-parallelogram.mjs can load it in Node.
 */

const CarpetsInParallelogramCore = (() => {
  /* The applet uses a 400x300 canvas and places the corners at
     (W/5, H-H/5), (3W/5, H-H/5), (W-W/5, H/5), (W-2W/5, H/5). */
  const WIDTH = 400;
  const HEIGHT = 300;
  const MARGIN = 12;
  const MIN_SIDE = 24; // keep the parallelogram from collapsing

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampToBoard = (p) => ({
    x: clamp(p.x, MARGIN, WIDTH - MARGIN),
    y: clamp(p.y, MARGIN, HEIGHT - MARGIN),
  });
  const copy = (p) => ({ x: p.x, y: p.y });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));

  /* Twice the signed area of a triangle. */
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  /* Signed shoelace area, and its plain (positive) size. */
  function signed(pts) {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum / 2;
  }
  const area = (pts) => Math.abs(signed(pts));

  /* GeoSDoub.Intersect(p1,p2,p3,p4), from its bytecode: the two line
     equations in general form, with NaN when |determinant| < 1. The applet
     treats NaN in the x coordinate of any of its five intersections as
     "NoDraw". */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / d, y: (c1 * a2 - c2 * a1) / d };
  }

  /* InsideTest.IsInside(p,a,b), from its bytecode: the dot product of the
     two vectors from p must be non-positive. */
  function inside(p, a, b) {
    return (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= 0;
  }

  const at = (a, b, t) => ({
    x: (1 - t) * a.x + t * b.x,
    y: (1 - t) * a.y + t * b.y,
  });

  /* Where a pointer nearest falls on a side, as a coefficient in [0,1].
     The Java applet restricted its point to the side's line and then used
     Dist(P,B)/Dist(B,C); on the segment this is the same number. */
  function projectCoef(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return 0;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return clamp(t, 0, 1);
  }

  /** The picture the applet's init() opens with, in board units. */
  function start(options) {
    const o = options || {};
    const A = { x: 80, y: 240 }, B = { x: 240, y: 240 };
    const C = { x: 320, y: 60 }, D = { x: 160, y: 60 };
    return {
      A, B, C, D,
      coefP: o.coefP === undefined ? 0.7 : clamp(o.coefP, 0, 1),
      coefQ: o.coefQ === undefined ? 0.5 : clamp(o.coefQ, 0, 1),
      coefR: o.coefR === undefined ? 0.6 : clamp(o.coefR, 0, 1),
      showNames: o.showNames === undefined ? false : !!o.showNames,
      showHint: o.showHint === undefined ? false : !!o.showHint,
      explored: false,
    };
  }

  /** Restore the opening picture, keeping the player's two checkboxes. */
  function reset(s) {
    return start({ showNames: s.showNames, showHint: s.showHint });
  }

  function setOption(s, key, value) {
    if (key !== "showNames" && key !== "showHint") return s;
    return Object.assign({}, s, { [key]: !!value, explored: true });
  }

  /* Corners only move horizontally in the applet (CTKMoveableDoub.Fix(2)).
     UpgradePoints keeps C.x - D.x = B.x - A.x. P, Q and R keep their
     coefficients, so UpgradeMoveable places them again after a corner drag. */
  function movePoint(s, name, p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return s;
    const base = s.B.x - s.A.x;
    let A = s.A, B = s.B, C = s.C, D = s.D;
    const next = Object.assign({}, s);

    if (name === "A" || name === "B" || name === "C" || name === "D") {
      let x = clamp(p.x, MARGIN, WIDTH - MARGIN);
      if (name === "A") {
        /* D.x = C.x - (B.x - A.x), kept on the board. */
        x = clamp(x, MARGIN - (s.C.x - s.B.x), WIDTH - MARGIN - (s.C.x - s.B.x));
        x = Math.min(x, s.B.x - MIN_SIDE);
        A = { x, y: s.A.y };
        D = { x: s.C.x - (s.B.x - x), y: s.D.y };
      } else if (name === "B") {
        /* C.x = D.x + (B.x - A.x). */
        x = clamp(x, MARGIN - s.D.x + s.A.x, WIDTH - MARGIN - s.D.x + s.A.x);
        x = Math.max(x, s.A.x + MIN_SIDE);
        B = { x, y: s.B.y };
        C = { x: s.D.x + (x - s.A.x), y: s.C.y };
      } else if (name === "C") {
        /* D.x = C.x - (B.x - A.x). */
        x = clamp(x, MARGIN + base, WIDTH - MARGIN + base);
        C = { x, y: s.C.y };
        D = { x: x - base, y: s.D.y };
      } else {
        /* C.x = D.x + (B.x - A.x). */
        x = clamp(x, MARGIN - base, WIDTH - MARGIN - base);
        D = { x, y: s.D.y };
        C = { x: x + base, y: s.C.y };
      }
      const pts = [A, B, C, D];
      if (B.x - A.x < MIN_SIDE - 1e-9 || C.x - D.x < MIN_SIDE - 1e-9 ||
          pts.some((q) => q.x < MARGIN - 1e-9 || q.x > WIDTH - MARGIN + 1e-9)) return s;
      Object.assign(next, { A, B, C, D });
    } else if (name === "P" || name === "Q" || name === "R") {
      if (name === "P") next.coefP = projectCoef(p, s.B, s.C);
      else if (name === "Q") next.coefQ = projectCoef(p, s.C, s.D);
      else next.coefR = projectCoef(p, s.A, s.D);
    } else {
      return s; // unknown handle
    }
    next.explored = true;
    return next;
  }

  /* The five intersections and every area on the page, straight from the
     applet's Compute() and Draw(). */
  function compute(s) {
    const { A, B, C, D } = s;
    const P = at(B, C, s.coefP);
    const Q = at(C, D, s.coefQ);
    const R = at(A, D, s.coefR);

    const S = intersect(B, R, A, Q);
    const T = intersect(P, R, A, Q);
    const U = intersect(B, Q, P, R);
    const V = intersect(B, Q, A, P);
    const W = intersect(B, R, A, P);

    const insideP = inside(P, B, C), insideQ = inside(Q, C, D), insideR = inside(R, A, D);
    const finite = [S, T, U, V, W].every((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
    const noDraw = !finite || !insideP || !insideQ || !insideR;

    const redA = area([A, S, R]);            // red triangle A-S-R
    const redD = area([R, T, Q, D]);         // red quadrilateral R-T-Q-D
    const redC = area([C, P, U, Q]);         // red quadrilateral C-P-U-Q
    const redB = area([B, P, V]);            // red triangle B-P-V
    const orange = area([A, B, W]);          // red/orange triangle A-B-W
    const blue = area([S, T, U, V, W]);      // the blue pentagon
    const pinkR = area([R, S, T]);           // hint: pink triangle R-S-T
    const pinkP = area([P, U, V]);           // hint: pink triangle P-U-V
    const red = redA + redD + redC + redB + orange;

    const bigRed = area([A, D, Q]) + area([B, C, Q]); // the two big triangles
    const para = area([A, B, C, D]);

    return {
      A, B, C, D, P, Q, R, S, T, U, V, W,
      insideP, insideQ, insideR, finite, noDraw,
      redA, redD, redC, redB, orange, red, blue, pinkR, pinkP, bigRed, para,
      /* The page's (1): pink + blue = orange. */
      carpet: pinkR + blue + pinkP - orange,
      /* The page's conclusion: painted red minus blue = half the box. */
      difference: red - blue,
      half: para / 2,
      leftover: red - blue - para / 2,
    };
  }

  /* The line under the picture. An illustration has no winner. */
  function describe(s) {
    const g = compute(s);
    const r = (v) => Math.round(v);
    if (g.noDraw) {
      return "Two of the lines are parallel here, so the applet hides its carpet; the parallelogram is still shown.";
    }
    const parts = [
      `Painted red ${r(g.red)} minus blue ${r(g.blue)} = ${r(g.difference)}.`,
      `Half the parallelogram is ${r(g.half)}; the difference never changes.`,
    ];
    if (s.showHint) {
      parts.push(`Pink ${r(g.pinkR)} + blue ${r(g.blue)} + pink ${r(g.pinkP)} = orange ${r(g.orange)}.`);
    }
    return parts.join(" ");
  }

  /** No win, loss or finish: this is an illustration to explore. */
  function result() {
    return null;
  }

  return {
    WIDTH, HEIGHT, MARGIN, MIN_SIDE,
    clamp, clampToBoard, copy, sqDist, dist, cross, signed, area,
    intersect, inside, at, projectCoef,
    start, reset, setOption, movePoint, compute, describe, result,
  };
})();
