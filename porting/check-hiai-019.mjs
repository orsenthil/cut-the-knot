#!/usr/bin/env node
"use strict";

/*
 * Logic test for hiai-019/hiai-019-core.js.
 *
 *   node porting/check-hiai-019.mjs
 *
 * The page claims three things: the circle chain returns to the point D it
 * started from, DEF is equilateral, and the three Napoleon circumcircles meet
 * in one point (the Fermat point for an acute triangle).  It also says the
 * inscribed angles at D, E and F are 60 or 120 degrees.  All four are checked
 * over thousands of non-degenerate triangles and starting points.  A second,
 * literal transcription of the applet's own methods (Reset, GetNapoleon,
 * GetCircle, PropagatePoints, Other, GeoSDoub.IntersectX/Y, FindCircumcenter,
 * ComputeSignedAngle, AdjustCircles) is compared with the core across the
 * whole 3-point configuration space and for all three propagation indices.
 *
 * The applet refuses a cut when both line components are at most one pixel,
 * and the try/catch in PropagatePoints leaves that point where it was; the
 * same happens here.  Those degenerate pictures are excluded from the
 * theorem checks and reported explicitly instead.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("hiai-019/hiai-019-core.js", "Hiai019Core");
const rand = rng(54420019);
const TAU = 2 * Math.PI;
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const pt = (x, y) => ({ x, y });
const D2 = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const DD = (p, q) => Math.sqrt(D2(p, q));
const uniform = (lo, hi) => lo + rand() * (hi - lo);

/* --------------------------------------------------------------------- *
 * A second transcription, made straight from javap, without using the core.
 * --------------------------------------------------------------------- */

