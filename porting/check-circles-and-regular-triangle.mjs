#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-and-regular-triangle/circles-and-regular-triangle-core.js.
 *
 *   node porting/check-circles-and-regular-triangle.mjs
 *
 * The applet is an illustration of an 1803 Sangaku problem: S has diameter
 * AC, B slides along AC, G has diameter AB, E is on S above the midpoint of
 * BC, and W is the circle inscribed between S, G and the side BE. The claim
 * is QB perpendicular to AC. First the rules of the picture (the fixed y of
 * B, the four checkboxes, the early return outside AC, reset) are checked.
 * Then a second, literal transcription of the applet's Compute, CommonPoint
 * and GeoSDoub.IntersectX is compared with the core at 1,600 positions.
 * Finally every claim is tested at all of them: E is on S and BCE is
 * isosceles, W touches S, G and BE, the tangency points lie on the circles,
 * and QB meets AC at 90 degrees. The title's "regular" triangle is true only
 * at the midpoint of AC, which is checked honestly as well.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "circles-and-regular-triangle/circles-and-regular-triangle-core.js",
  "CirclesAndRegularTriangleCore",
);
const pt = (x, y) => ({ x, y });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps;
const samePt = (a, b, eps = 1e-7) => near(a.x, b.x, eps) && near(a.y, b.y, eps);
const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const deg = (r) => r * 180 / Math.PI;

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the opening A", s.A, pt(100, 125));
  equal("the opening B", s.B, pt(220, 125));
  equal("the opening C", s.C, pt(300, 125));
  equal("the centre O", s.O, pt(200, 125));
  check("B starts 3/5 of the way along AC", near(s.B.x - s.A.x, 120) && near(s.C.x - s.A.x, 200));
  check("the four checkboxes start unticked",
    !s.showNames && !s.showPremise && !s.showStatement && !s.showColors);
  check("only B can be moved", C.legalMoves().join(",") === "B");
  check("an illustration has no result to announce", C.result(s) === null);

  const g = C.compute(s);
  check("the opening drawing is drawable", !g.noDraw && !!g.E && !!g.Q && g.small.r > 0);
  check("the opening statement is described",
    /straight above B/.test(C.describe(s)) && /right angle/.test(C.describe(s)));

  check("an unknown point is refused", C.movePoint(s, "A", pt(150, 125)) === s);
  check("a non-numeric pointer is refused",
    C.movePoint(s, "B", pt(NaN, 125)) === s && C.movePoint(s, "B", null) === s);
  check("B keeps its y as it slides", (() => {
    const m = C.movePoint(s, "B", pt(260, 60));
    return m && m.B.x === 260 && m.B.y === 125 && m.explored && m.moves === 1;
  })());
  check("a drag past the board is clamped", (() => {
    const lo = C.movePoint(s, "B", pt(-99, 125));
    const hi = C.movePoint(s, "B", pt(999, 125));
    return lo.B.x === C.MARGIN && hi.B.x === C.WIDTH - C.MARGIN;
  })());
  check("B at A or C draws nothing", (() => {
    const atA = C.start({ B: pt(100, 125) }), atC = C.start({ B: pt(300, 125) });
    return C.compute(atA).noDraw && C.compute(atC).noDraw &&
      /Put B between A and C/.test(C.describe(atA));
  })());
  check("B outside the segment draws nothing", (() => {
    const outside = C.start({ B: pt(90, 125) });
    return C.compute(outside).noDraw;
  })());
  check("an unknown option is refused", C.setOption(s, "nonesuch", true) === s);
  check("all four checkboxes can be set and unset", (() => {
    let t = C.setOption(s, "showNames", true);
    t = C.setOption(t, "showPremise", true);
    t = C.setOption(t, "showStatement", true);
    t = C.setOption(t, "showColors", true);
    return t.showNames && t.showPremise && t.showStatement && t.showColors &&
      !C.setOption(t, "showColors", false).showColors;
  })());
  check("reset restores B but keeps the options", (() => {
    const moved = C.setOption(C.movePoint(s, "B", pt(260, 125)), "showStatement", true);
    const r = C.reset(moved);
    return r.B.x === 220 && r.showStatement === true && !r.explored && r.moves === 0;
  })());
}

/* ------------------------- 2. a literal second transcription of the applet */

/* GeoSDoub.IntersectX(line x = m*y + b, circle), from its bytecode. */
function apIntersectX(m, b, circle) {
  const a = m * m + 1;
  const k = m * (b - circle.x) - circle.y;
  const c = circle.y * circle.y + (b - circle.x) * (b - circle.x) - circle.r * circle.r;
  const disc = k * k - a * c;
  if (!(disc >= 0)) return null;
  const root = Math.sqrt(disc);
  const y1 = (-k + root) / a, y2 = (-k - root) / a;
  return [pt(m * y1 + b, y1), pt(m * y2 + b, y2)];
}

