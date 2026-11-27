#!/usr/bin/env node
"use strict";

/*
 * Logic test for from-7/from-7-core.js.
 *
 *   node porting/check-from-7.mjs
 *
 * The page's one claim is the area ratio: 7, 19, 37, ... = 3N^2 + 3N + 1
 * times the original triangle. It is checked exhaustively on an integer
 * lattice of triangles (including reflected, tall and flat ones, with N from
 * 1 to 8) and on a seeded random sample (N up to 16), together with the
 * applet's collinearity, its parallelogram areas and its centered-hexagonal
 * difference sequence.
 *
 * A second, literal transcription of From7Canvas.Draw / Extend / LinComb /
 * DrawGrid and From7Panel's <, > and typed-number handlers is compared with
 * the core over the same space, so a drift in either transcription shows up.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("from-7/from-7-core.js", "From7Core");
const near = (a, b, tol = 1e-9) => C.close(a, b, tol);
const same = (p, q, tol = 1e-9) => near(p.x, q.x, tol) && near(p.y, q.y, tol);
const cross = (a, b) => a.x * b.y - a.y * b.x;
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  const r = Math.min(Math.floor(400 / 10), Math.floor(250 / 10));
  check("opening A is the applet's W/2 - r/4, H/2",
    same(s.A, { x: 400 / 2 - r / 4, y: 250 / 2 }, 1e-12));
  check("opening B and C are one radius above and below the horizontal",
    same(s.B, { x: 200 + r * Math.cos(Math.PI / 6), y: 125 - r * Math.sin(Math.PI / 6) }, 1e-12) &&
    same(s.C, { x: 200 + r * Math.cos(Math.PI / 6), y: 125 + r * Math.sin(Math.PI / 6) }, 1e-12));
  check("Num starts at 1, both switches start off",
    s.N === 1 && !s.showGrid && !s.addColor && s.width === 400 && s.height === 250);

  const moved = C.move(s, { type: "point", name: "B", point: { x: 77, y: 33 } });
  check("a drag moves only the named corner and keeps the original",
    same(moved.B, { x: 77, y: 33 }) && same(moved.A, s.A) && same(moved.C, s.C) && !same(s.B, moved.B));
  check("PointIsEligible refuses points on or outside the canvas edge",
    C.move(s, { type: "point", name: "A", point: { x: 0, y: 50 } }) === null &&
    C.move(s, { type: "point", name: "A", point: { x: 50, y: 0 } }) === null &&
    C.move(s, { type: "point", name: "A", point: { x: 400, y: 50 } }) === null &&
    C.move(s, { type: "point", name: "A", point: { x: 50, y: 250 } }) === null &&
    C.move(s, { type: "point", name: "A", point: { x: -3, y: 50 } }) === null);
  check("a non-finite point or an unknown corner is refused",
    C.move(s, { type: "point", name: "A", point: { x: NaN, y: 50 } }) === null &&
    C.move(s, { type: "point", name: "A", point: { x: 50, y: Infinity } }) === null &&
    C.move(s, { type: "point", name: "D", point: { x: 50, y: 50 } }) === null);

  const grid = C.move(s, { type: "option", key: "showGrid", value: true });
  const color = C.move(s, { type: "option", key: "addColor", value: true });
  check("each checkbox changes only its own flag",
    grid.showGrid && !grid.addColor && color.addColor && !color.showGrid && !s.showGrid && !s.addColor);
  check("a bad checkbox key or a non-boolean value is refused",
    C.move(s, { type: "option", key: "grid", value: true }) === null &&
    C.move(s, { type: "option", key: "showGrid", value: "yes" }) === null &&
    C.move(s, { type: "unknown" }) === null && C.move(s, null) === null);

  // From7Panel.clickedMLess / clickedMMore / keyPressMNum, from the bytecode.
  const panelLess = (n) => (n > 0 ? (n > 1 ? n - 1 : n) : n);
  const panelMore = (n) => n + 1;
  const panelTyped = (text, current) => {
    const n = Number.parseInt(text, 10);
    if (n >= 1) return n; // Integer.parseInt, then the Min test
    return current;       // the old value is put back into the TextField
  };
  let panelOk = true;
  for (let n = 1; n <= 60; n++) {
    const state = Object.assign({}, s, { N: n });
    panelOk = panelOk && C.move(state, { type: "step", delta: -1 }).N === panelLess(n);
    panelOk = panelOk && C.move(state, { type: "step", delta: 1 }).N === panelMore(n);
    panelOk = panelOk && C.move(state, { type: "N", value: n }).N === panelTyped(String(n), n);
    panelOk = panelOk && C.move(state, { type: "N", value: n + 3 }).N === panelTyped(String(n + 3), n);
  }
  check("<, > and the typed Num match the panel's own methods for N = 1..60", panelOk);
  check("typing a number below Min leaves N alone, like the applet",
    C.move(Object.assign({}, s, { N: 7 }), { type: "N", value: 0 }) === null && panelTyped("0", 7) === 7 &&
    C.move(Object.assign({}, s, { N: 7 }), { type: "N", value: -5 }) === null && panelTyped("-5", 7) === 7);
  check("a bad step or a fractional Num is refused",
    C.move(s, { type: "step", delta: 2 }) === null && C.move(s, { type: "N", value: 2.5 }) === null);
  const afterReset = C.move(grid, { type: "reset" });
  check("Reset restores the corners but keeps Num and the switches",
    same(afterReset.A, s.A) && same(afterReset.B, s.B) && same(afterReset.C, s.C) &&
    afterReset.N === 1 && afterReset.showGrid && !afterReset.addColor);
  check("a demonstration has no win, loss or ending", C.result(s) === null);
}

/* ----------------------------------------- 2. the page's claim, exhaustively */

