#!/usr/bin/env node
"use strict";

/*
 * Logic test for ceva-pww/ceva-pww-core.js.
 *
 *   node porting/check-ceva-pww.mjs
 *
 * Checked: the starting triangle and the panel's four numbers and range; the
 * article's claim (AF/FB)(BD/DC)(CE/EA) = 1 and its grid step
 * BD/DC = FB·EA/(CE·AF) over all 10^4 positive integer settings; concurrency
 * and every geometric claim on many triangles; the ratio buttons' clamping.
 * Last, a second transcription of CevaPWWCanvas.DrawCevian, LinComb,
 * GetParallelTo and GeoSDoub.Intersect, written straight from the bytecode,
 * is compared with the core's figure over thousands of random triangles and
 * ratio settings, including negative ratios and the parallel (m = -n) case.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("ceva-pww/ceva-pww-core.js", "CevaPwwCore");

const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const nanEqual = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) ||
  (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6);
const pointEqual = (p, q, tol) => (p === null && q === null) ||
  (Boolean(p) && Boolean(q) && nanEqual(p.x, q.x) && nanEqual(p.y, q.y));
const tri = (A, B, Cc, ratios) => ({ ...C.start({ points: { A, B, C: Cc } }), ...ratios });
const allClaims = (s) => Object.values(C.claims(s)).every(Boolean);

/* ------------------------- the applet's methods, transcribed a second time */

/* CevaPWWCanvas.LinComb: t*p + (1-t)*q. */
function appletLinComb(p, q, t) {
  return { x: t * p.x + (1 - t) * q.x, y: t * p.y + (1 - t) * q.y };
}
/* GeoSDoub.GetParallelTo: p + 100*(q-r). */
function appletParallel(p, q, r) {
  return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
}
/* GeoSDoub.Intersect: ax+by+c=0 lines, NaN when |det| < 1. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}
/* CevaPWWCanvas.DrawCevian, including its parallel branch. */
function appletCevian(V, X, Y, m, n) {
  if (n === -m) {
    return {
      foot: null,
      p: appletParallel(V, X, Y),
      q: appletParallel(V, Y, X),
    };
  }
  const foot = appletLinComb(X, Y, n / (m + n));
  return { foot, p: foot, q: { x: V.x, y: V.y } };
}
/* The points of DrawGrid in the order the bytecode stores them. */
function appletFigure(A, B, Cc, ae, ec, af, fb) {
  const be = appletCevian(B, A, Cc, ae, ec);       // local 2, named E
  const cf = appletCevian(Cc, A, B, af, fb);       // local 3, named F
  const ad = appletCevian(A, B, Cc, ae * fb, ec * af); // local 4, named D
  const nan = { x: NaN, y: NaN };
  const E = be.foot, F = cf.foot, D = ad.foot;
  const K = E && D ? appletIntersect(E, B, A, D) : nan; // local 15
  const l8 = appletParallel(A, F || nan, Cc);
  const l9 = appletParallel(Cc, E || nan, B);
  const l10 = appletParallel(A, E || nan, B);
  const l11 = appletParallel(B, F || nan, Cc);
  const G = appletIntersect(B, l11, Cc, l9);        // local 12, named G
  const Q = appletIntersect(A, l8, Cc, l9);         // local 13
  const R = appletIntersect(A, l10, B, l11);        // local 14
  const p16 = appletIntersect(l10, A, F || nan, Cc);
  const p17 = appletIntersect(l8, A, B, E || nan);
  const l18 = appletParallel(B, A, D || nan);
  const l19 = appletParallel(Cc, A, D || nan);
  const p20 = appletIntersect(B, l18, A, R);
  const p21 = appletIntersect(Cc, l19, A, Q);
  const p22 = appletIntersect(B, G, A, D || nan);
  const p23 = appletIntersect(Cc, l19, B, G);
  return { E, F, D, K, G, Q, R, p16, p17, p20, p21, p22, p23,
    cevians: { ad, be, cf } };
}

/* ------------------------------------------ 1. the start and the panel ---- */

