#!/usr/bin/env node
"use strict";

/*
 * Logic test for midpoints/midpoints-core.js.
 *
 *   node porting/check-midpoints.mjs
 *
 * Three parts:
 *  1. the applet's own rules (two modes, snapping to 2, the click rectangles,
 *     the 100-point array, Reset) and its closing test;
 *  2. the page's claims, exhaustively on small grids and on thousands of
 *     random configurations: odd n gives one reflection and exactly one
 *     closing vertex, even n gives a translation (infinitely many starts iff
 *     it is zero, none otherwise), and for n = 4 that happens exactly when the
 *     four dots form a parallelogram in the given order (Varignon);
 *  3. midpointer.draw() written a second time straight from the bytecode
 *     (p1 <- mouse, p2 <- (0,0), p2 <- p1 + 2*(O_i - p1), target rings, the
 *     |dx| < 3 && |dy| < 3 test) and compared with the core over every small
 *     configuration and a wide random sweep.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("midpoints/midpoints-core.js", "MidpointsCore");

const P = (x, y) => ({ x, y });
const same = (p, q) => !!p && !!q && p.x === q.x && p.y === q.y;

/* ---------------------------------- the applet's draw(), second transcription */

/*
 * javap -c midpointer, draw():
 *   p1.x = m_Mouse.x; p1.y = m_Mouse.y
 *   for i in 0..N-1:
 *     p2.x = p1.x + 2*(m_pt[i].x - p1.x)
 *     p2.y = p1.y + 2*(m_pt[i].y - p1.y)
 *     drawLine(p1 -> p2); p1 = p2
 *   if (m_pt.length > 0) { // always 100: reset allocates a new array
 *     for (r = 2; r < 8; r += 2) drawOval((mouse.x+p2.x)/2 - r, ..., 2r, 2r)
 *     finished = |mouse.x-p2.x| < 3 && |mouse.y-p2.y| < 3
 *   }
 * Java ints wrap, so the transcription truncates to 32 bits on every step.
 */
function appletDraw(points, mouse) {
  const ji = (v) => v | 0;
  let p1 = P(ji(mouse.x), ji(mouse.y)); // the constructor's p1 is set from mouse
  let p2 = P(0, 0);                     // the constructor's p2
  const lines = [];
  for (let i = 0; i < points.length; i++) {
    const o = points[i];
    p2 = P(ji(p1.x + 2 * ji(o.x - p1.x)), ji(p1.y + 2 * ji(o.y - p1.y)));
    lines.push([P(p1.x, p1.y), P(p2.x, p2.y)]);
    p1 = P(p2.x, p2.y);
  }
  const rings = [];
  for (let r = 2; r < 8; r += 2) {
    rings.push({
      x: ji(Math.trunc((mouse.x + p2.x) / 2)) - r,
      y: ji(Math.trunc((mouse.y + p2.y) / 2)) - r,
      w: 2 * r, h: 2 * r,
    });
  }
  const finished = Math.abs(mouse.x - p2.x) < 3 && Math.abs(mouse.y - p2.y) < 3;
  return { lines, end: p2, rings, finished };
}

/* An independent composition of point reflections, not using the core. */
function compose(points, a) {
  let p = P(a.x, a.y);
  for (const o of points) p = P(2 * o.x - p.x, 2 * o.y - p.y);
  return p;
}
function alt(points) {
  let sx = 0, sy = 0;
  points.forEach((o, i) => {
    const s = i % 2 === 0 ? 1 : -1;
    sx += s * o.x;
    sy += s * o.y;
  });
  return P(sx, sy);
}
const grid = (vals) => {
  const out = [];
  for (const x of vals) for (const y of vals) out.push(P(x, y));
  return out;
};
function* tuples(pool, n, prefix = []) {
  if (n === 0) { yield prefix; return; }
  for (const p of pool) yield* tuples(pool, n - 1, prefix.concat([p]));
}

/* --------------------------------------------------- 1. the applet's rules */

