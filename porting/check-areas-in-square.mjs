#!/usr/bin/env node
"use strict";

/*
 * Logic test for areas-in-square/areas-in-square-core.js.
 *
 *   node porting/check-areas-in-square.mjs
 *
 * Checks the page's exact claim, I : II : III : IV = 1 : N : N² : N²+N-1,
 * for every whole N the applet's spinner allows (2..20) and for hundreds of
 * random boards, E drags and square resizes. Then Reset() and ShowDissection()
 * are transcribed a second time from AreasInSquareCanvas's bytecode and every
 * point and segment is compared with the core.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("areas-in-square/areas-in-square-core.js", "AreasInSquareCore");
const samePoint = (p, q, tol = 1e-9) => C.close(p.x, q.x, tol) && C.close(p.y, q.y, tol);
const ok = (g) => Object.values(C.claims(g)).every(Boolean);

/* ------------------------------------------------------------ 1. the rules */

{
  equal("opening state: N=2, side 360, both switches off", C.start({}), {
    width: 400, height: 400, n: 2, span: 360,
    showColors: false, showDissection: false, explored: false,
  });

  const g = C.compute(C.start({}));
  check("opening square is centred with A bottom-left and D top-left",
    samePoint(g.A, { x: 20, y: 380 }) && samePoint(g.B, { x: 380, y: 380 }) &&
    samePoint(g.C, { x: 380, y: 20 }) && samePoint(g.D, { x: 20, y: 20 }));
  check("opening E is the midpoint AD and M is where AC meets BE",
    samePoint(g.E, { x: 20, y: 200 }) && samePoint(g.M, { x: 140, y: 260 }) &&
    g.onAC && g.onBE);
  check("opening areas are 1:2:4:5 and add to the square's area",
    ok(g) && g.areas.map((v) => Math.round(v / g.unit)).join(",") === "1,2,4,5" &&
    C.close(g.total, 360 * 360));

  const s = C.start({ n: 7 });
  check("E sits one N-th of the way up from A",
    samePoint(C.compute(s).E, { x: 21.5, y: 21.5 + 357 - 357 / 7 }) && C.compute(s).fraction);
  check("the side is truncated to a whole multiple of N, as Reset does",
    s.span === 357 && C.snapSide(400, 400, 7) === 357 && C.snapSide(400, 400, 3) === 360);

  check("N outside 2..20 is refused",
    C.move(s, { type: "n", value: 1 }) === null && C.move(s, { type: "n", value: 21 }) === null);
  check("a fractional N is refused by the integer spinner",
    C.move(s, { type: "n", value: 3.5 }) === null && C.move(s, { type: "n", value: "7" }) === null);
  const changed = C.move(s, { type: "n", value: 11 });
  check("an accepted N changes only N and the square's side",
    changed.n === 11 && changed.span === C.snapSide(400, 400, 11) &&
    changed.showColors === s.showColors && changed.width === s.width);

  const shown = C.move(s, { type: "option", key: "showColors", value: true });
  check("a checkbox changes only its own flag",
    shown.showColors && !shown.showDissection && !s.showColors);
  check("an unknown checkbox or a non-boolean value is refused",
    C.move(s, { type: "option", key: "showGrid", value: true }) === null &&
    C.move(s, { type: "option", key: "showColors", value: "yes" }) === null);
  const reset = C.move(shown, { type: "reset" });
  check("reset restores N=2, the opening side and both switches",
    reset.n === 2 && reset.span === 360 && !reset.showColors && !reset.showDissection &&
    !reset.explored && shown.explored);

  const draggedE = C.move(s, { type: "point", name: "E", point: { x: 21.5, y: 21.5 + 357 - 357 / 5 } });
  check("dragging E changes N but leaves the square where it was",
    C.close(draggedE.n, 5) && draggedE.span === s.span && draggedE.explored);
  check("dragging E past A, off the board or to a bad point is refused",
    C.move(s, { type: "point", name: "E", point: { x: 20, y: 400 } }) === null &&
    C.move(s, { type: "point", name: "E", point: { x: -1, y: 200 } }) === null &&
    C.move(s, { type: "point", name: "E", point: { x: 20, y: NaN } }) === null);
  const draggedC = C.move(s, { type: "point", name: "C", point: { x: 300, y: 100 } });
  check("dragging C resizes the centred square and keeps N",
    draggedC.n === s.n && draggedC.span === 200 && ok(C.compute(draggedC)));
  check("dragging C off the board or an unknown move is refused",
    C.move(s, { type: "point", name: "C", point: { x: 900, y: 100 } }) === null &&
    C.move(s, { type: "point", name: "Z", point: { x: 100, y: 100 } }) === null &&
    C.move(s, { type: "fly" }) === null);
}