const Applet = (() => {
  const N = 3;
  const TURN = 1.0471975511965976;
  const p2 = (x, y) => pt(x, y);

  /* GeoSDoub.Rotate(p, q, angle, sign) */
  function rotate(p, q, angle, sign) {
    const co = Math.cos(angle), si = Math.sin(angle);
    return p2(p.x + co * (q.x - p.x) - sign * si * (q.y - p.y),
              p.y + sign * si * (q.x - p.x) + co * (q.y - p.y));
  }

  /* GeoSDoub.FindOrientation */
  function orientation(p, q, r) {
    const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return v > 0 ? 1 : -1;
  }

  /* GeoSDoub.ComputeSignedAngle, including the unreachable acos > .99 branch */
  function signedAngle(a, b, c) {
    const half = (D2(a, b) + D2(a, c) - D2(b, c)) / 2;
    const cosine = half / (DD(a, b) * DD(a, c));
    const ang = Math.acos(cosine);
    if (ang > 0.99 && (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y) < 0) return Math.PI;
    return orientation(a, b, c) === 1 ? ang : -ang;
  }

  /* GeoSDoub.Intersect(p1,p2,p3,p4) */
  function cutLines(a, b, c, d) {
    const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    const n1 = a.x * b.y - a.y * b.x, n2 = c.x * d.y - c.y * d.x;
    if (den === 0) return null;
    return p2((n1 * (c.x - d.x) - (a.x - b.x) * n2) / den,
              (n1 * (c.y - d.y) - (a.y - b.y) * n2) / den);
  }

  /* GeoSDoub.FindCircumcenter + HIAI019Canvas.GetCircle: r is the mean of the
     three distances, not simply the distance to the first vertex. */
  function circle3(a, b, c) {
    const m1 = p2((a.x + b.x) / 2, (a.y + b.y) / 2);
    const m2 = p2((b.x + c.x) / 2, (b.y + c.y) / 2);
    const o = cutLines(m1, p2(m1.x + a.y - b.y, m1.y + b.x - a.x),
                       m2, p2(m2.x + b.y - c.y, m2.y + c.x - b.x));
    return { center: o, r: (DD(o, a) + DD(o, b) + DD(o, c)) / 3 };
  }

  /* GeoSDoub.Intersect(DoubLine, DoubCircle) -> IntersectX / IntersectY.
     The one-pixel test on the line's x/y difference is kept. */
  function cutLineCircle(p, q, circle) {
    const dy = p.y - q.y, dx = p.x - q.x;
    let m, b, byX;
    if (Math.abs(dy) > 1) { byX = true; m = dx / dy; b = q.x - m * q.y; }
    else if (Math.abs(dx) > 1) { byX = false; m = dy / dx; b = q.y - m * q.x; }
    else return null;
    const A = m * m + 1;
    const B = byX ? m * (b - circle.center.x) - circle.center.y
                  : m * (b - circle.center.y) - circle.center.x;
    const Cc = (byX ? circle.center.y ** 2 + (b - circle.center.x) ** 2
                   : circle.center.x ** 2 + (b - circle.center.y) ** 2) - circle.r ** 2;
    const disc = B * B - A * Cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const y1 = (-B + s) / A, y2 = (-B - s) / A;
    return byX ? [p2(m * y1 + b, y1), p2(m * y2 + b, y2)]
               : [p2(y1, m * y1 + b), p2(y2, m * y2 + b)];
  }

  /* HIAI019Canvas.Other: c[1] only when c[0] is within a pixel of the vertex. */
  function other(c, v) {
    return DD(c[0], v) < 1 ? c[1] : c[0];
  }

  /* GetNapoleon(i) / GetCircle(i) */
  function napoleons(v) {
    return v.map((_, i) => rotate(v[i], v[(i + 1) % N], TURN, -1));
  }
  function circles(v, naps) {
    return v.map((_, i) => circle3(v[i], v[(i + 1) % N], naps[i]));
  }

  /* PropagatePoints(from): the loop variable j = (k + from) % N, jp = j+1. */
  function propagate(points, v, cir, from) {
    for (let k = 0; k < N; k++) {
      const j = (k + from) % N, jp = (j + 1) % N;
      try {
        const cuts = cutLineCircle(points[j], v[jp], cir[jp]);
        if (!cuts || cuts.length < 2) continue;
        const chosen = other(cuts, v[jp]);
        points[jp].x = chosen.x;
        points[jp].y = chosen.y;
      } catch (e) { /* applet catches Exception around the loop body */ }
    }
    return points;
  }

  function angles(cir, points) {
    return cir.map((c, i) => signedAngle(p2(c.center.x + 200, c.center.y), c.center, points[i]));
  }

  /* HIAI019Canvas.Reset with an injected Math.random */
  function reset(opts, random) {
    const o = opts || {};
    const w = o.width === undefined ? 400 : o.width;
    const h = o.height === undefined ? 250 : o.height;
    const r = Math.min(w, h) / 5;
    const v = [], points = [];
    for (let i = 0; i < N; i++) {
      v.push(p2(Math.trunc(r * Math.cos((2 * Math.PI / N) * i) + w / 2),
                Math.trunc(r * Math.sin((2 * Math.PI / N) * i) + h / 2)));
      points.push(p2(0, 0));
    }
    const naps = napoleons(v), cir = circles(v, naps);
    const a = (random() / 4) * Math.PI;
    points[0] = p2(cir[0].center.x + cir[0].r * Math.cos(a),
                   cir[0].center.y + cir[0].r * Math.sin(a));
    propagate(points, v, cir, 0);
    return { vertices: v, napoleons: naps, circles: cir, points, signedAngles: angles(cir, points) };
  }

  /* AdjustCircles, used after a vertex is dragged. */
  function adjustVertex(v, oldCir, oldAngles, points, index) {
    const naps = napoleons(v), cir = circles(v, naps);
    points[index] = p2(cir[index].center.x + cir[index].r * Math.cos(oldAngles[index]),
                       cir[index].center.y + cir[index].r * Math.sin(oldAngles[index]));
    propagate(points, v, cir, index);
    return { napoleons: naps, circles: cir, points, signedAngles: angles(cir, points) };
  }

  return { N, p2, rotate, orientation, signedAngle, cutLines, circle3,
           cutLineCircle, other, napoleons, circles, propagate, angles,
           reset, adjustVertex };
})();

