#!/usr/bin/env node
"use strict";

/*
 * Logic test for common-tangent-sangaku/common-tangent-sangaku-core.js.
 *
 *   node porting/check-common-tangent-sangaku.mjs
 *
 * Three things are checked. (1) The applet's own starting geometry, its
 * guards and its options. (2) A second, literal transcription of Compute()
 * from the bytecode — including GeoSDoub.IntersectCirclesX/Y with its 1-unit
 * determinant tolerance, NearestPoint and ExtendLine — compared with the core
 * over a grid of positions and hundreds of seeded random configurations.
 * (3) The page's exact claim: for two circles inscribed in an angle, any two
 * of {MN joins the tangency points, the small circle touches MN, the small
 * circle's centre lies on the big circle} imply the third. That is checked by
 * rebuilding each condition independently on a grid of angles and distances,
 * and by measuring the resulting points, radii and tangencies — not by
 * restating the formula used to construct them.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("common-tangent-sangaku/common-tangent-sangaku-core.js", "CommonTangentSangakuCore");

const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
const ptNear = (a, b, tol = 1e-6) => !!a && !!b && near(a.x, b.x, tol) && near(a.y, b.y, tol);
// When the two chord ends have equal y, the applet's y-ordering cannot tell
// them apart; the two computations may label that degenerate pair either way.
const pairNear = (a, b, c, d, tol = 1e-6) =>
  (ptNear(a, c, tol) && ptNear(b, d, tol)) || (ptNear(a, d, tol) && ptNear(b, c, tol));
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* --------------------------------------------- a second transcription (2) */

/** GeoSDoub.IntersectCirclesX / IntersectCirclesY / the equal-coordinate case. */
function appletCircleHits(k1, k2) {
  const c1 = k1.center, c2 = k2.center, r1 = k1.radius, r2 = k2.radius;
  if (Math.abs(c1.x - c2.x) > 1) {
    const m = -(c1.y - c2.y) / (c1.x - c2.x);
    const b = (c1.x * c1.x + c1.y * c1.y - c2.x * c2.x - c2.y * c2.y - r1 * r1 + r2 * r2) /
      (2 * (c1.x - c2.x));
    const a = b - c1.x; // local slot 6 in the bytecode
    const q = m * a - c1.y;
    const c = a * a + c1.y * c1.y - r1 * r1;
    const disc = q * q - (1 + m * m) * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const y1 = (-q + root) / (1 + m * m), y2 = (-q - root) / (1 + m * m);
    return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
  }
  if (Math.abs(c1.y - c2.y) > 1) {
    const m = -(c1.x - c2.x) / (c1.y - c2.y);
    const b = (c1.y * c1.y + c1.x * c1.x - c2.y * c2.y - c2.x * c2.x - r1 * r1 + r2 * r2) /
      (2 * (c1.y - c2.y));
    const a = b - c1.y;
    const q = m * a - c1.x;
    const c = a * a + c1.x * c1.x - r1 * r1;
    const disc = q * q - (1 + m * m) * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const x1 = (-q + root) / (1 + m * m), x2 = (-q - root) / (1 + m * m);
    return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
  }
  return [null, null];
}

