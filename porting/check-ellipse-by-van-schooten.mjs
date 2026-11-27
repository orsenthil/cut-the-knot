#!/usr/bin/env node
"use strict";

/*
 * Logic test for ellipse-by-van-schooten/ellipse-by-van-schooten-core.js.
 *
 *   node porting/check-ellipse-by-van-schooten.mjs
 *
 * Part 1 checks the initial configuration against the applet's init().
 * Part 2 checks the page's claims over hundreds of configurations: the right
 * angle AOB, the constant circumradius, Thales' right angle POQ, the diameter
 * PQ, and the ellipse equation with half-axes R + MC and R - MC.
 * Part 3 replays the applet's own AMoved/BMoved/UpgradeAngles/Compute methods
 * from a second, literal bytecode transcription over a grid of starting
 * coefficients, both modes and hundreds of drags.
 */

import { loadCore, check, done } from "./lib/load-core.mjs";

const C = loadCore("ellipse-by-van-schooten/ellipse-by-van-schooten-core.js", "EllipseByVanSchootenCore");
const near = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps;
const point = (x, y) => ({ x: x, y: y });
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const dot = (p, q) => p.x * q.x + p.y * q.y;
const sub = (p, q) => point(p.x - q.x, p.y - q.y);
const add = (p, q) => point(p.x + q.x, p.y + q.y);
const scale = (p, k) => point(p.x * k, p.y * k);
const unit = (p) => { const r = Math.hypot(p.x, p.y) || 1; return point(p.x / r, p.y / r); };
const same = (p, q, eps = 1e-7) => p && q && near(p.x, q.x, eps) && near(p.y, q.y, eps);

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start({});
  const W = 400, H = 250;
  check("the board is the applet's optimal 400 by 250", s.WIDTH === W && s.HEIGHT === H);
  check("O is at (3W/7, 4H/7)", same(s.O, point((W * 3) / 7, (H * 4) / 7), 1e-12));
  check("X is at (4W/5, O.y)", same(s.X, point((W * 4) / 5, s.O.y), 1e-12));
  check("Y is at (O.x, H/5)", same(s.Y, point(s.O.x, H / 5), 1e-12));
  check("A is at parameter 0.6 on the X arm", same(s.A, point(260.57142857142856, s.O.y), 1e-12));
  check("B is at parameter 0.5 on the Y arm", same(s.B, point(s.O.x, 96.42857142857143), 1e-12));
  check("the rod starts with the applet's length", near(s.length, d(s.A, s.B), 1e-12));
  check("the starting angles are pi/6 and pi/3", near(s.angles.x, Math.PI / 6, 1e-12) && near(s.angles.y, Math.PI / 3, 1e-12));
  check("Define triangle starts unchecked (AB is preserved)", s.options.rigid === true);
  check("Trace starts unchecked", s.options.trace === false);
  check("Hint starts unchecked", s.options.hint === false);
  check("names start shown", s.options.names === true);
  check("the starting C comes from rotating AB by those angles", same(s.C, point(144.76013512918334, 216.602971123682), 1e-9));
  check("the circle through O, A, B has the applet's radius", near(s.circle.radius, 50.25450533158646, 1e-9));
  check("an illustration reports no win and no loss", typeof C.describe(s) === "string" && !/won|lost|win|lose/i.test(C.describe(s)));
}

/* ------------------------------- 2. the page's claims, over many positions */