/* A picture without a failed cut: every link is longer than the applet's
   one-pixel threshold and no point sits at the initial (0,0) position. */
function healthy(state) {
  if (state.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) ||
                         DD(p, pt(0, 0)) < 1e-6)) return false;
  for (let j = 0; j < 3; j++) {
    const p = state.points[j];
    /* A point sitting on either vertex of its circle makes the inscribed
       angle and the far-intersection choice ill-conditioned: the applet has
       the same numerical difficulty there. */
    if (DD(p, state.vertices[j]) < 3 || DD(p, state.vertices[(j + 1) % 3]) < 3) return false;
    /* The cut refuses a link whose two components are both <= 1 pixel. */
    const link = state.vertices[(j + 1) % 3];
    if (Math.max(Math.abs(p.x - link.x), Math.abs(p.y - link.y)) < 3) return false;
  }
  return true;
}

function randomTriangle(minSide = 40) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const v = [0, 1, 2].map(() => pt(uniform(30, 370), uniform(25, 225)));
    if (Math.min(DD(v[0], v[1]), DD(v[1], v[2]), DD(v[2], v[0])) >= minSide) return v;
  }
  return null;
}

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start({ random: () => 0.5 });
  equal("three vertices", s.vertices.length, 3);
  equal("three circumcircles", s.circles.length, 3);
  equal("the applet's board", [C.WIDTH, C.HEIGHT], [400, 250]);
  check("the default radius is a fifth of the short side", C.RADIUS === 50);
  check("the first vertex is at the applet's starting angle",
    s.vertices[0].x === 250 && s.vertices[0].y === 125);
  check("the second vertex is truncated, not rounded",
    s.vertices[1].x === 175 && s.vertices[1].y === 168);
  check("the third vertex is truncated, not rounded",
    s.vertices[2].x === 174 && s.vertices[2].y === 81);
  check("the Napoleon apex completes an equilateral triangle",
    near(C.dist(s.napoleons[0], s.vertices[0]), C.dist(s.vertices[0], s.vertices[1]), 1e-9) &&
    near(C.dist(s.napoleons[0], s.vertices[1]), C.dist(s.vertices[0], s.vertices[1]), 1e-9));
  check("the first circle passes through the side and its apex",
    [0, 1, 2].every((j) => near(C.dist(s.circles[0].center,
      [s.vertices[0], s.vertices[1], s.napoleons[0]][j]), s.circles[0].r, 1e-9)));
  check("D lies on the first circle", near(C.dist(s.points[0], s.circles[0].center), s.circles[0].r, 1e-9));
  check("E lies on the second circle", near(C.dist(s.points[1], s.circles[1].center), s.circles[1].r, 1e-9));
  check("F lies on the third circle", near(C.dist(s.points[2], s.circles[2].center), s.circles[2].r, 1e-9));
  check("names are on by default, marks are off",
    s.showNames === true && s.showPremises === false && s.showStatement === false);
  check("an illustration never has a result", C.result(s) === null);
  const g = C.compute(s);
  check("the default picture is not degenerate", healthy(s));
  check("the chain comes back to D", g.closure < 1e-6, `${g.closure}`);
  check("the default triangle DEF is equilateral", g.equilateral < 1e-6, `${g.equilateral}`);
  check("the status line reports a closed chain", C.describe(s).includes("Chain back at D"));
  check("the status line reports the three circles meeting", C.describe(s).includes("Circles share a point"));
}

/* ------------------------------------- 2. Reset against the applet's bytecode */

