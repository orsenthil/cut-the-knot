#!/usr/bin/env node
"use strict";

/*
 * Logic test for carpet-with-hole/carpet-with-hole-core.js.
 *
 *   node porting/check-carpet-with-hole.mjs
 *
 * The page's claim is the equidecomposition: an NX by (NX-3) carpet with an
 * (NX-4) by 1 hole is cut into two equal staircase pieces that tile an
 * (NX-2) by (NX-2) square. Here the identity NX(NX-3)-(NX-4)=(NX-2)^2 is
 * checked for every integer NX, and the pieces are checked cell by cell both
 * in the carpet and after the slide, for all seven radio sizes and on 200
 * random boards. Reset(), Poly1(), Poly2(), DefineDist(), Draw() and
 * DrawOutline() are then transcribed a second time straight from javap -c and
 * compared point for point with the core on more than a thousand boards.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("carpet-with-hole/carpet-with-hole-core.js", "CarpetWithHoleCore");
const same = (p, q, tol = 1e-9) => C.close(p.x, q.x, tol) && C.close(p.y, q.y, tol);
const ok = (g) => Object.values(C.claims(g)).every(Boolean);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("opening picture is the 9x12 carpet with the grid on", s, {
    nx: 12, width: 400, height: 300,
    showGrid: true, shiftL: { x: 0, y: 0 }, shiftR: { x: 0, y: 0 },
    explored: false,
  });
  check("the opener is at the start, grid on, not yet assembled",
    !C.compute(s).assembled && C.compute(s).showGrid && !C.compute(s).explored);

  check("only the applet's seven radio sizes are accepted",
    C.move(s, { type: "nx", value: 6 }) !== null &&
    C.move(s, { type: "nx", value: 18 }) !== null &&
    C.move(s, { type: "nx", value: 7 }) === null &&
    C.move(s, { type: "nx", value: 20 }) === null &&
    C.move(s, { type: "nx", value: 12.5 }) === null);

  const size = C.move(s, { type: "nx", value: 18 });
  check("a size change relayouts and clears both pieces",
    size.nx === 18 && size.shiftL.x === 0 && size.shiftR.y === 0 &&
    size.showGrid === s.showGrid && !size.explored && C.compute(size).a === 12);

  const grid = C.move(s, { type: "grid", value: false });
  check("the grid checkbox flips alone and marks the picture explored",
    !grid.showGrid && grid.nx === s.nx && grid.explored &&
    C.move(s, { type: "grid", value: "yes" }) === null);
  check("reset relayouts at the same board size but keeps the grid setting",
    (() => {
      const r = C.move(grid, { type: "reset" });
      return r.nx === 12 && !r.showGrid && r.width === 400 && r.height === 300 &&
        !r.explored && C.compute(r).whole;
    })());

  const g = C.compute(s);
  const nearR = { x: g.mx + 2 * g.a + g.targetR.x, y: g.my + g.targetR.y };
  const slid = C.move(s, { type: "drag", name: "R", point: nearR });
  check("sliding the right piece two cells left and one up snaps into the square",
    slid.shiftR.x === -2 * g.a && slid.shiftR.y === -g.a &&
    C.compute(slid).assembled && slid.explored);
  const nearL = { x: g.mx + g.targetL.x, y: g.my + g.targetL.y };
  const slidL = C.move(s, { type: "drag", name: "L", point: nearL });
  check("sliding the left piece two cells right and one down also works",
    slidL.shiftL.x === 2 * g.a && slidL.shiftL.y === g.a &&
    C.compute(slidL).assembled);
  const loose = C.move(s, { type: "drag", name: "L", point: { x: g.mx + g.a, y: g.my } });
  check("a drag that is not near the snap target leaves a partial shift",
    loose.shiftL.x === g.a && loose.shiftL.y === 0 && !C.compute(loose).assembled);

  check("bad drags and unknown moves are refused",
    C.move(s, { type: "drag", name: "X", point: nearL }) === null &&
    C.move(s, { type: "drag", name: "L", point: { x: NaN, y: 0 } }) === null &&
    C.move(s, { type: "fly" }) === null && C.move(null, { type: "reset" }) === null);
  check("a drag outside the board is clamped back onto it",
    (() => {
      const d = C.move(s, { type: "drag", name: "L", point: { x: 9999, y: -9999 } });
      return d && d.shiftL.x === 400 - g.mx && d.shiftL.y === -g.my;
    })());
  check("the status sentence names the carpet, the hole and the square",
    C.describe(s).includes("9 by 12") && C.describe(s).includes("10 by 10") &&
    C.describe(slid).includes("10 by 10 square"));
}

/* ------------------------------- 2. the page's claim over every size ------- */

