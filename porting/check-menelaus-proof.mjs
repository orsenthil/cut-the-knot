#!/usr/bin/env node
"use strict";

/*
 * Logic test for menelaus-proof/menelaus-proof-core.js.
 *
 *   node porting/check-menelaus-proof.mjs
 *
 * The exact claim on the applet's linked explanation is the Menelaus
 * theorem: for F on AB, D on BC and E on CA (or their extensions), the
 * three points are collinear iff AF/BF · BD/CD · CE/AE = 1 — equivalently
 * AF/FB · BD/DC · CE/EA = -1 with signed segments. This test checks both
 * directions, the product's invariance under every drag the applet allows,
 * and the auxiliary constructions of all three proof modes.
 *
 * Section 5 is a second, literal transcription of the applet's own methods
 * from the bytecode (GetPoint, MoveableLinComb, GeoSDoub.Intersect,
 * NearestPoint, GetParallelTo, FindAltitude, DoubLine.CreateMidPoint, Perp,
 * InBetween and DrawMenelausProof's update sequence). It is compared with
 * the core on the start position, on hundreds of random triangles and on
 * every reachable one-step configuration of all six draggable points.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("menelaus-proof/menelaus-proof-core.js", "MenelausProofCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePt = (p, q, tol = 1e-5) =>
  p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const copy = (p) => ({ x: p.x, y: p.y });
const allClaims = (s) => C.claims(s);
const namedClaims = (cl) => Object.entries(cl).filter(([, v]) => typeof v === "boolean");
const allTrue = (cl) => namedClaims(cl).every(([, v]) => v);
const tri = (A, B, Cc) => ({ A: copy(A), B: copy(B), C: copy(Cc) });
const product = (s) => {
  const m = C.measurements(s);
  return m.product;
};

/* ---------------- the applet's own arithmetic, transcribed from bytecode */

const TWO_PI = 6.283185307179586;

/* MenelausProofCanvas.GetPoint(int). Java's (int) truncates towards zero. */
function appletGetPoint(i, width, height) {
  const r = Math.trunc(Math.min(width, height) / 5);
  let x = Math.trunc(width / 2) + Math.trunc(r * Math.cos((TWO_PI * (i - 1)) / 3));
  let y = Math.trunc(height / 2) + Math.trunc(r * Math.sin((TWO_PI * (i - 1)) / 3));
  if (i === 1) return { x: x + 100, y };
  if (i === 2) return { x: x - 110, y: height - 40 };
  return { x, y };
}

/* MenelausProofCanvas.MoveableLinComb: t*first + (1-t)*second. */
function appletLinComb(a, b, t) {
  return {
    x: t * a.x + (1 - t) * b.x,
    y: t * a.y + (1 - t) * b.y,
  };
}

/* GeoSDoub.Intersect(P1,P2,P3,P4); |det| < 1 returns NaN in the applet. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.NearestPoint(p, a, b), including the SqDist < 0.1 guard. */
function appletNearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) * (a.x - p.x) + (a.y - p.y) * (a.y - p.y) < 0.1) return copy(p);
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

function appletParallelTo(p, q, r) {
  return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
}

function appletAltitude(p, q, r) {
  const s = { x: p.x + r.y - q.y, y: p.y - r.x + q.x };
  return appletIntersect(p, s, q, r);
}

function appletMidPoint(a, b, t) {
  return { x: t * a.x + (1 - t) * b.x, y: t * a.y + (1 - t) * b.y };
}

function appletPerp(p, a, b) {
  return { x: p.x + a.y - b.y, y: p.y - a.x + b.x };
}

function appletInBetween(p, q, r) {
  return (p.x - q.x) * (r.x - q.x) + (p.y - q.y) * (r.y - q.y) < 0;
}

function appletLine(p) {
  if (appletInBetween(p.D, p.E, p.F)) return { a: p.D, b: p.F };
  if (appletInBetween(p.E, p.D, p.F)) return { a: p.E, b: p.F };
  return { a: p.E, b: p.D };
}

