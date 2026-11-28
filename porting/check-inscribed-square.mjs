#!/usr/bin/env node
"use strict";

/*
 * Logic test for inscribed-square/inscribed-square-core.js.
 *
 *   node porting/check-inscribed-square.mjs
 *
 * The first section checks the initial picture and the mouse constraints.
 * The second section is a *second*, independent transcription of the applet's
 * DrawSquare bytecode (GeoSDoub.Intersect with its |det| > 1 test,
 * FindOrientation, NearestPoint, GetParallelTo) and compares it with the core
 * over thousands of configurations, including the parallel and too-short
 * branches. The rest check the page's claims exhaustively over a grid of
 * triangles: the side formula, the construction by homothety, the false
 * "central symmetry" wording, the one/two solutions claim, and the one-pixel
 * eye threshold.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const Core = loadCore("inscribed-square/inscribed-square-core.js", "InscribedSquareCore");

/* --------------------------- a second transcription of the Java bytecode */

const sq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const d = (a, b) => Math.sqrt(sq(a, b));
const ok = (v) => Number.isFinite(v);
const near = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const same = (a, b, eps = 1e-7) => {
  if (!ok(a) || !ok(b)) return !ok(a) && !ok(b);
  return near(a, b, eps);
};
const samePt = (a, b, eps) => !!a && !!b && same(a.x, b.x, eps) && same(a.y, b.y, eps);

/* GeoSDoub.FindOrientation, from the bytecode's exact polynomial. */
function jOrientation(a, b, c) {
  const s = c.x * (b.y - a.y) + c.y * (a.x - b.x) + a.x * b.y - b.x * a.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Intersect(DoubPoint x4): NaN unless |det| > 1. */
function jIntersect(a, b, c, e) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - e.y, b2 = e.x - c.x, c2 = c.x * e.y - c.y * e.x;
  const xn = b1 * c2 - b2 * c1;
  const yn = a2 * c1 - a1 * c2;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) <= 1) return { x: NaN, y: NaN };
  return { x: xn / det, y: yn / det };
}

/* GeoSDoub.NearestPoint(DoubPoint x3), including the 0.1 early return. */
function jNearest(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y;
  if (sq(a, p) < 0.1) return { x: p.x, y: p.y };
  const t = (vx * (p.x - a.x) + vy * (p.y - a.y)) / (vx * vx + vy * vy);
  return { x: a.x + vx * t, y: a.y + vy * t };
}

/* GeoSDoub.GetParallelTo: point + 100 * (b - c). */
function jParallel(a, b, c) {
  return { x: a.x + 100 * (b.x - c.x), y: a.y + 100 * (b.y - c.y) };
}

/* InscribedSquareCanvas.DrawSquare, following the javap offsets in order. */
function jDrawSquare(A, B, C, P) {
  if (d(A, P) < 2) return { active: false };
  const t = { x: P.x + (B.y - A.y), y: P.y - (B.x - A.x) };
  let p = jIntersect(P, t, A, C);
  let q = null, r = null, side = 0, sign = 0, fallback = false;
  if (!ok(p.x) || !ok(p.y)) {
    fallback = true;
    q = { x: A.x, y: A.y - (P.x - A.x) };
    p = { x: P.x, y: q.y };
    side = d(p, jNearest(p, B, C));
  } else {
    sign = jOrientation(A, P, p) * jOrientation(A, P, C);
    side = d(p, P);
    const ab = d(A, B);
    q = { x: P.x + ((B.x - A.x) * sign * side) / ab, y: (A.y + B.y) / 2 };
    const up = jParallel(q, P, p);
    const across = jParallel(p, A, B);
    r = jIntersect(q, up, p, across);
    side = d(r, jNearest(r, B, C)); // the bytecode overwrites d with the gap
    return { active: true, fallback, sign, gap: side, p, q, r, trialSide: d(p, P) };
  }
  return { active: true, fallback, sign, gap: side, p, q, r, trialSide: side };
}

function compareDrawing(label, A, B, Cc, P) {
  const g = Core.geometry({ A, B, C: Cc, P, showNames: true });
  const j = jDrawSquare(A, B, Cc, P);
  check(label + " active", g.active === j.active);
  if (!j.active) return;
  check(label + " fallback", g.fallback === j.fallback);
  check(label + " sign", g.sign === j.sign);
  check(label + " gap", same(g.gap, j.gap, 1e-9), `${g.gap} vs ${j.gap}`);
  check(label + " p", samePt(g.p, j.p, 1e-9));
  check(label + " q", g.q && j.q ? samePt(g.q, j.q, 1e-9) : !g.q && !j.q);
  check(label + " r", g.r && j.r ? samePt(g.r, j.r, 1e-9) : !g.r && !j.r);
}

