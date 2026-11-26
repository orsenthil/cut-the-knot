#!/usr/bin/env node
"use strict";

/*
 * Logic test for archimedes-quadruplets/archimedes-quadruplets-core.js.
 *
 *   node porting/check-archimedes-quadruplets.mjs
 *
 * The article makes one exact claim: Power's four circles have the same
 * radius as Archimedes' twins, x = r1*r2/(r1+r2), hence the same area
 * pi*x^2. It also gives OD^2 = r1^2+r2^2 and OL = r-x. All of these are
 * checked at 1001 positions of C, at 1000 random drags of all three points,
 * and with a second, literal transcription of AdjustCircles,
 * ComputePointsAndCircles, GetPerp and Extend from the Java bytecode. That
 * transcription also records the one deliberate deviation: the applet put
 * |AB| = 2r into its BigCircle object instead of the drawn radius r, so its
 * four circles had half the radius the article states.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("archimedes-quadruplets/archimedes-quadruplets-core.js", "ArchimedesQuadrupletsCore");
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* ------- a second transcription, straight from the applet's bytecode ------ */

const W = 360, H = 240, M = 20;
const BASE = Math.floor(H * 5 / 6); // init(): (h*5)/6 -> y of A, B and C

/** init(): A=(w/2-(w/2-m), 5h/6), B=(w/2+(w/2-m), 5h/6), C=0.3A+0.7B. */
function appletStart() {
  const A = { x: W / 2 - (W / 2 - M), y: BASE };
  const B = { x: W / 2 + (W / 2 - M), y: BASE };
  const Cpt = { x: 0.3 * A.x + 0.7 * B.x, y: A.y };
  return { A, B, C: Cpt };
}

const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/**
 * AdjustCircles() + ComputePointsAndCircles(), transcribed instruction by
 * instruction. Note BigCircle's radius: GeoSDoub.Dist(A,B) is the full |AB|,
 * while DrawUpperArc draws a semicircle of radius |A.x-B.x|/2.
 */
function appletCompute(A, B, Cp) {
  const big = { center: mid(A, B), radius: dist(A, B) }; // DoubCircle(mid(A,B), Dist(A,B))
  const O1 = mid(A, Cp), O2 = mid(B, Cp);
  const c1 = { center: O1, radius: dist(O1, Cp) };
  const c2 = { center: O2, radius: dist(O2, Cp) };
  // D = (C1.x, C1.y - C1.GetRadius()), E = (C2.x, C2.y - C2.GetRadius())
  const D = { x: c1.center.x, y: c1.center.y - c1.radius };
  const E = { x: c2.center.x, y: c2.center.y - c2.radius };
  // x = C1.GetRadius() * C2.GetRadius() / BigCircle.GetRadius()
  const x = c1.radius * c2.radius / big.radius;

  // GetPerp(P, big, x): s = x / Dist(P, big); both perpendicular offsets.
  function getPerp(P) {
    const s = x / dist(P, big.center);
    const dx = (P.y - big.center.y) * s;
    const dy = (big.center.x - P.x) * s;
    return [
      { x: P.x + dx, y: P.y + dy },
      { x: P.x - dx, y: P.y - dy },
    ];
  }
  // Extend(p, big.center, big.radius/(big.radius-x))
  const factor = big.radius / (big.radius - x);
  const extend = (p) => ({
    x: big.center.x + (p.x - big.center.x) * factor,
    y: big.center.y + (p.y - big.center.y) * factor,
  });
  const leftCenters = getPerp(D), rightCenters = getPerp(E);
  return {
    big: big, O1: O1, O2: O2, r1: c1.radius, r2: c2.radius,
    D: D, E: E, x: x,
    leftCenters: leftCenters, rightCenters: rightCenters,
    leftQ: leftCenters.map(extend), rightQ: rightCenters.map(extend),
    drawnRadius: Math.abs(A.x - B.x) / 2, // DrawUpperArc()
  };
}

/* -------------------------------- 1. the applet's constants and start ---- */