/* ------------------------------- 2. the page's claim over every option --- */

{
  check("N=2 is the original puzzle's 1:2:4:5",
    C.compute(C.start({ n: 2 })).ratios.join(",") === "1,2,4,5");
  check("N=20 is 1:20:400:419",
    C.compute(C.start({ n: 20 })).ratios.join(",") === "1,20,400,419");

  let allRatios = true, allSum = true, allLines = true, allGrid = true, allPositive = true;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    const g = C.compute(C.start({ n }));
    const k = C.claims(g);
    allRatios &&= k.ratio && k.ratioAddsUp;
    allSum &&= k.areasAddUp;
    allLines &&= k.MOnBothLines && k.EAtFraction;
    allPositive &&= k.positive;
    allGrid &&= g.dissection.length === 6 * n - 5 &&
      g.dissection.every(([p, q]) =>
        Number.isFinite(p.x) && Number.isFinite(p.y) &&
        Number.isFinite(q.x) && Number.isFinite(q.y));
  }
  check("the four areas are in the page's ratio for all 19 values of N", allRatios);
  check("the four areas add to the square's area for all N", allSum);
  check("M is on both lines and E is at AD/N for all N", allLines);
  check("all four pieces have positive area for all N", allPositive);
  check("ShowDissection draws 6N-5 finite segments for all N", allGrid);
}

/* -------------------------------- 3. random boards, E drags and resizes -- */

{
  const rand = rng(20261126);
  let boards = true, drags = true, resizes = true, scale = true;
  for (let i = 0; i < 500; i++) {
    const width = 220 + Math.floor(rand() * 700);
    const height = 220 + Math.floor(rand() * 700);
    const n = 2 + Math.floor(rand() * 19);
    const g = C.compute(C.start({ width, height, n }));
    boards &&= ok(g) && g.ratios.join(",") === [1, n, n * n, n * n + n - 1].join(",");

    // Slide E to an arbitrary fraction between D-side and the midpoint.
    const state = C.start({ width, height, n });
    const geo = C.compute(state);
    const target = 2 + rand() * 18;
    const ey = geo.A.y - geo.side / target;
    const moved = C.move(state, { type: "point", name: "E", point: { x: geo.A.x, y: ey } });
    drags &&= moved && ok(C.compute(moved)) && C.close(moved.n, target, 1e-9) &&
      C.close(C.compute(moved).A.y - C.compute(moved).E.y,
        C.compute(moved).side / moved.n, 1e-7);

    // Resize the square by grabbing its top-right corner.
    const span = 60 + rand() * (C.maxSide(width, height) - 60);
    const corner = { x: width / 2 + span / 2, y: height / 2 - span / 2 };
    const resized = C.move(state, { type: "point", name: "C", point: corner });
    resizes &&= resized && ok(C.compute(resized)) &&
      C.close(resized.span, span, 2e-3) && resized.n === n;

    // The ratio is scale invariant: unit grows with side², ratios do not.
    const small = C.compute(Object.assign({}, state, { span: 120 }));
    const big = C.compute(Object.assign({}, state, { span: 300 }));
    scale &&= ok(small) && ok(big) &&
      small.ratios.join(",") === big.ratios.join(",") &&
      C.close(big.unit / small.unit, (300 / 120) ** 2);
  }
  check("the claim holds on 500 random board sizes and N values", boards);
  check("the claim holds on 500 random E positions", drags);
  check("the claim holds on 500 random square resizes", resizes);
  check("the ratios are scale invariant while the unit area grows with side²", scale);
}

/* ------------ 4. a second transcription of the applet's own computation --- */

