#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-with-two-centers/circle-with-two-centers-core.js.
 *
 *   node porting/check-circle-with-two-centers.mjs
 *
 * There is no winning here: this is a geometric fallacy demo. We check the
 * start/drag/option state, then every claim the page makes over a grid of 360
 * angle-and-position combinations in both drawing modes, then compare the
 * core with a second, literal transcription of the applet's own geometry
 * (GeoSDoub.ComputeAngle / Intersect / FindCircumcenter / Intersect(line,circle)
 * and Canvas.Compute) over the same grid, and finally the degenerate edges.
 */

import { loadCore, check, done } from "./lib/load-core.mjs";

const C = loadCore(
  "circle-with-two-centers/circle-with-two-centers-core.js",
  "CircleWithTwoCentersCore"
);

const EPS = 0.4; // Canvas.eps
const rad = (d) => d * Math.PI / 180;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const nearPt = (p, q, tol = 1e-6) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);

/* Every angle shape we can draw: 3 apexes x 6 lower rays x 5 upper rays x 2
 * radii x 2 modes = 360 configurations. Cases where the two rays are collinear
 * (D does not exist) are tested as degenerate, not compared. */
const APEXES = [{ x: 80, y: 320 }, { x: 160, y: 240 }, { x: 240, y: 180 }];
const LOW = [-50, -30, -10, 10, 30, 50];
const HIGH = [-170, -150, -130, -110, -100];
const RADII = [200, 260];

const cases = [];
for (const A of APEXES) {
  for (const low of LOW) {
    for (const high of HIGH) {
      for (const r of RADII) {
        const B = { x: A.x + r * Math.cos(rad(low)), y: A.y + r * Math.sin(rad(low)) };
        const Cc = { x: A.x + r * Math.cos(rad(high)), y: A.y + r * Math.sin(rad(high)) };
        for (const cheat of [false, true]) {
          cases.push({ A, B, C: Cc, cheat });
        }
      }
    }
  }
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  check("a new game is not over", C.result(s) === null);
  check("cheat is on by default, like the page's first applet", s.cheat === true);
  check("names on, hint off, at the start", s.showNames === true && s.showHint === false);
  check("the three draggable points are offered", JSON.stringify(C.legalMoves(s)) === '["A","B","C"]');

  const next = C.move(s, { point: "A", x: 12, y: 34 });
  check("a drag moves only that point and gives a new position",
    nearPt(next.A, { x: 12, y: 34 }) && nearPt(s.A, { x: 90, y: 300 }) && next !== s);
  check("a drag outside the board is clamped",
    nearPt(C.move(s, { point: "C", x: 9999, y: -50 }).C, { x: C.W, y: 0 }));
  check("bad drags are refused", C.move(s, { point: "D", x: 1, y: 2 }) === null &&
    C.move(s, { point: "A", x: NaN, y: 2 }) === null);

  const dragged = C.move(s, { point: "B", x: 300, y: 350 });
  check("dragging alone has not finished the demo", C.result(dragged) === null);
  const toggled = C.setOptions(s, { cheat: false });
  check("toggling alone has not finished the demo", C.result(toggled) === null);
  check("drag + toggle finishes the demo", C.result(C.setOptions(dragged, { cheat: false })) === "done");
  check("only a real change of cheat counts as a comparison",
    C.setOptions(dragged, { cheat: true }).toggles === 0 &&
    C.setOptions(C.setOptions(dragged, { cheat: false }), { cheat: false }).toggles === 1);

  const kept = C.setOptions(C.move(s, { point: "C", x: 200, y: 100 }), { cheat: false, showHint: true });
  const back = C.reset(kept);
  check("reset restores the points but keeps the options and counters",
    nearPt(back.A, { x: 90, y: 300 }) && nearPt(back.B, { x: 330, y: 340 }) &&
    nearPt(back.C, { x: 310, y: 80 }) && back.cheat === false &&
    back.showHint === true && back.moves === kept.moves && back.toggles === kept.toggles);
}

/* ------------------------------------------- 2. the page's claims, exhaustively */

