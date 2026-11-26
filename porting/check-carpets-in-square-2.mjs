#!/usr/bin/env node
"use strict";

/*
 * Logic test for carpets-in-square-2/carpets-in-square-2-core.js.
 *
 *   node porting/check-carpets-in-square-2.mjs
 *
 * Checks the page's three claims — red area = blue area, the two rectangles
 * EFGH and IFJH add to ABCD, and (in hint mode) the blue quadrilateral IFGH
 * is half of ABCD — for a whole grid of A drags and F positions and for 500
 * random configurations. Then init() and Compute() of
 * CarpetsInSquare2Canvas are transcribed a second time, literally from the
 * bytecode (including GeoSDoub.IntersectY's quadratic), and every point and
 * area is compared with the core over another few hundred configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("carpets-in-square-2/carpets-in-square-2-core.js", "CarpetsInSquare2Core");
const P = (x, y) => ({ x, y });
const samePoint = (p, q, tol = 1e-7) =>
  Number.isFinite(p.x) === Number.isFinite(q.x) &&
  Number.isFinite(p.y) === Number.isFinite(q.y) &&
  (!Number.isFinite(p.x) || (C.close(p.x, q.x, tol) && C.close(p.y, q.y, tol)));
const ok = (g) => Object.values(C.claims(g)).every(Boolean);

/* ------------------------------------------------------------ 1. the rules */

{
  equal("the opening position is the applet's 450x400, 4/5 rectangle, F at 0.3", C.start({}), {
    width: 450, height: 400, left: 45, top: 40,
    right: 405, bottom: 360, fy: 136,
    showNames: true, hint: true, explored: false,
  });

  const g = C.compute(C.start({}));
  check("opening corners and centre match init()",
    samePoint(g.A, P(45, 360)) && samePoint(g.B, P(405, 360)) &&
    samePoint(g.C, P(405, 40)) && samePoint(g.D, P(45, 40)) &&
    samePoint(g.O, P(225, 200)));
  check("opening F is CreateMidPoint(0.3) on BC and H is its reflection",
    samePoint(g.F, P(405, 136)) && samePoint(g.H, P(45, 264)));
  check("E is the left and I the right circle hit on AB; G and J are opposite",
    g.E.x < g.O.x && g.I.x > g.O.x &&
    samePoint(g.E, P(225 - Math.sqrt(10896), 360)) &&
    samePoint(g.I, P(225 + Math.sqrt(10896), 360)) &&
    samePoint(g.G, P(225 + Math.sqrt(10896), 40)) &&
    samePoint(g.J, P(225 - Math.sqrt(10896), 40)));
  check("K and L are finite intersections of the inner rectangles' sides",
    ok(g) && Number.isFinite(g.K.x) && Number.isFinite(g.L.x));
  check("the opening red and blue areas match the page", ok(g) &&
    C.close(g.redNormalTotal, g.blueNormalArea) &&
    C.close(g.redHintTotal, g.blueHintArea) &&
    C.close(g.blueHintArea, 57600) && C.close(g.rectangleSum, 115200));

  const s = C.start({});
  check("a demo has no win or loss", C.result(s) === null);
  const hintOff = C.move(s, { type: "option", key: "hint", value: false });
  check("the hint checkbox only changes its own flag",
    hintOff.hint === false && hintOff.showNames === s.showNames && hintOff.explored && !s.explored);
  const namesOff = C.move(hintOff, { type: "option", key: "showNames", value: false });
  check("the names checkbox only changes its own flag",
    namesOff.showNames === false && namesOff.hint === false && hintOff.showNames === true);
  check("an unknown option or a non-boolean is refused",
    C.move(s, { type: "option", key: "grid", value: true }) === null &&
    C.move(s, { type: "option", key: "hint", value: "yes" }) === null);
  const reset = C.move(namesOff, { type: "reset" });
  check("reset restores the opening picture at this board size",
    reset.left === 45 && reset.right === 405 && reset.fy === 136 &&
    reset.hint === true && reset.showNames === true && !reset.explored);

  check("an unknown move, a bad point and an off-board point are refused",
    C.move(s, { type: "fly" }) === null && C.move(s, null) === null &&
    C.move(s, { type: "point", name: "A", point: P(NaN, 360) }) === null &&
    C.move(s, { type: "point", name: "Z", point: P(100, 200) }) === null &&
    C.move(s, { type: "point", name: "A", point: P(500, 360) }) === null);
}

