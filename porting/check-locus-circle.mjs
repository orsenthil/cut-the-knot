#!/usr/bin/env node
"use strict";

/*
 * Logic test for locus-circle/locus-circle-core.js.
 *
 *   node porting/check-locus-circle.mjs
 *
 * (1) A second transcription of the applet's CutI, CutE, Reset and projection
 * bytecode is compared with the core over the whole 15 x 15 spinner grid and
 * several positions of A and B.  (2) The article's claims are checked over
 * that grid: M and N divide AB in the chosen ratio, MN is a diameter, every
 * sampled point of the circle has AP/BP = NB/NC, the closed-form centre and
 * radius agree, the family never intersects, and r = 1 is a perpendicular
 * bisector.  (3) The page's wrong sentence about small r and the old applet's
 * far-away r = 1 sentinel are measured, plus drags, options and edge cases.
 */

import { loadCore, check, done } from "./lib/load-core.mjs";

const C = loadCore("locus-circle/locus-circle-core.js", "LocusCircleCore");
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nearPoint = (p, q, tol = 1e-7) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const cross = (a, b) => a.x * b.y - a.y * b.x;
const configs = [
  [C.point(100 / 3, 230), C.point(340 / 3, 230)],
  [C.point(60, 80), C.point(300, 200)],
  [C.point(70, 240), C.point(330, 90)],
  [C.point(120, 150), C.point(280, 150)],
  [C.point(200, 60), C.point(90, 250)],
];

/* ---------------------------------- 1. the applet's own method, transcribed
 * a second time straight from the bytecode of CutI, CutE and Reset.  This
 * version deliberately keeps the million-pixel sentinel at NB == NC. */

function appletReset(A, B, P, nb, nc) {
  const denI = nb + nc;                       // CutI: iload_3 + iload 4
  const M = {
    x: A.x * nc / denI + B.x * nb / denI,
    y: A.y * nc / denI + B.y * nb / denI,
  };
  const denE = nb - nc;                       // CutE: iload_3 - iload 4
  const N = denE === 0
    ? { x: 1000000, y: A.y }
    : { x: B.x * nb / denE - A.x * nc / denE,
        y: B.y * nb / denE - A.y * nc / denE };
  const centre = { x: (M.x + N.x) / 2, y: (M.y + N.y) / 2 };
  const radius = Math.hypot(M.x - N.x, M.y - N.y) / 2;
  const from = Math.hypot(P.x - centre.x, P.y - centre.y);
  const projected = {
    x: centre.x + (P.x - centre.x) * radius / from,
    y: centre.y + (P.y - centre.y) * radius / from,
  };
  return { M, N, centre, radius, projected };
}

{
  let cases = 0, worstM = 0, worstN = 0, worstCircle = 0, worstP = 0, worstSentinel = 0;
  for (const [A, B] of configs) {
    for (let nb = C.N_MIN; nb <= C.N_MAX; nb++) {
      for (let nc = C.N_MIN; nc <= C.N_MAX; nc++) {
        const P0 = C.point((A.x + B.x) / 2 + 23, (A.y + B.y) / 2 - 37);
        const state = Object.assign({}, C.start({ nb: nb, nc: nc }), { A: A, B: B });
        state.P = C.restrict(state, P0);
        const g = C.geometry(state);
        const ref = appletReset(A, B, P0, nb, nc);
        cases++;
        worstM = Math.max(worstM, d(g.M, ref.M));
        worstSentinel = Math.max(worstSentinel, d(C.circleFromDiameter(ref.M, ref.N).c, ref.centre));
        if (nb === nc) {
          // The port follows the article here: exact bisector, not the sentinel.
          const n = C.sub(B, A), m = C.midpoint(A, B);
          worstCircle = Math.max(worstCircle,
            Math.abs((state.P.x - m.x) * n.x + (state.P.y - m.y) * n.y) / d(A, B));
        } else {
          worstN = Math.max(worstN, d(g.N, ref.N));
          worstCircle = Math.max(worstCircle, d(g.circle.c, ref.centre),
            Math.abs(g.circle.r - ref.radius));
          worstP = Math.max(worstP, d(state.P, ref.projected));
        }
      }
    }
  }
  check("the whole 15x15 spinner grid was compared", cases === 5 * 15 * 15, `${cases} cases`);
  check("core M matches CutI everywhere", worstM < 1e-7, `worst ${worstM}`);
  check("core N matches CutE for every NB != NC", worstN < 1e-6, `worst ${worstN}`);
  check("core circle matches Reset's diameter circle", worstCircle < 1e-7, `worst ${worstCircle}`);
  check("core P matches Reset's radial projection", worstP < 1e-7, `worst ${worstP}`);
  check("the second transcription is self-consistent", worstSentinel < 1e-6, `worst ${worstSentinel}`);
}

