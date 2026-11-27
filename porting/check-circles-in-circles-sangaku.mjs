#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-in-circles-sangaku/circles-in-circles-sangaku-core.js.
 *
 *   node porting/check-circles-in-circles-sangaku.mjs
 *
 * Sweeps X along the diameter at 1,201 places for each of three board
 * radii (3,603 configurations).  On each one it checks the page's claims:
 * r1 = (r²−x²)/(2r), r3 = x²/r as the positive root of the page's quadratic,
 * r4 = x²/r from the page's second Pythagorean equation, so r3 = r4; the
 * lens radius r5 = r1−x, with r3 = r4 = r5 = r/9 at x = r/3; and every
 * tangency of the four r1 circles, the three r3 circles and the two r5
 * circles.  It also checks the secondary-circle claims (the outer four
 * always have radius r1; when the five are equal they are r/5) and compares
 * every circle, radius and null entry with a second, literal transcription
 * of CirclesInCirclesSangakuCanvas.Compute() from the bytecode.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("circles-in-circles-sangaku/circles-in-circles-sangaku-core.js", "CirclesInCirclesSangakuCore");
const O = C.O;
const near = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol;
const max = (a, b) => Math.max(a, b);

/* -------------- a second, independent transcription of the applet's Compute */

/*
 * Bytecode locals: slot 1 r, slot 3 x = |X−O|, slot 5 r1 = (r²−x²)/2/r,
 * slot 7 r3 = x²/r, slot 9 r5 = r1−x, slot 11 (r−r3)/2.  The four arrays are
 * built in the applet's own order and filled with null when a circle is
 * omitted; the guard is its `X.x >= A.x && X.x <= B.x`.
 */
function appletCompute(r, X) {
  const c = (x, y, radius) => ({ x: x, y: y, r: radius });
  if (!(X >= O.x - r && X <= O.x + r)) return null;

  const l1 = r;
  const l3 = Math.abs(X - O.x);
  const l5 = (l1 * l1 - l3 * l3) / 2 / l1;
  const l7 = l3 * l3 / l1;
  const l9 = l5 - l3;
  const l11 = (l1 - l7) / 2;

  const c4 = [
    c(O.x + l3, O.y - l5, l5),
    c(O.x - l3, O.y - l5, l5),
    c(O.x - l3, O.y + l5, l5),
    c(O.x + l3, O.y + l5, l5),
  ];
  const c3 = [
    c(O.x, O.y, l7),
    c(O.x, O.y - l1 + l7, l7),
    c(O.x, O.y + l1 - l7, l7),
  ];
  let c2 = [null, null];
  if (l9 > 0) c2 = [c(O.x, O.y - l5, l9), c(O.x, O.y + l5, l9)];
  let c5 = [
    c(O.x, O.y - l1 + l11, l11),
    c(O.x, O.y - l1 + 2 * l11 + l5, l5),
    null,
    c(O.x, O.y + l1 - 2 * l11 - l5, l5),
    c(O.x, O.y + l1 - l11, l11),
  ];
  if (2 * l7 - l1 > 0) c5[2] = c(O.x, O.y + 2 * l7 - l1, 2 * l7 - l1);

  return { r: l1, x: l3, r1: l5, r3: l7, r4: l7, r5: l9, half: l11,
    circles4: c4, circles3: c3, circles2: c2, circles5: c5 };
}