/* ------------------------------------------- 2. the drags, as in mouseDragged */

{
  const s = C.start({});
  const left = C.move(s, { type: "point", name: "A", point: P(30, 360) });
  check("dragging A left mirrors the whole rectangle about the fixed O",
    left.left === 30 && left.right === 420 && left.fy === s.fy &&
    ok(C.compute(left)));
  const past = C.move(s, { type: "point", name: "A", point: P(300, 360) });
  check("dragging A past O snaps back to the mirror of B, as the applet does",
    past.left === 45 && past.right === 405 && past.explored);
  const band = C.move(s, { type: "point", name: "A", point: P(100, 360) });
  check("inside the applet's forbidden band A steps 3 units left",
    band.left === 97 && band.right === 353);
  const f = C.move(s, { type: "point", name: "F", point: P(405, 200) });
  check("dragging F to the centre of BC keeps E and I symmetric",
    f.fy === 200 && ok(C.compute(f)) &&
    C.close(C.compute(f).E.x + C.compute(f).I.x, 450));
  const clamped = C.move(s, { type: "point", name: "F", point: P(405, 390) });
  check("F outside BC is clamped rather than blanking the figure",
    clamped.fy === s.bottom && C.compute(clamped).valid);
  check("maxLeft keeps the circle meeting AB at the tightest F",
    C.close(C.maxLeft(s), 65) &&
    C.close(C.maxLeft(Object.assign({}, s, { fy: 200 })), 65 - 1e-9, 1e-8));
}

/* ------------------------------------ 3. the page's claims over many drags -- */

{
  let grid = 0, gridOk = 0, redNormal = true, redHint = true, rectangles = true;
  let half = true, circle = true, sides = true, positive = true;
  for (let left = 8; left <= 64; left += 4) {
    for (let fy = 44; fy <= 356; fy += 24) {
      const state = Object.assign({}, C.start({}), { left, right: 450 - left, fy });
      const g = C.compute(state);
      const k = C.claims(g);
      grid++;
      if (k.valid) gridOk++;
      redNormal &&= k.valid && k.redEqualsBlueNormal;
      redHint &&= k.valid && k.redEqualsBlueHint && k.blueIsHalfNormal;
      rectangles &&= k.valid && k.rectanglesAddUp && k.IFGHHalf && k.EFJHHalf;
      circle &&= k.commonCircle && k.OIsMidpoint;
      sides &&= k.equalSides;
      positive &&= k.positiveAreas;
    }
  }
  check(`the grid has ${grid} draggable configurations`, grid === 15 * 14);
  check(`all ${gridOk} grid configurations have a drawable figure`, gridOk === grid);
  check("red = blue in the normal picture for every grid configuration", redNormal);
  check("red = blue and blue = ABCD/2 with the hint on, for every grid configuration", redHint);
  check("EFGH + IFJH = ABCD and IFGH = EFJH = ABCD/2 on the grid", rectangles);
  check("E, F, G, I, J lie on one circle about O, the midpoint of AC and FH", circle);
  check("CG = DJ = BI on the grid, as the page's proof says", sides);
  check("all coloured pieces have positive area on the grid", positive);
}

/* ------------------------------------- 4. random boards and the page's words */