{
  const first = C.start({});
  const u0 = unit(sub(first.P, first.O));       // one fixed OP line through O
  const v0 = point(-u0.y, u0.x);                // the perpendicular OQ line
  let s = first;
  let rightOAB = 0, equalR = 0, rightPOQ = 0, onCircle = 0, diameter = 0;
  let ellipse = 0, halfAxes = 0, fixedLines = 0, traceCap = 0;
  const R0 = first.circle.radius;
  for (let i = 0; i < 240; i++) {
    const x = 172 + (i % 60) * 2.4;
    s = C.moveA(s, point(x, s.O.y));
    if (!s.P || !s.Q || !Number.isFinite(s.circle.radius)) continue;
    const M = s.circle.center, R = s.circle.radius, mc = d(M, s.C);
    const oa = sub(s.A, s.O), ob = sub(s.B, s.O);
    if (Math.abs(dot(oa, ob)) > 1e-6 * d(oa, ob) * d(ob, ob)) rightOAB++;
    if (!near(R, R0, 1e-7)) equalR++;
    if (Math.abs(dot(sub(s.P, s.O), sub(s.Q, s.O))) > 1e-5) rightPOQ++;
    if (Math.abs(d(M, s.O) - R) > 1e-6 || Math.abs(d(M, s.A) - R) > 1e-6 ||
        Math.abs(d(M, s.B) - R) > 1e-6) onCircle++;
    if (!same(scale(add(s.P, s.Q), 0.5), M, 1e-6)) diameter++;
    const big = Math.max(d(s.C, s.P), d(s.C, s.Q));
    const small = Math.min(d(s.C, s.P), d(s.C, s.Q));
    if (!near(big, R + mc, 1e-6) || !near(small, Math.abs(R - mc), 1e-6)) halfAxes++;
    const u = dot(sub(s.C, s.O), u0), v = dot(sub(s.C, s.O), v0);
    const res1 = (u / big) ** 2 + (v / small) ** 2 - 1;
    const res2 = (u / small) ** 2 + (v / big) ** 2 - 1;
    if (Math.min(Math.abs(res1), Math.abs(res2)) > 1e-6) ellipse++;
    // P and Q stay on the two perpendicular fixed lines through O; the
    // circle/line intersection may list them in either order.
    const on = (p, u) => Math.abs(sub(p, s.O).x * u.y - sub(p, s.O).y * u.x);
    const order1 = on(s.P, u0) < 1e-5 && on(s.Q, v0) < 1e-5;
    const order2 = on(s.P, v0) < 1e-5 && on(s.Q, u0) < 1e-5;
    if (!order1 && !order2) fixedLines++;
  }
  check("AOB stays a right angle while AB slides", rightOAB === 0, `${rightOAB} bad`);
  check("circle L keeps the same radius for fixed AB and angle", equalR === 0, `${equalR} bad`);
  check("POQ is right because PQ is a diameter (Thales)", rightPOQ === 0, `${rightPOQ} bad`);
  check("O, A and B all lie on circle L", onCircle === 0, `${onCircle} bad`);
  check("M is the midpoint of PQ", diameter === 0, `${diameter} bad`);
  check("the half-axes are R + MC and R - MC", halfAxes === 0, `${halfAxes} bad`);
  check("C satisfies the ellipse equation in the OP/OQ frame", ellipse === 0, `${ellipse} bad`);
  check("P and Q remain on the two fixed perpendicular lines through O", fixedLines === 0, `${fixedLines} bad`);

  // The same checks on B drags rather than A drags.
  s = C.start({});
  let badB = 0;
  for (let i = 0; i < 160; i++) {
    s = C.moveB(s, point(s.O.x, 52 + (i % 40) * 2));
    if (!s.P || !s.Q) continue;
    const R = s.circle.radius, mc = d(s.circle.center, s.C);
    const big = Math.max(d(s.C, s.P), d(s.C, s.Q));
    const small = Math.min(d(s.C, s.P), d(s.C, s.Q));
    if (!near(R, R0, 1e-7) || !near(big, R + mc, 1e-6) ||
        !near(small, Math.abs(R - mc), 1e-6)) badB++;
  }
  check("the invariants also hold while B is dragged", badB === 0, `${badB} bad`);

  // "Define triangle" mode: A and B move independently and the rod changes.
  let free = C.start({});
  free = C.setOption(free, "rigid", false);
  const before = free.length;
  free = C.moveA(free, point(200, free.O.y));
  const afterA = d(free.A, free.B);
  free = C.moveB(free, point(free.O.x, 70));
  const afterB = d(free.A, free.B);
  check("Define triangle lets AB change length", !near(afterA, before, 1e-6) || !near(afterB, afterA, 1e-6));
  check("A stays on the X arm in free mode", near(free.A.y, free.O.y, 1e-9));
  check("B stays on the Y arm in free mode", near(free.B.x, free.O.x, 1e-9));
  const movedC = C.moveC(free, point(220, 110));
  check("dragging C in free mode stores the triangle's angles",
    same(movedC.C, point(220, 110), 1e-9) && !same(movedC.angles, free.angles, 1e-9));

  // Trace: the applet keeps 500 points and throws the trace away on a toggle.
  let traced = C.setOption(C.start({}), "trace", true);
  for (let i = 0; i < 620; i++) traced = C.moveA(traced, point(170 + (i % 80), traced.O.y));
  check("the trace is capped at 500 points", traced.trace.length === C.TRACE_LIMIT && C.TRACE_LIMIT === 500);
  check("switching Define triangle clears the trace", C.setOption(traced, "rigid", false).trace.length === 0);
  check("switching Trace off clears the trace", C.setOption(traced, "trace", false).trace.length === 0);
  check("the status line reports the circle radius and C", /radius \d/.test(C.describe(traced)));

  // The page's "fixed AB, mobile O" circular-arc remark is about a different
  // viewpoint than the applet implements: O is fixed here and the arms turn.
  // What is true in the applet is that M stays R from O; check that too.
  let mobile = C.start({});
  let offCircle = 0;
  for (let i = 0; i < 120; i++) {
    mobile = C.moveX(mobile, point(320 - i * 0.7, mobile.O.y));
    if (Math.abs(d(mobile.circle.center, mobile.O) - mobile.circle.radius) > 1e-6) offCircle++;
  }
  check("M stays one radius from O when an arm is turned", offCircle === 0, `${offCircle} bad`);
}