{
  const s = C.start({});
  const a = appletStart();
  check("the applet's board is 360x240 with a 20px margin",
    C.WIDTH === W && C.HEIGHT === H && C.MARGIN === M);
  check("the baseline is at 5h/6 = 200", C.BASE_Y === BASE && BASE === 200);
  check("A and B start at the margin, 320 apart",
    C.START_AX === 20 && C.START_BX === 340 && C.DIAMETER === 320);
  check("C starts at 0.3*A + 0.7*B, i.e. 70% along AB",
    near(C.START_CX, a.C.x) && near(C.START_CX, 244) &&
    near(s.cx, a.C.x) && near(s.cx, 20 + 0.7 * 320),
    `${s.cx} vs ${a.C.x}`);
  check("a new position is plain JSON data",
    JSON.stringify(s) === JSON.stringify(JSON.parse(JSON.stringify(s))) &&
    Object.keys(s).sort().join(",") === "ax,bx,cx");
}

/* ------------------------------ 2. dragging and the eligible region ------ */

{
  const s = C.start({});
  const moved = C.setPoint(s, "C", 300);
  check("setPoint returns a new position and leaves the old one alone",
    moved !== s && s.cx === 244 && moved.cx === 300 && moved.ax === 20 && moved.bx === 340);
  check("PointIsEligible keeps A before C and B after C",
    C.eligible(s, "A", 100) && !C.eligible(s, "A", 244) &&
    C.eligible(s, "B", 320) && !C.eligible(s, "B", 240) &&
    C.eligible(s, "C", 200) && !C.eligible(s, "C", 19) && !C.eligible(s, "C", 340));
  check("a drag past a neighbour stops at the five-unit gap",
    C.setPoint(s, "A", 300).cx === 244 && C.setPoint(s, "A", 300).ax === 239 &&
    C.setPoint(s, "B", 100).bx === 249 && C.setPoint(s, "C", -3).cx === 25 &&
    C.setPoint(s, "C", 999).cx === 335);
  check("bad numbers fall back to the applet's start",
    C.start({ ax: NaN, bx: undefined, cx: Infinity }).ax === 20 &&
    C.start({ ax: NaN, bx: undefined, cx: Infinity }).cx === 244);
  const p = C.position(s);
  check("the saved position is JSON-safe and has the drawn numbers",
    JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))) &&
    p.C.x === 244 && p.r1 === 112 && p.r2 === 48 && p.r === 160 &&
    near(p.radius, 33.6, 1e-6));
}

/* ------------------- 3. the geometry at 1001 draggable positions --------- */

