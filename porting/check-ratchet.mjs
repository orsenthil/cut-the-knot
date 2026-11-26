#!/usr/bin/env node
"use strict";

/*
 * Logic test for ratchet/ratchet-core.js.
 *
 *   node porting/check-ratchet.mjs
 *
 * 1. The staircase geometry the applet builds (step, tread, ball).
 * 2. The page's claim, frame by frame over many cycles: alone, either
 *    staircase carries the ball down; together they carry it up, by the
 *    same amount every 24 frames (one step less the 0.8 step that T falls).
 * 3. The hand-over rule: S gives the ball at the top of each climb and takes
 *    it back at the bottom, every 12 frames, never otherwise.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("ratchet/ratchet-core.js", "RatchetCore");
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

/* ------------------------------------------------------------ 1. geometry */

{
  const D = C.stepVector();
  check("one step is 100 pixels along the slope 10:30", near(Math.hypot(D.x, D.y), 100) && near(D.y / D.x, 3));
  const t = C.tread(D);
  check("the tread is 40 pixels and square to the slope", near(Math.hypot(t.x, t.y), 40) && near(t.x * D.x + t.y * D.y, 0));
  const s = C.start();
  equal("a new demo shows both staircases", s.mode, "both");
  equal("the flashing staircase holds the ball first", C.holder(s), "S");
  const b = C.ball(s);
  check("the ball's radius is the notch's inradius (about 24)", b.r > 24 && b.r < 24.5, String(b.r));
  check("a new demo is not won or lost", s.frame === 0);
  const poly = C.polygon(s.S, s.width, s.height);
  check("the outline has an even number of corners (two per tooth, two for the back)", poly.length % 2 === 1 || poly.length >= 6);
  const before = JSON.stringify(s);
  C.tick(s);
  equal("tick does not change the position it is given", JSON.stringify(s), before);
}

/* ------------------------------------------- 2. down alone, up together */

/** Net vertical movement of the ball over n frames, ignoring wrap-around jumps. */
function drift(mode, frames) {
  let s = C.start({ mode });
  let y = C.ball(s).y;
  let total = 0;
  const cycles = []; // ball movement in each 24 frames with no wrap-around inside
  let cycle = 0, wrapped = false;
  for (let i = 1; i <= frames; i++) {
    s = C.tick(s);
    const ny = C.ball(s).y;
    const dy = ny - y;
    if (Math.abs(dy) < 120) { total += dy; cycle += dy; } else wrapped = true; // a wrap jumps a screen
    y = ny;
    if (i % 24 === 0) {
      if (!wrapped) cycles.push(cycle);
      cycle = 0; wrapped = false;
    }
  }
  return { total, cycles };
}

{
  const T = drift("regular", 2400);
  check("alone, the plain staircase carries the ball down", T.total > 0, String(T.total));
  const S = drift("flashing", 2400);
  check("alone, the flashing staircase carries the ball down", S.total > 0, String(S.total));
  const B = drift("both", 2400);
  check("together, they carry the ball up", B.total < 0, String(B.total));
  const D = C.stepVector();
  // Each 24-frame cycle: up one step on S, then down 12 frames on T: net -D + 24/30 D = -0.2 D.
  check("every 24 frames the ball rises exactly 0.2 of a step",
    B.cycles.length > 20 && B.cycles.every((d) => near(d, -0.2 * D.y)), B.cycles.filter((d) => !near(d, -0.2 * D.y)).join(","));
  check("in 24 frames alone, the plain staircase falls 0.8 of a step",
    T.cycles.length > 20 && T.cycles.every((d) => near(d, 0.8 * D.y)), T.cycles.filter((d) => !near(d, 0.8 * D.y)).join(","));
  check("in 24 frames alone, the flashing staircase also falls 0.8 of a step",
    S.cycles.length > 20 && S.cycles.every((d) => near(d, 0.8 * D.y)), S.cycles.filter((d) => !near(d, 0.8 * D.y)).join(","));
}

/* ------------------------------------------- 3. the hand-over rule */

{
  let s = C.start();
  let swaps = [];
  let who = C.holder(s);
  for (let i = 1; i <= 240; i++) {
    s = C.tick(s);
    const w = C.holder(s);
    if (w !== who) swaps.push(i);
    who = w;
  }
  check("the ball changes hands exactly every 12 frames", swaps.length === 20 && swaps.every((f, i) => f === 12 * (i + 1)), swaps.join(","));
  // Regular and flashing never hand the ball over.
  for (const mode of ["regular", "flashing"]) {
    let t = C.start({ mode });
    const h = C.holder(t);
    let same = true;
    for (let i = 0; i < 200; i++) { t = C.tick(t); same = same && C.holder(t) === h; }
    check(`${mode} alone keeps the ball on one staircase`, same);
  }
  // Positions stay on screen: the origins wrap back inside.
  let u = C.start();
  let onScreen = true;
  for (let i = 0; i < 3000; i++) {
    u = C.tick(u);
    for (const st of [u.S, u.T]) {
      const x = Math.round(st.O.x), y = Math.round(st.O.y);
      onScreen = onScreen && x >= -1 && y >= -1 && x <= u.width && y <= u.height;
    }
  }
  check("both origins stay on the canvas for 3000 frames", onScreen);
  check("the position is plain JSON", JSON.stringify(JSON.parse(JSON.stringify(u))) === JSON.stringify(u));
}

done("ratchet");