{
  check("the exact identity N(N-3)-(N-4)=(N-2)^2 holds for every whole N",
    Array.from({ length: 61 }, (_, i) => i + 4).every(
      (n) => n * (n - 3) - (n - 4) === (n - 2) * (n - 2)));
  check("N=12: a 108-cell rectangle minus an 8-cell hole is a 100-cell square",
    C.compute(C.start({})).rectArea === 108 &&
    C.compute(C.start({})).holeArea === 8 &&
    C.compute(C.start({})).carpetArea === 100 &&
    C.compute(C.start({})).squareArea === 100);

  let identity = true, halves = true, counts = true, grid = true, hole = true, size = true;
  let carpet = true, square = true;
  for (const nx of C.NX_OPTIONS) {
    const g = C.layout(nx, C.WIDTH, C.HEIGHT);
    const k = C.claims(g);
    identity &&= k.areaIdentity;
    halves &&= k.halfAreas;
    counts &&= k.vertexCount;
    grid &&= k.gridCount;
    hole &&= k.holeSize;
    size &&= k.positiveSize;
    carpet &&= k.startTiles;
    square &&= k.squareTiles;
  }
  check("the area identity holds for all seven radio sizes", identity);
  check("each of the two pieces has half the square's area, for all seven sizes", halves);
  check("both polygons have 4*((N-4)/2)+4 vertices, as Poly1/Poly2 build", counts);
  check("Draw() emits 3N-9 grid segments for all seven sizes", grid);
  check("the hole is (N-4) cells by 1 cell for all seven sizes", hole);
  check("the cell size is positive at the applet's 400x300 board for all sizes", size);
  check("the two pieces tile the cut carpet cell by cell, for all seven sizes", carpet);
  check("after the slide the same pieces tile the square cell by cell", square);

  const rand = rng(20261126);
  let boards = true, noOverlap = true;
  for (let i = 0; i < 200; i++) {
    const width = 200 + Math.floor(rand() * 600);
    const height = 180 + Math.floor(rand() * 500);
    for (const nx of C.NX_OPTIONS) {
      const g = C.layout(nx, width, height);
      boards &&= ok(g);
      const c = C.claims(g);
      noOverlap &&= c.startTiles && c.squareTiles && c.positiveSize;
    }
  }
  check("every claim holds on 200 random boards at all seven sizes", boards);
  check("both tilings are exact (no cell missed, none counted twice) on all 1400 cases", noOverlap);

  check("the snap targets are exactly (2A, A) and (-2A, -A)",
    C.NX_OPTIONS.every((nx) => {
      const g = C.layout(nx, C.WIDTH, C.HEIGHT);
      return g.targetL.x === 2 * g.a && g.targetL.y === g.a &&
        g.targetR.x === -2 * g.a && g.targetR.y === -g.a;
    }));
}

/* --------------- 3. a second transcription of the applet's own bytecode --- */