/* ------------------------------------------------ 2. start state and options */

{
  const s = C.start({});
  const s2 = C.VIEW.width / 3, s4 = C.VIEW.height * 3 / 5;
  const s6 = C.VIEW.width / 4, s8 = 50;
  check("the applet's initial A and B are horizontal and 80 units apart",
    nearPoint(s.A, C.point(s2 - s6, s4 + s8)) && nearPoint(s.B, C.point(s2 - s6 / 5, s4 + s8)));
  check("the initial P comes from the applet's cos(pi/3) construction",
    near(104.36540643415387, s.P.x) && near(150.60656803425252, s.P.y));
  check("the spinner defaults are NB=4 and NC=3",
    s.options.nb === 4 && s.options.nc === 3 && s.options.ratio === undefined);
  check("the checkboxes start unchecked, as in the applet",
    !s.options.names && !s.options.hint && !s.options.extra);
  check("P starts on the Apollonian circle",
    near(d(s.P, s.A) / d(s.P, s.B), 4 / 3, 1e-9));
  const g = C.geometry(s);
  check("the start circle has the bytecode's centre and radius",
    nearPoint(g.circle.c, C.point(216.1904761904762, 230)) && near(g.circle.r, 137.14285714285717));
}

/* --------------------------------------------------- 3. the article's claims */

{
  let worstLineM = 0, worstLineN = 0, worstRatioM = 0, worstRatioN = 0;
  let worstSample = 0, worstCentre = 0, worstRadius = 0, worstRightAngle = 0;
  let sampled = 0;
  for (const [A, B] of configs) {
    for (let nb = 1; nb <= 15; nb++) {
      for (let nc = 1; nc <= 15; nc++) {
        const g = C.compute(A, B, nb, nc);
        const ab = C.sub(B, A);
        worstLineM = Math.max(worstLineM, Math.abs(cross(C.sub(g.M, A), ab)) / d(A, B));
        if (g.N) worstLineN = Math.max(worstLineN, Math.abs(cross(C.sub(g.N, A), ab)) / d(A, B));
        if (nb === nc) continue;
        const r = nb / nc;
        worstRatioM = Math.max(worstRatioM, Math.abs(d(g.M, A) / d(g.M, B) - r));
        worstRatioN = Math.max(worstRatioN, Math.abs(d(g.N, A) / d(g.N, B) - r));
        const l = C.locus(A, B, r);
        worstCentre = Math.max(worstCentre, d(g.circle.c, l.c) / d(A, B));
        worstRadius = Math.max(worstRadius, Math.abs(g.circle.r - l.r) / d(A, B));
        for (let k = 0; k < 8; k++) {
          const ang = 2 * Math.PI * k / 8;
          const P = C.point(g.circle.c.x + g.circle.r * Math.cos(ang),
                            g.circle.c.y + g.circle.r * Math.sin(ang));
          worstSample = Math.max(worstSample, Math.abs(d(P, A) / d(P, B) - r));
          // Thales: MN subtends a right angle at every P on its circle.
          const u = C.sub(g.M, P), v = C.sub(g.N, P);
          const denom = d(u, C.point(0, 0)) * d(v, C.point(0, 0));
          // The 8 samples include M and N themselves, where the "angle" is
          // not defined; skip those two endpoints.
          if (denom > 1) {
            worstRightAngle = Math.max(worstRightAngle, Math.abs(u.x * v.x + u.y * v.y) / denom);
          }
          sampled++;
        }
      }
    }
  }
  check("M and N lie on line AB for every count pair", worstLineM < 1e-8 && worstLineN < 1e-8,
    `worst ${Math.max(worstLineM, worstLineN)}`);
  check("AM/BM = AN/BN = NB/NC on the whole grid",
    worstRatioM < 1e-8 && worstRatioN < 1e-8,
    `worst ${Math.max(worstRatioM, worstRatioN)}`);
  check("MN is a diameter: it subtends a right angle at sampled P",
    worstRightAngle < 1e-8, `worst ${worstRightAngle}`);
  check("enough points of the locus were sampled", sampled === 5 * (225 - 15) * 8, `${sampled}`);
  check("every sampled point has AP/BP = NB/NC", worstSample < 1e-8, `worst ${worstSample}`);
  check("centre matches A + r^2/(r^2-1) * AB", worstCentre < 1e-8, `worst ${worstCentre}`);
  check("radius matches r*AB/|r^2-1|", worstRadius < 1e-8, `worst ${worstRadius}`);
}

