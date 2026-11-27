#!/usr/bin/env node
"use strict";

/*
 * Logic test for gothic-arc/gothic-arc-core.js.
 *
 *   node porting/check-gothic-arc.mjs
 *
 * 1. A second, literal transcription of GothicArcCanvas.init, DrawSmallCircle,
 *    DrawOneCircle and ApolloniusCircle.Compute, compared with the core over
 *    every WIDTH/HEIGHT configuration the applet's rectangle can use here.
 * 2. Every formula the cut-the-knot page states, checked exactly with integer
 *    arithmetic (R_n, R_1+R_2=OD, Pappus' height, DP_n, DO_n, the Euclid
 *    triples and the three named 3-4-5 triangles) and numerically against the
 *    circles the applet actually draws.
 * 3. The mode/names options, the tangencies and the saved position.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("gothic-arc/gothic-arc-core.js", "GothicArcCore");

const close = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
const closePoint = (a, b, tol = 1e-7) => close(a.x, b.x, tol) && close(a.y, b.y, tol);
const closeCircle = (a, b, tol = 1e-7) => closePoint(a.center, b.center, tol) && close(a.radius, b.radius, tol);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  check("the page's WIDTH parameter is 500", s.width === 500);
  check("the page's HEIGHT parameter is 400", s.height === 400);
  check("m_Margin and Num match the applet", C.MARGIN === 30 && C.NUM === 7);
  check("Show=1 turns both names and the gothic arc on", s.showNames && s.showGothic);
  check("A and B lie on one horizontal line", close(s.a.y, s.b.y) && s.b.x > s.a.x);
  check("C is two pixels to the right of the midpoint of AB",
    close(s.c.x, (s.a.x + s.b.x) / 2 + 2));
  check("the drawn chain has the applet's seven circles", C.chain(s).length === 7);
  const off = C.withOptions(s, { showNames: false, showGothic: false, count: 3 });
  check("names and the gothic arc can both be switched off", !off.showNames && !off.showGothic);
  check("the circle count follows the option", C.chain(off).length === 3);
  check("a reset keeps the options but restores the base",
    (() => { const q = C.reset(off); return close(q.a.x, 30) && !q.showGothic && q.count === 3; })());
}

/* --------------------------------- 2. second transcription of the bytecode */

/*
 * Written straight from javap of GothicArcCanvas.init and the three Apollonius
 * methods. It deliberately does not call any core helper.
 */
function appletInit(W, H, show) {
  const margin = 30;
  const side = Math.min(W - 2 * margin, 2 * (H - 2 * margin));
  const rect = { x: margin, y: H - 2 * margin - side / 2, w: side, h: side };
  const A = { x: rect.x, y: (2 * rect.y + rect.h) / 2 };
  const B = { x: rect.x + rect.w, y: (2 * rect.y + rect.h) / 2 };
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const R = dist(mid(A, B), A);
  const big = { center: mid(A, B), radius: R };
  const leftBig = { center: { x: B.x, y: B.y }, radius: R - 1 };
  // GeoSDoub.IntersectCirclesX chooses the smaller y for TopPoint.
  const dx = leftBig.center.x - big.center.x;
  const a0 = (big.radius ** 2 - leftBig.radius ** 2 + dx * dx) / (2 * dx);
  const h = Math.sqrt(big.radius ** 2 - a0 * a0);
  const candidates = [
    { x: big.center.x + a0, y: big.center.y - h },
    { x: big.center.x + a0, y: big.center.y + h },
  ];
  const top = candidates[0].y < candidates[1].y ? candidates[0] : candidates[1];
  const t = ((top.x - A.x) * (B.x - A.x) + (top.y - A.y) * (B.y - A.y)) /
    ((B.x - A.x) ** 2 + (B.y - A.y) ** 2);
  const D = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
  const Cpt = { x: (A.x + B.x) / 2 + 2, y: A.y };
  const va = { x: top.x - Cpt.x, y: top.y - Cpt.y };
  const vb = { x: B.x - Cpt.x, y: B.y - Cpt.y };
  const cos = (va.x * vb.x + va.y * vb.y) / (Math.hypot(va.x, va.y) * Math.hypot(vb.x, vb.y));
  const angleC = Math.round(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI);
  const O1 = mid(A, Cpt), O2 = mid(B, Cpt);
  const left = { center: O1, radius: dist(O1, Cpt) };
  const right = { center: O2, radius: dist(O2, Cpt) };
  return { A, B, Cpt, top, D, big, leftBig, left, right, angleC, show: show === "1" };
}

function appletInfo(c) {
  return c.center.x * c.center.x + c.center.y * c.center.y - c.radius * c.radius;
}