{
  const rand = rng(20261126);
  let configs = 0, valid = 0, claims = true, scale = true, noNaN = true;
  for (let i = 0; i < 500; i++) {
    const width = 320 + Math.floor(rand() * 500);
    const height = 300 + Math.floor(rand() * 300);
    const start = C.start({ width, height, f: 0.05 + rand() * 0.9 });
    const left = 4 + rand() * Math.max(1, C.maxLeft(start) - 4);
    const fy = start.top + 4 + rand() * (start.bottom - start.top - 8);
    const state = Object.assign({}, start, {
      left, right: width - left, fy,
    });
    const g = C.compute(state);
    configs++;
    if (g.valid) valid++;
    claims &&= !g.valid || ok(g);
    noNaN &&= Number.isFinite(g.K.x) === g.valid && Number.isFinite(g.L.x) === g.valid;
    if (i < 100) {
      const bigger = C.compute(Object.assign({}, state, {
        left: left * 1.5, right: width - left * 1.5,
        width: width * 1.5, height: height * 1.5,
        top: start.top * 1.5, bottom: start.bottom * 1.5, fy: fy * 1.5,
      }));
      scale &&= !bigger.valid || ok(bigger);
    }
  }
  check(`500 random rectangles, centres and F positions were tried`, configs === 500);
  check(`all ${valid} drawable random configurations satisfy every page claim`, valid > 300 && claims);
  check("an undrawable figure has NaN K and L, drawable ones have finite points", noNaN);
  check("the equalities survive scaling the whole board", scale);
}

/* ------------- 5. a second transcription of init() and Compute() from javap -- */