/* r = 1: the article says perpendicular bisector; the applet faked it with
 * a far-away point, which is only right when AB is horizontal. */
{
  const A = C.point(80, 220), B = C.point(300, 110);
  const state = Object.assign({}, C.start({ nb: 4, nc: 4 }), { A: A, B: B });
  state.P = C.restrict(state, C.point(300, 210));
  const g = C.geometry(state);
  const m = C.midpoint(A, B), n = C.sub(B, A);
  check("equal counts give a line, not a circle", g.circle === null && !!g.line);
  check("P is projected onto the perpendicular bisector",
    near((state.P.x - m.x) * n.x + (state.P.y - m.y) * n.y, 0, 1e-8));
  let worst = 0;
  for (let k = 0; k < 40; k++) {
    const t = -2 + 4 * k / 39;
    const p = C.point(m.x - n.y * t, m.y + n.x * t);
    worst = Math.max(worst, Math.abs(d(p, A) - d(p, B)));
  }
  check("all 40 sampled points of the r=1 line are equidistant", worst < 1e-8, `worst ${worst}`);
  check("the description names the perpendicular bisector",
    C.describe(state).includes("perpendicular bisector"));

  const sentinel = C.appletCircle(A, B, 4, 4);
  const len = d(A, C.point(0, 0));
  let slantDeviation = 0;
  for (const t of [-40, 40]) {
    const target = C.point(m.x - n.y / d(A, B) * t, m.y + n.x / d(A, B) * t);
    const dx = target.x - sentinel.c.x, dy = target.y - sentinel.c.y;
    const k = sentinel.r / Math.hypot(dx, dy);
    slantDeviation = Math.max(slantDeviation,
      d(C.point(sentinel.c.x + dx * k, sentinel.c.y + dy * k), target));
  }
  check("the old sentinel is visibly wrong for a slanted AB", slantDeviation > 10,
    `deviation ${slantDeviation.toFixed(2)} px`);
  const Ah = C.point(100 / 3, 230), Bh = C.point(340 / 3, 230);
  const hs = C.appletCircle(Ah, Bh, 4, 4), hm = C.midpoint(Ah, Bh);
  let flatDeviation = 0;
  for (const t of [-60, 60]) {
    const dx = hm.x - hs.c.x, dy = hm.y + t - hs.c.y;
    const k = hs.r / Math.hypot(dx, dy);
    flatDeviation = Math.max(flatDeviation,
      Math.hypot(hs.c.x + dx * k - hm.x, hs.c.y + dy * k - hm.y - t));
  }
  check("the old sentinel was a good stand-in only when AB was level", flatDeviation < 0.01,
    `deviation ${flatDeviation.toFixed(5)} px`);
  check("the port follows the page rather than copying that quirk", len > 0 && g.line !== null);
}

/* The family claim, and the page's one false sentence about smaller r. */
{
  const A = C.point(100, 150), B = C.point(300, 150);
  const circles = [];
  for (let nb = 1; nb <= 15; nb++) {
    for (let nc = 1; nc <= 15; nc++) {
      const g = C.compute(A, B, nb, nc);
      if (g.circle) circles.push({ r: nb / nc, c: g.circle.c, radius: g.circle.r });
    }
  }
  let crossings = 0, pairs = 0;
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i], b = circles[j];
      if (near(a.r, b.r, 1e-12)) continue;
      pairs++;
      const sep = d(a.c, b.c);
      if (sep < a.radius + b.radius - 1e-7 && sep > Math.abs(a.radius - b.radius) + 1e-7) crossings++;
    }
  }
  check("all 210 spinner ratios give distinct circles", circles.length === 210);
  check("no two circles of the family cross", crossings === 0,
    `${crossings} crossings in ${pairs} pairs`);

  const small = [1 / 15, 1 / 10, 1 / 5, 1 / 2].map((r) => C.locus(A, B, r));
  const nearA = small.every((l) => l.c.x < A.x) && small.every((l, i) => i === 0 || l.r > small[i - 1].r);
  check("for r < 1 the circles shrink towards A, not B", nearA);
  const gapToB = small.map((l) => d(l.c, B) - l.r);
  check("the page's 'smaller r is closer to B' sentence is false",
    gapToB[0] > gapToB[gapToB.length - 1],
    `nearest distance from B grows ${gapToB[0].toFixed(1)} > ${gapToB[3].toFixed(1)}`);
  const large = [1.2, 2, 4, 15].map((r) => C.locus(A, B, r));
  check("for r > 1 the circles shrink towards B as r grows",
    large.every((l, i) => i === 0 || (l.r < large[i - 1].r && d(l.c, B) < d(large[i - 1].c, B))));
}