/* ------------------------------------------------ 1. the initial picture */

{
  equal("applet starting A (W/3, 2H/3)", Core.START_A, { x: 200, y: 300 });
  equal("applet starting B (2W/3, 2H/3)", Core.START_B, { x: 400, y: 300 });
  equal("applet starting C (3W/5, H/3)", Core.START_C, { x: 360, y: 150 });
  equal("applet starting P (2W/5, 2H/3)", Core.START_P, { x: 240, y: 300 });
  const s = Core.start({});
  check("start copies the points rather than sharing them", s.A !== Core.START_A && s.B !== Core.START_B);
  check("ShowNames defaults to on", s.showNames === true);
  check("start is not degenerate", Core.geometry(s).active === true);

  // UpdatePoints: A and B snap to a common y, P to the midline of AB.
  const movedA = Core.move(s, "A", { x: 220, y: 130 });
  check("dragging A keeps the base horizontal", movedA.A.y === movedA.B.y && movedA.A.y === 300);
  const movedB = Core.move(s, "B", { x: 410, y: 90 });
  check("dragging B keeps the base horizontal", movedB.B.y === movedB.A.y && movedB.B.y === 300);
  const movedP = Core.move(s, "P", { x: 300, y: 10 });
  check("dragging P puts it on the midline of AB", movedP.P.y === (movedP.A.y + movedP.B.y) / 2);
  check("dragging C leaves it free", Core.move(s, "C", { x: 310, y: 70 }).C.y === 70);
  check("dragging outside the canvas is clamped", Core.move(s, "C", { x: 900, y: -20 }).C.x === Core.WIDTH);
  check("an unknown handle is refused", Core.move(s, "Q", { x: 1, y: 2 }) === s);
  check("the slider drives P along AB", near(Core.fraction(Core.setFraction(s, 0.25)), 0.25));
  check("P may be placed past either end, as in the applet", near(Core.fraction(Core.setFraction(s, 1.5)), 1.5) &&
    near(Core.fraction(Core.setFraction(s, -0.2)), -0.2));
  check("ShowNames can be switched", Core.setShowNames(s, false).showNames === false);
}

/* -------------------------- 2. the whole drawing routine, twice, in bulk */

{
  const us = [60, 100, 140, 200, 260, 320];
  const cs = [-60, 0, 40, 120, 160, 240, 360];
  const hs = [-260, -150, -80, -40, 40, 80, 150, 260];
  const fs = [-0.2, 0, 0.1, 0.2, 0.45, 4 / 7, 0.8, 1, 1.2];
  let cases = 0, active = 0, fallback = 0;
  for (const u of us) {
    for (const c of cs) {
      for (const h of hs) {
        const A = { x: 200, y: 300 }, B = { x: 200 + u, y: 300 }, C0 = { x: 200 + c, y: 300 + h };
        for (const f of fs) {
          const P = { x: A.x + f * u, y: A.y };
          const tag = `u=${u} c=${c} h=${h} f=${f}`;
          compareDrawing(tag, A, B, C0, P);
          const g = Core.geometry({ A, B, C: C0, P });
          cases++;
          if (g.active) active++;
          if (g.fallback) fallback++;
        }
      }
    }
  }
  check("a few thousand configurations were compared", cases === 3024 && active > 2600);
  check("the parallel branch was exercised", fallback > 0);
  compareDrawing("B left of A", { x: 400, y: 300 }, { x: 200, y: 300 }, { x: 300, y: 120 }, { x: 350, y: 300 });
  compareDrawing("C below AB", { x: 200, y: 300 }, { x: 400, y: 300 }, { x: 360, y: 450 }, { x: 260, y: 300 });
  compareDrawing("P at A (too close)", { x: 200, y: 300 }, { x: 400, y: 300 }, { x: 360, y: 150 }, { x: 200, y: 300 });
  compareDrawing("AC perpendicular to AB (parallel branch)",
    { x: 200, y: 300 }, { x: 400, y: 300 }, { x: 200, y: 120 }, { x: 260, y: 300 });
  compareDrawing("degenerate AB", { x: 200, y: 300 }, { x: 200, y: 300 }, { x: 360, y: 150 }, { x: 260, y: 300 });
  const nonFinite = Core.geometry({ A: { x: 200, y: 300 }, B: { x: 200, y: 300 },
    C: { x: 360, y: 150 }, P: { x: 260, y: 300 } });
  check("degenerate AB falls into the parallel branch, as in the applet",
    nonFinite.active && nonFinite.fallback && !nonFinite.r);
}

/* ------------------------ 3. the constructed figure really is a square */

