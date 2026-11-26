#!/usr/bin/env node
"use strict";

/*
 * Logic test for archi/archi-core.js.
 *
 *   node porting/check-archi.mjs
 *
 * Checks the opening picture and every move; checks Archimedes' exact claim
 * (CD = OD = R implies angle DCO = angle AOB / 3) for every whole degree from
 * 1 to 179 and for random angles; and compares the core with a second, literal
 * transcription of the applet's own bytecode (its integer snapping,
 * FindSecondEnd, CheckPoint, the two Move methods, ShouldOpen and the angle
 * drawn by draw()). The page's "solved when D falls on the circle" test is
 * checked against the applet's 0.6-unit tolerance for every angle too.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("archi/archi-core.js", "ArchiCore");

const near = (a, b, eps = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
const rad = (d) => d * Math.PI / 180;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const trunc = (x) => Math.trunc(x); // Java's d2i

/* ------------------------------------------- the applet's own second version */

// Every field and operation here follows javap of archimedes.class, including
// its integer points and the 0.6 tolerance. Nothing is shared with the core.
function appletStart() {
  const ap = {
    O: { x: 200, y: 262 }, R: 70, r: 4, D: 9,
    B: { x: 200 + trunc(Math.cos(Math.PI / 6) * 70), y: 262 - trunc(Math.sin(Math.PI / 6) * 70) },
    C: { x: 200 - trunc(3 * 70 / 2), y: 262 },
    P01: null, finished: false, its: 9,
  };
  appletFindSecondEnd(ap);
  return ap;
}
function appletDist(p, q) {
  const dx = p.x - q.x, dy = p.y - q.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function appletFindSecondEnd(ap) {
  const d = appletDist(ap.C, ap.B);
  if (d < 0.001) return false;
  const t = ap.R / d;
  ap.P01 = {
    x: trunc(ap.C.x + t * (ap.B.x - ap.C.x)),
    y: trunc(ap.C.y + t * (ap.B.y - ap.C.y)),
  };
  if (Math.abs(appletDist(ap.O, ap.P01) - ap.R) < 0.6) ap.finished = true;
  return true;
}
function appletCheckPoint(ap, p) {
  if (Math.abs(p.x - ap.C.x) + Math.abs(p.y - ap.C.y) <= ap.r) ap.its = 0;
  else if (Math.abs(p.x - ap.B.x) + Math.abs(p.y - ap.B.y) <= ap.r) ap.its = 1;
  else ap.its = 9;
}
function appletMove(ap, p) {
  if (ap.its === 0) {
    ap.finished = false;
    if (p.x < ap.O.x) {
      ap.C.x = p.x;
      appletFindSecondEnd(ap);
    }
  } else if (ap.its === 1) {
    ap.finished = false;
    const d = appletDist(ap.O, p);
    if (d >= 0.001) {
      const t = ap.R / d;
      ap.B = {
        x: trunc(ap.O.x + t * (p.x - ap.O.x)),
        y: trunc(ap.O.y + t * (p.y - ap.O.y)),
      };
      appletFindSecondEnd(ap);
    }
  }
}
function appletDrawAngle(ap) {
  return trunc(180 * Math.acos((ap.B.x - ap.O.x) / ap.R) / Math.PI);
}

/* ------------------------------------------------------------ 1. the rules */

{
  equal("the board is the applet's 400 x 350", [C.WIDTH, C.HEIGHT], [400, 350]);
  equal("the centre and radius are the constructor's", [C.O, C.R], [{ x: 200, y: 262 }, 70]);
  equal("the opening angle hand is B", C.START_B, { x: 260, y: 228 });
  equal("the opening slider is C", C.START_C, { x: 95, y: 262 });
  check("the opening C is 1.5 radii left of O", C.START_C.x === C.O.x - Math.trunc(3 * C.R / 2));
  const s = C.start();
  check("a fresh picture is not explored", s.moves === 0 && !s.explored && C.result(s) === null);
  check("the slider starts to the left of O", s.C.x < C.O.x && s.C.y === C.O.y);
  check("the angle hand starts on the circle up to the applet's integer snap", near(dist(s.B, C.O), C.R, 1.5));
  const types = new Set(C.legalMoves(s).map((m) => m.type));
  check("legal moves cover both handles and reset", ["B", "C", "reset"].every((t) => types.has(t)));
  check("the opening D is not yet on the circle", !C.construct(s).onCircle);
}

/* --------------------------------------------- 2. every move and its limits */

{
  const s = C.start();
  const b = C.move(s, { type: "B", x: C.O.x, y: C.O.y - 140 });
  check("dragging B changes only B and keeps it on the circle",
    b && near(dist(b.B, C.O), C.R, 1e-9) && b.C.x === s.C.x && b.C.y === s.C.y);
  const c = C.move(s, { type: "C", x: 40, y: 10 });
  check("dragging C changes only its x, and keeps it on the x-axis",
    c && c.C.x === 40 && c.C.y === C.O.y && c.B.x === s.B.x && c.B.y === s.B.y);
  check("a move counts as exploring", b.moves === 1 && b.explored && C.result(b) === "done");
  check("the old position is untouched", s.moves === 0 && !s.explored);
  check("C cannot be dragged to O or to its right",
    C.move(s, { type: "C", x: C.O.x }) === null && C.move(s, { type: "C", x: C.O.x + 20 }) === null);
  check("B cannot be dragged onto the centre", C.move(s, { type: "B", x: C.O.x, y: C.O.y }) === null);
  check("bad moves are refused",
    C.move(s, { type: "B", x: NaN, y: 1 }) === null &&
    C.move(s, { type: "C", x: "x" }) === null &&
    C.move(s, { type: "nonsense" }) === null && C.move(null, { type: "reset" }) === null);
  const reset = C.move(b, { type: "reset" });
  check("reset restores the opening picture and clears the result",
    reset.B.x === C.START_B.x && reset.B.y === C.START_B.y &&
    reset.C.x === C.START_C.x && reset.C.y === C.START_C.y &&
    reset.moves === 0 && C.result(reset) === null);
  const cramped = C.construct({ B: C.START_B, C: { x: C.O.x - 0.0001, y: C.O.y } });
  check("a slider almost at O still gives finite angles",
    cramped.D !== null && [cramped.angle, cramped.angleAtC, cramped.D.x, cramped.D.y].every(Number.isFinite));
}

/* ------------------------------- 3. Archimedes' claim, for every whole degree */

{
  let onCircleCount = 0, betweenCount = 0;
  for (let degree = 1; degree <= 179; degree++) {
    const theta = rad(degree);
    const solved = C.solveFor(theta);
    const g = C.construct({ B: solved.B, C: solved.C });
    const label = `theta = ${degree}°`;

    check(`${label}: CD equals the radius`, near(dist(solved.C, solved.D), C.R, 1e-9));
    check(`${label}: D lies on the circle`, near(dist(C.O, solved.D), C.R, 1e-9));
    check(`${label}: D lies on the ray CB`,
      near((solved.D.x - solved.C.x) * (solved.B.y - solved.C.y) -
           (solved.D.y - solved.C.y) * (solved.B.x - solved.C.x), 0, 1e-9));
    check(`${label}: angle DCO is one third of angle AOB`,
      near(g.angleAtC, theta / 3, 1e-9) && near(g.angle, theta, 1e-12));
    check(`${label}: the applet's finished test fires`, g.onCircle);
    check(`${label}: OC is 2R cos(theta/3)`,
      near(C.O.x - solved.C.x, 2 * C.R * Math.cos(theta / 3), 1e-9));
    check(`${label}: the solved C is left of O`, solved.C.x < C.O.x);
    onCircleCount++;
    if (g.between) betweenCount++;
  }
  check("all 179 angles satisfy the claim", onCircleCount === 179);
  check("D is on the segment CB through 135°, beyond B above it",
    betweenCount === 135 && !C.construct({ B: C.solveFor(rad(150)).B, C: C.solveFor(rad(150)).C }).between);

  const rand = rng(20261126);
  for (let i = 0; i < 200; i++) {
    const theta = 0.01 + (Math.PI - 0.02) * rand();
    const solved = C.solveFor(theta);
    const g = C.construct({ B: solved.B, C: solved.C });
    check(`random angle ${i}: 3 * angle DCO = angle AOB`,
      near(3 * g.angleAtC, g.angle, 1e-8) && g.onCircle && near(dist(C.O, g.D), C.R, 1e-9));
    // The mirror image below the x-axis works just as well.
    const below = C.construct({ B: C.pointOnCircle(-theta), C: solved.C });
    check(`random angle ${i}: the mirror below the axis also trisects`,
      near(below.angle, theta, 1e-9) && near(below.angleAtC, theta / 3, 1e-8) && below.onCircle);
  }
  check("solveFor refuses the degenerate ends of the range",
    C.solveFor(0) === null && C.solveFor(Math.PI) === null && C.solveFor(NaN) === null);
}

/* ------------------- 4. the same numbers as the applet's own integer methods */

{
  const ap0 = appletStart();
  const core0 = C.construct(C.start());
  check("the opening D matches the applet's FindSecondEnd",
    near(core0.D.x, ap0.P01.x, 1) && near(core0.D.y, ap0.P01.y, 1));
  check("the opening angle matches the applet's draw()", core0.angleDeg === appletDrawAngle(ap0));
  check("the opening solved flag matches the applet", core0.onCircle === ap0.finished);

  // Integer pointer positions, as the applet's mouseDragged makes them.
  const placements = [];
  for (let degree = 1; degree <= 179; degree++) {
    const theta = rad(degree);
    const B = { x: ap0.O.x + trunc(Math.cos(theta) * 70), y: ap0.O.y - trunc(Math.sin(theta) * 70) };
    const exactCx = ap0.O.x - 2 * 70 * Math.cos(theta / 3);
    for (const shift of [-3, -1, 0, 1, 3]) {
      placements.push({ B, Cx: trunc(exactCx) + shift });
    }
  }
  const rand = rng(777);
  for (let i = 0; i < 120; i++) {
    placements.push({
      B: { x: 200 + trunc((rand() * 2 - 1) * 70), y: 262 - trunc(rand() * 140) },
      Cx: 5 + trunc(rand() * 190),
    });
  }

  let compared = 0, skipped = 0;
  for (const place of placements) {
    const ap = appletStart();
    ap.B = place.B;
    ap.C = { x: place.Cx, y: 262 };
    ap.finished = false;
    appletFindSecondEnd(ap);

    const g = C.construct({ B: place.B, C: ap.C });
    check("core D is the applet's D up to its integer truncation",
      near(g.D.x, ap.P01.x, 1.01) && near(g.D.y, ap.P01.y, 1.01));
    check("core angle is the applet's drawn whole-degree angle", g.angleDeg === appletDrawAngle(ap));

    // The applet snaps D to integers, so near its 0.6 cut-off the two tests
    // can disagree by one; outside that band they must agree exactly.
    const gap = Math.abs(dist(C.O, g.D) - C.R);
    if (Math.abs(gap - C.TOL) < 1.6) { skipped++; continue; }
    check("core solved flag matches the applet's ShouldOpen", g.onCircle === ap.finished);
    compared++;
  }
  check("the second transcription was compared over every angle and random drags",
    placements.length === 179 * 5 + 120 && compared + skipped === placements.length && compared > 300,
    `compared ${compared}, skipped near the 0.6 cut-off ${skipped}`);

  // CheckPoint(): C is checked first, then B, then nothing.
  {
    const ap = appletStart();
    appletCheckPoint(ap, { x: ap.C.x + 1, y: ap.C.y + 1 });
    check("CheckPoint picks C first", ap.its === 0);
    appletCheckPoint(ap, { x: ap.B.x + 2, y: ap.B.y + 2 });
    check("CheckPoint picks B outside C's ring", ap.its === 1);
    appletCheckPoint(ap, { x: 10, y: 10 });
    check("CheckPoint picks nothing elsewhere", ap.its === 9);
    appletMove(ap, { x: 10, y: 10 });
    check("a drag with nothing picked changes nothing", ap.B.x === 260 && ap.C.x === 95);
  }

  // MoveMovingPoint(): only a pointer left of O moves C; the y is ignored.
  {
    const ap = appletStart();
    appletCheckPoint(ap, { x: ap.C.x, y: ap.C.y });
    appletMove(ap, { x: 40, y: 200 });
    check("applet drag moves C.x only", ap.C.x === 40 && ap.C.y === 262);
    appletCheckPoint(ap, { x: ap.C.x, y: ap.C.y });
    appletMove(ap, { x: 300, y: 100 });
    check("applet refuses to drag C to the right of O", ap.C.x === 40 && ap.C.y === 262);
  }

  // MoveAngleHand(): B is projected onto the circle, then FindSecondEnd().
  {
    const ap = appletStart();
    appletCheckPoint(ap, { x: ap.B.x, y: ap.B.y });
    appletMove(ap, { x: 200, y: 122 });
    check("applet projects B onto the circle",
      Math.abs(appletDist(ap.B, ap.O) - 70) < 1.5 && ap.B.x === 200 && ap.B.y === 192);
    appletCheckPoint(ap, { x: ap.B.x, y: ap.B.y });
    appletMove(ap, { x: 200, y: 262 });
    check("applet ignores a drag of B onto O", ap.B.x === 200 && ap.B.y === 192);
  }
}

/* --------------------------- 5. the page's "solved when D falls on the circle" */

{
  let withSolution = 0, trueBranch = 0, degenerateOnly = 0;
  const ap0 = appletStart();
  for (let degree = 1; degree <= 179; degree++) {
    const theta = rad(degree);
    const B = { x: ap0.O.x + trunc(Math.cos(theta) * 70), y: ap0.O.y - trunc(Math.sin(theta) * 70) };
    const exactCx = ap0.O.x - 2 * 70 * Math.cos(theta / 3);
    // The second place where the test fires: CB = R, so D collapses onto B,
    // at c = -2R cos(theta) (only reachable for angles past 90°).
    const collapsedCx = ap0.O.x + 2 * 70 * Math.cos(theta);
    const solved = [];
    for (let cx = 5; cx < ap0.O.x; cx++) {
      const ap = appletStart();
      ap.B = B; ap.C = { x: cx, y: 262 }; ap.finished = false;
      appletFindSecondEnd(ap);
      if (ap.finished) solved.push(cx);
    }
    if (solved.length) withSolution++;
    const nearTrue = Math.min(...solved.map((cx) => Math.abs(cx - exactCx)));
    const nearCollapsed = theta > Math.PI / 2
      ? Math.min(...solved.map((cx) => Math.abs(cx - collapsedCx))) : Infinity;
    check(`angle ${degree}°: a slider near a real solution works`,
      nearTrue <= 3 || nearCollapsed <= 3);
    if (nearTrue <= 3) trueBranch++;
    else if (nearCollapsed <= 3) degenerateOnly++;
  }
  check("the applet can be solved at every whole degree", withSolution === 179);
  check("the exact trisection slider is reachable for most angles", trueBranch === 168);
  check("past 150°, integer snapping leaves only the collapsed D=B branch",
    degenerateOnly === 11 && trueBranch + degenerateOnly === 179);

  // At the collapsed branch D is on the circle, but the angle is not a third.
  const theta = rad(179);
  const collapsed = C.construct({
    B: C.pointOnCircle(theta),
    C: { x: C.O.x + 2 * C.R * Math.cos(theta), y: C.O.y },
  });
  check("the collapsed branch still passes the applet's circle test", collapsed.onCircle);
  check("the collapsed branch is not a trisection", !near(collapsed.angleAtC, collapsed.angle / 3, 0.01));
  check("the status line says so instead of claiming a trisection",
    /does not trisect/.test(C.describe(collapsed)));
  check("the status text reports the trisection on the genuine branch",
    /one third/.test(C.describe(C.construct({ B: C.solveFor(rad(90)).B, C: C.solveFor(rad(90)).C }))));
  check("a solved figure is still only a demo", C.result(C.start({ B: C.pointOnCircle(theta), C: C.solveFor(theta).C })) === null);
}

done("archi");