{
  const s = C.start();
  equal("start A is w/3,h/2 with Java integer division", s.A, { x: 133, y: 150 });
  equal("start B is 2w/3,h/5", s.B, { x: 266, y: 60 });
  equal("start C is 3w/4,4h/7", s.C, { x: 300, y: 171 });
  equal("the four panel numbers start at 2,3,3,2",
    [s.ae, s.ec, s.af, s.fb], [2, 3, 3, 2]);
  equal("the panel's range is -10..10", [C.MIN, C.MAX], [-10, 10]);
  check("an illustration has no win, loss or end", C.result(s) === null);
  check("the starting triangle is not degenerate", C.doubleArea(s) > 1e-7);
  check("all claims hold on the starting picture", allClaims(s));
  check("the starting ratios give a Ceva product of 1", C.ratios(s).product === 1);
  check("withPoint does not change the old position", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === 133 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("an unknown point name leaves the position alone",
    C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === 133);
  check("bad text in a number field restores the old value",
    C.setRatio(s, "ae", "not a number").ae === 2);
  check("the number fields clamp below Min and above Max", (() => {
    const lo = C.setRatio(s, "ae", -99), hi = C.setRatio(s, "fb", 99);
    return lo.ae === -10 && hi.fb === 10;
  })());
  check("the < and > buttons stop at the ends of the range", (() => {
    let s2 = s;
    for (let i = 0; i < 30; i++) s2 = C.stepRatio(s2, "ae", -1);
    const atMin = s2.ae === -10;
    for (let i = 0; i < 30; i++) s2 = C.stepRatio(s2, "ae", 1);
    return atMin && s2.ae === 10;
  })());
}

/* --------------------------------------- 2. the article's claims, in fixed cases */

const fixed = [
  ["panel start", 2, 3, 3, 2],
  ["all ones", 1, 1, 1, 1],
  ["all tens", 10, 10, 10, 10],
  ["long AE, short EC", 10, 1, 1, 10],
  ["short AE, long EC", 1, 10, 10, 1],
  ["unequal sides", 3, 7, 2, 5],
];
const shapes = [
  ["panel triangle", C.start().A, C.start().B, C.start().C],
  ["acute", { x: 200, y: 40 }, { x: 50, y: 270 }, { x: 350, y: 260 }],
  ["obtuse", { x: 60, y: 150 }, { x: 350, y: 90 }, { x: 300, y: 260 }],
];
for (const [sn, A, B, Cc] of shapes) {
  for (const [rn, ae, ec, af, fb] of fixed) {
    const s = tri(A, B, Cc, { ae, ec, af, fb });
    check(`${sn}, ${rn}: every claim holds`, allClaims(s));
  }
}

/* -------------------------- 3. all 10^4 positive settings of the four fields */

{
  let tested = 0;
  let bad = "";
  for (let ae = 1; ae <= 10; ae++) {
    for (let ec = 1; ec <= 10; ec++) {
      for (let af = 1; af <= 10; af++) {
        for (let fb = 1; fb <= 10; fb++) {
          const s = tri({ x: 133, y: 150 }, { x: 266, y: 60 }, { x: 300, y: 171 },
            { ae, ec, af, fb });
          const r = C.ratios(s);
          const want = (af / fb) * ((ae * fb) / (ec * af)) * (ec / ae);
          if (!allClaims(s) || Math.abs(r.product - 1) > 1e-12 ||
              Math.abs(r.product - want) > 1e-12) {
            bad = `${ae},${ec},${af},${fb}`;
            break;
          }
          tested++;
        }
      }
    }
  }
  check("the Ceva product is 1 for all 10,000 positive integer settings",
    tested === 10000 && bad === "", bad);
}

/* ----------------------- 4. the page's grid claim, over the same settings --- */

{
  let tested = 0;
  let bad = "";
  const A = { x: 200, y: 250 }, B = { x: 40, y: 60 }, Cc = { x: 360, y: 80 };
  for (let ae = 1; ae <= 10; ae++) {
    for (let ec = 1; ec <= 10; ec++) {
      for (let af = 1; af <= 10; af++) {
        for (let fb = 1; fb <= 10; fb++) {
          const s = tri(A, B, Cc, { ae, ec, af, fb });
          const f = C.figure(s);
          const bdDc = Math.hypot(B.x - f.D.x, B.y - f.D.y) /
            Math.hypot(f.D.x - Cc.x, f.D.y - Cc.y);
          const article = (fb * ae) / (ec * af); // FB·EA / (CE·AF)
          if (!close(bdDc, article, 1e-9 * Math.max(1, article))) {
            bad = `${ae},${ec},${af},${fb}: ${bdDc} vs ${article}`;
            break;
          }
          tested++;
        }
      }
    }
  }
  check("BD/DC = FB·EA/(CE·AF) on all 10,000 settings", tested === 10000 && bad === "", bad);
}

/* ---------------- 4b. the article's grid square: AE·AF steps on each side --- */

{
  let tested = 0;
  let bad = "";
  for (let ae = 1; ae <= 10; ae++) {
    for (let ec = 1; ec <= 10; ec++) {
      for (let af = 1; af <= 10; af++) {
        for (let fb = 1; fb <= 10; fb++) {
          /* The fine grid cuts A→Q into (AE+EC)·AF strips and A→R into
             (AF+FB)·AE strips; K sits at fractions AE/(AE+EC) and AF/(AF+FB). */
          const i = (ae / (ae + ec)) * ((ae + ec) * af);
          const j = (af / (af + fb)) * ((af + fb) * ae);
          if (!close(i, ae * af, 1e-9) || !close(j, ae * af, 1e-9)) {
            bad = `${ae},${ec},${af},${fb}: ${i},${j}`;
            break;
          }
          tested++;
        }
      }
    }
  }
  check("K is at grid step AE·AF on both sides for all 10,000 settings",
    tested === 10000 && bad === "", bad);
}

/* ------------- 5. concurrency and grid identities over random triangles ---- */

{
  const rand = rng(3102);
  let tested = 0;
  let bad = "";
  for (let trial = 0; trial < 2000; trial++) {
    const s = tri(
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      {
        ae: 1 + Math.floor(rand() * 10), ec: 1 + Math.floor(rand() * 10),
        af: 1 + Math.floor(rand() * 10), fb: 1 + Math.floor(rand() * 10),
      },
    );
    if (C.doubleArea(s) < 200) continue;
    const cl = C.claims(s);
    if (!cl.nondegenerate || !cl.feetOnSides || !cl.ratioParams ||
        !cl.concurrent || !cl.cevaProduct || !cl.dissection ||
        !cl.gridParallelogram || !cl.gridKCoordinates) {
      bad = `trial ${trial}: ${JSON.stringify(cl)}`;
      break;
    }
    tested++;
  }
  check(`every geometric claim holds on ${tested} random triangles`,
    tested > 1900 && bad === "", bad);
}

/* ------------------ 6. core against the bytecode transcription, point by point */

{
  const rand = rng(777);
  const names = ["E", "F", "D", "K", "G", "Q", "R", "p16", "p17",
    "p20", "p21", "p22", "p23"];
  let tested = 0;
  const mismatches = [];
  for (let trial = 0; trial < 3000; trial++) {
    const ae = Math.floor(rand() * 21) - 10;
    const ec = Math.floor(rand() * 21) - 10;
    const af = Math.floor(rand() * 21) - 10;
    const fb = Math.floor(rand() * 21) - 10;
    const A = { x: 30 + rand() * 340, y: 30 + rand() * 240 };
    const B = { x: 30 + rand() * 340, y: 30 + rand() * 240 };
    const Cc = { x: 30 + rand() * 340, y: 30 + rand() * 240 };
    const s = tri(A, B, Cc, { ae, ec, af, fb });
    const core = C.figure(s);
    const applet = appletFigure(A, B, Cc, ae, ec, af, fb);
    for (const n of names) {
      if (!pointEqual(core[n], applet[n], 1e-5)) {
        mismatches.push(`trial ${trial} ${n}: core ${JSON.stringify(core[n])} applet ${JSON.stringify(applet[n])}`);
      }
    }
    for (const [n, a] of Object.entries(applet.cevians)) {
      const b = core.cevians[n];
      if (!pointEqual(a.p, b.line.p, 1e-5) || !pointEqual(a.q, b.line.q, 1e-5)) {
        mismatches.push(`trial ${trial} cevian ${n}`);
      }
    }
    tested++;
  }
  check(`core matches the applet's own construction on ${tested} configurations`,
    tested === 3000 && mismatches.length === 0, mismatches.slice(0, 3).join(" | "));
}

/* ------------------- 7. negative ratios, zero sums and parallel cevians ---- */

{
  const s = tri({ x: 133, y: 150 }, { x: 266, y: 60 }, { x: 300, y: 171 },
    { ae: 5, ec: -5, af: 2, fb: 3 });
  const f = C.figure(s);
  const a = appletFigure(s.A, s.B, s.C, 5, -5, 2, 3);
  check("a cevian with n = -m is the parallel through the vertex",
    f.cevians.be.parallel && f.cevians.be.foot === null);
  check("the applet transcription uses the same parallel branch",
    a.cevians.be.foot === null && pointEqual(f.cevians.be.line.p, a.cevians.be.p, 1e-5));
  check("a zero-count field is kept, not turned into an error",
    C.setRatio(s, "af", 0).af === 0);
  check("the product is undefined when a ratio divides by zero",
    C.ratios(C.setRatio(s, "ec", 0)).product === null);
  const flat = tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 },
    { ae: 1, ec: 1, af: 1, fb: 1 });
  check("a flat triangle is reported as degenerate", !C.claims(flat).nondegenerate);
  check("figure never throws on a flat triangle", (() => {
    const fig = C.figure(flat);
    return Boolean(fig && fig.K && typeof fig.K.x === "number");
  })());
}

done("ceva-pww");