{
  let lattice = 0, latticeBad = 0;
  let random = 0, randomBad = 0, affineBad = 0;
  let collinearBad = 0, orderBad = 0, parallelBad = 0;
  let degenerate = 0, degenerateBad = 0;

  const at = (A, B, Cpt, N) => C.compute({ A, B, C: Cpt, N, width: 400, height: 250 });
  const testTriangle = (A, B, Cpt, N, into) => {
    const g = at(A, B, Cpt, N);
    into.count++;
    if (!C.areaClaim(g)) into.bad++;
    // Orientation and factor: the signed ratio is the positive factor.
    if (!near(g.big / g.small, g.expectedRatio, 1e-7)) into.bad++;

    // The applet's X/XX points all lie on their side's line, in the order
    // XX[k], P[k], P[k+1], X[k] at parameters -N, 0, 1, 1+N.
    const P = [A, B, Cpt];
    for (let k = 0; k < 3; k++) {
      const u = sub(P[(k + 1) % 3], P[k]);
      if (!near(cross(u, sub(g.X[k], P[k])), 0, 1e-6) ||
          !near(cross(u, sub(g.XX[k], P[k])), 0, 1e-6)) collinearBad++;
      const d = sub(g.X[k], g.XX[k]);
      const len2 = d.x * d.x + d.y * d.y;
      const param = (sub(g.XX[k], P[k]).x * d.x + sub(g.XX[k], P[k]).y * d.y) / len2;
      if (!near(param, -N / (2 * N + 1), 1e-8)) orderBad++;
    }

    // Each shaded parallelogram has the same area: N(N+1)|AB x AC|.
    const base = Math.abs(cross(sub(B, A), sub(Cpt, A)));
    for (const para of g.parallelograms) {
      if (!near(Math.abs(C.signedArea(para)), N * (N + 1) * base, 1e-6)) parallelBad++;
    }

    // The grid must have exactly 6N+9 finite lines, as DrawGrid asks for.
    if (g.grid.length !== 6 * N + 9 || g.grid.some((l) =>
      !Number.isFinite(l.a.x) || !Number.isFinite(l.a.y) ||
      !Number.isFinite(l.b.x) || !Number.isFinite(l.b.y))) into.bad++;
    return g;
  };

  const latticeBag = { count: 0, bad: 0 };
  for (let x = -30; x <= 40; x += 5) {
    for (let y = -30; y <= 30; y += 5) {
      if (y === 0) continue; // flat: the ratio is not defined
      for (let N = 1; N <= 8; N++) {
        testTriangle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x, y }, N, latticeBag);
      }
    }
  }
  lattice = latticeBag.count;
  latticeBad = latticeBag.bad;
  check(`area ratio = 3N^2+3N+1 on ${lattice} lattice triangles (N = 1..8), with finite grid lines`,
    lattice === 15 * 12 * 8 && latticeBad === 0, `${latticeBad} failures`);

  const sequence = [];
  for (let N = 1; N <= 6; N++) {
    const g = at({ x: 0, y: 0 }, { x: 7, y: 0 }, { x: 2, y: 9 }, N);
    sequence.push(g.ratio);
  }
  check("the page's 7, 19, 37 and the next hex numbers are exact",
    sequence.every((v, i) => near(v, [7, 19, 37, 61, 91, 127][i], 1e-10)),
    JSON.stringify(sequence));

  let diffOk = true, cubeOk = true, oeisOk = true;
  const oeis = [1, 7, 19, 37, 61, 91, 127, 169, 217, 271];
  for (let n = 0; n <= 60; n++) {
    const f = 3 * n * n + 3 * n + 1;
    diffOk = diffOk && f - (3 * (n - 1) * (n - 1) + 3 * (n - 1) + 1 || 1) === (n === 0 ? 0 : 6 * n);
    cubeOk = cubeOk && f === (n + 1) ** 3 - n ** 3;
    if (n < oeis.length) oeisOk = oeisOk && f === oeis[n];
  }
  check("consecutive ratios differ by 6(N+1) (centered hexagonal numbers)", diffOk);
  check("3N^2+3N+1 = (N+1)^3 - N^3", cubeOk);
  check("the sequence matches OEIS A003215 (1, 7, 19, 37, ...)", oeisOk);

  const randomBag = { count: 0, bad: 0 };
  const rand = rng(20261127);
  const rr = () => Math.round((rand() - 0.5) * 4000) / 10;
  for (let i = 0; i < 400; i++) {
    const A = { x: rr(), y: rr() };
    const B = { x: rr(), y: rr() };
    const Cpt = { x: rr(), y: rr() };
    if (Math.abs(cross(sub(B, A), sub(Cpt, A))) < 1) continue;
    for (let N = 1; N <= 16; N++) {
      const g = testTriangle(A, B, Cpt, N, randomBag);
      random++;
      // Apply a random affine map: every area scales by det(M), the ratio does not.
      const a = (rand() - 0.5) * 6, b = (rand() - 0.5) * 6;
      const c = (rand() - 0.5) * 6, d = (rand() - 0.5) * 6;
      if (Math.abs(a * d - b * c) < 0.05) continue;
      const T = (p) => ({ x: a * p.x + b * p.y + 17, y: c * p.x + d * p.y - 23 });
      const h = at(T(A), T(B), T(Cpt), N);
      if (!near(h.ratio, g.ratio, 1e-7)) affineBad++;
    }
  }
  random = randomBag.count;
  randomBad = randomBag.bad;
  check(`the claim also holds on ${random} random triangles (N = 1..16)`, randomBad === 0, `${randomBad} failures`);
  check("the ratio is unchanged by random affine maps", affineBad === 0, `${affineBad} failures`);
  check("the X/XX points stay on their sides for every tested triangle", collinearBad === 0, `${collinearBad} failures`);
  check("XX, P, Q, X occur at -N, 0, 1, 1+N along each side", orderBad === 0, `${orderBad} failures`);
  check("each shaded parallelogram has area N(N+1) times the base cross", parallelBad === 0, `${parallelBad} failures`);

  const flat = at({ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 30, y: 5 }, 3);
  degenerate++;
  if (!flat.degenerate || flat.ratio !== null || C.areaClaim(flat)) degenerateBad++;
  check("a flat triangle has no ratio and no false claim", degenerate === 1 && degenerateBad === 0);
}

