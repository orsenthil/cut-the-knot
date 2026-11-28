#!/usr/bin/env node
"use strict";

/*
 * Logic test for hanner/hanner-core.js.
 *
 *   node porting/check-hanner.mjs
 *
 * Two independent readings of the old HannerCanvas are compared here:
 *
 * 1. A literal second transcription of GeoSDoub.Rotate / Intersect /
 *    NearestPoint / GetParallelTo, ComputeC, CollectAIsGreater,
 *    CollectBIsGreater and UpgradePoints (including its two calls per drag,
 *    the circumcircle glide for C and the A/B swap when FindOrientation is
 *    1). It shares no function with the core and compares every derived
 *    point and every piece vertex on a grid, at random, and after drags.
 * 2. The cut-the-knot page's claim: this is an uncentered Perigal dissection,
 *    so the five pieces of the hypotenuse square slide into the two leg
 *    squares. Areas, translation-only congruence, non-overlap and complete
 *    coverage are checked over many right triangles and both leg orders.
 *    The old applet's empty CollectEqual method is checked as a quirk.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("hanner/hanner-core.js", "HannerCore");

const pt = (x, y) => ({ x, y });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const polyArea = (p) => {
  let twice = 0;
  for (let i = 0; i < p.length; i++) {
    const u = p[i], v = p[(i + 1) % p.length];
    twice += u.x * v.y - v.x * u.y;
  }
  return Math.abs(twice / 2);
};

/* --------------- 1. the applet's own methods, transcribed a second time */