/* ---------------- 3. a second, literal transcription of the applet's code */

function ref() {
  const P = (x, y) => ({ x: x, y: y });
  const plus = (a, b) => P(a.x + b.x, a.y + b.y);
  const minus = (a, b) => P(a.x - b.x, a.y - b.y);
  const sq = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
  const dst = (a, b) => Math.sqrt(sq(a, b));

  // GeoSDoub.FindOrientation, from its bytecode's cross-product expression.
  function orient(a, b, c) {
    const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return v > 0 ? 1 : -1;
  }
  // GeoSDoub.ComputeSignedAngle (the dead acos > 0.99 branch is unreachable).
  function signed(a, b, c) {
    const pq = dst(a, b), qr = dst(b, c);
    const cos = (sq(a, b) + sq(b, c) - sq(a, c)) / (2 * pq * qr);
    const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
    return orient(a, b, c) === 1 ? ang : -ang;
  }
  // GeoSDoub.Intersect(DoubPoint x4), with its 1-unit |denominator| cutoff.
  function cross4(a, b, c, e) {
    const v4 = a.y - b.y, v6 = b.x - a.x, v8 = a.x * b.y - a.y * b.x;
    const v10 = c.y - e.y, v12 = e.x - c.x, v14 = c.x * e.y - c.y * e.x;
    const v16 = v6 * v14 - v12 * v8, v18 = v8 * v10 - v14 * v4, v20 = v4 * v12 - v10 * v6;
    if (Math.abs(v20) < 1) return P(NaN, NaN);
    return P(v16 / v20, v18 / v20);
  }
  // GeoSDoub.FindCircumcenter: midpoints and perpendicular directions.
  function circum(a, b, c) {
    const m1 = P((a.x + b.x) / 2, (a.y + b.y) / 2);
    const m2 = P((b.x + c.x) / 2, (b.y + c.y) / 2);
    return cross4(m1, plus(m1, P(b.y - a.y, -(b.x - a.x))),
      m2, plus(m2, P(c.y - b.y, -(c.x - b.x))));
  }
  // EllipseByVanSchootenCanvas.GetCircle.
  function getCircle(a, b, c) {
    const m = circum(a, b, c);
    const r = (dst(m, a) + dst(m, b) + dst(m, c)) / 3;
    return { m: m, r: r };
  }
  // GeoSDoub.Intersect(DoubLine, DoubCircle), using IntersectX/IntersectY.
  function lineCircle(a, b, circle) {
    if (Math.abs(a.y - b.y) > 1) {
      const k = (a.x - b.x) / (a.y - b.y);
      const c = b.x - k * b.y;
      const aa = k * k + 1;
      const bb = k * (c - circle.m.x) - circle.m.y;
      const cc = circle.m.y * circle.m.y + (c - circle.m.x) * (c - circle.m.x) - circle.r * circle.r;
      const disc = bb * bb - aa * cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
      return [P(k * t1 + c, t1), P(k * t2 + c, t2)];
    }
    if (Math.abs(a.x - b.x) > 1) {
      const k = (a.y - b.y) / (a.x - b.x);
      const c = b.y - k * b.x;
      const aa = k * k + 1;
      const bb = k * (c - circle.m.y) - circle.m.x;
      const cc = circle.m.x * circle.m.x + (c - circle.m.y) * (c - circle.m.y) - circle.r * circle.r;
      const disc = bb * bb - aa * cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
      return [P(t1, k * t1 + c), P(t2, k * t2 + c)];
    }
    return null;
  }
  // GeoSDoub.Rotate.
  function rotate(o, p, ang, dir) {
    const cs = Math.cos(ang), sn = Math.sin(ang);
    return P(o.x + cs * (p.x - o.x) - dir * sn * (p.y - o.y),
      o.y + dir * sn * (p.x - o.x) + cs * (p.y - o.y));
  }
  // DoubLine.UpdateMidPoint's parameter, then the midpoint itself.
  function updateT(p, q, mid) {
    const dx = p.x - q.x, dy = p.y - q.y;
    return -((dx * (q.x - mid.x) + dy * (q.y - mid.y)) / (dx * dx + dy * dy));
  }
  function at(p, q, t) { return P(p.x + t * (q.x - p.x), p.y + t * (q.y - p.y)); }
  // GeoSDoub.NearestPoint (the SqDist < 0.1 short circuit is negligible).
  function nearest(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return P(a.x + dx * t, a.y + dy * t);
  }

  // A complete state, transcribed from init() in the order the applet builds it.
  function start(ca, cb, angC, angB, rigid) {
    const W = 400, H = 250;
    const O = P((W * 3) / 7, (H * 4) / 7);
    const X = P((W * 4) / 5, O.y);
    const Y = P(O.x, H / 5);
    const A = at(O, X, ca), B = at(O, Y, cb);
    const st = { O: O, X: X, Y: Y, A: A, B: B, As: P(A.x, A.y), Bs: P(B.x, B.y),
      ca: ca, cb: cb, length: dst(A, B), ang: P(angC, angB), C: P(0, 0), rigid: rigid };
    upgradeP(st);
    return st;
  }
  function upgradeAngles(st) {
    st.ang = P(signed(st.B, st.C, st.A), signed(st.A, st.B, st.C));
    return st;
  }
  function upgradeP(st) {
    const upper = rotate(st.A, st.B, st.ang.x, -1);
    const lower = rotate(st.B, st.A, st.ang.y, 1);
    st.C = cross4(st.B, upper, st.A, lower);
    return st;
  }
  function compute(st) {
    st.circle = getCircle(st.O, st.A, st.B);
    if (Math.abs(dst(st.circle.m, st.C) - st.circle.r) > 1) {
      const hits = lineCircle(st.circle.m, st.C, st.circle);
      if (hits) { st.P = hits[0]; st.Q = hits[1]; }
    }
    return st;
  }
  // AMoved from the bytecode, followed by the tail common to both modes.
  function moveA(st, raw) {
    const A = nearest(raw, st.O, st.X);
    st.A = A;
    if (st.rigid) {
      const hits = lineCircle(st.O, st.Y, { m: A, r: st.length });
      if (hits) {
        const chosen = orient(hits[0], st.X, st.O) === orient(st.B, st.X, st.O) ? hits[0] : hits[1];
        st.B = chosen;
        st.cb = updateT(st.O, st.Y, st.B);
        st.As = P(A.x, A.y);
        st.ca = updateT(st.O, st.X, st.A);
        upgradeP(st);
      } else {
        st.A = P(st.As.x, st.As.y);
      }
    } else {
      st.ca = updateT(st.O, st.X, st.A);
      upgradeAngles(st);
    }
    st.length = dst(st.A, st.B);
    st.ca = updateT(st.O, st.X, st.A);
    return compute(st);
  }
  // BMoved from the bytecode.
  function moveB(st, raw) {
    const B = nearest(raw, st.O, st.Y);
    st.B = B;
    if (st.rigid) {
      const hits = lineCircle(st.O, st.X, { m: B, r: st.length });
      if (hits) {
        const chosen = orient(hits[0], st.O, st.Y) === orient(st.A, st.O, st.Y) ? hits[0] : hits[1];
        st.A = chosen;
        st.ca = updateT(st.O, st.X, st.A);
        st.Bs = P(B.x, B.y);
        st.cb = updateT(st.O, st.Y, st.B);
        upgradeP(st);
      } else {
        st.B = P(st.Bs.x, st.Bs.y);
      }
    } else {
      st.cb = updateT(st.O, st.Y, st.B);
      upgradeAngles(st);
    }
    st.length = dst(st.A, st.B);
    st.cb = updateT(st.O, st.Y, st.B);
    return compute(st);
  }
  function moveC(st, raw) { st.C = P(raw.x, raw.y); upgradeAngles(st); compute(st); return st; }
  function moveX(st, raw) {
    st.X = P(raw.x, raw.y);
    st.A = at(st.O, st.X, st.ca); st.As = P(st.A.x, st.A.y);
    upgradeAngles(st); st.length = dst(st.A, st.B); compute(st); return st;
  }
  function moveY(st, raw) {
    st.Y = P(raw.x, raw.y);
    st.B = at(st.O, st.Y, st.cb); st.Bs = P(st.B.x, st.B.y);
    upgradeAngles(st); st.length = dst(st.A, st.B); compute(st); return st;
  }
  return { start: start, moveA: moveA, moveB: moveB, moveC: moveC,
    moveX: moveX, moveY: moveY, upgradeP: upgradeP, compute: compute };
}