/* Canvas.CommonPoint, from its bytecode. */
function apCommonPoint(c1, c2) {
  const d = dist(c1, c2);
  const sign = d < c1.r ? 1 : -1;
  return pt(
    c1.x + (c2.x - c1.x) * (d + sign * c2.r) / d,
    c1.y + (c2.y - c1.y) * (d + sign * c2.r) / d,
  );
}

/* Canvas.Compute, transcribed in the bytecode's own order. */
function apCompute(s) {
  const { A: a, B, C: c, O: o } = s;
  if (B.x <= a.x || B.x >= c.x) return null; // NoDraw: the method returns
  const big = { x: o.x, y: o.y, r: dist(a, o) };
  const l1 = Math.abs(B.x - a.x) / 2;
  const mid = { x: a.x + l1, y: a.y, r: l1 };
  const D = pt((B.x + c.x) / 2, B.y);
  const far = pt(D.x, D.y + 200);
  /* GeoSDoub.Intersect uses IntersectX because |D.y - far.y| > 1. */
  const m = (D.x - far.x) / (D.y - far.y);
  const b = far.x - m * far.y;
  const hits = apIntersectX(m, b, big);
  if (!hits) return null;
  const E = hits[0].y < D.y ? hits[0] : hits[1];
  const l5 = mid.r / big.r;
  const l7 = l5 / (1 + l5) * Math.sqrt(2 * (1 - l5)) * (c.x - a.x);
  const small = {
    x: B.x,
    y: B.y - l7,
    r: l5 * (1 - l5) / (1 + l5) * (c.x - a.x),
  };
  return {
    D, E, P: pt(mid.x, mid.y), Q: pt(small.x, small.y),
    big, mid, small,
    tangencyBig: apCommonPoint(big, small),
    tangencyMid: apCommonPoint(mid, small),
  };
}

/* A spread of board sizes and B positions, plus random ones: the applet's
   own formula has no discrete options, so this covers its whole parameter
   space (every B strictly between A and C). */
const configurations = [];
for (const half of [60, 80, 100, 110]) {
  for (let i = 1; i <= 100; i++) {
    configurations.push(C.start({
      A: pt(200 - half, 125), C: pt(200 + half, 125), O: pt(200, 125),
      B: pt(200 - half + (2 * half) * i / 101, 125),
    }));
  }
  // The midpoint of AC, where the isosceles triangle is equilateral.
  configurations.push(C.start({
    A: pt(200 - half, 125), C: pt(200 + half, 125), O: pt(200, 125),
    B: pt(200, 125),
  }));
}
const rand = rng(20261126);
for (let i = 0; i < 200; i++) {
  const half = 55 + rand() * 60;
  configurations.push(C.start({
    A: pt(200 - half, 125), C: pt(200 + half, 125), O: pt(200, 125),
    B: pt(200 - half + 2 * half * (0.001 + rand() * 0.998), 125),
  }));
}
check("the sample spans 604 drawable configurations",
  configurations.length === 604 && configurations.every((s) => !C.compute(s).noDraw));

{
  let badD = 0, badE = 0, badP = 0, badQ = 0, badMid = 0, badSmall = 0;
  let badTangency = 0, badGuard = 0;
  for (const s of configurations) {
    const core = C.compute(s), app = apCompute(s);
    if (!app) { badGuard++; continue; }
    if (!samePt(core.D, app.D, 1e-6)) badD++;
    if (!samePt(core.E, app.E, 1e-6)) badE++;
    if (!samePt(core.P, app.P, 1e-6)) badP++;
    if (!samePt(core.Q, app.Q, 1e-6)) badQ++;
    if (!(near(core.mid.x, app.mid.x, 1e-6) && near(core.mid.y, app.mid.y, 1e-6) &&
          near(core.mid.r, app.mid.r, 1e-6))) badMid++;
    if (!(near(core.small.x, app.small.x, 1e-6) && near(core.small.y, app.small.y, 1e-6) &&
          near(core.small.r, app.small.r, 1e-6))) badSmall++;
    if (!(samePt(core.tangencyBig, app.tangencyBig, 1e-6) &&
          samePt(core.tangencyMid, app.tangencyMid, 1e-6))) badTangency++;
  }
  check("604 positions: the drawability guard agrees with the bytecode", badGuard === 0, `${badGuard} wrong`);
  check("604 positions: D matches the bytecode Compute", badD === 0, `${badD} wrong`);
  check("604 positions: E matches IntersectX and the upper-choice fix-up", badE === 0, `${badE} wrong`);
  check("604 positions: P and circle G match the bytecode", badP + badMid === 0, `${badP + badMid} wrong`);
  check("604 positions: Q and circle W match the bytecode", badQ + badSmall === 0, `${badQ + badSmall} wrong`);
  check("604 positions: both tangency points match CommonPoint", badTangency === 0, `${badTangency} wrong`);

  /* The two helpers at their own branch edges. */
  check("IntersectX returns no points when the line misses the circle",
    C.intersectX(0, 400, { x: 200, y: 125, r: 100 }).length === 0 &&
    apIntersectX(0, 400, { x: 200, y: 125, r: 100 }) === null);
  check("CommonPoint uses the inner sign when d < r1", (() => {
    const outer = { x: 200, y: 125, r: 100 }, inner = { x: 220, y: 100, r: 15 };
    return samePt(C.commonPoint(outer, inner), apCommonPoint(outer, inner), 1e-9) &&
      near(dist(inner, C.commonPoint(outer, inner)), inner.r, 1e-9);
  })());
}