function appletCompute(c0, c1, c2, s0, s1, s2) {
  const A1 = 2 * (c1.center.x - c0.center.x);
  const A2 = 2 * (c2.center.x - c0.center.x);
  const B1 = 2 * (c1.center.y - c0.center.y);
  const B2 = 2 * (c2.center.y - c0.center.y);
  const o = appletInfo(c0);
  const D1 = o - appletInfo(c1);
  const D2 = o - appletInfo(c2);
  const K = A1 * B2 - A2 * B1;
  if (Math.abs(K) < 0.01) return null;
  const G = (B1 * D2 - B2 * D1) / K;
  const I = -(A1 * D2 - A2 * D1) / K;
  const d1 = 2 * (s0 * c0.radius - s1 * c1.radius);
  const d2 = 2 * (s0 * c0.radius - s2 * c2.radius);
  const v = (B1 * d2 - B2 * d1) / K;
  const w = -(A1 * d2 - A2 * d1) / K;
  const L = v * v + w * w - 1;
  if (Math.abs(L) < 0.001) return null;
  const cc = 2 * (v * G + w * I - v * c0.center.x - w * c0.center.y + s0 * c0.radius);
  const Q = G * G + I * I - 2 * G * c0.center.x - 2 * I * c0.center.y + o;
  let disc = cc * cc - 4 * L * Q;
  if (disc < 0) return null;
  disc = Math.sqrt(disc);
  const root = (t) => {
    const tr = Math.abs(t);
    return { center: { x: v * t + G, y: w * t + I }, radius: tr };
  };
  return [root((-cc + disc) / (2 * L)), root((-cc - disc) / (2 * L))];
}

function appletChain(g, count) {
  const out = [];
  let prev = g.left;
  for (let i = 1; i <= count; i++) {
    const grown = { center: { x: prev.center.x, y: prev.center.y + 1 }, radius: prev.radius + 1 };
    const bigGrown = {
      center: { x: g.big.center.x, y: g.big.center.y + 1 },
      radius: g.big.radius + 1,
    };
    // SetCircles(neighbour, rightCircle, inflate(big)), Compute(1, 1, -1).
    const pair = appletCompute(grown, g.right, bigGrown, 1, 1, -1);
    if (!pair) break;
    // UsedCircles is recreated empty on every DrawSmallCircle call.
    prev = pair[0];
    out.push({ center: { x: prev.center.x, y: prev.center.y }, radius: prev.radius });
  }
  return out;
}

{
  let geometryChecks = 0, circleChecks = 0, bad = 0;
  for (const W of [100, 140, 200, 280, 360, 440, 500, 620, 800]) {
    for (const H of [100, 160, 240, 320, 400, 520, 700]) {
      const s = C.start({ width: W, height: H });
      const g = appletInit(W, H, "1");
      const okGeom = closePoint(s.a, g.A) && closePoint(s.b, g.B) && closePoint(s.c, g.Cpt) &&
        closePoint(s.top, g.top) && closePoint(s.d, g.D) && s.angleC === g.angleC &&
        closeCircle(s.rightBig, g.big) && closeCircle(s.leftBig, g.leftBig) &&
        closeCircle(s.leftCircle, g.left) && closeCircle(s.rightCircle, g.right);
      geometryChecks++;
      if (!okGeom) bad++;
      const mine = C.chain(s), theirs = appletChain(g, 7);
      if (mine.length !== theirs.length) { bad++; continue; }
      for (let i = 0; i < mine.length; i++) {
        circleChecks++;
        if (!closeCircle(mine[i], theirs[i])) bad++;
      }
    }
  }
  check("init transcription agrees on all 63 WIDTH/HEIGHT settings", bad === 0 && geometryChecks === 63,
    `${bad} mismatches over ${geometryChecks} settings and ${circleChecks} circles`);
  check("every drawn circle matches the second transcription", bad === 0 && circleChecks >= 7 * 60,
    `${circleChecks} circle comparisons`);
}

/* ---------------------------------------------- 3. the page's exact claims */