{
  let squares = 0, equalSides = 0, rightAngles = 0, danglingOnAC = 0;
  for (const u of [80, 120, 200, 280]) {
    for (const c of [-40, 30, 120, 190]) {
      for (const h of [-220, -120, -60, 60, 160]) {
        const A = { x: 200, y: 300 }, B = { x: 200 + u, y: 300 }, C0 = { x: 200 + c, y: 300 + h };
        for (const f of [0.12, 0.3, 0.5, 0.73, 0.95]) {
          const P = { x: A.x + f * u, y: A.y };
          const g = Core.geometry({ A, B, C: C0, P });
          if (!g.active || g.fallback || !g.r || !Core.finite(g.r) || !Core.finite(g.q)) continue;
          squares++;
          const a = [P, g.q, g.r, g.p];
          const sides = [d(a[0], a[1]), d(a[1], a[2]), d(a[2], a[3]), d(a[3], a[0])];
          if (sides.every((v) => near(v, sides[0], 1e-8))) equalSides++;
          const e1 = { x: a[1].x - a[0].x, y: a[1].y - a[0].y };
          const e2 = { x: a[3].x - a[0].x, y: a[3].y - a[0].y };
          if (near(e1.x * e2.x + e1.y * e2.y, 0, 1e-7)) rightAngles++;
          const onAC = Math.abs((g.p.x - A.x) * h - (g.p.y - A.y) * c);
          if (onAC < 1e-6) danglingOnAC++;
          check(`trial square side equals |Pp| at f=${f}`, near(g.side, d(P, g.p), 1e-8));
        }
      }
    }
  }
  check("many non-degenerate trial squares were drawn", squares > 300);
  check("every trial square has four equal sides", equalSides === squares);
  check("every trial square has a right angle at P", rightAngles === squares);
  check("the dangling corner p lies on AC", danglingOnAC === squares);
}

/* ---------------------- 4. "central symmetry" vs homothety at A */

{
  const s = Core.start({});
  const t1 = 0.2, t2 = 0.55;
  const g1 = Core.geometry(Core.setFraction(s, t1));
  const g2 = Core.geometry(Core.setFraction(s, t2));
  check("different P give different square sizes", !near(g1.side, g2.side));
  const reflected = (p) => ({ x: 2 * s.A.x - p.x, y: 2 * s.A.y - p.y });
  const reflectedSide = d(reflected(g1.P), reflected(g1.p));
  check("central symmetry keeps the length, so it cannot give the second square",
    near(reflectedSide, g1.side) && !near(reflectedSide, g2.side));
  const k = t2 / t1;
  const scaled = (p) => ({ x: s.A.x + k * (p.x - s.A.x), y: s.A.y + k * (p.y - s.A.y) });
  check("homothety at A maps the first trial square to the second",
    samePt(scaled(g1.P), g2.P) && samePt(scaled(g1.p), g2.p) &&
    samePt(scaled(g1.q), g2.q) && samePt(scaled(g1.r), g2.r));
  check("the homothety ratio is the ratio of the side lengths", near(k, g2.side / g1.side));
}

/* ------------------------- 5. the exact inscribed square, formula & claim */

{
  let solved = 0, onBC = 0, formula = 0, targets = 0;
  for (const u of [80, 120, 200, 260, 320]) {
    for (const c of [-40, 20, 100, 160, 240, 300]) {
      for (const h of [-260, -150, -90, -40, 40, 90, 150, 260]) {
        if (c === 0) continue; // P would land on A, where the applet stops drawing
        const A = { x: 200, y: 300 }, B = { x: 200 + u, y: 300 }, C0 = { x: 200 + c, y: 300 + h };
        const base = { A, B, C: C0, P: Core.START_P, showNames: true };
        const t = Core.solutionFraction(base);
        const g = Core.geometry(Core.setFraction(base, t));
        solved++;
        if (g.open && g.gap < 1e-8) onBC++;
        const expect = (Math.abs(h) * u) / (Math.abs(h) + u);
        if (near(g.side, expect, 1e-8) && near(Core.inscribedSide(base), expect, 1e-12)) formula++;
        if (g.target && samePt(g.target.hit, g.r, 1e-7) &&
            samePt(g.target.foot1, g.q, 1e-7) && samePt(g.target.foot2, g.P, 1e-7)) targets++;
      }
    }
  }
  check("the construction solved every triangle in the grid", solved === 240 && onBC === solved);
  check("side = height * base / (height + base), independent of where C sits", formula === solved);
  check("the page's ray A->free corner lands at BC and traces the target square", targets === solved);
  const base = Core.start({});
  check("the solved square has side 150*200/350 = 85.714...",
    near(Core.inscribedSide(base), (150 * 200) / 350));
  check("solutionFraction agrees with the hand-computed 160/350", near(Core.solutionFraction(base), 160 / 350));
  const g = Core.geometry(Core.setFraction(base, Core.solutionFraction(base)));
  check("the applet's eyes open at the solution", g.open === true && g.gap < 1);
}