// GeoSDoub.Rotate: the first point is the centre; sin is multiplied by dir.
function apRotate(centre, point, a, dir) {
  const co = Math.cos(a), si = Math.sin(a);
  const dx = point.x - centre.x, dy = point.y - centre.y;
  const out = { x: 0, y: 0 };
  out.x = centre.x + co * dx - dir * si * dy;
  out.y = centre.y + dir * si * dx + co * dy;
  return out;
}
function apIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const den = a1 * b2 - a2 * b1;
  const out = { x: 0, y: 0 };
  if (Math.abs(den) < 1) { out.x = NaN; out.y = NaN; return out; }
  out.x = (b1 * c2 - b2 * c1) / den;
  out.y = (c1 * a2 - c2 * a1) / den;
  return out;
}
function apNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const out = { x: a.x, y: a.y };
  if (dx * dx + dy * dy < 0.1) return out;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  out.x = a.x + t * dx;
  out.y = a.y + t * dy;
  return out;
}
function apParallel(p, q, r) {
  return { x: p.x + 100 * (r.x - q.x), y: p.y + 100 * (r.y - q.y) };
}
function apAngle(v, p, q) {
  const d1 = dist(v, p), d2 = dist(v, q);
  const co = (d1 * d1 + d2 * d2 - dist(p, q) * dist(p, q)) / (2 * d1 * d2);
  return Math.acos(Math.max(-1, Math.min(1, co)));
}
function apOrientation(p, q, r) {
  const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return s > 0 ? 1 : -1;
}
function apComputeC(a, b, angle) {
  const rayA = apRotate(a, b, angle, -1);
  const rayB = apRotate(b, a, Math.PI / 2 - angle, 1);
  return apIntersect(a, rayA, b, rayB);
}
function apCircle(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const u = { x: m1.x + a.y - b.y, y: m1.y - a.x + b.x };
  const v = { x: m2.x + b.y - c.y, y: m2.y - b.x + c.x };
  const o = apIntersect(m1, u, m2, v);
  return { c: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
}
function apShift(poly, dx, dy) {
  const out = [];
  for (const p of poly) out.push({ x: p.x + dx, y: p.y + dy });
  return out;
}

/** HannerCanvas.Compute, with CollectAIsGreater / CollectBIsGreater in full. */
function apCompute(st) {
  const A = st.A, B = st.B, Cc = st.C;
  if (Number.isNaN(Cc.x) || Number.isNaN(Cc.y)) return { branch: "none", poly: [], trans: [] };
  const lenBC = dist(B, Cc), lenAC = dist(A, Cc);
  const aGreater = lenBC > lenAC;
  const equal = Math.abs(lenBC - lenAC) < 0.5;

  const Cq = apRotate(B, Cc, Math.PI / 2, 1);
  const Aq = apRotate(Cc, B, Math.PI / 2, -1);
  const Bq = apRotate(Cc, A, Math.PI / 2, 1);
  const Cp = apRotate(A, Cc, Math.PI / 2, -1);
  const Ap = apRotate(B, A, Math.PI / 2, -1);
  const Bp = apRotate(A, B, Math.PI / 2, 1);
  const M = apNearest(Cc, A, B);
  const Mp = apNearest(Cc, Ap, Bp);
  const parallel = apParallel(Cc, A, B);
  const derived = { Cq, Aq, Bq, Cp, Ap, Bp, M, Mp };
  const poly = [], trans = [];

  if (aGreater) {
    const Ma = apIntersect(B, Cq, Cc, parallel);
    const Mb = apIntersect(B, Ap, Aq, Cq);
    const K = apIntersect(B, Mb, Cc, parallel);
    poly.push([B, K, Ma]);
    trans.push(apShift(poly[0], A.x - K.x, A.y - K.y));
    poly.push([B, K, Cc]);
    trans.push(apShift(poly[1], B.x - K.x, B.y - K.y));
    poly.push([K, Ma, Cq, Mb]);
    trans.push(apShift(poly[2], Bp.x - K.x, Bp.y - K.y));
    poly.push([K, Mb, Aq, Cc]);
    trans.push(apShift(poly[3], Ap.x - K.x, Ap.y - K.y));
    poly.push([A, Cc, Bq, Cp]);
    trans.push(apShift(poly[4], M.x - Bq.x, M.y - Bq.y));
    return Object.assign(derived, { branch: "a", Ma, Mb, K, poly, trans });
  }
  if (!equal) {
    const Ma = apIntersect(A, Cp, Cc, parallel);
    const Mb = apIntersect(A, Bp, Cp, Bq);
    const K = apIntersect(A, Mb, Cc, parallel);
    poly.push([A, K, Cc]);
    trans.push(apShift(poly[0], A.x - K.x, A.y - K.y));
    poly.push([A, K, Ma]);
    trans.push(apShift(poly[1], M.x - Ma.x, M.y - Ma.y));
    poly.push([K, Cc, Bq, Mb]);
    trans.push(apShift(poly[2], 2 * A.x - Mb.x - K.x, 2 * A.y - Mb.y - K.y));
    poly.push([K, Mb, Cp, Ma]);
    trans.push(apShift(poly[3], Ap.x - K.x, Ap.y - K.y));
    poly.push([Aq, Cc, B, Cq]);
    trans.push(apShift(poly[4], M.x - Aq.x, M.y - Aq.y));
    return Object.assign(derived, { branch: "b", Ma, Mb, K, poly, trans });
  }
  // CollectEqual() in the class file is literally `return`.
  return Object.assign(derived, { branch: "equal", poly: [], trans: [] });
}

/** UpgradePoints called once, as on mouseDragged and again on mouseReleased. */
function apUpgrade(next, name) {
  if (name === "C") next.angleA = apAngle(next.A, next.B, next.C);
  else if (name === "A" || name === "B") next.C = apComputeC(next.A, next.B, next.angleA);
  if (apOrientation(next.A, next.B, next.C) === 1) {
    const old = next.A;
    next.A = next.B;
    next.B = old;
  }
}
function apMove(st, name, point) {
  const next = Object.assign({}, st, { explored: true });
  if (name === "C" && st.circle) {
    const dx = point.x - st.circle.c.x, dy = point.y - st.circle.c.y;
    const factor = st.circle.r / Math.hypot(dx, dy);
    next.C = { x: st.circle.c.x + dx * factor, y: st.circle.c.y + dy * factor };
  } else {
    next[name] = { x: point.x, y: point.y };
  }
  apUpgrade(next, name);
  apUpgrade(next, name);
  return next;
}

/* -------------------------------- the configurations, grid and random */

const rand = rng(5312);
const states = [];
for (let deg = 8; deg <= 82; deg += 2) {
  for (const span of [150, 300, 440]) {
    for (const [ox, oy] of [[5, 12], [40, 60]]) {
      const angle = deg * Math.PI / 180;
      const a = pt(ox, oy), b = pt(ox + span, oy);
      states.push({ A: a, B: b, C: C.computeC(a, b, angle), angleA: angle, circle: null });
    }
  }
}
for (let i = 0; i < 240; i++) {
  const angle = (6 + rand() * 78) * Math.PI / 180;
  const a = pt(5 + rand() * 200, 5 + rand() * 250);
  const b = pt(a.x + 90 + rand() * 300, a.y + (rand() - 0.5) * 30);
  states.push({ A: a, B: b, C: C.computeC(a, b, angle), angleA: angle, circle: null });
}

function samePoint(x, y, tol) {
  return Math.abs(x.x - y.x) <= tol && Math.abs(x.y - y.y) <= tol;
}

/* ----------------------------------------------- 1. rules, options, status */

{
  const s = C.start({});
  check("the board keeps the applet's size", C.VIEW.width === 520 && C.VIEW.height === 460);
  check("A is one third across and nine sixteenths down",
    s.A.x === 520 / 3 && s.A.y === 460 * 9 / 16);
  check("B is two thirds across at the same height",
    Math.abs(s.B.x - 2 * 520 / 3) < 1e-12 && s.B.y === s.A.y);
  check("the applet's opening angle is 30 degrees", Math.abs(s.angleA - Math.PI / 6) < 1e-14);
  const right = (s.A.x - s.C.x) * (s.B.x - s.C.x) + (s.A.y - s.C.y) * (s.B.y - s.C.y);
  check("ComputeC starts from a right triangle at C", Math.abs(right) < 1e-9);
  equal("the three draggable handles", C.legalMoves(s), ["A", "B", "C"]);
  check("a demo never wins or loses", C.result(s) === null &&
    C.result(C.move(s, "A", pt(100, 100))) === "done");
  check("an unknown handle is refused", C.move(s, "Z", pt(1, 2)) === s);
  check("a point is clamped to the board", C.move(s, "A", pt(9999, -20)).A.x === 520);
  check("the hint box starts off and reset keeps options",
    !s.options.hint && C.setOption(s, "hint", true).options.hint &&
    !s.options.hint && C.setOption(s, "nonsense", true) === s &&
    C.reset(C.setOption(s, "hint", true)).options.hint === true &&
    C.reset(s).angleA === Math.PI / 6);
  const circleState = C.beginDrag(s, "C");
  check("grabbing C sets the triangle's circumcircle", Boolean(circleState.circle) &&
    Math.abs(dist(circleState.circle.c, s.A) - circleState.circle.r) < 1e-8 &&
    Math.abs(dist(circleState.circle.c, s.B) - circleState.circle.r) < 1e-8 &&
    Math.abs(dist(circleState.circle.c, s.C) - circleState.circle.r) < 1e-8);
  check("freeing C releases the circle", C.freeC(circleState).circle === null);
  const glided = C.move(circleState, "C", pt(s.C.x + 80, s.C.y + 130));
  check("C glides on the circle when dragged",
    Math.abs(dist(glided.C, circleState.circle.c) - circleState.circle.r) < 1e-8 &&
    glided.C !== s.C);
  check("an unknown option or handle is ignored by every entry point",
    C.beginDrag(s, "A") === s && C.freeC(s) === s);
}

/* ------------- 2. the core against the independent bytecode transcription */

{
  let worst = 0, worstName = "", compared = 0, branches = { a: 0, b: 0, equal: 0 };
  const pointNames = ["Cq", "Aq", "Bq", "Cp", "Ap", "Bp", "M", "Mp", "Ma", "Mb", "K"];
  for (const s of states) {
    const mine = C.geometry(s), his = apCompute(s);
    compared++;
    branches[mine.branch]++;
    if (mine.branch !== his.branch) throw new Error(`branch differs at ${JSON.stringify(s)}`);
    for (const name of pointNames) {
      const u = mine[name], v = his[name];
      if (!u && !v) continue;
      if (!u || !v) throw new Error(`missing ${name} at ${JSON.stringify(s)}`);
      const d = Math.max(Math.abs(u.x - v.x), Math.abs(u.y - v.y));
      if (d > worst) { worst = d; worstName = name; }
    }
    if (mine.poly.length !== his.poly.length || mine.trans.length !== his.trans.length) {
      throw new Error(`piece count differs at ${JSON.stringify(s)}`);
    }
    for (let i = 0; i < mine.poly.length; i++) {
      for (let j = 0; j < mine.poly[i].length; j++) {
        const d = Math.max(
          Math.abs(mine.poly[i][j].x - his.poly[i][j].x),
          Math.abs(mine.poly[i][j].y - his.poly[i][j].y));
        if (d > worst) { worst = d; worstName = `poly${i}`; }
      }
      for (let j = 0; j < mine.trans[i].length; j++) {
        const d = Math.max(
          Math.abs(mine.trans[i][j].x - his.trans[i][j].x),
          Math.abs(mine.trans[i][j].y - his.trans[i][j].y));
        if (d > worst) { worst = d; worstName = `trans${i}`; }
      }
    }
  }
  check(`every derived point and piece matches the bytecode (${compared} cases, worst ${worst.toExponential(1)} at ${worstName})`,
    compared === states.length && worst < 1e-7);
  check(`both collectors are exercised (a:${branches.a}, b:${branches.b})`,
    branches.a > 20 && branches.b > 20);

  let drags = 0, dragWorst = 0;
  for (let i = 0; i < states.length; i += 7) {
    const s = states[i];
    for (const name of C.NAMES) {
      const grabbed = C.beginDrag(s, name);
      const p = pt(20 + rand() * 470, 20 + rand() * 410);
      const mine = C.move(grabbed, name, p);
      const his = apMove(grabbed, name, p);
      for (const key of ["A", "B", "C"]) {
        dragWorst = Math.max(dragWorst, Math.abs(mine[key].x - his[key].x),
          Math.abs(mine[key].y - his[key].y));
      }
      dragWorst = Math.max(dragWorst, Math.abs(mine.angleA - his.angleA));
      drags++;
    }
  }
  check(`drags (including C's circle glide) match the bytecode (${drags}, worst ${dragWorst.toExponential(1)})`,
    dragWorst < 1e-7);

  const over = { A: pt(0, 0), B: pt(20, 0), C: pt(10, 5), angleA: 0.5, circle: null };
  const dragged = C.move(over, "C", pt(10, 5));
  check("the A/B swap happens only for FindOrientation == 1 (applet's own test)",
    apOrientation(over.A, over.B, over.C) === 1 &&
    dragged.A.x === 20 && dragged.B.x === 0 && apOrientation(dragged.A, dragged.B, dragged.C) === -1);
  const above = { A: pt(0, 0), B: pt(20, 0), C: pt(10, -5), angleA: 0.5, circle: null };
  const noSwap = C.move(above, "A", pt(1, 0));
  check("a right triangle above AB is not swapped",
    apOrientation(above.A, above.B, above.C) === -1 &&
    noSwap.A.x === 1 && noSwap.B.x === 20);
}

/* -------------------------------- 3. the page's dissection claim */

function inside(p, poly) {
  let odd = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) odd = !odd;
  }
  return odd;
}