{
  let wrong = 0, n = 0;
  for (let t = 0; t < 400; t++) {
    const w = t % 5 === 0 ? 320 + (t % 90) : 400;
    const h = t % 7 === 0 ? 200 + (t % 60) : 250;
    const seq = Array.from({ length: 8 }, () => rand());
    let coreSeed = 0, appletSeed = 0;
    const core = C.start({ width: w, height: h, random: () => seq[coreSeed++] });
    const applet = Applet.reset({ width: w, height: h }, () => seq[appletSeed++]);
    n++;
    const sameP = (a, b) => near(a.x, b.x, 1e-9) && near(a.y, b.y, 1e-9);
    const sameC = (a, b) => sameP(a.center, b.center) && near(a.r, b.r, 1e-9);
    if (!core.vertices.every((p, j) => sameP(p, applet.vertices[j])) ||
        !core.napoleons.every((p, j) => sameP(p, applet.napoleons[j])) ||
        !core.circles.every((c, j) => sameC(c, applet.circles[j])) ||
        !core.points.every((p, j) => sameP(p, applet.points[j])) ||
        !core.signedAngles.every((a, j) => near(a, applet.signedAngles[j], 1e-9))) wrong++;
  }
  check("Reset matches the applet on every board size tried", wrong === 0, `${wrong} of ${n} wrong`);
  check("the comparison covered many sizes", n === 400);
}

/* ------------------------ 3. propagation against the second transcription */

{
  let wrong = 0, n = 0;
  for (let t = 0; t < 900; t++) {
    const v = randomTriangle(20);
    if (!v) continue;
    const naps = Applet.napoleons(v), cir = Applet.circles(v, naps);
    for (let from = 0; from < 3; from++) {
      /* Points may be on or off their circles: the applet accepts either. */
      const corePoints = v.map((p, j) => j === from
        ? C.onCircle(cir[j], uniform(0, TAU))
        : pt(p.x + uniform(-90, 90), p.y + uniform(-90, 90)));
      const appletPoints = corePoints.map((p) => Applet.p2(p.x, p.y));
      C.propagate(corePoints, v, cir, from);
      Applet.propagate(appletPoints, v, cir, from);
      n++;
      if (!corePoints.every((p, j) => near(p.x, appletPoints[j].x, 1e-8) &&
                                      near(p.y, appletPoints[j].y, 1e-8))) wrong++;
    }
  }
  check("PropagatePoints matches for all three indices", wrong === 0, `${wrong} of ${n} runs`);
  check("the comparison covered many configurations", n > 2000, `${n}`);

  /* Other's one-pixel choice, straight from the bytecode. */
  const v = pt(100, 100);
  check("Other picks the second point when the first is the vertex",
    C.other([pt(100.4, 100), pt(180, 100)], v).x === 180);
  check("Other picks the first point otherwise",
    C.other([pt(150, 100), pt(100, 100)], v).x === 150);

  /* A line shorter than the applet's one-pixel threshold gives no cut and is
     swallowed by the catch, leaving that point untouched. */
  const c = { center: pt(200, 100), r: 50 };
  check("a too-short line has no circle cut", C.lineCircle(pt(200, 100), pt(200.4, 100.3), c) === null);
  const flat = C.start({});
  const flatPoints = flat.points.map((p) => ({ ...p }));
  /* Put point D exactly on the linking vertex B: the line B->B has no
     direction, so the first cut fails and E is left alone. */
  flatPoints[0] = { ...flat.vertices[1] };
  const kept = { ...flatPoints[1] };
  C.propagate(flatPoints, flat.vertices, flat.circles, 0);
  check("a swallowed cut leaves the point where it was",
    flatPoints[1].x === kept.x && flatPoints[1].y === kept.y);
}

/* --------------------- 4. the page's claims, over the whole configuration */