/* ------------------------------------------- 4. moves, options and edges */

{
  const s0 = C.start({});
  let worstDrag = 0;
  for (const target of [C.point(s0.P.x + 40, s0.P.y + 40),
                        C.point(s0.P.x - 60, s0.P.y + 10),
                        C.point(s0.B.x, s0.B.y - 30)]) {
    const moved = C.move(s0, "P", target);
    worstDrag = Math.max(worstDrag,
      Math.abs(d(moved.P, moved.A) / d(moved.P, moved.B) - 4 / 3));
  }
  check("dragging P keeps AP/BP = NB/NC", worstDrag < 1e-8, `worst ${worstDrag}`);
  const movedA = C.move(s0, "A", C.point(70, 110));
  const movedB = C.move(s0, "B", C.point(320, 190));
  check("moving A or B reprojects P onto the new circle",
    near(d(movedA.P, movedA.A) / d(movedA.P, movedA.B), 4 / 3, 1e-8)
    && near(d(movedB.P, movedB.A) / d(movedB.P, movedB.B), 4 / 3, 1e-8));
  check("unknown handles are refused", C.move(s0, "X", C.point(1, 1)) === s0);
  check("handles stay on the board", C.clamp(C.point(-100, 999)).x === C.PAD
    && C.clamp(C.point(-100, 999)).y === C.VIEW.height - C.PAD);
  check("the spinner clamps whole numbers to 1..15",
    C.clampCount(3.7, 4) === 3 && C.clampCount(-4, 4) === 1
    && C.clampCount(100, 4) === 15 && C.clampCount(NaN, 4) === 4);
  check("out-of-range input fields follow the applet's 1..15 bounds",
    C.setOption(s0, "nc", 0).options.nc === 1
    && C.setOption(s0, "nb", 99).options.nb === 15);

  const changed = C.setOption(s0, "nb", 2);
  check("changing NB reprojects P and keeps the ratio",
    near(d(changed.P, changed.A) / d(changed.P, changed.B), 2 / 3, 1e-8));
  const equal = C.setOption(changed, "nc", 2);
  check("equal counts produce a line and keep P on it",
    C.geometry(equal).line !== null
    && near((equal.P.x - (equal.A.x + equal.B.x) / 2) * (equal.B.x - equal.A.x)
          + (equal.P.y - (equal.A.y + equal.B.y) / 2) * (equal.B.y - equal.A.y), 0, 1e-7));
  const ticked = C.setOption(C.setOption(s0, "hint", true), "extra", true);
  check("checkboxes do not move P", nearPoint(ticked.P, s0.P));
  check("Reset restores the start but keeps the options",
    nearPoint(C.reset(ticked).A, s0.A) && nearPoint(C.reset(ticked).P, s0.P)
    && C.reset(ticked).options.hint && C.reset(ticked).options.extra);

  const hintState = C.setOption(C.setOption(s0, "hint", true), "nb", 5);
  const segs = C.hintSegments(hintState);
  check("the hint draws the applet's division parallels",
    segs.length === (5 - 1) + (3 - 1) + (5 - 1), `${segs.length} segments`);
  const gm = C.geometry(hintState).M, gn = C.geometry(hintState).N;
  let worstParallel = 0;
  for (const seg of segs) {
    const want = seg.kind === "outer" ? C.sub(hintState.P, gn) : C.sub(hintState.P, gm);
    worstParallel = Math.max(worstParallel,
      Math.abs(cross(C.sub(seg.to, seg.from), want)) / (d(seg.to, seg.from) * d(want, C.point(0, 0))));
  }
  check("each hint segment is parallel to PM or PN", worstParallel < 1e-8, `worst ${worstParallel}`);
  check("degenerate A = B is refused", C.compute(C.point(10, 10), C.point(10, 10), 2, 1) === null);
  check("a picture has no win or loss", C.result(changed) === null);
  check("the saved position is plain data", JSON.stringify(s0).includes("nb")
    && JSON.stringify(s0).includes("A") && !("line" in s0));
}

done("locus-circle");
