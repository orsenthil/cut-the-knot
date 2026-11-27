#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-ab/four-ab-core.js.
 *
 *    node porting/check-four-ab.mjs
 *
 * Part 1 transcribes FourABCanvas.init / AdjustRadius / Compute and
 * FourABPanel's listeners straight from the bytecode a second time and
 * compares them with the core over the whole canvas and slider ranges.
 * Part 2 checks the cut-the-knot page's claim S1 - S2 + S3 - S4 = 4ab:
 * first over every small (a, b, r) grid point, then against the four exact
 * quadrant areas and an independent Simpson integration of the disk.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-ab/four-ab-core.js", "FourAbCore");
const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/* ---------------------------------------- 1. second transcription of the applet */

/* FourABCanvas.init, with Java's integer divisions kept as Math.floor. */
function bytecodeCanvas(w, h) {
  const inset = 20;
  const x3 = Math.floor(w / 6);              // a in canvas pixels
  const x4 = Math.floor(h / 8);              // b in canvas pixels
  const x5 = Math.sqrt(x3 * x3 + x4 * x4) + Math.floor(Math.min(x3, x4) / 10);
  const x7 = w / 2;
  const x9 = h / 2;
  return {
    inset: inset,
    O: { x: x7, y: x9 },
    R: 2 * x5,
    A: { x: x7 + x3, y: x9 - x4 },
    B: { x: x7 + x3 + x5, y: x9 - x4 },
    a: x3,
    b: x4,
    step: x5,
  };
}

/* FourABCanvas.AdjustRadius(v): B.x = A.x + R*v; the radius is |B-A|. */
function bytecodeRadius(canvas, value) {
  const bx = canvas.A.x + canvas.R * (value / 100);
  return bx - canvas.A.x;
}

/* FourABCanvas.Compute: the "Show extra" lines x=2a and y=2b on screen. */
function bytecodeExtra(canvas) {
  return {
    verticalX: 2 * canvas.A.x - canvas.O.x,
    horizontalY: 2 * canvas.A.y - canvas.O.y,
  };
}

const widths = [];
const heights = [];
for (let w = 60; w <= 900; w += 7) widths.push(w);
for (let h = 40; h <= 700; h += 11) heights.push(h);

{
  let bad = "";
  let n = 0;
  for (const w of widths) {
    for (const h of heights) {
      const s = C.initial(w, h);
      const j = bytecodeCanvas(w, h);
      n++;
      if (s.a !== j.a || s.b !== j.b || !near(s.step, j.step) || !near(s.full, j.R) ||
          !near(s.radius, j.step)) {
        bad = `${w}x${h}: core ${JSON.stringify(s)} vs bytecode ${JSON.stringify(j)}`;
        break;
      }
    }
  }
  check("init matches the bytecode for every canvas size", !bad, bad);
  check("the canvas grid really is exhaustive-sized", n === widths.length * heights.length,
    `${n} canvases`);
}

{
  let bad = "";
  for (const w of widths) {
    for (const h of heights) {
      const s = C.initial(w, h);
      if (s.slider !== 50 || s.showExtra !== false || !near(s.radius, s.step) ||
          !near(s.full, 2 * s.step)) {
        bad = `${w}x${h}: ${JSON.stringify(s)}`;
        break;
      }
    }
  }
  check("slider starts at 50, radius at step, extra lines off", !bad, bad);
}

{
  let bad = "";
  let n = 0;
  for (let w = 120; w <= 640; w += 31) {
    for (let h = 80; h <= 460; h += 23) {
      const j = bytecodeCanvas(w, h);
      const start = C.initial(w, h);
      for (let v = 0; v <= 100; v++) {
        const s = C.withSlider(start, v);
        n++;
        if (s.slider !== v || !near(s.radius, bytecodeRadius(j, v))) {
          bad = `${w}x${h} slider ${v}: ${s.radius} vs ${bytecodeRadius(j, v)}`;
          break;
        }
      }
      if (bad) break;
    }
    if (bad) break;
  }
  check("AdjustRadius matches the bytecode at every slider value", !bad, bad);
  check("every slider value was tried", n > 4000, `${n} states`);
}