{
  let halves = true, apexes = true, pythagoras = true, radius = true;
  let tangentLine = true, tangentBig = true, contacts = true, areas = true;
  let twins = true, equation = true;
  for (let i = 0; i <= 1000; i++) {
    const cx = 25 + (335 - 25) * i / 1000;
    const g = C.geometry(C.start({ cx: cx }));
    const r1 = g.r1, r2 = g.r2, r = g.r, x = g.radius;
    const O = g.O;
    halves = halves && near(g.a + g.b, 320) && near(r1 + r2, r) &&
      near(r, dist(g.A, g.B) / 2);
    apexes = apexes && near(g.D.x, g.O1.x) && near(g.D.y, C.BASE_Y - r1) &&
      near(g.E.x, g.O2.x) && near(g.E.y, C.BASE_Y - r2);
    pythagoras = pythagoras && near(dist(O, g.D) ** 2, r1 * r1 + r2 * r2) &&
      near(dist(O, g.E) ** 2, r1 * r1 + r2 * r2) &&
      near(g.od2, r1 * r1 + r2 * r2);
    // The article's claim: the four radii equal the twins' radius.
    radius = radius && near(x, r1 * r2 / r) &&
      g.left.concat(g.right).every((c) => near(dist(c.center, c.contact), x)) &&
      near(dist(g.left[0].center, g.D), x) &&
      near(g.left[0].center.x - g.D.x, -(g.left[1].center.x - g.D.x)) &&
      near(g.twins[0].radius, x) && near(g.twins[1].radius, x);
    // Each circle touches OD (or OE) at D (or E): the offset from the
    // apex is perpendicular to OD and its length is x.
    for (const [pair, apex] of [[g.left, g.D], [g.right, g.E]]) {
      for (const circle of pair) {
        const v = { x: circle.center.x - apex.x, y: circle.center.y - apex.y };
        const d = { x: apex.x - O.x, y: apex.y - O.y };
        tangentLine = tangentLine &&
          near(Math.hypot(v.x, v.y), x) &&
          near(v.x * d.x + v.y * d.y, 0, 1e-7); // perpendicular
        // Internal tangency to the big semicircle: OL = r-x, and the
        // tangency dot K is on the arc at distance r from O.
        const OL = dist(O, circle.center);
        tangentBig = tangentBig && near(OL, r - x) &&
          near(OL * OL, x * x + dist(O, apex) ** 2);
        contacts = contacts && near(dist(O, circle.contact), r) &&
          near((circle.contact.x - O.x) * (circle.center.y - O.y) -
               (circle.contact.y - O.y) * (circle.center.x - O.x), 0, 1e-6);
      }
    }
    areas = areas && near(g.circleArea, Math.PI * x * x) &&
      near(g.twinArea, g.circleArea) && near(g.fourArea, 4 * Math.PI * x * x);
    // A twin touches the upright through C, its own small circle and the big
    // one; these identities are the reason its radius is r1*r2/r too.
    for (let k = 0; k < 2; k++) {
      const twin = g.twins[k];
      const small = k === 0 ? g.O1 : g.O2;
      const sr = k === 0 ? r1 : r2;
      twins = twins &&
        near(twin.center.x, g.C.x + (k === 0 ? -x : x)) &&
        near(dist(twin.center, small), sr + x) &&
        near(dist(twin.center, O), r - x);
    }
    equation = equation &&
      near((r1 + r2 - x) ** 2, x * x + r1 * r1 + r2 * r2);
  }
  check("AC + CB = AB and r1 + r2 = r = |AB|/2 (1001 positions)", halves);
  check("D and E are the tops of the two small semicircles", apexes);
  check("OD^2 = OE^2 = r1^2 + r2^2 (1001 positions)", pythagoras);
  check("the radius is r1*r2/(r1+r2), equal to both twins", radius);
  check("all four circles touch OD or OE at D or E", tangentLine);
  check("all four circles are internally tangent to the big semicircle", tangentBig);
  check("each tangency dot K lies on the big arc on the ray O->L", contacts);
  check("each circle's area is pi*x^2, so all five circles agree", areas);
  check("the two original twins touch their small and big circles", twins);
  check("the article's (r1+r2-x)^2 = x^2+r1^2+r2^2 holds", equation);
}

/* ------------------------- 4. symmetry and the maximum ------------------- */

{
  let symmetric = true;
  const mid = C.geometry(C.start({ cx: 180 }));
  check("the four circles are largest when C is in the middle",
    near(mid.radius, 40) && near(mid.radius, mid.r / 4) &&
    C.geometry(C.start({ cx: 25 })).radius < mid.radius &&
    C.geometry(C.start({ cx: 335 })).radius < mid.radius);
  for (let i = 0; i <= 200; i++) {
    const cx = 25 + 310 * i / 200;
    const g = C.geometry(C.start({ cx: cx }));
    const mirror = C.geometry(C.start({ cx: 360 - cx }));
    symmetric = symmetric && near(g.radius, mirror.radius) &&
      near(g.r1 + g.r2, mirror.r1 + mirror.r2) &&
      near(g.radius, g.r1 * g.r2 / g.r);
  }
  check("moving C the same distance from either end gives equal radii", symmetric);
}

/* ---------------- 5. the applet's own arithmetic, transcribed ------------ */