{
  // GeoSDoub.Intersect(p1,p2,p3,p4), javap -c: a1=p1.y-p2.y, b1=p2.x-p1.x,
  // c1=p1.x*p2.y-p1.y*p2.x; d=a1*b2-a2*b1; NaN if |d|<1.
  function geoIntersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return P(NaN, NaN);
    return P((b1 * c2 - b2 * c1) / d, (c1 * a2 - c2 * a1) / d);
  }

  // DoubLine.CreateMidPoint(t): m_1*t + m_2*(1-t), with m_1 = B, m_2 = C.
  function midpoint(B, Cpt, t) {
    return P(B.x * t + Cpt.x * (1 - t), B.y * t + Cpt.y * (1 - t));
  }

  // CarpetsInSquare2Canvas.init() and Compute(), javap -c. IntersectY uses
  // m=(y1-y2)/(x1-x2)=0 for the horizontal AB, b=y2, A=1+m*m,
  // B=m*(b-cy)-cx, C=cx*cx+(b-cy)^2-r^2, roots=(-B +/- sqrt(B²-A*C))/A.
  function applet(w, h, left, t) {
    // init() sets the height to 4/5 of the canvas and O to its centre; a
    // dragged A keeps that O and mirrors B and C to w-left (mouseDragged).
    const wy = Math.floor(4 * h / 5);
    const x = left, y = (h - wy) / 2;
    const right = w - x;
    const D = P(x, y);
    const A = P(x, y + wy);
    const B = P(right, y + wy);
    const Cpt = P(right, y);
    const O = P(w / 2, (A.y + Cpt.y) / 2);
    const F = midpoint(B, Cpt, t);
    const H = P(2 * O.x - F.x, 2 * O.y - F.y);
    const r = Math.hypot(F.x - O.x, F.y - O.y);
    const m = (A.y - B.y) / (B.x - A.x);
    const b = B.y - m * B.x;
    const aa = 1 + m * m;
    const bb = m * (b - O.y) - O.x;
    const cc = O.x * O.x + (b - O.y) * (b - O.y) - r * r;
    const det = bb * bb - aa * cc;
    if (det < 0) return { A, B, C: Cpt, D, O, F, H, valid: false };
    const t1 = (-bb + Math.sqrt(det)) / aa;
    const t2 = (-bb - Math.sqrt(det)) / aa;
    // GeoSDoub.Intersect(DoubCircle,DoubLine) puts t1 first; Compute() picks
    // the smaller x for E and the larger one for I.
    const hits = [P(t1, m * t1 + b), P(t2, m * t2 + b)];
    const E = hits[0].x < hits[1].x ? hits[0] : hits[1];
    const I = hits[0].x < hits[1].x ? hits[1] : hits[0];
    const G = P(2 * O.x - E.x, 2 * O.y - E.y);
    const J = P(2 * O.x - I.x, 2 * O.y - I.y);
    const K = geoIntersect(F, J, H, G);
    const L = geoIntersect(F, E, H, I);
    return { A, B, C: Cpt, D, O, F, H, E, I, G, J, K, L, valid: true };
  }

  function shoelace(points) {
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      s += p.x * q.y - q.x * p.y;
    }
    return Math.abs(s / 2);
  }

  const opening = applet(450, 400, 45, C.F_FRACTION);
  const openingCore = C.compute(C.start({}));
  check("the transcription reproduces init()'s opening rectangle and F",
    samePoint(opening.A, openingCore.A) && samePoint(opening.B, openingCore.B) &&
    samePoint(opening.C, openingCore.C) && samePoint(opening.D, openingCore.D) &&
    samePoint(opening.O, openingCore.O) && samePoint(opening.F, openingCore.F) &&
    C.close(opening.F.y, 136));

  const cases = [];
  for (let w = 360; w <= 700; w += 40) {
    for (let h = 320; h <= 560; h += 40) {
      for (let left = 8; left <= 64; left += 14) {
        for (let t = 0.1; t <= 0.9; t += 0.2) cases.push([w, h, left, t]);
      }
    }
  }
  const rand = rng(424242);
  for (let i = 0; i < 400; i++) {
    cases.push([
      300 + Math.floor(rand() * 500), 300 + Math.floor(rand() * 300),
      6 + rand() * 60, 0.05 + rand() * 0.9,
    ]);
  }
  let pointsMatch = true, areasMatch = true, validityMatch = true, compared = 0;
  for (const [w, h, left, t] of cases) {
    const a = applet(w, h, left, t);
    // The core takes the same figure; its own start() uses the same 4/5 rule.
    const s0 = C.start({ width: w, height: h, f: t });
    const state = Object.assign({}, s0, { left, right: w - left, fy: a.F.y });
    const g = C.compute(state);
    compared++;
    validityMatch &&= g.valid === a.valid;
    if (!a.valid) continue;
    for (const name of ["A", "B", "C", "D", "O", "F", "H", "E", "I", "G", "J", "K", "L"]) {
      pointsMatch &&= samePoint(g[name], a[name], 1e-6);
    }
    const redN = [[a.H, a.D, a.J], [a.J, a.K, a.G], [a.G, a.C, a.F],
      [a.F, a.B, a.I], [a.I, a.L, a.E], [a.A, a.E, a.H]].map(shoelace);
    const redH = [[a.H, a.D, a.G], [a.H, a.A, a.I],
      [a.I, a.B, a.F], [a.C, a.F, a.G]].map(shoelace);
    areasMatch &&=
      C.close(C.sum(redN), g.redNormalTotal, 1e-6) &&
      C.close(C.sum(redH), g.redHintTotal, 1e-6) &&
      C.close(shoelace([a.H, a.K, a.F, a.L]), g.blueNormalArea, 1e-6);
    areasMatch &&= C.close(
      shoelace([a.E, a.F, a.G, a.H]) + shoelace([a.I, a.F, a.J, a.H]),
      g.rectangleSum, 1e-6);
  }
  check(`all ${compared} configurations agree with the bytecode on validity`, validityMatch);
  check(`A,B,C,D,O,F,H,E,I,G,J,K,L match Compute() on ${compared} configurations`, pointsMatch);
  check("red and blue areas match the figures drawn by the bytecode", areasMatch);

  const tight = applet(450, 400, 65, 0.5);
  check("the transcription agrees that a narrow rectangle just touches AB",
    tight.valid && C.close(tight.E.x, 225, 1e-7) && C.close(tight.I.x, 225, 1e-7));
}

done("carpets-in-square-2");