{
  // R_n = Rr/(r^2 + r + n^2), r = 1; R_n = R/(2 + n^2); R_1 = R/3, R_2 = R/6.
  let ok = true;
  for (let n = 1; n <= 60; n++) {
    const q = C.ideal(1, n);
    if (!close(q.radius, 1 / (2 + n * n)) || !close(q.radius, 1 * 1 / (1 + 1 + n * n))) ok = false;
  }
  check("R_n = Rr/(r^2+r+n^2) = R/(2+n^2) for n = 1..60", ok);
  check("R_1 = R/3 and R_2 = R/6", close(C.ideal(3, 1).radius, 1) && close(C.ideal(6, 2).radius, 1));
  check("R_1 + R_2 = OD = R/2", close(C.ideal(6, 1).radius + C.ideal(6, 2).radius, 3));

  // R_n / OD = 2/(2+n^2): integer-exact for many R and n.
  ok = true;
  for (let R = 2; R <= 40; R++) {
    for (let n = 1; n <= 20; n++) {
      const q = C.ideal(R, n);
      if (!close(q.radius / (R / 2), 2 / (2 + n * n))) ok = false;
      if (!close(q.fractionOfOD, 2 / (2 + n * n))) ok = false;
    }
  }
  check("each ideal radius is exactly a rational fraction of OD", ok);

  // Pappus' height, the foot's offset and D O_n, with exact integer triples.
  ok = true;
  for (let n = 1; n <= 200; n++) {
    const q = C.ideal(1, n);
    const p = C.pythagoras(n);
    if (!close(q.height, 2 * n * q.radius)) ok = false;
    if (!close(q.dDistance, Math.hypot(p.dLeg, p.heightLeg) / (2 * (2 + n * n)))) ok = false;
    if (p.dLeg * p.dLeg + p.heightLeg * p.heightLeg !== p.dHyp * p.dHyp) ok = false;
    if (p.oLeg * p.oLeg + p.oHeightLeg * p.oHeightLeg !== p.oHyp * p.oHyp) ok = false;
  }
  check("O_n P_n = 2 n R_n and DP_n^2 + O_n P_n^2 = DO_n^2 for n = 1..200", ok);
  check("all DP_n O_n triangles have integer Euclid legs (n^2-4, 4n, n^2+4)",
    [1, 2, 3, 4, 5, 6, 11].every((n) => {
      const p = C.pythagoras(n);
      return Math.abs(p.dLeg) * Math.abs(p.dLeg) + p.heightLeg * p.heightLeg === p.dHyp * p.dHyp;
    }));

  // The three specific 3-4-5 triangles named on the page.
  const tri = (a, b, c) => {
    const s = [a, b, c].map(Math.abs).sort((x, y) => x - y);
    return close(s[1] / s[0], 4 / 3, 1e-9) && close(s[2] / s[0], 5 / 3, 1e-9);
  };
  const q2 = C.ideal(6, 2); // ODP: OD = R/2, DP = O_2 P_2, OP = O O_2
  check("ODP is a 3-4-5 triangle", tri(6 / 2, q2.height, q2.ooDistance));
  const q6 = C.ideal(76, 6);
  check("n = 6 gives O_6P_6 = 24R/76, DP_6 = 32R/76, DO_6 = 40R/76",
    close(q6.height, 24) && close(Math.abs(q6.dx), 32) && close(q6.dDistance, 40) &&
    tri(q6.height, q6.dx, q6.dDistance));
  const q3 = C.ideal(11, 3); // O P_3 O_3
  check("O P_3 O_3 is a 3-4-5 triangle",
    close(q3.oDistance, 8) && close(q3.height, 6) && close(q3.ooDistance, 10) &&
    tri(q3.oDistance, q3.height, q3.ooDistance));
}

/* --------------------------------- 4. the drawn circles against the claims */

{
  const s = C.start({});
  const R = (s.b.x - s.a.x) / 2;
  const drawn = C.chain(s);
  check("first drawn radius is near R/3", close(drawn[0].radius, R / 3, 0.2),
    `${drawn[0].radius.toFixed(3)} vs ${(R / 3).toFixed(3)}`);
  check("second drawn radius is near R/6", close(drawn[1].radius, R / 6, 1.2),
    `${drawn[1].radius.toFixed(3)} vs ${(R / 6).toFixed(3)}`);
  check("centre K is above O, as R_1 + R_2 = OD predicts",
    close(drawn[0].center.x, s.c.x, 4) && close(s.a.y - drawn[0].center.y, 2 * R / 3, 4));
  check("centre P sits above D, the foot of the perpendicular",
    close(drawn[1].center.x, s.d.x, 4) && close(s.a.y - drawn[1].center.y, 2 * R / 3, 4));
  check("drawn radii decrease along the chain", drawn.every((c, i) => i === 0 || c.radius < drawn[i - 1].radius));
  const errors = C.tangencyErrors(s, drawn);
  check("every drawn circle touches the big circle, the right semicircle and its neighbour",
    errors.every((row) => row.every((e) => e < 1e-6)), JSON.stringify(errors[0]));
  check("a second choice of endpoints rebuilds the same geometry",
    (() => {
      const a = { x: 25, y: 260 }, b = { x: 405, y: 260 };
      const q = C.withEndpoints(s, a, b);
      return close(q.b.x - q.a.x, 380) && C.chain(q).length === 7 && close(q.d.y, 260);
    })());
  const pos = C.position(s);
  check("the saved position is plain data with points, radii and options",
    pos.a.x === s.a.x && pos.b.x === s.b.x && close(pos.radius, R) &&
    pos.drawn.length === 7 && pos.ideal.length === 4 && pos.od === R / 2);
  check("compute returns null at the applet's zero determinant",
    C.compute([
      { center: { x: 0, y: 0 }, radius: 10 },
      { center: { x: 10, y: 0 }, radius: 5 },
      { center: { x: 20, y: 0 }, radius: 5 },
    ], [1, 1, -1]) === null);
}

done("gothic-arc");