{
  let honest = 0;
  let honestEIsA = true;
  let honestCentersAgree = true;
  let honestMidIsCenter = true;
  let honestPerp = true;
  let honestDone = false;
  let circleOk = true;
  let cheatTilted = true;
  let cheatTwoCenters = true;
  let cheatCentersAreFalse = true;
  let degenerateOk = true;
  let angleGrowth = true;

  for (const c of cases) {
    const s = C.start({ A: c.A, B: c.B, C: c.C, cheat: c.cheat });
    const g = C.geometry(s);
    const collinear = Math.abs(Math.sin(g.angle)) < 1e-6;
    if (collinear) {
      degenerateOk = degenerateOk && g.degenerate && g.D === null && g.circle === null;
      continue;
    }
    honestDone = honestDone || !g.degenerate;
    if (!g.degenerate) {
      // The circle circumscribes B, C and D in both modes.
      circleOk = circleOk && near(dist(g.circle, g.B), g.circle.r) &&
        near(dist(g.circle, g.C), g.circle.r) && near(dist(g.circle, g.D), g.circle.r);
    }
    if (!c.cheat && !g.degenerate) {
      honest++;
      honestEIsA = honestEIsA && nearPt(g.E, c.A) && nearPt(g.F, c.A);
      honestCentersAgree = honestCentersAgree && nearPt(g.centerB, g.centerC);
      honestMidIsCenter = honestMidIsCenter && nearPt(g.centerB, g.circle) &&
        nearPt(g.centerC, { x: (c.A.x + g.D.x) / 2, y: (c.A.y + g.D.y) / 2 });
      // With true perpendiculars, BD·BA = 0 and CD·CA = 0.
      const dotB = (c.B.x - c.A.x) * (g.pb.x - c.B.x) + (c.B.y - c.A.y) * (g.pb.y - c.B.y);
      const dotC = (c.C.x - c.A.x) * (g.pc.x - c.C.x) + (c.C.y - c.A.y) * (g.pc.y - c.C.y);
      honestPerp = honestPerp && near(dotB, 0) && near(dotC, 0);
    }
    if (c.cheat && !g.degenerate) {
      // The tilted lines are no longer perpendicular, so the right-angle
      // marks in the drawing lie: that is the whole fallacy.
      const dotB = (c.B.x - c.A.x) * (g.pb.x - c.B.x) + (c.B.y - c.A.y) * (g.pb.y - c.B.y);
      const dotC = (c.C.x - c.A.x) * (g.pc.x - c.C.x) + (c.C.y - c.A.y) * (g.pc.y - c.C.y);
      cheatTilted = cheatTilted && dotB !== 0 && dotC !== 0;
      cheatTwoCenters = cheatTwoCenters && !nearPt(g.centerB, g.centerC);
      cheatCentersAreFalse = cheatCentersAreFalse &&
        !near(dist(g.circle, g.centerB), 0) && !near(dist(g.circle, g.centerC), 0);
    }
  }

  check("some honest configurations are drawable", honest > 100);
  check("the page's claim: with true perpendiculars E and F coincide with A",
    honestEIsA, `${honest} honest configurations`);
  check("the page's claim: the honest drawing has one centre, the midpoint of AD",
    honestCentersAgree && honestMidIsCenter);
  check("the page's claim: angles ABD and ACD are right when not cheating", honestPerp);
  check("the circumscribing circle goes through B, C and D in both modes", circleOk);
  check("the page's claim: D does not exist only for a 0 or 180 degree angle", degenerateOk);
  check("non-collinear angles give a drawable construction", honestDone);
  check("the cheat tilts both perpendiculars away from right angles", cheatTilted);
  check("the cheat produces two different 'centres'", cheatTwoCenters);
  check("the two cheat centres are not the real circumcenter", cheatCentersAreFalse);

  // Canvas.Compute: Shift = 1 for honest; 1 + (1-eps)*2*eps/pi*angle when cheating.
  const g1 = C.geometry(C.start({ cheat: true }));
  const g2 = C.geometry(C.start({ A: { x: 90, y: 300 }, B: { x: 330, y: 340 }, C: { x: 250, y: 100 }, cheat: true }));
  check("the applet's cheat factor follows (1 - eps)*2*eps/pi times the angle",
    near(g1.shift, 1 + (1 - EPS) * 2 * EPS / Math.PI * g1.angle) &&
    near(g2.shift, 1 + (1 - EPS) * 2 * EPS / Math.PI * g2.angle));
  angleGrowth = g2.angle > g1.angle ? g2.shift > g1.shift : g2.shift < g1.shift;
  check("the fake tilt grows with the angle at A", angleGrowth);
}