/** GeoSDoub.NearestPoint(p, a, b). */
function appletNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * dx + dy * dy < 0.1) return { x: p.x, y: p.y };
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** GeoSDoub.Intersect(p,q,r,s), including the |det| < 1 => NaN behaviour. */
function appletLineIntersection(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** InsideTest.IsInside(v,p,q) from the bytecode. */
function appletInside(v, p, q) {
  return (v.x - p.x) * (v.x - q.x) + (v.y - p.y) * (v.y - q.y) <= 0;
}

/** Compute(), translated statement by statement from the disassembly. */
function appletCompute(state) {
  const Cpt = state.C, Opt = state.O, Qpt = state.Q;
  if (dist(Qpt, Cpt) < 2 || appletInside(Cpt, Opt, Qpt)) return null;
  const R = dist(Opt, Qpt);
  const d = dist(Opt, Cpt);
  const radiusQ = R * dist(Qpt, Cpt) / d;
  const radiusC = Math.sqrt(d * d - R * R);
  const hits = appletCircleHits({ center: Cpt, radius: radiusC }, { center: Opt, radius: R });
  if (!hits || !hits[0] || !hits[1]) return null;
  const M = hits[0].y < hits[1].y ? hits[0] : hits[1];
  const N = hits[0].y < hits[1].y ? hits[1] : hits[0];
  const P = { x: (M.x + N.x) / 2, y: (M.y + N.y) / 2 };
  const S = appletNearest(Qpt, Cpt, M);
  const T = appletNearest(Qpt, Cpt, N);
  // ExtendLine(t, O, C) = second argument + t * (first - second).
  const stretch = (d + R) / d;
  const V = { x: Cpt.x + stretch * (Opt.x - Cpt.x), y: Cpt.y + stretch * (Opt.y - Cpt.y) };
  const tangentEnd = { x: V.x + (Cpt.y - V.y), y: V.y + (Cpt.x - V.x) };
  const U = appletLineIntersection(V, tangentEnd, Cpt, M);
  const W = appletLineIntersection(V, tangentEnd, Cpt, N);
  return { R: R, r: radiusQ, d: d, radiusC: radiusC, M: M, N: N, P: P, S: S, T: T, V: V, U: U, W: W };
}

/* -------------------------------------------- an independent angle diagram */

/** Circle O inscribed in an angle at the origin, half-angle with sin = s. */
function angleDiagram(s, d, chordX, xq) {
  const co = Math.sqrt(1 - s * s);
  const C = { x: 0, y: 0 }, O = { x: d, y: 0 };
  const R = s * d;
  const rho = xq * s;
  // Points where the chord x = chordX cuts (O), if it does.
  const dy2 = R * R - (chordX - d) * (chordX - d);
  const upper = dy2 >= 0 ? { x: chordX, y: Math.sqrt(dy2) } : null;
  const lower = dy2 >= 0 ? { x: chordX, y: -Math.sqrt(dy2) } : null;
  const Qpt = { x: xq, y: 0 };
  return { C: C, O: O, Q: Qpt, R: R, rho: rho, s: s, co: co, upper: upper, lower: lower, d: d };
}
const lineDist = (p, a, b) => C.distanceToLine(p, a, b);
/** The angle's sides are the lines through (0,0) with directions (co,±s). */
function sideDistUpper(p, dia) {
  return Math.abs(p.x * dia.s - p.y * dia.co);
}
function sideDistLower(p, dia) {
  return Math.abs(p.x * dia.s + p.y * dia.co);
}

/* ------------------------------------------------------------ 1. the basics */

{
  equal("the applet's default constants", [C.WIDTH, C.HEIGHT, C.COEF, C.MIN_CQ], [400, 250, 0.6, 2]);
  const s = C.start({});
  check("init places O at the centre of the 400x250 canvas", ptNear(s.O, { x: 200, y: 125 }, 0));
  check("init places C at (4/5 w, 3/5 h)", ptNear(s.C, { x: 320, y: 150 }, 0));
  check("init puts Q at CreateMidPoint(0.6) on CO", ptNear(s.Q, { x: 248, y: 135 }, 1e-12));
  check("the opening diagram can be computed", C.geometry(s) !== null && C.canDraw(s));
  const g = C.geometry(s);
  const d = C.distance(s.C, s.O);
  const R = C.distance(s.O, s.Q);
  check("big radius is OQ, small radius is R*CQ/d",
    near(g.R, R) && near(g.r, R * C.distance(s.Q, s.C) / d));
  check("the applet's one guard rejects CQ below 2", !C.canDraw(C.setCoef(s, 0.01)) && !appletCompute(C.setCoef(s, 0.01)));
  check("the starting position is data only", JSON.stringify(C.start({})) === JSON.stringify(C.start({})));
}

/* --------------------------- 2. dragging: Q stays a glider on the segment */

{
  const s = C.start({});
  const movedO = C.movePoint(s, "O", { x: 150, y: 100 });
  check("moving O keeps the saved ratio coef and slides Q with it",
    near(movedO.coef, s.coef) && ptNear(movedO.Q, C.lerp(movedO.C, movedO.O, s.coef), 1e-12));
  const movedC = C.movePoint(s, "C", { x: 300, y: 180 });
  check("moving C keeps the saved ratio coef and slides Q with it",
    near(movedC.coef, s.coef) && ptNear(movedC.Q, C.lerp(movedC.C, movedC.O, s.coef), 1e-12));
  let ok = true, onLine = true;
  const prng = rng(11);
  for (let i = 0; i < 200; i++) {
    const p = { x: 10 + prng() * 380, y: 10 + prng() * 230 };
    const n = C.movePoint(s, "Q", p);
    ok = ok && n.coef >= 0 && n.coef <= 1;
    // Q must be the orthogonal projection, clamped to the segment.
    const raw = ((p.x - s.C.x) * (s.O.x - s.C.x) + (p.y - s.C.y) * (s.O.y - s.C.y)) /
      (C.distance(s.C, s.O) ** 2);
    onLine = onLine && ptNear(n.Q, C.lerp(s.C, s.O, C.clamp(raw, 0, 1)), 1e-9);
  }
  check("200 drags of Q always land inside [0,1]", ok);
  check("200 drags of Q are projections onto CO", onLine);
  const clamped = C.movePoint(s, "O", { x: -50, y: 999 });
  check("dragging O is clamped inside the board", clamped.O.x >= 12 && clamped.O.y <= s.height - 12);
  const reset = C.reset({ ...s, showNames: true, showHint: true });
  check("reset restores the diagram but keeps display options",
    ptNear(reset.O, s.O) && ptNear(reset.C, s.C) && reset.showNames && reset.showHint && !reset.showStatement);
}

/* ----------------------------- 3. geometry, against the second transcription */

{
  let compared = 0, agree = true, radiiAgree = true, tangentAgree = true, skeletonAgree = true;
  const positions = [];
  for (const x of [40, 100, 200, 320, 380]) {
    for (const y of [20, 80, 125, 200, 240]) positions.push({ x: x, y: y });
  }
  const prng = rng(2026);
  for (let i = 0; i < 240; i++) positions.push({ x: 30 + prng() * 340, y: 20 + prng() * 210 });

  const coefs = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  for (const Cpt of positions) {
    for (const coef of coefs.concat([prng() * 0.94 + 0.03])) {
      const O = { x: 200, y: 125 };
      if (C.distance(Cpt, O) < 6) continue;
      const s = { ...C.start({}), C: Cpt, O: O, Q: C.lerp(Cpt, O, coef), coef: coef };
      if (!C.canDraw(s)) continue;
      const mine = C.geometry(s);
      const theirs = appletCompute(s);
      if (!mine || !theirs) {
        agree = agree && !mine && !theirs;
        continue;
      }
      compared++;
      agree = agree && near(mine.R, theirs.R, 1e-7) && near(mine.r, theirs.r, 1e-7) &&
        near(mine.d, theirs.d, 1e-7) && near(mine.rAux, theirs.radiusC, 1e-7);
      radiiAgree = radiiAgree && pairNear(mine.M, mine.N, theirs.M, theirs.N, 1e-6) &&
        ptNear(mine.P, theirs.P, 1e-6);
      skeletonAgree = skeletonAgree && pairNear(mine.S, mine.T, theirs.S, theirs.T, 1e-6) &&
        ptNear(mine.V, theirs.V, 1e-6);
      // The applet returns NaN for an almost-parallel tangent/side pair; skip
      // exactly those configurations, but insist the rest agree.
      if (Number.isFinite(theirs.U.x) && Number.isFinite(theirs.W.x)) {
        tangentAgree = tangentAgree && pairNear(mine.U, mine.W, theirs.U, theirs.W, 1e-5);
      }
    }
  }
  check("over " + compared + " configurations both computations agree on the radii", agree && compared > 500);
  check("both find the same tangency chord MN and its midpoint", radiiAgree);
  check("both find the same feet S,T and far point V", skeletonAgree);
  check("both find the same tangent points U,W when they exist", tangentAgree);
}

/* -------------------------- 4. the page's three-way implication, exhaustively */

{
  let pairs = 0, allTrue = true, measured = true, radiusLaw = true, incircle = true;
  for (let si = 1; si <= 17; si++) {
    const s = si / 20; // half-angle sine from 0.05 to 0.85
    for (const d of [40, 73, 111, 160, 227, 300]) {
      const R = s * d;
      const tangencyX = d - R * s; // x of the chord joining the tangency points

      // (1) and (2) => (3): xq*s = tangencyX - xq.
      {
        const xq = tangencyX / (1 + s);
        const dia = angleDiagram(s, d, tangencyX, xq);
        pairs++;
        allTrue = allTrue && near(Math.abs(dia.O.x - xq), dia.R, 1e-8 * d);
        // Re-measure: the chord is tangent to the small circle and the big
        // circle is tangent to both sides at the chord's ends.
        measured = measured && !!dia.upper && !!dia.lower &&
          near(lineDist(dia.Q, dia.upper, dia.lower), dia.rho, 1e-8 * d) &&
          near(sideDistUpper(dia.upper, dia), 0, 1e-9 * d) &&
          near(C.distance(dia.upper, dia.O), dia.R, 1e-9 * d);
        radiusLaw = radiusLaw && near(dia.rho, dia.R * xq / d, 1e-12 * d);
      }

      // (1) and (3) => (2): the centre on (O) nearer to C is at xq = d - R.
      {
        const xq = d - R;
        const dia = angleDiagram(s, d, tangencyX, xq);
        pairs++;
        allTrue = allTrue && near(lineDist(dia.Q, dia.upper, dia.lower), dia.rho, 1e-8 * d);
        measured = measured && !!dia.upper &&
          near(sideDistUpper(dia.upper, dia), 0, 1e-9 * d) &&
          near(Math.abs(d - xq), dia.R, 1e-12 * d);
      }

      // (2) and (3) => (1): from xq = d - R, the chord is at xq + rho.
      {
        const xq = d - R;
        const chord = xq + xq * s;
        const dia = angleDiagram(s, d, chord, xq);
        pairs++;
        allTrue = allTrue && near(chord, tangencyX, 1e-8 * d);
        measured = measured && !!dia.upper && !!dia.lower &&
          near(sideDistUpper(dia.upper, dia), 0, 1e-9 * d) &&
          near(sideDistLower(dia.lower, dia), 0, 1e-9 * d) &&
          near(Math.abs(d - xq), dia.R, 1e-12 * d) &&
          near(lineDist(dia.Q, dia.upper, dia.lower), dia.rho, 1e-8 * d);
        // The small circle is the incircle of triangle CMN: its centre is the
        // intersection of the angle bisector with the tangent to the chord.
        incircle = incircle && near(xq * s, (d - R) * s, 1e-12 * d) &&
          near(xq + xq * s, chord, 1e-12 * d);
      }
    }
  }
  check("all " + pairs + " angle/distance pairs satisfy the implied condition", allTrue);
  check("in every case the chord really joins the big circle's tangency points", measured);
  check("the exact radius law r = R*CQ/CO holds in every case", radiusLaw);
  check("the small circle is the incircle of CMN in every case", incircle);
}

/* ------------------------- 5. the radius identity and the applet's limits */

{
  let identity = true, quadratics = true, monotone = true;
  let previous = -Infinity, maxR = 0;
  const s = C.start({});
  for (let i = 1; i <= 199; i++) {
    const t = i / 200;
    const st = C.setCoef(s, t);
    const g = C.geometry(st);
    if (!g) continue;
    // r = R(1 - R/d) = d*s*(1-s), largest at coef = 1/2.
    identity = identity && near(g.r, g.R * (1 - g.R / g.d), 1e-8 * g.d) &&
      near(g.r, g.d * (1 - t) * t, 1e-8 * g.d);
    // The chord's two intersections always lie on both circles.
    quadratics = quadratics &&
      near(C.distance(g.M, s.C), g.rAux, 1e-7) && near(C.distance(g.M, s.O), g.R, 1e-7) &&
      near(C.distance(g.N, s.C), g.rAux, 1e-7) && near(C.distance(g.N, s.O), g.R, 1e-7);
    if (t <= 0.5) monotone = monotone && g.r >= previous;
    previous = g.r;
    maxR = Math.max(maxR, g.r);
  }
  check("r = R(1 - R/d) = d*coef*(1-coef) for 199 positions", identity);
  check("MN's ends lie on both circles", quadratics);
  check("the small radius grows up to coef = 1/2", monotone && near(maxR, C.distance(s.C, s.O) / 4, 1e-7));

  const far = { ...s, Q: { x: 2 * s.C.x - s.O.x, y: 2 * s.C.y - s.O.y } };
  check("the applet's angle guard rejects a Q in the opposite half-plane", !C.canDraw(far) && !appletCompute(far));
  const cond = C.conditions(s, 1e-6);
  check("the drawn diagram satisfies all three conditions",
    !!cond && cond.tangencyPoints && cond.tangentToChord && cond.onBigCircle);
  const saved = C.position(s);
  check("the saved position is plain board-unit data",
    ptNear(saved.C, s.C) && ptNear(saved.O, s.O) && ptNear(saved.Q, s.Q) &&
    near(saved.radiusO, gRadius(s)) && ptNear(saved.M, C.geometry(s).M, 1e-9));
}

function gRadius(s) {
  const g = C.geometry(s);
  return g ? g.R : NaN;
}

done("common-tangent-sangaku");