{
  const s = C.start();
  equal("Reset starts with no dots", s.points, []);
  equal("Reset starts the cursor at (200,180)", s.cursor, P(200, 180));
  check("Place points is the opening mode", s.mode === "place");
  check("a fresh diagram is not explored", !s.explored);
  check("an illustration never wins or loses", C.result(s) === null
    && C.result(C.addPoint(s, P(40, 40))) === null);

  equal("snapping uses Java's (v/2)*2", C.snap(P(7, -3)), P(6, -2));
  check("(100,20) is in the applet's click area", C.inCanvas(P(100, 20)));
  check("(350,20) is in the upper gap, outside the click area", !C.inCanvas(P(350, 20)));
  check("(350,40) is inside the lower click area", C.inCanvas(P(350, 40)));
  check("the border and negative coordinates are refused",
    !C.inCanvas(P(0, 100)) && !C.inCanvas(P(200, 350)) && !C.inCanvas(P(-2, 40)));

  const placed = C.addPoint(s, P(101, 83));
  equal("a click adds a snapped midpoint", placed.points, [P(100, 82)]);
  check("placing a dot marks it explored and leaves the old state alone",
    placed.explored && !s.explored && s.points.length === 0);
  check("a click outside the canvas is ignored", C.addPoint(s, P(360, 20)) === s);
  const dragged = C.setMode(placed, "drag");
  check("Drag mouse refuses new dots, as mouseReleased did", C.addPoint(dragged, P(40, 40)) === dragged);
  check("switching modes marks it explored", dragged.explored);
  check("an unknown mode is ignored", C.setMode(dragged, "jump") === dragged);
  check("switching to the same mode is a no-op", C.setMode(dragged, "drag") === dragged);

  const moved = C.moveCursor(dragged, P(55, 61));
  equal("a dragged cursor is snapped to the 2-pixel grid", moved.cursor, P(54, 60));
  check("moving the cursor leaves the old state alone", same(dragged.cursor, P(200, 180)));
  check("a non-finite cursor is ignored", C.moveCursor(moved, P(NaN, 4)) === moved);
  const far = C.moveCursor(moved, P(9999, -9999));
  equal("the cursor is clamped to the board", far.cursor, P(390, 10));

  let many = s;
  for (let i = 0; i < 105; i++) many = C.addPoint(many, P(20 + (i % 20) * 2, 40));
  check("the applet's 100-point array is not overrun", many.points.length === C.MAX_POINTS);

  const reset = C.reset(moved);
  equal("Reset clears the dots and returns to Place points", reset.points, []);
  check("Reset restores Place points and keeps the cursor", reset.mode === "place"
    && same(reset.cursor, moved.cursor));
  check("the empty chain keeps the applet's old p2 at the corner",
    same(C.chain(C.start()).end, P(0, 0)));
  check("with no dots the chain reports no polygons", C.geometry(C.start()).n === 0);
  check("status asks for dots when there are none", /place midpoints/.test(C.describe(s)));
  check("status explains Place points after dots are added", /Switch to Drag mouse/.test(C.describe(placed)));
}

/* ---------------------------------------- 2. the page's claims, exhaustively */