/* ----------------------------- 3. the same answers as the applet's own method */

/*
 * Literal transcription of the three Java helpers the applet uses. These are
 * deliberately written in the bytecode's own terms (slope form for a
 * line-circle crossing, a threshold of 1px for parallel lines and for the
 * "other point" test), not in the core's parametric form.
 */
function jComputeAngle(p, q, r) {
  const sq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const d = (a, b) => Math.sqrt(sq(a, b));
  return Math.acos((sq(q, p) + sq(q, r) - sq(p, r)) / (2 * d(q, p) * d(q, r)));
}

function jIntersect(p0, p1, p2, p3) {
  const a1 = p0.y - p1.y;
  const b1 = p1.x - p0.x;
  const c1 = p0.x * p1.y - p0.y * p1.x;
  const a2 = p2.y - p3.y;
  const b2 = p3.x - p2.x;
  const c2 = p2.x * p3.y - p2.y * p3.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN }; // GeoSDoub's 1px guard
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}

function jCircumcenter(a, b, c) {
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const m1 = mid(a, b);
  const m2 = mid(b, c);
  const n1 = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const n2 = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  return jIntersect(m1, n1, m2, n2);
}

function jCircle(a, b, c) {
  const o = jCircumcenter(a, b, c);
  const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  return { x: o.x, y: o.y, r: (d(o, a) + d(o, b) + d(o, c)) / 3 };
}

// GeoSDoub.IntersectX: solve x = m*y + c against the circle.
function jIntersectX(p0, p1, circle) {
  const m = (p1.x - p0.x) / (p1.y - p0.y);
  const c = p1.x - m * p1.y;
  const A = m * m + 1;
  const B = m * (c - circle.x) - circle.y;
  const C = circle.y * circle.y + (c - circle.x) ** 2 - circle.r * circle.r;
  const disc = B * B - A * C;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y1 = (-B + root) / A;
  const y2 = (-B - root) / A;
  return [{ x: m * y1 + c, y: y1 }, { x: m * y2 + c, y: y2 }];
}

// GeoSDoub.IntersectY: solve y = m*x + c against the circle.
function jIntersectY(p0, p1, circle) {
  const m = (p1.y - p0.y) / (p1.x - p0.x);
  const c = p1.y - m * p1.x;
  const A = m * m + 1;
  const B = m * (c - circle.y) - circle.x;
  const C = circle.x * circle.x + (c - circle.y) ** 2 - circle.r * circle.r;
  const disc = B * B - A * C;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x1 = (-B + root) / A;
  const x2 = (-B - root) / A;
  return [{ x: x1, y: m * x1 + c }, { x: x2, y: m * x2 + c }];
}

function jCircleLine(p0, p1, circle) {
  if (Math.abs(p0.y - p1.y) > 1) return jIntersectX(p0, p1, circle);
  if (Math.abs(p0.x - p1.x) > 1) return jIntersectY(p0, p1, circle);
  return null;
}

// GeoSDoub.Other: the crossing at least 1px away from the known point.
function jOther(pts, p) {
  if (!pts) return null;
  return dist(pts[0], p) >= 1 ? pts[0] : pts[1];
}