{
  const stats = {
    n: 0, skipped: 0, close: 0, equal: 0, triangle: 0, inscribed: 0,
    meet: 0, fermat: 0, acute: 0,
    maxClose: 0, maxEqual: 0, maxAngle: 0, maxInscribed: 0, maxMeet: 0,
  };
  for (let t = 0; t < 9000; t++) {
    const vertices = randomTriangle(45);
    if (!vertices) continue;
    const s = C.start({ vertices, random: () => rand() });
    /* Also exercise points chosen well away from the starting angle. */
    const state = C.turnPoint(s, 0, uniform(0, TAU));
    if (!healthy(state)) { stats.skipped++; continue; }
    const g = C.compute(state);
    stats.n++;
    stats.maxClose = Math.max(stats.maxClose, g.closure);
    stats.maxEqual = Math.max(stats.maxEqual, g.equilateral);
    stats.maxAngle = Math.max(stats.maxAngle,
      ...g.triangleAngles.map((a) => Math.abs(a - Math.PI / 3)));
    if (g.closure > 1e-4) stats.close++;
    if (g.equilateral > 1e-4) stats.equal++;
    if (g.triangleAngles.some((a) => Math.abs(a - Math.PI / 3) > 1e-4)) stats.triangle++;
    for (const a of g.inscribed) {
      const err = Math.min(Math.abs(a - Math.PI / 3), Math.abs(a - 2 * Math.PI / 3));
      stats.maxInscribed = Math.max(stats.maxInscribed, err);
      if (err > 1e-4) stats.inscribed++;
    }
    const common = C.commonPoint(state, 1e-4);
    if (!common) stats.meet++;
    else stats.maxMeet = Math.max(stats.maxMeet, common.error);

    /* Fermat point: for an acute triangle the common point sees the sides
       either at three 120 degree angles (inside) or at 120, 60, 60. */
    const inner = [0, 1, 2].map((j) => {
      const a = vertices[j], b = vertices[(j + 1) % 3], d = vertices[(j + 2) % 3];
      const u = pt(b.x - a.x, b.y - a.y), w = pt(d.x - a.x, d.y - a.y);
      return Math.acos((u.x * w.x + u.y * w.y) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y)));
    });
    if (inner.every((a) => a < Math.PI / 2) && common) {
      stats.acute++;
      const rays = [0, 1, 2].map((j) => {
        const a = vertices[j], b = vertices[(j + 1) % 3], p = common.point;
        const u = pt(a.x - p.x, a.y - p.y), w = pt(b.x - p.x, b.y - p.y);
        return Math.acos(Math.max(-1, Math.min(1,
          (u.x * w.x + u.y * w.y) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y)))));
      });
      const sorted = rays.slice().sort((a, b) => a - b);
      const inside = sorted.every((a) => near(a, 2 * Math.PI / 3, 1e-4));
      const outside = near(sorted[0], Math.PI / 3, 1e-4) &&
                      near(sorted[1], Math.PI / 3, 1e-4) &&
                      near(sorted[2], 2 * Math.PI / 3, 1e-4);
      if (!inside && !outside) stats.fermat++;
    }
  }
  check("non-degenerate configurations were exercised", stats.n > 3000,
    `${stats.n} tried, ${stats.skipped} degenerate`);
  check("the chain returns to D", stats.close === 0, `${stats.close} of ${stats.n} failed`);
  check("DEF is equilateral", stats.equal === 0, `${stats.equal} of ${stats.n} failed`);
  check("the angles at D, E and F are 60 degrees", stats.triangle === 0,
    `${stats.triangle} of ${stats.n} failed`);
  check("inscribed angles are 60 or 120 degrees", stats.inscribed === 0,
    `${stats.inscribed} of ${stats.n} failed`);
  check("the three circumcircles are concurrent", stats.meet === 0,
    `${stats.meet} of ${stats.n} failed`);
  check("acute triangles meet at a Fermat point", stats.acute > 100 && stats.fermat === 0,
    `${stats.fermat} of ${stats.acute} failed`);
  check("the numerical errors are small",
    stats.maxClose < 1e-4 && stats.maxEqual < 1e-4 && stats.maxAngle < 1e-4 &&
    stats.maxInscribed < 1e-4 && stats.maxMeet < 1e-4,
    `${stats.maxClose}, ${stats.maxEqual}, ${stats.maxAngle}, ${stats.maxInscribed}, ${stats.maxMeet}`);
  check("degenerate one-pixel cuts were found and excluded", stats.skipped > 0, `${stats.skipped}`);
}

/* ------------------------------- 5. the drag and button operations */