const R = ref();
{
  let badStart = 0, badA = 0, badB = 0, badC = 0, badX = 0, badY = 0, badCircle = 0, used = 0;
  for (let ia = 1; ia <= 9; ia++) {
    for (let ib = 1; ib <= 9; ib++) {
      for (const rigid of [true, false]) {
        const ca = ia / 10, cb = ib / 10;
        const angC = Math.PI / 12, angB = Math.PI / 4;
        let core = C.start({ rigid: rigid, names: true });
        // Give both transcriptions the same starting coefficients and angles.
        core = Object.assign({}, core, {
          A: C.lerp(core.O, core.X, ca), B: C.lerp(core.O, core.Y, cb),
          As: C.lerp(core.O, core.X, ca), Bs: C.lerp(core.O, core.Y, cb),
          coefA: ca, coefB: cb, angles: point(angC, angB),
        });
        core.length = d(core.A, core.B);
        core = C.upgradePFromAngles(core);
        let apple = R.start(ca, cb, angC, angB, rigid);
        if (!same(core.C, apple.C, 1e-8) || !near(core.length, apple.length, 1e-8)) badStart++;
        for (let k = 0; k < 14; k++) {
          const rx = 165 + ((k * 13 + ia * 7) % 150);
          const ry = 55 + ((k * 19 + ib * 11) % 100);
          const coreA = C.moveA(core, point(rx, core.O.y));
          const appleA = R.moveA(Object.assign({}, apple), point(rx, apple.O.y));
          if (!same(coreA.A, appleA.A, 1e-7) || !same(coreA.B, appleA.B, 1e-7) ||
              !same(coreA.C, appleA.C, 1e-6) || !near(coreA.length, appleA.length, 1e-7)) badA++;
          core = coreA; apple = appleA;
          const coreB = C.moveB(core, point(core.O.x, ry));
          const appleB = R.moveB(Object.assign({}, apple), point(apple.O.x, ry));
          if (!same(coreB.A, appleB.A, 1e-7) || !same(coreB.B, appleB.B, 1e-7) ||
              !same(coreB.C, appleB.C, 1e-6) || !near(coreB.length, appleB.length, 1e-7)) badB++;
          core = coreB; apple = appleB;
        }
        const coreC = C.moveC(core, point(200, 100));
        const appleC = R.moveC(Object.assign({}, apple), point(200, 100));
        if (!same(coreC.C, appleC.C, 1e-8)) badC++;
        core = coreC; apple = appleC;
        const coreX = C.moveX(core, point(340, core.O.y));
        const appleX = R.moveX(Object.assign({}, apple), point(340, apple.O.y));
        if (!same(coreX.A, appleX.A, 1e-8)) badX++;
        core = coreX; apple = appleX;
        const coreY = C.moveY(core, point(core.O.x, 40));
        const appleY = R.moveY(Object.assign({}, apple), point(apple.O.x, 40));
        if (!same(coreY.B, appleY.B, 1e-8)) badY++;
        core = coreY; apple = appleY;
        if (core.circle && Math.abs(core.circle.radius - apple.circle.r) > 1e-7) badCircle++;
        if (core.P && apple.P && !same(core.P, apple.P, 1e-6)) badCircle++;
        used++;
      }
    }
  }
  check(`${used} starting triangles match the applet's init and UpgradeP`, badStart === 0, `${badStart} bad`);
  check("2,268 A drags match the bytecode's AMoved", badA === 0, `${badA} bad`);
  check("2,268 B drags match the bytecode's BMoved", badB === 0, `${badB} bad`);
  check("C, X and Y drags match the bytecode", badC + badX + badY === 0, `${badC}/${badX}/${badY} bad`);
  check("the construction agrees with Compute in every run", badCircle === 0, `${badCircle} bad`);

  // Reachability: a circle that misses the arm must restore As / Bs exactly.
  let badRevert = 0;
  for (let i = 0; i < 80; i++) {
    let core = C.start({});
    let apple = R.start(0.6, 0.5, Math.PI / 6, Math.PI / 3, true);
    core = C.moveA(core, point(180 + i, core.O.y));
    apple = R.moveA(Object.assign({}, apple), point(180 + i, apple.O.y));
    if (!same(core.A, apple.A, 1e-7) || !same(core.B, apple.B, 1e-7)) badRevert++;
  }
  check("rejected A moves restore the applet's saved point", badRevert === 0, `${badRevert} bad`);
}

done("ellipse-by-van-schooten");