{
  const small = grid([0, 2, 4, 6, 8]);
  const cursors = grid([0, 2, 4, 6, 8]);

  /* Two reflections: a translation by twice the vector between centres. */
  let twoFail = 0;
  for (const o1 of small) for (const o2 of small) {
    const a = P(12, 26);
    const b = compose([o1, o2], a);
    if (!same(b, P(a.x + 2 * (o2.x - o1.x), a.y + 2 * (o2.y - o1.y)))) twoFail++;
  }
  check("two reflections shift by twice the gap between their centres, on all 625 pairs", twoFail === 0);

  /* n = 3 is the case the page discusses in detail: the red circle's centre
     depends only on the three dots and is a vertex of the closed polygon. */
  let threeFail = 0, threeCenterFail = 0, threeUniqueFail = 0, equationsFail = 0;
  for (const a of small) for (const b of small) for (const c of small) {
    const pts = [a, b, c];
    const m = alt(pts); // O1 - O2 + O3
    const targets = cursors.map((cursor) => C.geometry({ points: pts, cursor }).target);
    if (targets.some((t) => !same(t, m))) threeCenterFail++;
    for (const cursor of cursors) {
      const g = C.geometry({ points: pts, cursor });
      const end = compose(pts, cursor);
      if (!same(g.end, end) || !same(g.fixedPoint, m)) threeFail++;
      // On the snapped even grid the < 3 test is exactly equality.
      if (g.finished !== same(cursor, m)) threeUniqueFail++;
    }
    const closed = compose(pts, m);
    if (!same(closed, m)) equationsFail++;
    const vertices = [m, compose([a], m), compose([a, b], m)];
    for (let i = 0; i < 3; i++) {
      const next = vertices[(i + 1) % 3];
      if (!same(P(vertices[i].x + next.x, vertices[i].y + next.y),
        P(2 * pts[i].x, 2 * pts[i].y))) equationsFail++;
    }
  }
  check("n=3: the chain always ends where the reflected cursor formula says", threeFail === 0);
  check("n=3: the red centre is fixed and equals O1-O2+O3 on all 15,625 triples", threeCenterFail === 0);
  check("n=3: exactly one cursor closes the polygon, and the 3-pixel test finds it", threeUniqueFail === 0);
  check("n=3: that vertex satisfies a_i + a_(i+1) = 2m_i on every triple", equationsFail === 0);

  /* n = 4: the page's Varignon claim. The chain shift is zero exactly when
     O1 + O3 = O2 + O4, i.e. the two diagonals of O1O2O3O4 share a midpoint
     (a parallelogram, possibly a degenerate one when all four are collinear). */
  const fourPool = grid([0, 2, 4, 6, 8, 10]);
  let fourFail = 0, fourParaFail = 0, fourSolFail = 0;
  let zeroShift = 0;
  for (const a of fourPool) for (const b of fourPool) for (const c of fourPool) for (const d of fourPool) {
    const pts = [a, b, c, d];
    const s = alt(pts);
    const parallelogram = a.x + c.x === b.x + d.x && a.y + c.y === b.y + d.y;
    const g = C.geometry({ points: pts, cursor: P(20, 22) });
    if (!same(g.shift, P(-2 * s.x, -2 * s.y)) || g.targetAgrees !== true) fourFail++;
    if (g.symmetry.identity !== parallelogram) fourParaFail++;
    if ((g.solutions === Infinity) !== parallelogram) fourSolFail++;
    if (parallelogram) zeroShift++;
    // The chain and the independent composition must agree.
    if (!same(g.end, compose(pts, P(20, 22)))) fourFail++;
  }
  check("n=4: the shift is 2*(O2-O1+O4-O3) on all 1,679,616 ordered quadruples", fourFail === 0);
  check("n=4: zero shift iff O1+O3=O2+O4 (parallelogram, in boundary order)", fourParaFail === 0);
  check("n=4: zero shift gives infinitely many starts, otherwise none", fourSolFail === 0);
  check("the exhaustive n=4 sweep found both kinds of configuration", zeroShift > 0 && zeroShift < 36 ** 4);

  /* Parallelogram side-midpoints: Varignon in the other direction. */
  const quad = [P(30, 40), P(210, 70), P(260, 240), P(60, 200)];
  const sides = quad.map((p, i) => P((p.x + quad[(i + 1) % 4].x) / 2, (p.y + quad[(i + 1) % 4].y) / 2));
  check("the side midpoints of any quadrilateral form a parallelogram (Varignon)",
    sides[0].x + sides[2].x === sides[1].x + sides[3].x
    && sides[0].y + sides[2].y === sides[1].y + sides[3].y);
  const startAt = P(55, 65);
  const verts = [startAt];
  sides.forEach((o) => verts.push(P(2 * o.x - verts[verts.length - 1].x, 2 * o.y - verts[verts.length - 1].y)));
  check("a quadrilateral with those side midpoints really exists", same(verts[4], startAt));
  check("Varignon's parallelogram closes for every starting vertex",
    [P(10, 10), P(300, 80), P(190, 310)].every((a) => {
      const v = [a];
      sides.forEach((o) => v.push(P(2 * o.x - v[v.length - 1].x, 2 * o.y - v[v.length - 1].y)));
      return same(v[4], a);
    }));
}

/* ------------------------- 3. odd and even compositions over random cases */

