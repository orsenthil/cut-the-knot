#!/usr/bin/env node
"use strict";

/*
 * Logic test for markowsky-parabola/markowsky-parabola-core.js.
 *
 *   node porting/check-markowsky-parabola.mjs
 *
 * Section 1 checks the state transitions and the applet's own guard. Section 2
 * is a second, independent transcription of the applet's bytecode (Parabola,
 * Compute, ComputeWhatNot, ComputeTangent1/2 and GeoSDoub.Intersect/
 * NearestPoint) compared with the core at every one of the 511 x 511 slider
 * settings. Section 3 checks the page's claim on every configuration in the
 * domain the page states (0 < p < q <= 260), first on the exact parabola, then
 * on the applet's whole-pixel drawing, plus the auxiliary-point facts drawn
 * by the applet's "extra" hint. There is no win or loss in an illustration.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("markowsky-parabola/markowsky-parabola-core.js", "MarkowskyParabolaCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the applet starts with TtA = 80, TtB = 180", [s.tA, s.tB], [80, 180]);
  check("all three checkboxes start off",
    !s.options.names && !s.options.statement && !s.options.hint);
  check("a fresh picture has not been touched", s.touches === 0);

  const low = C.setOffset(s, "A", -999);
  const high = C.setOffset(s, "B", 999);
  check("scrollbars stop at -250 and 260", low.tA === -250 && high.tB === 260);
  check("a scrollbar move counts as a touch and leaves the other one alone",
    high.tA === 80 && high.touches === 1 && high.options.hint === false);
  check("a rounded scrollbar value is used as an integer",
    C.setOffset(s, "A", 81.6).tA === 82);
  check("a scrollbar string and the same number agree",
    C.setOffset(s, "A", "35").tA === C.setOffset(s, "A", 35).tA);
  check("an unknown scrollbar is ignored", C.setOffset(s, "Z", 5) === s);
  check("an out-of-board drag is clamped to the slider range",
    C.moveVertex(s, "A", { x: 5000, y: 200 }).tA === 260 &&
    C.moveVertex(s, "B", { x: -5000, y: 200 }).tB === -250);
  check("a nudge of a dot changes its parabola parameter",
    C.moveVertex(s, "A", { x: C.HALF + 83, y: 123 }).tA === 83);

  let t = s;
  for (const name of ["names", "statement", "hint"]) t = C.setOption(t, name, true);
  check("each of the applet's three checkboxes can be switched on",
    t.options.names && t.options.statement && t.options.hint && t.touches === 0);
  check("checkboxes can be switched off again",
    !C.setOption(C.setOption(t, "hint", false), "names", false).options.names);
  check("an unknown checkbox is ignored", C.setOption(t, "fill", true) === t);
}

/* ----------------------------- the applet's own method, transcribed again */

function jParabola(t) {
  return Math.trunc(Math.trunc((t * t) / 4) / 40);
}
function jCompute(h, t) {
  return h - 40 - jParabola(t) - 20;
}
/* GeoSDoub.Intersect(Point,Point,Point,Point), CTKGeometry.zip, bytecode order. */
function jIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - a1 * c2) / den };
}
/* GeoSDoub.NearestPoint(Point,Point,Point). */
function jNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const sq = dx * dx + dy * dy;
  if (sq < 0.1) return { x: p.x, y: p.y };
  const k = (dx * (p.x - a.x) + dy * (p.y - a.y)) / sq;
  return { x: a.x + k * dx, y: a.y + k * dy };
}
/* MarkowskyParabolaCanvas.ComputeWhatNot + ComputeTangent1/2, from javap. */
function jPicture(tA, tB) {
  const W = 560, H = 500, half = W / 2;
  const O = { x: half, y: jCompute(H, 0) };
  const Op = { x: half, y: 20 };
  const A = { x: half + tA, y: jCompute(H, tA) };
  const B = { x: half + tB, y: jCompute(H, tB) };
  const Ap = { x: A.x, y: 20 };
  const Bp = { x: B.x, y: 20 };
  if (Math.abs(tA - tB) < 0.1 || Math.abs(tB) < 0.1 || Math.abs(tA) < 0.1) {
    return { active: false, O, A, B };
  }
  const AT = { x: half + tA + 50, y: A.y - 50 * ((tA / 40) / 2) };
  const BT = { x: half + tB + 50, y: B.y - 50 * ((tB / 40) / 2) };
  const C = jIntersect(O, B, A, Ap);
  const D = jNearest(C, O, Op);
  const K = jIntersect(O, A, B, Bp);
  const M = jIntersect(A, AT, B, BT);
  return { active: true, O, A, B, Ap, Bp, AT, BT, C, D, K, M };
}

/* ------------------------------------------- 2. every case, where it is small */