/* MenelausProofCanvas.Init(): E on AC, D on BC, F = DE ∩ AB. */
function appletInit(A, B, Cc) {
  const E = appletLinComb(A, Cc, 2 / 3);
  const D = appletLinComb(B, Cc, 1 / 3);
  const F = appletIntersect(A, B, D, E);
  return { A: copy(A), B: copy(B), C: copy(Cc), D, E, F };
}

/* DrawMenelausProof's update sequence plus CTKMoveableDoub.UpdateLocation. */
function appletDrag(p0, selected, target) {
  const p = { A: copy(p0.A), B: copy(p0.B), C: copy(p0.C), D: copy(p0.D), E: copy(p0.E), F: copy(p0.F) };
  let update = 0;
  if (selected === "A") {
    p.A = copy(target);
    appletNearestPoint(p.E, p.E.x, p.E.y); // IsHit(E.x,E.y) resets m_Defect
    p.E = appletNearestPoint(p.E, p.A, p.C);
    update = 3;
  } else if (selected === "C") {
    p.C = copy(target);
    appletNearestPoint(p.D, p.D.x, p.D.y);
    p.D = appletNearestPoint(p.D, p.B, p.C);
    update = 2;
  }
  if (selected === "B") {
    p.B = copy(target);
    appletNearestPoint(p.F, p.F.x, p.F.y);
    p.F = appletNearestPoint(p.F, p.A, p.B);
    update = 1;
  }
  if (selected === "E") p.E = appletNearestPoint(target, p.A, p.C);
  if (selected === "D") p.D = appletNearestPoint(target, p.B, p.C);
  if (selected === "F") p.F = appletNearestPoint(target, p.A, p.B);
  if (selected === "F" || update === 2) p.E = appletIntersect(p.F, p.D, p.A, p.C);
  if (selected === "D" || update === 3) p.F = appletIntersect(p.D, p.E, p.B, p.A);
  if (selected === "E" || update === 1) p.D = appletIntersect(p.E, p.F, p.C, p.B);
  return p;
}

/* --------------------------------------------- 1. the start and the options */

{
  const s = C.start({});
  check("default size is the applet's embedded 500 by 380", s.width === 500 && s.height === 380);
  equal("A starts at the applet's GetPoint(0)", s.A, appletGetPoint(0, 500, 380));
  equal("B starts at the applet's GetPoint(1)", s.B, appletGetPoint(1, 500, 380));
  equal("C starts at the applet's GetPoint(2)", s.C, appletGetPoint(2, 500, 380));
  check("E starts two thirds of the way A -> C", closePt(s.E, appletLinComb(s.A, s.C, 2 / 3), 1e-12));
  check("D starts one third of the way B -> C", closePt(s.D, appletLinComb(s.B, s.C, 1 / 3), 1e-12));
  check("F starts at DE ∩ AB", closePt(s.F, appletIntersect(s.A, s.B, s.D, s.E), 1e-9));
  check("Plain is the applet's initial Proof = 0", s.proof === 0);
  check("Show names starts off, as in the applet's constructor", s.showNames === false);
  check("an illustration cannot be won or lost", C.result(s) === null);
  check("the starting position is drawable", C.valid(s));
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x !== 10 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("withOption changes only the named option", (() => {
    const next = C.withOption(s, "proof", 2);
    return next.proof === 2 && s.proof === 0 && next.showNames === s.showNames;
  })());
  check("proof wraps over the applet's four modes",
    C.withOption(s, "proof", 5).proof === 1 && C.withOption(s, "proof", -1).proof === 3);
}

/* ------------------------------------ 2. a hand-checkable right triangle */