/** Sample a box: every interior point of each expected square must be hit
 *  exactly once, and no sampled point outside them may be covered. */
function onEdge(p, poly, tol) {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    if (Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) < tol) return true;
  }
  return false;
}

function coverage(polys, expected, box, step) {
  let coveredOnce = 0, missed = 0, overlaps = 0, stray = 0;
  const tol = step * 1e-4;
  for (let x = box.x0 + step / 2; x < box.x1; x += step) {
    for (let y = box.y0 + step / 2; y < box.y1; y += step) {
      const p = pt(x, y);
      const want = expected.some((q) => inside(p, q));
      let hits = 0;
      for (const poly of polys) if (inside(p, poly)) hits++;
      if (hits === 1) coveredOnce++;
      // At an isosceles right triangle two pieces go degenerate; a sample
      // exactly on their shared edge counts as covered.
      if (want && hits === 0 && !polys.some((q) => onEdge(p, q, tol))) missed++;
      if (hits > 1) overlaps++;
      if (!want && hits > 0) stray++;
    }
  }
  return { coveredOnce, missed, overlaps, stray };
}

{
  let areaWorst = 0, congruenceWorst = 0, cases = 0;
  const samples = [];
  for (let deg = 5; deg <= 85; deg += 4) {
    for (const span of [8, 20, 55]) {
      const angle = deg * Math.PI / 180;
      const A = pt(0, 0), B = pt(span, 0);
      const state = { A, B, C: C.computeC(A, B, angle), angleA: angle, circle: null };
      const g = C.geometry(state);
      // The bytecode's empty CollectEqual draws nothing in its 0.5-unit
      // band; that quirk is checked separately below, not as a tiling case.
      if (g.poly.length !== 5) continue;
      const sumPoly = g.poly.reduce((s, p) => s + polyArea(p), 0);
      const sumTrans = g.trans.reduce((s, p) => s + polyArea(p), 0);
      const legSum = g.a * g.a + g.b * g.b;
      const hyp = C.dist(A, B) ** 2;
      areaWorst = Math.max(areaWorst, Math.abs(sumPoly - hyp), Math.abs(sumTrans - legSum));
      for (let i = 0; i < g.poly.length; i++) {
        for (let j = 0; j < g.poly[i].length; j++) {
          const p = g.poly[i][j], q = g.trans[i][j];
          const dx = q.x - p.x, dy = q.y - p.y;
          for (let k = 0; k < g.poly[i].length; k++) {
            const pk = g.poly[i][k], qk = g.trans[i][k];
            congruenceWorst = Math.max(congruenceWorst,
              Math.abs((qk.x - pk.x) - dx), Math.abs((qk.y - pk.y) - dy));
          }
        }
      }
      cases++;
      if (span === 20 && deg % 8 === 5) samples.push({ g, hyp, legSum });
    }
  }
  check(`the five pieces have the hypotenuse square's area (${cases} right triangles, worst ${areaWorst.toExponential(1)})`,
    areaWorst < 1e-7);
  check(`every moved piece is the same piece translated only (worst ${congruenceWorst.toExponential(1)})`,
    congruenceWorst < 1e-9);

  let missed = 0, overlaps = 0, stray = 0, tiled = 0;
  for (const { g, hyp } of samples) {
    const span = C.dist(g.A, g.B);
    const hypBox = { x0: 0, y0: 0, x1: span, y1: span };
    const t = coverage(g.trans, [g.squares.hypotenuse], hypBox, span / 90);
    const xs = g.squares.onAC.concat(g.squares.onBC).map((p) => p.x);
    const ys = g.squares.onAC.concat(g.squares.onBC).map((p) => p.y);
    const legBox = {
      x0: Math.min(...xs) - 0.1, x1: Math.max(...xs) + 0.1,
      y0: Math.min(...ys) - 0.1, y1: 0.1,
    };
    const l = coverage(g.poly, [g.squares.onAC, g.squares.onBC], legBox, span / 90);
    missed += t.missed + l.missed;
    overlaps += t.overlaps + l.overlaps;
    stray += t.stray + l.stray;
    if (t.missed === 0 && l.missed === 0 && t.overlaps === 0 && l.overlaps === 0 &&
        t.stray === 0 && l.stray === 0) tiled++;
    check(`right triangle at angle ${Math.round(C.computeAngle(g.A, g.B, g.C) * 180 / Math.PI)}° fills both squares (area ${Math.round(hyp)})`,
      t.missed === 0 && l.missed === 0 && t.overlaps === 0 && l.overlaps === 0 &&
      t.stray === 0 && l.stray === 0);
  }
  check(`complete tiling of both squares on ${tiled}/${samples.length} sampled right triangles`,
    tiled === samples.length && samples.length >= 8);

  const isosceles = { A: pt(0, 0), B: pt(20, 0),
    C: C.computeC(pt(0, 0), pt(20, 0), 44 * Math.PI / 180), angleA: 44 * Math.PI / 180, circle: null };
  const gi = C.geometry(isosceles);
  check("the empty CollectEqual leaves no fresh pieces in its near-equal band",
    gi.branch === "equal" && gi.poly.length === 0 && gi.a < gi.b &&
    gi.b - gi.a < 0.5 && apCompute(isosceles).poly.length === 0);

  const free = C.freeC(C.start({}));
  const skewed = C.move(free, "C", pt(320, 140));
  const gs = C.geometry(skewed);
  const skewSum = gs.poly.reduce((s, p) => s + polyArea(p), 0);
  check("with C freed from its circle the pieces stop fitting both squares",
    Math.abs(skewSum - C.dist(gs.A, gs.B) ** 2) > 1);
  check("a NaN apex stops the old Compute before it builds pieces",
    C.geometry({ ...C.start({}), C: pt(NaN, 0) }).poly.length === 0);
}

done("hanner");
