#!/usr/bin/env node
"use strict";

/*
 * Logic test for inversion-in-arbelos/inversion-in-arbelos-core.js.
 *
 *   node porting/check-inversion-in-arbelos.mjs
 *
 * The article claims: (1) h_n = 2n R_n for every circle of the chain;
 * (3) R_L = R/(1+k), R_R = Rk/(1+k); (4)/(6) AP_n = R(k+2)/(k^2 n^2+k+1);
 * (5) R_n = Rk/(k^2 n^2+k+1); (5') the same with t = 1/k. All of these are
 * checked over the whole 1..50 circle range and a grid of configurations,
 * along with direct tangency tests against the two given circles and each
 * neighbour in the chain. Section 2 is a second transcription of the applet's
 * own GetCircle(-n) and InvLine.Invert bytecode, compared with the core at
 * every configuration in the grid and at 300 random drags.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("inversion-in-arbelos/inversion-in-arbelos-core.js", "InversionInArbelosCore");

const near = (a, b, tol = 1e-7) =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* --------- a second transcription, straight from InversionInArbelosCanvas --- */

/** GetCircle(int i): cx=(A.x+B.x)/2, r=|B.x-A.x|/2, cy=O.y+2*r*i. */
function appletGetCircle(i, O, A, B) {
  const cx = (A.x + B.x) / 2;
  const r = Math.abs(B.x - A.x) / 2;
  const cy = O.y + 2 * r * i;
  return { c: { x: cx, y: cy }, r: r };
}

/** InvLine.Invert(DoubCircle): scale about O by rho^2/(d^2-r^2). */
function appletInvert(circle, O, rho) {
  const dx = circle.c.x - O.x;
  const dy = circle.c.y - O.y;
  const d2 = dx * dx + dy * dy;
  const scale = rho * rho / (d2 - circle.r * circle.r);
  return {
    c: { x: O.x + scale * dx, y: O.y + scale * dy },
    r: Math.abs(scale) * circle.r,
  };
}

/** The chain the applet draws: n = 0..N-1 circles GetCircle(-n), inverted. */
function appletChain(state) {
  const g = C.geometry(state);
  const out = [];
  for (let n = 0; n < g.N; n++) {
    const strip = appletGetCircle(-n, g.O, g.A, g.B);
    out.push(appletInvert(strip, g.O, g.rho));
  }
  return out;
}

/** The sizes the applet solves for: radii of the two nested tangent circles. */
function appletNested(O, A, B, R) {
  const rho = R.x - O.x;
  const p = A.x - O.x;
  const q = B.x - O.x;
  return { outer: rho * rho / (2 * p), inner: rho * rho / (2 * q) };
}

/* ---------------------------------------------- 1. constants and the start */

{
  const s = C.start({});
  const g = C.geometry(s);
  check("the board is 420 x 300 with the axis at y=245",
    C.VIEW.width === 420 && C.VIEW.height === 300 && C.AXIS_Y === 245);
  check("the spinner runs from 1 to 50, as CTKNumberCanvas.SetRange(1,50) does",
    C.N_MIN === 1 && C.N_MAX === 50 && s.N === 1);
  check("the guide checkbox starts off and is disabled at N=1",
    s.hints === false && C.setHints(s, true).hints === false);
  check("start is plain JSON data with all four handles on the axis",
    JSON.stringify(s) === JSON.stringify(JSON.parse(JSON.stringify(s))) &&
    [s.O, s.A, s.B, s.R].every((p) => p.y === C.AXIS_Y) &&
    s.O.x < s.A.x && s.A.x < s.B.x && s.R.x > s.O.x);
  check("a requested N and hints are kept only in range",
    C.setN(s, 7).N === 7 && C.setHints(C.setN(s, 7), true).hints === true &&
    C.setN(s, 0).N === 1 && C.setN(s, 99).N === 50 &&
    C.setN(s, NaN).N === 1);
  check("moving a handle never changes the state it was given",
    (() => {
      const next = C.setPoint(s, "A", { x: 205, y: 90 });
      return s.A.x === 190 && next.A.x === 205 && next !== s && next.A.y === C.AXIS_Y;
    })());
  check("a drag outside the board is clamped, keeping the circles on screen",
    (() => {
      const left = C.setPoint(s, "O", { x: -999, y: 0 });
      const right = C.setPoint(s, "B", { x: 9999, y: 0 });
      const farR = C.setPoint(s, "R", { x: 9999, y: 0 });
      return left.O.x >= 20 && right.B.x <= C.VIEW.width - 16 &&
        farR.R.x - farR.O.x <= C.maxRho(farR.O.x, farR.A.x) + 1e-9 &&
        C.geometry(farR).outer.radius <= C.AXIS_Y - 12 + 1e-9;
    })());
  check("the saved position is JSON-safe and carries the drawn circles",
    (() => {
      const pos = C.position(C.setN(s, 4));
      return JSON.stringify(pos) === JSON.stringify(JSON.parse(JSON.stringify(pos))) &&
        pos.N === 4 && pos.chain.length === 4 &&
        pos.chain[0].height === 0 && pos.chain[1].radius > 0 &&
        near(pos.k, pos.RR / pos.RL, 1e-5) && near(pos.R, pos.RL + pos.RR, 1e-5);
    })());
}