{
  // A=(0,0), B=(4,0), C=(0,3): E=(0,1), D=(4/3,2), DE meets AB at F=(-4/3,0).
  const s = C.start({ points: tri({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }) });
  check("right triangle E is (0,1)", closePt(s.E, { x: 0, y: 1 }, 1e-12), JSON.stringify(s.E));
  check("right triangle D is (4/3,2)", closePt(s.D, { x: 4 / 3, y: 2 }, 1e-12), JSON.stringify(s.D));
  check("right triangle F is (-4/3,0)", closePt(s.F, { x: -4 / 3, y: 0 }, 1e-9), JSON.stringify(s.F));
  check("right triangle: AF/BF = 1/4", close(C.measurements(s).ratios.AF_BF, 1 / 4, 1e-12));
  check("right triangle: BD/CD = 2", close(C.measurements(s).ratios.BD_CD, 2, 1e-12));
  check("right triangle: CE/AE = 2", close(C.measurements(s).ratios.CE_AE, 2, 1e-12));
  check("right triangle: the product is exactly 1", close(product(s), 1, 1e-11), String(product(s)));
  check("right triangle: signed product is -1", close(C.measurements(s).directedProduct, -1, 1e-11));
  check("right triangle: F is outside AB as Menelaus requires", C.param(s.F, s.A, s.B) < 0);
  check("right triangle: all claims hold", allTrue(allClaims(s)), JSON.stringify(allClaims(s)));
}

/* ------------------------------ 3. fixed and random triangles, every claim */

const fixed = [
  ["applet start", C.start()],
  ["equilateral", C.start({ points: tri({ x: 250, y: 60 }, { x: 70, y: 330 }, { x: 430, y: 330 }) })],
  ["obtuse at A", C.start({ points: tri({ x: 90, y: 170 }, { x: 440, y: 100 }, { x: 380, y: 340 }) })],
  ["clockwise", C.start({ points: tri({ x: 250, y: 330 }, { x: 60, y: 70 }, { x: 450, y: 90 }) })],
  ["thin", C.start({ points: tri({ x: 60, y: 190 }, { x: 450, y: 200 }, { x: 250, y: 226 }) })],
];

for (const [name, s] of fixed) {
  check(`${name}: D, E, F are collinear`, C.measurements(s).collinear);
  check(`${name}: AF/BF · BD/CD · CE/AE = 1`, close(product(s), 1, 1e-8), String(product(s)));
  check(`${name}: signed product is -1`, close(C.measurements(s).directedProduct, -1, 1e-8));
  for (const proof of [0, 1, 2, 3]) {
    const withMode = C.withOption(s, "proof", proof);
    check(`${name}: proof ${proof} auxiliary claims hold`,
      allTrue(allClaims(withMode)),
      `proof ${proof}: ${JSON.stringify(namedClaims(allClaims(withMode)))}`);
  }
}

{
  const rand = rng(6352);
  let tested = 0;
  for (let trial = 0; trial < 500; trial++) {
    const s = C.start({
      points: tri(
        { x: 10 + rand() * 480, y: 10 + rand() * 360 },
        { x: 10 + rand() * 480, y: 10 + rand() * 360 },
        { x: 10 + rand() * 480, y: 10 + rand() * 360 },
      ),
      proof: trial % 4,
    });
    if (!C.valid(s)) continue;
    if (Math.abs(C.measurements(s).collinearOffset) > 1e-8) {
      check(`random ${trial}: D, E, F are collinear`, false, String(C.measurements(s).collinearOffset));
    }
    if (!close(product(s), 1, 1e-6)) {
      check(`random ${trial}: product is 1`, false, String(product(s)));
    }
    if (!close(C.measurements(s).directedProduct, -1, 1e-6)) {
      check(`random ${trial}: signed product is -1`, false, String(C.measurements(s).directedProduct));
    }
    const cl = allClaims(s);
    const bad = namedClaims(cl).filter(([, v]) => !v);
    if (bad.length) check(`random ${trial}: proof claims hold`, false, JSON.stringify(bad));
    tested++;
  }
  check(`every claim holds on ${tested} random triangles in all four proof modes`, tested > 400);
}

/* -------------------------- 4. the converse and the sign conventions */