/* ----------------------------- 3. the applet's own method, transcribed twice */

{
  // Literal From7Canvas.Extend / LinComb / Draw, with the same pair order and
  // the same reversed arguments in the six DrawGrid calls.
  function appletDraw(A, B, Cpt, n) {
    const ext = (u, v) => ({ x: v.x + n * (v.x - u.x), y: v.y + n * (v.y - u.y) });
    const lc = (u, v, t) => ({ x: t * u.x + (1 - t) * v.x, y: t * u.y + (1 - t) * v.y });
    const X = [ext(A, B), ext(B, Cpt), ext(Cpt, A)];
    const XX = [ext(B, A), ext(Cpt, B), ext(A, Cpt)];
    const para = [
      [X[1], B, X[0], XX[2]],
      [X[2], Cpt, X[1], XX[0]],
      [X[0], A, X[2], XX[1]],
    ];
    const calls = [
      [n, XX[0], X[2], XX[1], X[0]],
      [n + 1, XX[0], X[1], XX[2], X[0]],
      [n, XX[1], X[0], XX[2], X[1]],
      [n + 1, XX[1], X[2], XX[0], X[1]],
      [n, XX[2], X[1], XX[0], X[2]],
      [n + 1, XX[2], X[0], XX[1], X[2]],
    ];
    const grid = [];
    for (const [count, p3, p4, p5, p6] of calls) {
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        grid.push([lc(p3, p4, t), lc(p6, p5, t)]);
      }
    }
    return { X, XX, para, grid };
  }

  // Literal From7Canvas.init(): integer /10, cos/sin of PI/6.
  function appletInit(w, h) {
    const size = Math.min((w / 10) | 0, (h / 10) | 0);
    return [
      { x: w / 2 - size / 4, y: h / 2 },
      { x: w / 2 + size * Math.cos(0.5235987755982988), y: h / 2 - size * Math.sin(0.5235987755982988) },
      { x: w / 2 + size * Math.cos(0.5235987755982988), y: h / 2 + size * Math.sin(0.5235987755982988) },
    ];
  }

  let initOk = true;
  for (const [w, h] of [[400, 250], [320, 200], [800, 600], [100, 100], [137, 93]]) {
    const s = C.start({ width: w, height: h });
    const pts = appletInit(w, h);
    initOk = initOk && same(s.A, pts[0], 1e-12) && same(s.B, pts[1], 1e-12) && same(s.C, pts[2], 1e-12);
  }
  check("the opening corners match init() at five canvas sizes", initOk);

  let drawOk = true, gridOk = true, ratioOk = true, cases = 0;
  const rand = rng(777);
  for (let i = 0; i < 250; i++) {
    const A = { x: rand() * 400, y: rand() * 250 };
    const B = { x: rand() * 400, y: rand() * 250 };
    const Cpt = { x: rand() * 400, y: rand() * 250 };
    for (let n = 1; n <= 12; n++) {
      cases++;
      const g = C.compute({ A, B, C: Cpt, N: n });
      const a = appletDraw(A, B, Cpt, n);
      for (let k = 0; k < 3; k++) {
        drawOk = drawOk && same(g.X[k], a.X[k]) && same(g.XX[k], a.XX[k]);
        drawOk = drawOk && g.parallelograms[k].every((p, j) => same(p, a.para[k][j]));
      }
      gridOk = gridOk && g.grid.length === a.grid.length && g.grid.every((line, j) =>
        same(line.a, a.grid[j][0]) && same(line.b, a.grid[j][1]));
      const shoelace = (pts) => pts.reduce((sum, p, k) => {
        const q = pts[(k + 1) % pts.length];
        return sum + p.x * q.y - q.x * p.y;
      }, 0) / 2;
      ratioOk = ratioOk && near(Math.abs(shoelace(a.X) / shoelace([A, B, Cpt])), 3 * n * n + 3 * n + 1, 1e-7);
    }
  }
  check(`X, XX and the three parallelograms match Draw in ${cases} cases`, drawOk);
  check(`all ${cases} grid-line sets match DrawGrid's six calls`, gridOk);
  check(`the transcribed bytecode gives the page's ratio in all ${cases} cases`, ratioOk);

  let linOk = true;
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const a = { x: 3, y: -7 }, b = { x: 41, y: 19 };
    linOk = linOk && same(C.linComb(a, b, t), { x: t * a.x + (1 - t) * b.x, y: t * a.y + (1 - t) * b.y }, 1e-12);
  }
  check("LinComb keeps the bytecode's reversed weights", linOk);

  let panelOk = true;
  for (let n = 1; n <= 50; n++) {
    // clickedMLess / clickedMMore / keyPressMNum one more time, independently.
    let less = n; if (less > 1) less--;
    const more = n + 1;
    const typedIn = String(n + 2);
    let typed = Number.parseInt(typedIn, 10); if (typed < 1) typed = n;
    const state = { A: { x: 1, y: 1 }, B: { x: 2, y: 2 }, C: { x: 3, y: 4 }, N: n, width: 400, height: 250 };
    panelOk = panelOk && C.move(state, { type: "step", delta: -1 }).N === less &&
      C.move(state, { type: "step", delta: 1 }).N === more &&
      C.move(state, { type: "N", value: n + 2 }).N === typed;
  }
  check("the panel's three handlers match the core for every N = 1..50", panelOk);

  equal("the small helper functions match the bytecode exactly",
    [
      C.extend({ x: 2, y: -3 }, { x: 5, y: 9 }, 4),
      C.linComb({ x: 2, y: -3 }, { x: 5, y: 9 }, 0.25),
      C.signedArea([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 3 }]),
    ],
    [
      { x: 17, y: 57 },
      { x: 4.25, y: 6 },
      6,
    ]);
}

done("from-7");