/* --------------------------- 2. the applet's own arithmetic, configuration by configuration */

{
  const configs = [];
  for (const o of [30, 70, 110]) {
    for (const p of [40, 80, 120]) {
      for (const gap of [30, 60, 90]) {
        const a = o + p;
        const b = a + gap;
        if (b > C.VIEW.width - 16) continue;
        const max = C.maxRho(o, a);
        for (const f of [0.2, 0.6, 1]) {
          const r = o + Math.max(C.MIN_RHO, max * f);
          configs.push(C.start({
            O: { x: o }, A: { x: a }, B: { x: b }, R: { x: r }, N: 50,
          }));
        }
      }
    }
  }
  let centres = true, radii = true, nested = true, strips = true;
  for (const state of configs) {
    const g = C.geometry(state);
    const drawn = appletChain(state);
    const pair = appletNested(g.O, g.A, g.B, g.R);
    nested = nested && near(g.outer.radius, pair.outer) && near(g.inner.radius, pair.inner);
    for (let n = 0; n < 50; n++) {
      const c = g.chain[n];
      radii = radii && near(c.radius, drawn[n].r);
      centres = centres && near(c.center.x, drawn[n].c.x) &&
        near(c.center.y, drawn[n].c.y);
      const strip = appletGetCircle(-n, g.O, g.A, g.B);
      strips = strips && near(strip.c.x, g.strip.center.x) &&
        near(strip.c.y, C.AXIS_Y - n * g.strip.step) &&
        near(strip.r, g.strip.radius);
    }
  }
  check("GetCircle(-n) places equal circles one diameter apart (all configurations)", strips);
  check("InvLine.Invert gives exactly the core's chain radii", radii);
  check("InvLine.Invert gives exactly the core's chain centres", centres);
  check("the two nested circle radii are the applet's rho^2/(2p) and rho^2/(2q)", nested);
  check("the grid covered many configurations", configs.length >= 50, `${configs.length}`);
}

/* ------------------------------ 3. every claim on the article, n = 0..49 */