{
  const rand = rng(97531);
  let converses = 0;
  for (let trial = 0; trial < 300; trial++) {
    const s = C.start({
      points: tri(
        { x: 20 + rand() * 460, y: 20 + rand() * 340 },
        { x: 20 + rand() * 460, y: 20 + rand() * 340 },
        { x: 20 + rand() * 460, y: 20 + rand() * 340 },
      ),
    });
    if (!C.valid(s) || Math.abs(s.B.x - s.A.x) + Math.abs(s.B.y - s.A.y) < 40) continue;
    // Pick D and E anywhere on their sides; the product-preserving F must be
    // exactly where line DE crosses AB (the applet's backward step).
    const u = 0.05 + rand() * 0.9, v = 0.05 + rand() * 0.9;
    const D = { x: s.B.x + u * (s.C.x - s.B.x), y: s.B.y + u * (s.C.y - s.B.y) };
    const E = { x: s.C.x + v * (s.A.x - s.C.x), y: s.C.y + v * (s.A.y - s.C.y) };
    const F = appletIntersect(s.A, s.B, D, E);
    if (!C.finite(F)) continue;
    const test = { ...s, D, E, F };
    if (!C.valid(test)) continue;
    const m = C.measurements(test);
    if (!close(m.product, 1, 1e-6)) check(`converse ${trial}: product still 1`, false, String(m.product));
    // Move F off the transversal directly: then neither collinearity nor the
    // product may hold (the contrapositive of the applet's backward step).
    const off = { ...test, F: { x: s.A.x + 0.5 * (s.B.x - s.A.x), y: s.A.y + 0.5 * (s.B.y - s.A.y) } };
    if (C.valid(off) && C.param(F, s.A, s.B) < 0.35) {
      const mo = C.measurements(off);
      check(`converse ${trial}: an off-line F is not collinear`, !mo.collinear);
      check(`converse ${trial}: an off-line F breaks the product`, Math.abs(mo.product - 1) > 1e-3,
        String(mo.product));
    }
    converses++;
  }
  check(`the forward and backward steps agree on ${converses} constructions`, converses > 200);
}

/* --------------- 5. the core against the applet's own bytecode, exhaustively */