{
  const pt = (x, y) => ({ x, y });
  const div = (a, b) => Math.trunc(a / b);

  // CarpetWithHoleCanvas.Reset(), javap -c: size=getSize(); Margin=40;
  // A=min((w-80)/(NX+2),(h-80)/(NX-1)); MX=(w-NX*A)/2; MY=(h-(NX-3)*A)/2.
  function appletReset(NX, w, h) {
    const A = Math.min(div(w - 2 * 40, NX + 2), div(h - 2 * 40, NX - 1));
    return { A, MX: div(w - NX * A, 2), MY: div(h - (NX - 3) * A, 2) };
  }

  // Poly1(), javap -c, in AddPoint order.
  function appletPoly1(NX, A, MX, MY) {
    const k = div(NX - 4, 2), out = [];
    let x = MX, y = MY;
    const add = () => out.push(pt(x, y));
    add();
    for (let i = 0; i < k; i++) { x = x + 2 * A; add(); y = y + A; add(); }
    x = MX + 2 * A; add(); y = y + A; add();
    for (let i = 0; i < k; i++) { x = x + 2 * A; add(); y = y + A; add(); }
    x = MX; add();
    return out;
  }

  // Poly2(), javap -c, in AddPoint order.
  function appletPoly2(NX, A, MX, MY) {
    const k = div(NX - 4, 2), out = [];
    let x = MX + 2 * A, y = MY;
    const add = () => out.push(pt(x, y));
    add();
    for (let i = 0; i < k; i++) { y = y + A; add(); x = x + 2 * A; add(); }
    y = y + A; add();
    x = MX + 4 * A; add();
    for (let i = 0; i < k; i++) { y = y + A; add(); x = x + 2 * A; add(); }
    x = MX + NX * A; y = MY; add();
    return out;
  }

  // CarpetWithHoleCanvas$Poly.DefineDist(), javap -c: vertex count decides.
  function appletMinDist(NX) {
    const n = 4 * div(NX - 4, 2) + 4;
    if (n < 9) return 2;
    if (n < 13) return 3;
    if (n > 24) return 5;
    return 4;
  }

  // Draw(g), javap -c: three left verticals, NX-5 split verticals, NX-2 rows.
  function appletGrid(NX, A, MX, MY) {
    const k = div(NX - 4, 2), out = [];
    const line = (x1, y1, x2, y2) => [pt(x1, y1), pt(x2, y2)];
    for (let i = 0; i < 3; i++)
      out.push(line(MX + i * A, MY, MX + i * A, MY + (NX - 3) * A));
    for (let j = 0; j < NX - 5; j++) {
      const x = MX + (j + 3) * A;
      out.push(line(x, MY, x, MY + k * A));
      out.push(line(x, MY + (k + 1) * A, x, MY + (NX - 3) * A));
    }
    for (let j = 0; j < NX - 2; j++)
      out.push(line(MX, MY + j * A, MX + NX * A, MY + j * A));
    return out;
  }

  // DrawOutline(g), javap -c: the carpet and the one-cell-high hole.
  function appletHole(NX, A, MX, MY) {
    return {
      x: MX + 2 * A, y: MY + div(NX - 4, 2) * A,
      w: (NX - 4) * A, h: A,
    };
  }

  function shoelace(poly) {
    let s = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      s += p.x * q.y - q.x * p.y;
    }
    return Math.abs(s / 2);
  }

  const cases = [[6, 400, 300], [8, 400, 300], [10, 400, 300], [12, 400, 300],
    [14, 400, 300], [16, 400, 300], [18, 400, 300]];
  const rand = rng(4242);
  for (let i = 0; i < 200; i++) {
    cases.push([
      C.NX_OPTIONS[Math.floor(rand() * C.NX_OPTIONS.length)],
      200 + Math.floor(rand() * 600),
      180 + Math.floor(rand() * 500),
    ]);
  }

  let cells = true, p1s = true, p2s = true, grids = true, holes = true, dists = true, areas = true;
  for (const [nx, w, h] of cases) {
    const a = appletReset(nx, w, h);
    const g = C.layout(nx, w, h);
    cells &&= g.a === a.A && g.mx === a.MX && g.my === a.MY;

    const p1 = appletPoly1(nx, a.A, a.MX, a.MY), p2 = appletPoly2(nx, a.A, a.MX, a.MY);
    p1s &&= g.p1.length === p1.length && g.p1.every((p, i) => same(p, p1[i]));
    p2s &&= g.p2.length === p2.length && g.p2.every((p, i) => same(p, p2[i]));

    const grid = appletGrid(nx, a.A, a.MX, a.MY);
    grids &&= g.grid.length === grid.length &&
      g.grid.every(([p, q], i) => same(p, grid[i][0]) && same(q, grid[i][1]));
    holes &&= same(g.hole, appletHole(nx, a.A, a.MX, a.MY));
    dists &&= g.minDist === appletMinDist(nx);

    const want = (nx - 2) * (nx - 2) * a.A * a.A / 2;
    areas &&= C.close(shoelace(p1), want, 1e-6) && C.close(shoelace(p2), want, 1e-6);
  }
  check(`cell size and origin match Reset on all ${cases.length} boards`, cells);
  check(`every Poly1 vertex matches Poly1() on all ${cases.length} boards`, p1s);
  check(`every Poly2 vertex matches Poly2() on all ${cases.length} boards`, p2s);
  check(`every Draw() grid segment matches on all ${cases.length} boards`, grids);
  check(`the hole rectangle matches DrawOutline() on all ${cases.length} boards`, holes);
  check(`the snap tolerance matches DefineDist() on all ${cases.length} boards`, dists);
  check(`both transcribed polygons have (N-2)^2/2 cells of area on all ${cases.length} boards`, areas);

  const twelve = appletPoly1(12, 20, 80, 60);
  check("the transcription reproduces the applet's exact N=12 staircase",
    twelve.length === 20 && same(twelve[0], pt(80, 60)) &&
    same(twelve[1], pt(120, 60)) && same(twelve[2], pt(120, 80)) &&
    same(twelve[10], pt(120, 160)) && same(twelve[19], pt(80, 240)));
}

done("carpet-with-hole");