/* --------------------- 6. "in general the problem has two solutions" */

{
  /* Direct line equations, independent of the core: for a square with its
     base on AB and its top edge at y = A.y + eps*s, solve x_BC - x_AC = s
     (top-left on AC) and x_AC - x_BC = s (top-left on BC). */
  function candidates(A, B, Cc) {
    const out = [];
    for (const eps of [-1, 1]) {
      const at = (y, P, Q) => P.x + ((Q.x - P.x) * (y - P.y)) / (Q.y - P.y);
      const L0 = at(A.y, B, Cc) - at(A.y, A, Cc);
      const L1 = eps * ((Cc.x - B.x) / (Cc.y - B.y) - (Cc.x - A.x) / (Cc.y - A.y));
      for (const sign of [1, -1]) {
        const s = (sign * L0) / (1 - sign * L1);
        if (ok(s) && s > 1e-9) out.push({ s, eps, sign });
      }
    }
    return out;
  }
  let two = 0, one = 0, matched = 0, cases = 0;
  for (const u of [40, 80, 140, 200, 260]) {
    for (const c of [-40, 30, 110, 160, 230, 310]) {
      for (const h of [-220, -150, -90, -40, 40, 90, 150, 220]) {
        const A = { x: 200, y: 300 }, B = { x: 200 + u, y: 300 }, Cc = { x: 200 + c, y: 300 + h };
        const list = candidates(A, B, Cc);
        cases++;
        if (u !== Math.abs(h)) {
          if (list.length === 2) two++;
        } else if (list.length === 1) one++;
        const state = { A, B, C: Cc, P: Core.START_P, showNames: true };
        const t = Core.solutionFraction(state);
        const g = Core.geometry(Core.setFraction(state, t));
        if (list.some((x) => near(x.s, g.side, 1e-8))) matched++;
      }
    }
  }
  check("two solutions when base and height differ, one when they are equal", cases === 240 && two === 228 && one === 12);
  check("the applet's inscribed square is one of the two", matched === cases);
  const wide = candidates({ x: 200, y: 300 }, { x: 400, y: 300 }, { x: 360, y: 150 });
  check("the second solution is the same square on the extended sidelines",
    wide.length === 2 && near(wide.find((x) => x.sign === -1).s, 600));
  const tall = candidates({ x: 200, y: 300 }, { x: 400, y: 300 }, { x: 300, y: 40 });
  check("for a tall triangle the second solution lies below AB",
    tall.length === 2 && tall.some((x) => x.eps === 1));
}

/* --------------------------- 7. the one-pixel eye threshold */

{
  const s = Core.start({});
  const exact = Core.solutionFraction(s);
  let lo = exact - 0.2, hi = exact;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const g = Core.geometry(Core.setFraction(s, mid));
    if (g.gap >= 1) lo = mid; else hi = mid;
  }
  const justOutside = Core.geometry(Core.setFraction(s, lo));
  const justInside = Core.geometry(Core.setFraction(s, hi));
  check("the eyes are shut when the gap is at least one pixel", justOutside.gap >= 1 && justOutside.open === false);
  check("the eyes open as soon as the gap drops below one pixel", justInside.gap < 1 && justInside.open === true);
  const reversed = Core.start({
    A: { x: 400, y: 300 }, B: { x: 200, y: 300 },
    C: { x: 300, y: 150 }, P: { x: 350, y: 300 },
  });
  const rg = Core.geometry(Core.setFraction(reversed, Core.solutionFraction(reversed)));
  check("a triangle drawn right-to-left still solves", rg.open && rg.gap < 1e-8);
  const below = Core.start({
    A: { x: 200, y: 300 }, B: { x: 400, y: 300 },
    C: { x: 360, y: 450 }, P: { x: 240, y: 300 },
  });
  const bg = Core.geometry(Core.setFraction(below, Core.solutionFraction(below)));
  check("a triangle below the base still solves", bg.open && bg.gap < 1e-8);
  const flat = Core.start({ A: { x: 200, y: 300 }, B: { x: 400, y: 300 },
    C: { x: 300, y: 300 }, P: { x: 240, y: 300 } });
  check("a flat triangle has a zero-size solution", Core.inscribedSide(flat) === 0 &&
    near(Core.solutionFraction(flat), 0.5));
  const noBase = Core.start({ A: { x: 200, y: 300 }, B: { x: 200, y: 300 },
    C: { x: 300, y: 150 }, P: { x: 240, y: 300 } });
  check("a zero-length base has no solution fraction", Core.solutionFraction(noBase) === null);
}

done("inscribed-square");