{
  // Start points and the three helper constructions, over many sizes.
  let sizes = 0;
  for (let w = 200; w <= 620; w += 20) {
    for (let h = 180; h <= 440; h += 20) {
      const s = C.start({ width: w, height: h });
      for (let i = 0; i < 3; i++) {
        const name = ["A", "B", "C"][i];
        if (!closePt(s[name], appletGetPoint(i, w, h), 1e-12)) {
          check(`${w}x${h}: GetPoint(${i}) matches the core`, false, JSON.stringify(s[name]));
        }
      }
      if (!closePt(s.E, appletLinComb(s.A, s.C, 2 / 3), 1e-12) ||
          !closePt(s.D, appletLinComb(s.B, s.C, 1 / 3), 1e-12) ||
          !closePt(s.F, appletIntersect(s.A, s.B, s.D, s.E), 1e-9)) {
        check(`${w}x${h}: Init matches the core`, false);
      }
      sizes++;
    }
  }
  check(`Init agrees with the bytecode on ${sizes} applet sizes`, sizes === 22 * 14);

  // The helpers, on the fixed triangles and hundreds of random ones.
  const rand = rng(24680);
  let helpers = 0;
  const checkHelpers = (s, tag) => {
    const tol = 1e-6;
    const proof3 = C.auxiliary(C.withOption(s, "proof", 3));
    const line = appletLine(s);
    const pairs = [
      ["nearestPoint(A)", C.nearestPoint(s.A, s.B, s.C), appletNearestPoint(s.A, s.B, s.C)],
      ["parallelPoint", C.parallelPoint(s.A, s.E, s.D), appletParallelTo(s.A, s.E, s.D)],
      ["altitudeFoot(A)", C.altitudeFoot(s.A, s.D, s.E), appletAltitude(s.A, s.D, s.E)],
      ["midPoint K", proof3.K, appletMidPoint(line.a, line.b, 0.6)],
      ["perp point", proof3.perpQ, appletPerp(proof3.K, line.a, line.b)],
      ["K_a", proof3.Ka, appletNearestPoint(s.A, proof3.K, proof3.perpQ)],
      ["P (proof 1)", C.auxiliary(C.withOption(s, "proof", 1)).P,
        appletIntersect(s.B, s.C, s.A, appletParallelTo(s.A, s.E, s.D))],
    ];
    for (const [what, core, applet] of pairs) {
      if (!closePt(core, applet, tol)) {
        check(`${tag}: ${what} matches the bytecode`, false,
          `core ${JSON.stringify(core)}, applet ${JSON.stringify(applet)}`);
      }
    }
    const coreLine = C.theLine(s);
    if (!(closePt(coreLine.p, line.a, tol) && closePt(coreLine.q, line.b, tol))) {
      check(`${tag}: TheLine endpoints match the bytecode`, false,
        `core ${JSON.stringify(coreLine)}, applet ${JSON.stringify(line)}`);
    }
    helpers++;
  };
  for (const [name, s] of fixed) checkHelpers(s, name);
  for (let trial = 0; trial < 600; trial++) {
    const s = C.start({ points: tri(
      { x: 10 + rand() * 480, y: 10 + rand() * 360 },
      { x: 10 + rand() * 480, y: 10 + rand() * 360 },
      { x: 10 + rand() * 480, y: 10 + rand() * 360 },
    ) });
    if (!C.valid(s)) continue;
    checkHelpers(s, `random ${trial}`);
  }
  check(`all auxiliary constructions match the bytecode on ${helpers} configurations`, helpers > 450);

  // Every one-step configuration: drag each of the six points to many targets.
  let drags = 0;
  const rand2 = rng(86420);
  for (const [baseName, base] of fixed) {
    for (const sel of ["A", "B", "C", "D", "E", "F"]) {
      for (let k = 0; k < 40; k++) {
        const target = {
          x: 15 + rand2() * 470,
          y: 15 + rand2() * 350,
        };
        const coreNext = C.applyDrag(base, sel, target);
        const appletNext = appletDrag(base, sel, target);
        const tol = 2e-5;
        for (const p of ["A", "B", "C", "D", "E", "F"]) {
          if (!closePt(coreNext[p], appletNext[p], tol)) {
            check(`${baseName}/${sel}/${k}: ${p} matches the applet's DrawMenelausProof`, false,
              `core ${JSON.stringify(coreNext[p])}, applet ${JSON.stringify(appletNext[p])}`);
          }
        }
        if (C.valid(coreNext) && C.valid(appletNext)) {
          const m = C.measurements(coreNext);
          if (!m.collinear) {
            check(`${baseName}/${sel}/${k}: the drag keeps D, E, F collinear`, false,
              String(m.collinearOffset));
          }
          if (!close(m.product, 1, 1e-5)) {
            check(`${baseName}/${sel}/${k}: the drag keeps the product at 1`, false,
              String(m.product));
          }
        }
        drags++;
      }
    }
  }
  check(`all one-step drags match the bytecode (${drags} configurations)`, drags === fixed.length * 6 * 40);
}

/* ----------------------------------------- 6. degenerate input, no NaN leaks */

{
  const flat = C.start({ points: tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }) });
  check("collinear corners are degenerate", C.measurements(flat).degenerate);
  check("a degenerate diagram has no claims", !allTrue(allClaims(flat)));
  check("a degenerate diagram is not valid for drawing", !C.valid(flat));
  check("intersect reports parallel lines as NaN", !C.finite(C.intersect(
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 },
  )));
  check("restart rebuilds D, E, F from the current corners", (() => {
    const s = C.withPoint(C.start(), "A", { x: 190, y: 90 });
    const r = C.restart(s);
    return closePt(r.A, s.A, 1e-12) && closePt(r.F, appletIntersect(r.A, r.B, r.D, r.E), 1e-9);
  })());
  check("an unknown drag target is ignored", (() => {
    const s = C.start();
    const n = C.applyDrag(s, "Z", { x: 1, y: 2 });
    return closePt(n.A, s.A, 1e-12) && closePt(n.F, s.F, 1e-9);
  })());
}

done("menelaus-proof");