{
  const rand = rng(4821);
  const randPoint = () => P(Math.trunc(rand() * 201) * 2, Math.trunc(rand() * 171) * 2);
  let oddCases = 0, evenCases = 0, oddFail = 0, evenFail = 0;
  for (let trial = 0; trial < 900; trial++) {
    const n = 1 + (trial % 25); // every n from 1 to 25, odd and even
    const pts = Array.from({ length: n }, randPoint);
    const a = randPoint();
    const g = C.geometry({ points: pts, cursor: a });
    const s = alt(pts);
    const end = compose(pts, a);
    if (n % 2 === 1) {
      oddCases++;
      if (!same(g.end, end) || !same(g.fixedPoint, s)
        || !same(end, P(2 * s.x - a.x, 2 * s.y - a.y))
        || !same(g.predictedTarget, s) || !same(g.target, s)
        || g.solutions !== 1 || g.finished !== same(a, s)) oddFail++;
      if (!same(compose(pts, s), s)) oddFail++; // the claimed unique start closes
    } else {
      evenCases++;
      if (!same(g.end, end) || !same(end, P(a.x - 2 * s.x, a.y - 2 * s.y))
        || !same(g.predictedTarget, P(a.x - s.x, a.y - s.y))
        || !same(g.target, g.predictedTarget)
        || g.symmetry.identity !== (s.x === 0 && s.y === 0)
        || g.finished !== (s.x === 0 && s.y === 0)) evenFail++;
      if ((s.x === 0 && s.y === 0) !== (g.solutions === Infinity)) evenFail++;
    }
  }
  check(`odd n: unique closing vertex and fixed red centre on ${oddCases} configurations`,
    oddCases === 468 && oddFail === 0);
  check(`even n: shift, centre and no-solution claim on ${evenCases} configurations`,
    evenCases === 432 && evenFail === 0);

  /* The target ring moves with the cursor only for even n; the page says it
     is fixed for three dots, and the logic test pins down both behaviours. */
  const oddPts = [P(40, 60), P(160, 80), P(220, 200)];
  const targets = [P(10, 10), P(200, 180), P(390, 330)]
    .map((cursor) => C.geometry({ points: oddPts, cursor }).target);
  check("the target never moves with the cursor when n is odd",
    same(targets[0], targets[1]) && same(targets[1], targets[2]));

  /* A reflection reverses a segment's direction; a translation keeps it. */
  const u = P(30, 0);
  let flipped = 0, kept = 0;
  for (let n = 1; n <= 9; n++) {
    const pts = Array.from({ length: n }, (_, i) => P(20 + i * 12, 40 + (i % 3) * 18));
    const a = P(70, 90), b = P(a.x + u.x, a.y + u.y);
    const da = compose(pts, a), db = compose(pts, b);
    const dir = P(db.x - da.x, db.y - da.y);
    if (n % 2 === 1 && same(dir, P(-u.x, -u.y))) flipped++;
    if (n % 2 === 0 && same(dir, u)) kept++;
  }
  check("odd reflections reverse a segment's orientation", flipped === 5);
  check("even reflections keep a segment's orientation", kept === 4);

  /* Messages, including the even case with and without a zero shift. */
  check("status names the fixed target for odd n",
    /red target stays at one spot/.test(C.describe({ points: oddPts, cursor: P(200, 180), mode: "drag" })));
  check("status says any start closes when the even shift is zero",
    /any start closes/.test(C.describe({
      points: [P(40, 40), P(120, 40), P(120, 100), P(40, 100)],
      cursor: P(200, 180), mode: "drag",
    })));
  check("status reports the shift when even n has no solution",
    /never closes/.test(C.describe({
      points: [P(40, 40), P(120, 40), P(120, 100), P(50, 100)],
      cursor: P(200, 180), mode: "drag",
    })));
  check("status announces a closed polygon at the solution",
    /chain closes/.test(C.describe({
      points: oddPts, cursor: alt(oddPts), mode: "drag",
    })));
  check("status asks for dots when dragging with none placed",
    /No midpoints yet/.test(C.describe({ points: [], cursor: P(20, 20), mode: "drag" })));
}

/* ---------------------------- 4. the core against the applet's own method */

{
  let compared = 0, mismatch = 0;
  const compare = (points, cursor) => {
    const core = C.chain({ points, cursor });
    const ap = appletDraw(points, cursor);
    if (core.segments.length !== ap.lines.length) { mismatch++; return; }
    for (let i = 0; i < ap.lines.length; i++) {
      if (!same(core.segments[i][0], ap.lines[i][0])
        || !same(core.segments[i][1], ap.lines[i][1])) mismatch++;
    }
    if (!same(core.end, ap.end)) mismatch++;
    const ringCentres = ap.rings.map((r) => P(r.x + r.w / 2, r.y + r.h / 2));
    if (ringCentres.some((p) => !same(p, core.target))) mismatch++;
    if (core.finished !== ap.finished) mismatch++;
    compared++;
  };

  const pool = grid([0, 2, 4, 6, 8]);
  const cursors = grid([0, 2, 4, 6, 8]);
  for (const a of pool) for (const cursor of cursors) compare([a], cursor);
  for (const pair of tuples(pool, 2)) for (const cursor of cursors) compare(pair, cursor);
  for (const triple of tuples(pool, 3)) for (const cursor of cursors.slice(0, 4)) compare(triple, cursor);
  const fourPool = grid([0, 2, 4, 6]);
  for (const quad of tuples(fourPool, 4)) for (const cursor of cursors.slice(0, 3)) compare(quad, cursor);

  const rand = rng(1994);
  for (let trial = 0; trial < 1400; trial++) {
    const n = 1 + (trial % 24);
    const pts = Array.from({ length: n }, () =>
      P(Math.trunc(rand() * 200) * 2, Math.trunc(rand() * 175) * 2));
    const cursor = P(Math.trunc(rand() * 200) * 2, Math.trunc(rand() * 175) * 2);
    compare(pts, cursor);
  }
  check(`core matches midpointer.draw() on ${compared} configurations`, compared > 200000 && mismatch === 0);

  equal("the three red rings are centred on the target, radii 2,4,6",
    appletDraw([P(100, 100)], P(200, 180)).rings.map((r) => [r.w, r.h]),
    [[4, 4], [8, 8], [12, 12]]);
  check("no DOM is used by the core", typeof globalThis.document === "undefined");
}

done("midpoints");