{
  // GeoSDoub.Intersect(p1,p2,p3,p4), javap -c: a1=p1.y-p2.y, b1=p2.x-p1.x,
  // c1=p1.x*p2.y-p1.y*p2.x; idem for p3,p4; d=a1*b2-a2*b1; NaN if |d|<1;
  // else x=(b1*c2-b2*c1)/d, y=(c1*a2-c2*a1)/d.
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / d, y: (c1 * a2 - c2 * a1) / d };
  }
  const pt = (x, y) => ({ x, y });

  // AreasInSquareCanvas.Reset(), javap -c, with the integer truncation
  // side = (min(w-40,h-40)/N)*N and every point/array it builds.
  function appletReset(N, width, height) {
    const side = Math.floor(Math.min(width - 40, height - 40) / N) * N;
    const x = (width - side) / 2, y = (height - side) / 2;
    const A = pt(x, y + side), B = pt(x + side, y + side);
    const Cpt = pt(x + side, y), D = pt(x, y);
    const E = pt(A.x, A.y - side / N);
    const M = intersect(A, Cpt, B, E);
    const AD = [], BC = [], BE = [], DF = [], AB = [], CD = [];
    for (let k = 0; k < N; k++) {
      AD.push(pt(A.x, A.y - (k + 1) * side / N));
      BC.push(pt(B.x, B.y - k * side / N));
    }
    const S = pt(side / (N + 1), side / (N * (N + 1)));
    for (let k = 0; k <= N; k++) {
      BE.push(pt(E.x + k * S.x, E.y + k * S.y));
      DF.push(pt(D.x + (k + 1) * S.x, D.y + (k + 1) * S.y));
    }
    for (let k = 0; k < N - 1; k++) {
      AB.push(pt(A.x + (k + 1) * side / N, A.y));
      CD.push(pt(Cpt.x - (k + 1) * side / N, Cpt.y));
    }
    const P = intersect(A, Cpt, D, BC[N - 1]);
    const dissection = [];
    for (let k = 0; k < N; k++) dissection.push([DF[k], BE[k + 1]]);
    for (let k = 1; k < N; k++) dissection.push([AD[k], BC[k]]);
    for (let k = 0; k < N - 1; k++) {
      dissection.push([DF[k], AD[AD.length - k - 2]]);
      dissection.push([BC[k + 1], BE[BE.length - k - 1]]);
    }
    for (let k = 0; k < N - 1; k++) {
      dissection.push([M, AB[k]]);
      dissection.push([P, CD[k]]);
    }
    return { side, A, B, C: Cpt, D, E, M, P, AD, BC, BE, DF, AB, CD, dissection };
  }
  function shoelace(points) {
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      s += p.x * q.y - q.x * p.y;
    }
    return Math.abs(s / 2);
  }

  const cases = [];
  for (let n = C.N_MIN; n <= C.N_MAX; n++) cases.push([n, 400, 400]);
  const rand = rng(777);
  for (let i = 0; i < 200; i++) {
    cases.push([
      2 + Math.floor(rand() * 19),
      220 + Math.floor(rand() * 700),
      220 + Math.floor(rand() * 700),
    ]);
  }

  let pointsMatch = true, arraysMatch = true, linesMatch = true, areasMatch = true;
  for (const [n, w, h] of cases) {
    const a = appletReset(n, w, h);
    const g = C.layout(n, a.side, w, h);
    for (const key of ["A", "B", "C", "D", "E", "M", "P"]) {
      pointsMatch &&= samePoint(g[key], a[key], 1e-7);
    }
    for (const key of ["AD", "BC", "BE", "DF", "AB", "CD"]) {
      arraysMatch &&= g[key].length === a[key].length &&
        g[key].every((p, i) => samePoint(p, a[key][i], 1e-7));
    }
    linesMatch &&= g.dissection.length === a.dissection.length &&
      g.dissection.every(([p, q], i) =>
        samePoint(p, a.dissection[i][0], 1e-7) && samePoint(q, a.dissection[i][1], 1e-7));

    const regions = [[a.A, a.M, a.E], [a.A, a.M, a.B], [a.B, a.M, a.C], [a.C, a.D, a.E, a.M]];
    const areas = regions.map(shoelace);
    const core = C.compute(C.start({ n, width: w, height: h }));
    const unit = a.side * a.side / (2 * n * (n + 1));
    areasMatch &&= areas.every((v, i) => C.close(v, core.areas[i], 1e-6)) &&
      areas.every((v, i) => C.close(v, unit * [1, n, n * n, n * n + n - 1][i], 1e-6));
  }
  check(`A,B,C,D,E,M,P match Reset for all ${cases.length} configurations`, pointsMatch);
  check(`all six point arrays match Reset for all ${cases.length} configurations`, arraysMatch);
  check(`every dissection segment matches ShowDissection for all ${cases.length} configurations`, linesMatch);
  check(`areas from the transcribed points obey the page's ratio on all ${cases.length} configurations`, areasMatch);

  const seven = appletReset(7, 400, 400);
  check("the transcription reproduces the applet's pixel truncation at N=7",
    seven.side === 357 && samePoint(seven.E, { x: 21.5, y: 21.5 + 357 - 51 }));
}

done("areas-in-square");