{
  const s = C.initial(640, 412);
  equal("slider below minimum is clamped", C.withSlider(s, -7).radius, 0);
  equal("slider 0 gives radius 0", C.withSlider(s, 0).radius, 0);
  check("slider 105 (the declared maximum) is clamped to 100",
    C.withSlider(s, 105).slider === 100 && near(C.withSlider(s, 105).radius, s.full));
  check("a fractional slider value is rounded as the Java slider does",
    C.withSlider(s, 3.6).slider === 4 && C.withSlider(s, 3.4).slider === 3);
}

{
  let bad = "";
  for (const w of widths) {
    for (const h of heights) {
      const j = bytecodeCanvas(w, h);
      const screen = bytecodeExtra(j);
      const lines = C.extraLines(C.initial(w, h));
      // Canvas x = O.x + a, canvas y = O.y - b, so x=2a -> 2A.x-O.x,
      // and y=2b -> 2A.y-O.y.
      if (!near(j.O.x + lines.x, screen.verticalX) ||
          !near(j.O.y - lines.y, screen.horizontalY)) {
        bad = `${w}x${h}: ${JSON.stringify(lines)} vs ${JSON.stringify(j)}`;
        break;
      }
    }
    if (bad) break;
  }
  check("the extra lines are exactly the bytecode's x=2a and y=2b", !bad, bad);

  const s = C.initial(640, 412);
  const l = C.extraLines(s);
  equal("the middle rectangle is 2a by 2b", { x: l.x, y: l.y }, { x: 212, y: 102 });
  check("the middle rectangle has area 4ab", near(l.x * l.y, 4 * s.a * s.b));
}

{
  const s = C.initial(640, 412);
  const moved = C.withCenter(s, 5000, -3);
  equal("the dragged centre stays in the first quadrant", { a: moved.a, b: moved.b },
    { a: 640, b: 0 });
  check("withCenter does not change the slider or the radius",
    moved.slider === s.slider && moved.radius === s.radius);
  check("withCenter does not mutate its argument", s.a === 106 && s.b === 51);
  check("withExtra toggles faithfully",
    C.withExtra(s, 1).showExtra === true && C.withExtra(C.withExtra(s, true), false).showExtra === false);
  const p = C.position(s);
  check("the saved position is plain JSON data",
    JSON.parse(JSON.stringify(p)).a === p.a && !("result" in p) && typeof p.signedArea === "number");
  equal("the initial signed area is 4ab", p.signedArea, 4 * 106 * 51);
}

/* --------------------------------------------- 2. the page's 4ab claim */

{
  let bad = "";
  let n = 0;
  for (let a = 1; a <= 50; a++) {
    for (let b = 1; b <= 30; b++) {
      const t = Math.hypot(a, b);
      for (const r of [t, t + 0.01, t * 1.3]) {
        const got = C.signedArea(a, b, r);
        n++;
        if (!near(got, 4 * a * b, 1e-9)) {
          bad = `a=${a} b=${b} r=${r}: ${got} != ${4 * a * b}`;
          break;
        }
      }
      if (bad) break;
    }
    if (bad) break;
  }
  check("4ab holds at and above sqrt(a*a+b*b) for every small (a,b)", !bad, bad);
  check("the claim grid covers thousands of configurations", n === 50 * 30 * 3, `${n} cases`);
}

{
  let bad = "";
  let n = 0;
  let below = 0;
  for (let a = 1; a <= 30; a++) {
    for (let b = 1; b <= 20; b++) {
      for (let r = 1; r <= 40; r++) {
        const holds = r >= Math.hypot(a, b);
        const got = C.signedArea(a, b, r);
        n++;
        if (holds !== near(got, 4 * a * b) || (!holds && got > 4 * a * b + 1e-9)) {
          bad = `a=${a} b=${b} r=${r}: hypothesis ${holds}, sum ${got}`;
          break;
        }
        if (!holds) below++;
      }
      if (bad) break;
    }
    if (bad) break;
  }
  check("the 4ab answer holds exactly when the radius hypothesis holds", !bad, bad);
  check("the grid really tests failing hypotheses too", below > 10000, `${n} cases, ${below} below`);
}