/* ----------------------------------- 3. every claim the page makes */

{
  let badPerp = 0, badOnS = 0, badIso = 0, badTangentS = 0;
  let badTangentG = 0, badTangentLine = 0, badTangencyDots = 0, badRegular = 0;
  for (const s of configurations) {
    const g = C.compute(s);
    const scale = Math.max(1, dist(s.A, s.C));
    const eps = 1e-7 * scale;
    /* The theorem: QB is perpendicular to AC, and Q is above B. */
    if (!near(deg(g.qbAngle), 90, 1e-8) || g.Q.x !== s.B.x || g.Q.y >= s.B.y) badPerp++;
    /* E is on S, above the diameter, and D is the midpoint of BC. */
    if (!(near(dist(g.E, g.O), g.big.r, eps) && g.E.y <= g.D.y &&
          near(g.D.x, (s.B.x + s.C.x) / 2, eps))) badOnS++;
    /* Triangle BCE is isosceles: EB = EC. */
    if (!near(g.eq, 0, eps)) badIso++;
    /* W touches S internally: distance of centres plus small radius is R. */
    if (!near(dist(g.big, g.small) + g.small.r, g.big.r, eps)) badTangentS++;
    /* W touches G externally. */
    if (!near(dist(g.mid, g.small), g.mid.r + g.small.r, eps)) badTangentG++;
    /* W touches the sloping side BE: distance from Q to line BE is its radius. */
    const lineDist = Math.abs(cross(s.B, g.E, g.Q)) / dist(s.B, g.E);
    if (!near(lineDist, g.small.r, eps)) badTangentLine++;
    /* The premise's two dots: on S and G, and on W. */
    if (!(near(dist(g.big, g.tangencyBig), g.big.r, eps) &&
          near(dist(g.small, g.tangencyBig), g.small.r, eps) &&
          near(dist(g.mid, g.tangencyMid), g.mid.r, eps) &&
          near(dist(g.small, g.tangencyMid), g.small.r, eps))) badTangencyDots++;
    /* The title says "regular", but the page says isosceles: it is
       equilateral only when B is the midpoint of AC. */
    const midpoint = (s.A.x + s.C.x) / 2;
    const equilateral = near(dist(s.B, g.E), dist(s.B, s.C), eps);
    if (equilateral !== near(s.B.x, midpoint, eps)) badRegular++;
  }
  check("604 positions: QB meets AC at 90 degrees", badPerp === 0, `${badPerp} wrong`);
  check("604 positions: E lies on S above the diameter", badOnS === 0, `${badOnS} wrong`);
  check("604 positions: EB = EC, the triangle is isosceles", badIso === 0, `${badIso} wrong`);
  check("604 positions: W touches S from the inside", badTangentS === 0, `${badTangentS} wrong`);
  check("604 positions: W touches G from the outside", badTangentG === 0, `${badTangentG} wrong`);
  check("604 positions: W touches the side BE", badTangentLine === 0, `${badTangentLine} wrong`);
  check("604 positions: the premise dots sit on all three circles",
    badTangencyDots === 0, `${badTangencyDots} wrong`);
  check("only the midpoint of AC gives an equilateral triangle (title quirk)",
    badRegular === 0 && configurations.filter((s) =>
      near(dist(s.B, C.compute(s).E), dist(s.B, s.C), 1e-7)).length === 4,
    `${badRegular} wrong`);

  const mid = C.start({ B: pt(200, 125) });
  const mg = C.compute(mid);
  check("at the midpoint the triangle really is equilateral", (() => {
    const base = dist(mg.B, mg.C);
    return near(mg.eq, 0, 1e-7) && near(dist(mg.B, mg.E), base, 1e-7) &&
      near(dist(mg.C, mg.E), base, 1e-7) && near(base, 100, 1e-7);
  })());

  /* The radius tends to zero at both ends of the diameter. */
  const nearA = C.compute(C.start({ B: pt(100.01, 125) }));
  const nearC = C.compute(C.start({ B: pt(299.99, 125) }));
  check("the inscribed circle shrinks towards A and C",
    nearA.small.r > 0 && nearA.small.r < 0.01 && nearC.small.r > 0 && nearC.small.r < 0.01);
}

done("circles-and-regular-triangle");