{
  const s = C.start({});
  const moved = C.moveVertex(s, 0, pt(300, 90));
  check("dragging a vertex moves just that vertex",
    moved.vertices[0].x === 300 && moved.vertices[0].y === 90 &&
    [1, 2].every((j) => near(moved.vertices[j].x, s.vertices[j].x) &&
                        near(moved.vertices[j].y, s.vertices[j].y)));
  check("dragging a vertex keeps the chain closed", C.compute(moved).closure < 1e-4);
  check("dragging a vertex keeps DEF equilateral", C.compute(moved).equilateral < 1e-4);
  check("dragging a vertex leaves the old state alone", s.vertices[0].x === 250);
  check("a vertex is clamped to the board",
    C.moveVertex(s, 0, pt(1000, -1000)).vertices[0].x <= C.WIDTH - C.PAD &&
    C.moveVertex(s, 0, pt(1000, -1000)).vertices[0].y >= C.PAD);
  check("an unknown vertex is ignored", C.moveVertex(s, 7, pt(1, 1)) === s);

  const dragged = C.movePointTo(s, 0, pt(350, 220));
  check("dragging a chain point projects it onto its circle",
    near(C.dist(dragged.points[0], dragged.circles[0].center), dragged.circles[0].r, 1e-9));
  check("dragging a chain point follows the porism", C.compute(dragged).closure < 1e-4);
  check("the chain point drag keeps DEF equilateral", C.compute(dragged).equilateral < 1e-4);
  check("an unknown chain point is ignored", C.movePointTo(s, 9, pt(1, 1)) === s);

  const turned = C.turnPoint(s, 0, 1.234);
  check("turning a point moves it round its circle",
    !near(turned.points[0].x, s.points[0].x, 1e-6) || !near(turned.points[0].y, s.points[0].y, 1e-6));
  check("turning a point keeps the porism", C.compute(turned).closure < 1e-4);
  check("turning an unknown point is ignored", C.turnPoint(s, 5, 1) === s);
  const centred = C.movePointTo(s, 0, s.circles[0].center);
  check("a drag onto the centre still leaves the point on its circle",
    near(C.dist(centred.points[0], centred.circles[0].center), centred.circles[0].r, 1e-9));
  check("an option toggles only itself",
    C.toggle(s, "showPremises").showPremises === true &&
    C.toggle(s, "showPremises").showNames === true &&
    C.toggle(s, "showPremises").showStatement === false);
  check("an unknown option is ignored", C.toggle(s, "nope") === s);

  /* AdjustCircles after a vertex drag, against the second transcription. */
  let wrong = 0, n = 0;
  for (let t = 0; t < 300; t++) {
    const v = randomTriangle(20);
    if (!v) continue;
    const cir = Applet.circles(v, Applet.napoleons(v));
    const points = [0, 1, 2].map((j) => C.onCircle(cir[j], uniform(0, TAU)));
    const ang = Applet.angles(cir, points);
    const old = { vertices: v, circles: cir, points: points.map((p) => Applet.p2(p.x, p.y)), signedAngles: ang };
    for (let index = 0; index < 3; index++) {
      const nv = v.map((p) => Applet.p2(p.x, p.y));
      nv[index] = Applet.p2(uniform(30, 370), uniform(25, 225));
      const expect = Applet.adjustVertex(nv, cir, ang,
        points.map((p) => Applet.p2(p.x, p.y)), index);
      const got = C.moveVertex(
        { ...old, width: 400, height: 250, vertices: v, circles: cir, points: old.points },
        index, nv[index]);
      n++;
      if (!got.points.every((p, j) => near(p.x, expect.points[j].x, 1e-8) &&
                                     near(p.y, expect.points[j].y, 1e-8))) wrong++;
    }
  }
  check("AdjustCircles matches the applet after a vertex drag", wrong === 0,
    `${wrong} of ${n} drags`);
  check("the drag comparison covered many positions", n > 600, `${n}`);
}

done("hiai-019");