{
  const rand = rng(20261127);
  let badClosed = "";
  let badTotal = "";
  for (let i = 0; i < 500; i++) {
    const a = 1 + rand() * 60;
    const b = 1 + rand() * 40;
    const r = 0.2 + rand() * 200;
    const s = C.quadrantAreas(a, b, r);
    if (!near(s[0] - s[1] + s[2] - s[3], C.signedArea(a, b, r), 2e-7)) {
      badClosed = `a=${a} b=${b} r=${r}: ${JSON.stringify(s)}`;
    }
    if (!near(s[0] + s[1] + s[2] + s[3], Math.PI * r * r, 2e-7)) {
      badTotal = `a=${a} b=${b} r=${r}: ${JSON.stringify(s)}`;
    }
  }
  check("the closed form agrees with all four exact quadrant areas", !badClosed, badClosed);
  check("the four quadrant areas always add up to pi*r*r", !badTotal, badTotal);
}

/* Independent numerical integration of 2*integral(min(a,H(v))*sign(v+b), v). */
function simpsonSignedArea(a, b, r) {
  const bb = Math.min(Math.max(b, -r), r);
  const f = (v) => Math.min(a, Math.sqrt(Math.max(0, r * r - v * v)));
  const integrate = (lo, hi) => {
    const n = 20000;
    const h = (hi - lo) / n;
    let total = f(lo) + f(hi);
    for (let i = 1; i < n; i++) total += (i % 2 ? 4 : 2) * f(lo + i * h);
    return (total * h) / 3;
  };
  return 2 * (integrate(-bb, r) - integrate(-r, -bb));
}

{
  const rand = rng(4932);
  let bad = "";
  for (let i = 0; i < 200; i++) {
    const a = 0.5 + rand() * 40;
    const b = 0.5 + rand() * 30;
    const r = 0.5 + rand() * 80;
    const closed = C.signedArea(a, b, r);
    const numeric = simpsonSignedArea(a, b, r);
    if (!near(closed, numeric, 5e-5)) bad = `a=${a} b=${b} r=${r}: ${closed} vs ${numeric}`;
  }
  check("a separate Simpson integration agrees with the closed form", !bad, bad);
}

{
  const r = 5;
  const q = C.quadrantAreas(40, 30, r);
  check("a circle wholly in quadrant 1 contributes pi*r*r there",
    near(q[0], Math.PI * r * r) && q[1] === 0 && q[2] === 0 && q[3] === 0,
    JSON.stringify(q));
  check("and its alternating sum is pi*r*r", near(C.signedArea(40, 30, r), Math.PI * r * r));

  let bad = "";
  for (const a of [2, 4, 6, 8]) {
    const rr = 9;
    const expected = 2 * a * Math.sqrt(rr * rr - a * a) + 2 * rr * rr * Math.asin(a / rr);
    if (!near(C.signedArea(a, 15, rr), expected)) {
      bad = `a=${a}: ${C.signedArea(a, 15, rr)} vs ${expected}`;
    }
  }
  check("with r below b the chord formula gives the half-disk split", !bad, bad);

  equal("radius zero gives no area anywhere", C.quadrantAreas(12, 7, 0), [0, 0, 0, 0]);
  equal("radius zero gives an alternating sum of zero", C.signedArea(12, 7, 0), 0);
}

{
  const s = C.initial(640, 412);
  check("the applet's starting circle satisfies the problem's hypothesis",
    s.radius > Math.hypot(s.a, s.b), `${s.radius} vs ${Math.hypot(s.a, s.b)}`);
  let first = -1;
  for (let v = 0; v <= 100; v++) {
    if (C.withSlider(s, v).radius >= Math.hypot(s.a, s.b)) {
      first = v;
      break;
    }
  }
  check("the slider crosses the hypothesis once, at value 48", first === 48, `first=${first}`);
  let bad = "";
  for (let v = 0; v <= 100; v++) {
    const t = C.withSlider(s, v);
    const equalTo4ab = near(C.signedArea(t.a, t.b, t.radius), 4 * t.a * t.b);
    if (equalTo4ab !== (v >= first)) bad = `slider ${v}: equality ${equalTo4ab}`;
  }
  check("every slider value follows the applet's answer or its failure", !bad, bad);
  check("the largest slider still obeys the hypothesis",
    C.withSlider(s, 100).radius >= Math.hypot(s.a, s.b));
}

done("four-ab");