{
  const gap = (p, q) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
  const worst = { O: 0, A: 0, B: 0, C: 0, D: 0, K: 0, M: 0, AT: 0, BT: 0 };
  let active = 0, inactive = 0, disagreement = 0;
  for (let tA = C.MIN_T; tA <= C.MAX_T; tA++) {
    for (let tB = C.MIN_T; tB <= C.MAX_T; tB++) {
      const core = C.geometry(C.start({ tA, tB }));
      const java = jPicture(tA, tB);
      if (core.active !== java.active) disagreement++;
      if (!java.active) inactive++; else active++;
      for (const name of Object.keys(worst)) {
        if (!java.active && !["O", "A", "B"].includes(name)) continue;
        // The core keeps the tangent ends as the q end of tangentA/tangentB.
        const mine = name === "AT" ? (core.tangentA && core.tangentA.q)
          : name === "BT" ? (core.tangentB && core.tangentB.q) : core[name];
        if (mine && java[name]) {
          worst[name] = Math.max(worst[name], gap(mine, java[name]));
        } else if (Boolean(mine) !== Boolean(java[name])) disagreement++;
      }
    }
  }
  check("the applet's guard agrees at all 511 x 511 settings", disagreement === 0);
  check("all 259,590 active and 1,531 skipped settings are exercised",
    active === 259590 && inactive === 1531);
  for (const name of Object.keys(worst)) {
    check(`core ${name} matches the second transcription at every setting`,
      worst[name] < 1e-9, `worst gap ${worst[name]}`);
  }
  check("integer parabola values are the applet's own truncation",
    [0, 80, 180, 260].map(jParabola).join(",") ===
    [0, 40, 202, 422].join(",") &&
    [0, 80, 180, 260].every((t) => C.parabola(t) === jParabola(t)));
  check("the parabola polyline runs from -272 to 272 in steps of 2",
    C.parabolaPoints().length === 273 &&
    C.parabolaPoints()[0].x === 8 &&
    C.parabolaPoints()[272].x === 552);
}

/* ------------------------------------------------------- 3. the page's claim */

{
  let idealMax = 0, slopeMax = 0, horizontalMax = 0, drawnMax = 0, drawnAt = null;
  let pairs = 0;
  for (let p = 1; p <= 260; p++) {
    for (let q = p + 1; q <= 260; q++) {
      const z = C.ideal(p, q);
      idealMax = Math.max(idealMax,
        Math.abs(C.angle(z.D, z.A, z.C) - C.angle(z.D, z.B, z.C)));
      slopeMax = Math.max(slopeMax, Math.abs(z.slopeDA + z.slopeDB));
      horizontalMax = Math.max(horizontalMax,
        Math.abs(z.D.y - z.C.y), Math.abs(z.K.y - z.C.y), Math.abs(z.M.y - z.C.y));
      const r = C.readings(C.start({ tA: p, tB: q }));
      if (r.gap > drawnMax) { drawnMax = r.gap; drawnAt = [p, q]; }
      pairs++;
    }
  }
  check("every one of the 33,670 right-branch pairs was tested", pairs === 33670);
  check("the page's claim ADC = BDC holds for the exact parabola everywhere",
    idealMax < 1e-9, `worst difference ${idealMax} degrees`);
  check("DA and DB have opposite slopes about the horizontal ray DC",
    slopeMax < 1e-12, `worst slope sum ${slopeMax}`);
  check("the hint's D, C, K and M are level (tangents meet above the chord's midpoint)",
    horizontalMax < 1e-9, `worst height difference ${horizontalMax}`);
  check("the applet's whole-pixel drawing agrees to within 4.3 degrees",
    drawnMax < 4.3, `worst ${drawnMax} degrees at TtA/TtB = ${drawnAt}`);
  check("the drawing is much closer for well separated points",
    C.readings(C.start({ tA: 80, tB: 180 })).gap < 0.1);
  check("the claim is false outside the stated right-branch domain",
    C.readings(C.start({ tA: -80, tB: 180 })).gap > 60);

  const invalid = [C.start({ tA: 0, tB: 180 }), C.start({ tA: 80, tB: 0 }),
    C.start({ tA: 80, tB: 80 })];
  check("the construction is skipped for zero or equal offsets",
    invalid.every((s) => !C.geometry(s).active && Number.isNaN(C.readings(s).adc)));
  check("an invalid configuration asks for two different nonzero offsets",
    invalid.every((s) => C.status(s).includes("different distances")));
  check("a left-branch configuration is directed back to the stated domain",
    C.status(C.start({ tA: -80, tB: 180 })).includes("to the right of the axis"));
  const good = C.status(C.start({ tA: 80, tB: 180 }));
  check("the status reports both angle readings and the claim",
    good.includes("31.9°") && good.includes("equal"));
  check("there is no win, loss or finishing move in an illustration",
    !("result" in C) && !("legalMoves" in C));
}

done("markowsky-parabola");