function sameCircle(a, b) {
  if (a === null || b === null) return a === b;
  return near(a.x, b.x, 1e-12) && near(a.y, b.y, 1e-12) && near(a.r, b.r, 1e-12);
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  const e = C.ends(s);
  check("the board is the applet's 400 × 300 canvas", C.VIEW.width === 400 && C.VIEW.height === 300);
  check("O and the default radius are the applet's", O.x === 200 && O.y === 150 && s.r === 130);
  check("A and B are the ends of the horizontal diameter",
    e.A.x === C.O.x - s.r && e.B.x === C.O.x + s.r && e.A.y === C.O.y && e.B.y === C.O.y);
  check("X starts in the applet's random range r/4 to r/2",
    s.x >= O.x + s.r / 4 && s.x <= O.x + s.r / 2);
  check("the three applet checkboxes start off as it embeds them",
    s.options.names === false && s.options.secondary === false && s.options.fill === false);
  check("the only draggable point is X", JSON.stringify(C.legalMoves(s)) === JSON.stringify(["X"]));
  check("an illustration has no result", C.result(s) === null);
  check("a fresh drawing has not been explored", s.explored === false);

  const moved = C.move(s, "X", { x: O.x + s.r, y: 999 });
  check("a drag moves X along AB and counts as exploring",
    moved.x === e.B.x && moved.explored === true && s.explored === false);
  check("a drag outside AB stops at the end of the diameter",
    C.move(s, "X", { x: 9999, y: 0 }).x === e.B.x &&
    C.move(s, "X", { x: -9999, y: 0 }).x === e.A.x);
  check("an unknown handle cannot be moved", C.move(s, "A", { x: 100, y: 100 }) === s);
  check("options and the two marked points can be changed",
    C.setOption(s, "secondary", true).options.secondary === true &&
    C.setSpecial(s, -1).x === O.x - s.r / 3 &&
    C.setSpecial(s, 1).x === O.x + s.r / 3);
  check("reset keeps the chosen radius and options",
    C.reset(moved).r === s.r && C.reset(moved).x === s.x && C.reset(moved).explored === true);
  check("outside AB the applet draws nothing",
    C.geometry({ r: 130, x: O.x - 131 }) === null && C.geometry({ r: 130, x: O.x + 131 }) === null);
}

/* --------------------------------- 2. every claim, over every configuration */

{
  let configs = 0, claims = true, tangencies = true, radii = true, lens = true;
  let secondary = true, agree = true, maxErr = 0;

  for (const r of [40, 130, 180]) {
    for (let k = 0; k <= 1200; k++) {
      const X = O.x - r + (2 * r * k) / 1200;
      const state = { r: r, x: X, options: { names: false, secondary: false, fill: false }, explored: true };
      const g = C.geometry(state);
      const a = appletCompute(r, X);
      configs++;
      if (!g || !a) { agree = false; continue; }

      /* The page's three equations, solved independently of the core. */
      const r1page = (r * r - g.x * g.x) / (2 * r);
      const r3page = -g.r1 + Math.sqrt(g.r1 * g.r1 + g.x * g.x); // positive root
      const r4page = (r * r + g.x * g.x) / (2 * r) - g.r1;
      const tol = 1e-7 * r;
      claims = claims && near(g.r1, r1page, tol) && near(g.r3, r3page, tol) &&
        near(g.r4, r4page, tol) && near(g.r3, g.r4, 1e-12) &&
        near((r - g.r1) * (r - g.r1), g.x * g.x + g.r1 * g.r1, 1e-6 * r * r);

      const t = C.tangency(g);
      tangencies = tangencies &&
        t.r1InsideBig < 1e-8 && t.r1TouchesAB < 1e-8 &&
        t.centralR3ToFour < 1e-8 && t.outerR3ToPair < 1e-8 &&
        t.outerR3InsideBig < 1e-8 && t.r5InsidePair < 1e-8;
      maxErr = max(maxErr, t.r1InsideBig, t.r1TouchesAB, t.centralR3ToFour,
        t.outerR3ToPair, t.outerR3InsideBig, t.r5InsidePair);

      // The outer four of the five region circles (not the middle one).
      radii = radii && near(g.half, g.r1, 1e-10) &&
        [0, 1, 3, 4].every((i) => near(g.circles5[i].r, g.r1, 1e-10));
      lens = lens && (g.r5 <= 0 ||
        (g.circles2.every((c) => c && near(c.r, g.r5, 1e-12)) &&
         near(2 * g.r1 - 2 * g.x, 2 * g.r5, 1e-9)));

      /* The applet's five-region circle appears exactly when 2r3 > r. */
      secondary = secondary &&
        (g.circles5[2] !== null) === (2 * g.r3 - r > 0) &&
        (g.circles5[2] === null || near(g.circles5[2].r, 2 * g.r3 - r, 1e-12));

      agree = agree &&
        near(g.r, a.r, 1e-12) && near(g.x, a.x, 1e-12) &&
        near(g.r1, a.r1, 1e-12) && near(g.r3, a.r3, 1e-12) &&
        near(g.r5, a.r5, 1e-12) && near(g.half, a.half, 1e-12) &&
        [0, 1, 2, 3].every((i) => sameCircle(g.circles4[i], a.circles4[i])) &&
        [0, 1, 2].every((i) => sameCircle(g.circles3[i], a.circles3[i])) &&
        [0, 1].every((i) => sameCircle(g.circles2[i], a.circles2[i])) &&
        [0, 1, 2, 3, 4].every((i) => sameCircle(g.circles5[i], a.circles5[i]));

    }
  }

  check(`all ${configs} configurations were computed`, configs === 3603);
  check("r1 = (r²−x²)/(2r) and the page's Pythagoras equation hold everywhere", claims);
  check("every tangency of the construction holds everywhere", tangencies);
  check(`the largest tangency error is ${maxErr.toExponential(1)}`, maxErr < 1e-8);
  check("the secondary half-gap equals r1 and its outer four circles have radius r1", radii);
  check("the lens circles exist exactly when r1 > x and have radius r1−x", lens);
  check("the fifth region circle exists exactly when 2r3 > r", secondary);
  check(`the core matches the applet's Compute() in all ${configs} cases`, agree);
}