function appletGeometry(A, B, Cc, cheat) {
  const angle = jComputeAngle(A, B, Cc);
  const shift = cheat ? 1 + (1 - EPS) * 2 * EPS / Math.PI * angle : 1;
  const pb = { x: B.x + (B.y - A.y) * shift, y: B.y - (B.x - A.x) };
  const pc = { x: Cc.x - (Cc.y - A.y) * shift, y: Cc.y + (Cc.x - A.x) };
  const D = jIntersect(B, pb, Cc, pc);
  const circle = jCircle(B, Cc, D);
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  if (!cheat) {
    return {
      angle, shift, D, circle, E: null, F: null,
      centerB: mid(D, A), centerC: mid(D, A),
    };
  }
  const E = jOther(jCircleLine(A, B, circle), B);
  const F = jOther(jCircleLine(A, Cc, circle), Cc);
  return {
    angle, shift, D, circle, E, F,
    centerB: E ? mid(D, E) : null,
    centerC: F ? mid(D, F) : null,
  };
}

{
  let compared = 0;
  let err = { angle: 0, shift: 0, D: 0, circle: 0, E: 0, F: 0, centerB: 0, centerC: 0 };
  const maxDiff = (p, q) => (!p || !q ? 0 : Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)));

  for (const c of cases) {
    const g = C.geometry(C.start({ A: c.A, B: c.B, C: c.C, cheat: c.cheat }));
    const j = appletGeometry(c.A, c.B, c.C, c.cheat);
    if (g.degenerate) continue; // the Java 1px guard agrees these have no D
    compared++;
    err.angle = Math.max(err.angle, Math.abs(g.angle - j.angle));
    err.shift = Math.max(err.shift, Math.abs(g.shift - j.shift));
    err.D = Math.max(err.D, maxDiff(g.D, j.D));
    err.circle = Math.max(err.circle, maxDiff(g.circle, j.circle), Math.abs(g.circle.r - j.circle.r));
    if (c.cheat) {
      err.E = Math.max(err.E, maxDiff(g.E, j.E));
      err.F = Math.max(err.F, maxDiff(g.F, j.F));
    }
    err.centerB = Math.max(err.centerB, maxDiff(g.centerB, j.centerB));
    err.centerC = Math.max(err.centerC, maxDiff(g.centerC, j.centerC));
  }
  const tol = 1e-5;
  check("compared against the applet on every drawable configuration", compared >= 300, `${compared} cases`);
  check("the applet's angle and cheat shift match the core",
    err.angle < tol && err.shift < tol, `errors ${err.angle}, ${err.shift}`);
  check("the applet's D matches the core", err.D < tol, `error ${err.D}`);
  check("the applet's circumcircle matches the core", err.circle < tol, `error ${err.circle}`);
  check("the applet's E and F (cheat mode) match the core",
    err.E < tol && err.F < tol, `errors ${err.E}, ${err.F}`);
  check("the applet's two centres match the core",
    err.centerB < tol && err.centerC < tol, `errors ${err.centerB}, ${err.centerC}`);
}

/* ------------------------------------------------------------ 4. edge cases */

{
  const s = C.start({ A: { x: 100, y: 100 }, B: { x: 100, y: 100 }, C: { x: 300, y: 200 } });
  const g = C.geometry(s);
  check("A = B has no angle and no construction", g.degenerate && g.D === null && g.circle === null);
  const flat = C.start({ cheat: true });
  const gf = C.geometry(C.move(C.move(flat, { point: "B", x: 90, y: 300 }), { point: "C", x: 90, y: 300 }));
  check("a flat angle is reported as degenerate", gf.degenerate && gf.centerB === null);
  check("arrow-key nudges use the same clamping as a drag",
    nearPt(C.nudge(C.start({}), "A", -1000, -1000).A, { x: 0, y: 0 }) &&
    nearPt(C.nudge(C.start({}), "B", 1000, 1000).B, { x: C.W, y: C.H }));
  check("the honest drawing's centres sit on the real circle",
    (() => {
      const gg = C.geometry(C.start({ cheat: false }));
      return near(dist(gg.circle, gg.centerB), 0) && near(dist(gg.circle, gg.centerC), 0);
    })());
}

done("circle-with-two-centers");