{
  const seed = appletStart();
  const s = C.start({});
  const g = C.geometry(s);
  const a = appletCompute(seed.A, seed.B, seed.C);
  check("the applet's BigCircle has radius |AB| = 2r, not the drawn r",
    near(a.big.radius, 320) && near(a.big.radius, 2 * g.r) &&
    near(a.drawnRadius, g.r));
  check("the applet's start C and both small circles match the core",
    near(seed.C.x, g.C.x) && near(a.O1.x, g.O1.x) && near(a.O2.x, g.O2.x) &&
    near(a.r1, g.r1) && near(a.r2, g.r2));
  check("the applet's D and E match the core's apexes",
    near(a.D.x, g.D.x) && near(a.D.y, g.D.y) &&
    near(a.E.x, g.E.x) && near(a.E.y, g.E.y));

  let radii = true, centers = true, dots = true, half = true, offArc = true;
  for (let i = 0; i <= 1000; i++) {
    const cx = 60 + 240 * i / 1000; // away from the degenerate ends
    const st = C.start({ cx: cx });
    const gg = C.geometry(st);
    const aa = appletCompute(gg.A, gg.B, gg.C);
    // The core uses the article's r; the applet used |AB| = 2r, so its
    // circles come out exactly half-size. This is a deliberate deviation.
    radii = radii && near(aa.x, gg.radius / 2, 1e-9);
    half = half && near(aa.x, aa.r1 * aa.r2 / aa.big.radius);
    for (let k = 0; k < 2; k++) {
      const vApp = { x: aa.leftCenters[k].x - aa.D.x, y: aa.leftCenters[k].y - aa.D.y };
      const vCore = { x: gg.left[k].center.x - gg.D.x, y: gg.left[k].center.y - gg.D.y };
      centers = centers &&
        near(Math.hypot(vApp.x, vApp.y), aa.x) &&
        near(vApp.x * vCore.y - vApp.y * vCore.x, 0, 1e-6) && // same ray
        near(vApp.x, vCore.x / 2) && near(vApp.y, vCore.y / 2);
      // The applet's Extend factor uses 2r, so its K dots miss the drawn arc.
      const miss = Math.abs(dist(aa.big.center, aa.leftQ[k]) - gg.r);
      offArc = offArc && miss > 0.02 * gg.r;
    }
    // The core's own K dots, by contrast, always lie on the arc.
    dots = dots && gg.left.concat(gg.right).every((o) =>
      near(dist(gg.O, o.contact), gg.r));
  }
  check("the applet's four radii are exactly half the article's radius", radii);
  check("the applet computes x = r1*r2/BigCircle.GetRadius()", half);
  check("its centres lie on the same perpendiculars, at half the distance", centers);
  check("its K dots miss the drawn arc (the transcribed bug)", offArc);
  check("the port's K dots stay on the arc at every position", dots);
}

/* ---------------------- 6. random drags of all three points -------------- */

{
  const random = rng(9238);
  let ok = true;
  for (let i = 0; i < 1000; i++) {
    const ax = 5 + 200 * random();
    const cx = ax + 10 + (320 - (ax - 20) - 20) * random();
    const bx = Math.min(355, cx + 10 + random() * 10);
    const st = C.start({ ax: ax, bx: bx, cx: cx });
    const g = C.geometry(st);
    const x = g.radius;
    ok = ok && g.a >= C.GAP && g.b >= C.GAP &&
      near(g.r, (st.bx - st.ax) / 2) &&
      near(x, g.r1 * g.r2 / g.r) &&
      near(g.od2, g.r1 * g.r1 + g.r2 * g.r2) &&
      g.left.concat(g.right).every((o) =>
        near(dist(g.O, o.center), g.r - x) &&
        near(dist(g.O, o.contact), g.r)) &&
      g.twins.every((t) => near(t.radius, x)) &&
      near(C.position(st).radius, x, 1e-6);
  }
  check("1000 random drags of A, C and B keep every identity true", ok);
}

done("archimedes-quadruplets");