/* --------------------------------- 3. the sangaku's special place x = r/3 */

{
  let all = true, lenses = 0;
  for (const r of [40, 130, 180]) {
    for (const side of [-1, 1]) {
      const s = C.setSpecial({ r: r, x: O.x, options: {}, explored: false }, side);
      const g = C.geometry(s);
      const ok = near(g.x, r / 3, 1e-12) && near(g.r1, 4 * r / 9, 1e-10) &&
        near(g.r3, r / 9, 1e-10) && near(g.r4, r / 9, 1e-10) && near(g.r5, r / 9, 1e-10) &&
        near(2 * g.r1 - 2 * g.x, 2 * r / 9, 1e-10);
      all = all && ok && g.circles2.every((c) => c && near(c.r, r / 9, 1e-10));
      lenses += g.circles2.filter(Boolean).length;
    }
  }
  check("at x = r/3, r3 = r4 = r5 = r/9 and r1 = 4r/9 on both sides", all);
  check(`the two marked points supply ${lenses} lens circles`, lenses === 12);

  /* The page's last extra claim, checked at its exact position. */
  let five = true;
  for (const r of [40, 130, 180]) {
    const g = C.geometry({ r: r, x: O.x + r * Math.sqrt(3 / 5) });
    five = five && g.circles5.every((c) => c && near(c.r, r / 5, 1e-9));
  }
  check("at x = r√(3/5) all five region circles have radius r/5", five);
  check("no lens circle fits when x is larger than r/3",
    C.geometry({ r: 130, x: O.x + 130 * 0.6 }).circles2.every((c) => c === null));
  check("the status speaks the radii that were checked",
    /r3 and r4 are equal/.test(C.describe(C.start({}))) &&
    /lens circle/.test(C.describe(C.start({}))));
  const g = C.geometry(C.start({ xRatio: 0.4 }));
  const x0 = 130 * 0.4, r10 = (130 * 130 - x0 * x0) / 2 / 130;
  equal("the default drawing's radii are the swept ones",
    [g.r1, g.r3, g.r5].map((v) => Math.round(v * 1e9)),
    [r10, x0 * x0 / 130, r10 - x0].map((v) => Math.round(v * 1e9)));
}

done("circles-in-circles-sangaku");