{
  let chain = true, radius = true, height = true, ap = true, alt = true;
  let decomposition = true, tangency = true, neighbours = true, base = true;
  let configs = 0;
  for (const o of [30, 70, 110]) {
    for (const p of [40, 80, 120]) {
      for (const gap of [30, 60, 90]) {
        const a = o + p;
        const b = a + gap;
        if (b > C.VIEW.width - 16) continue;
        const max = C.maxRho(o, a);
        for (const f of [0.15, 0.5, 0.9]) {
          const state = C.start({
            O: { x: o }, A: { x: a }, B: { x: b },
            R: { x: o + Math.max(C.MIN_RHO, max * f) }, N: 50,
          });
          const g = C.geometry(state);
          configs++;
          const k = g.k, R = g.Rbig, t = 1 / k;
          decomposition = decomposition &&
            near(g.RL, R / (1 + k)) && near(g.RR, R * k / (1 + k)) &&
            near(R, g.RL + g.RR) && near(k, g.RR / g.RL) &&
            near(g.outer.center.x + g.outer.radius, g.Aprime.x) &&
            near(g.inner.center.x + g.inner.radius, g.Bprime.x) &&
            near(dist(g.outer.center, g.inner.center), g.outer.radius - g.inner.radius);
          for (let n = 0; n < 50; n++) {
            const c = g.chain[n];
            const denom = k * k * n * n + k + 1;
            radius = radius && near(c.radius, R * k / denom);
            height = height && near(c.height, 2 * n * c.radius);
            ap = ap && near(c.AP, R * (k + 2) / denom) &&
              near(c.AP, c.center.x - g.O.x); // P_n is the projection on L
            alt = alt && near(c.radius, R * t / (t * t + t + n * n));
            chain = chain && near(c.center.y, C.AXIS_Y - c.height);
            tangency = tangency &&
              near(dist(c.center, g.outer.center), g.outer.radius - c.radius) &&
              near(dist(c.center, g.inner.center), g.inner.radius + c.radius);
            if (n > 0) {
              neighbours = neighbours &&
                near(dist(c.center, g.chain[n - 1].center), c.radius + g.chain[n - 1].radius);
            }
          }
          base = base && g.chain[0].height === 0 &&
            near(g.chain[0].radius, g.RR) &&
            near(g.chain[0].center.y, C.AXIS_Y);
        }
      }
    }
  }
  check("claim (3): R_L = R/(1+k), R_R = Rk/(1+k), R = R_L+R_R", decomposition);
  check("claim (1): h_n = 2n R_n for n=0..49 in every configuration", height);
  check("claim (5): R_n = Rk/(k^2 n^2 + k + 1)", radius);
  check("claim (4)/(6): AP_n = R(k+2)/(k^2 n^2 + k + 1) = distance AO_n", ap);
  check("claim (5'): R_n = Rt/(t^2 + t + n^2) with t = 1/k", alt);
  check("every circle centre is h_n above the axis", chain);
  check("each chain circle is tangent to both given circles", tangency);
  check("neighbouring chain circles are tangent to each other", neighbours);
  check("circle 0 has its diameter on L and radius R_R", base);
  check("the grid covered at least 50 configurations", configs >= 50, `${configs}`);
}

/* ------------------------------------------------- 4. random drags and ranges */

{
  const random = rng(1741);
  let ok = true;
  for (let i = 0; i < 300; i++) {
    const o = 25 + 85 * random();
    const a = o + C.MIN_P + 110 * random();
    const b = a + C.MIN_GAP + 60 * random();
    if (b > C.VIEW.width - 16) continue;
    const max = C.maxRho(o, a);
    const r = o + C.MIN_RHO + (max - C.MIN_RHO) * random();
    const n = 1 + Math.floor(50 * random());
    const state = C.start({ O: { x: o }, A: { x: a }, B: { x: b }, R: { x: r }, N: n });
    const g = C.geometry(state);
    const drawn = appletChain(state);
    for (let j = 0; j < n; j++) {
      const c = g.chain[j];
      ok = ok && near(c.radius, drawn[j].r) && near(c.center.x, drawn[j].c.x) &&
        near(c.center.y, drawn[j].c.y) &&
        near(c.height, 2 * j * c.radius) &&
        near(c.radius, g.Rbig * g.k / (g.k * g.k * j * j + g.k + 1)) &&
        near(dist(c.center, g.outer.center), g.outer.radius - c.radius);
    }
  }
  check("300 random drags agree with the bytecode and all the formulas", ok);
  check("N controls how many circles are drawn",
    C.geometry(C.setN(C.start({}), 1)).chain.length === 1 &&
    C.geometry(C.setN(C.start({}), 50)).chain.length === 50);
  check("hints turn off again when N falls to 1",
    C.setN(C.setHints(C.setN(C.start({}), 3), true), 1).hints === false);
  check("a missing N, negative N and fractional N all clamp",
    C.setN(C.start({}), -4).N === 1 && C.setN(C.start({}), 2.7).N === 3 &&
    C.setN(C.start({}), undefined).N === 1);
  equal("the default diagram keeps the applet's start values",
    [C.start({}).O.x, C.start({}).A.x, C.start({}).B.x, C.start({}).R.x],
    [70, 190, 270, 210]);
}

done("inversion-in-arbelos");
