#!/usr/bin/env node
"use strict";

/*
 * Logic test for impossible-trinomial/impossible-trinomial-core.js.
 *
 *   node porting/check-impossible-trinomial.mjs
 *
 * ImpossibleTrinomial is a drawing, not a game. The page's one claim is that
 * the fork shows "two rectangular prongs" on the left and "three cylinders"
 * on the right. The drawing is checked against a second, literal transcription
 * of ImpossibleTrinomialCanvas.init/Draw/ExtendFrom/DrawCover over 9,801
 * canvas sizes, then every one of the 6,600 scrollbar settings is checked for
 * the cover band, for the invariance of the fork under the band and for the
 * two-prong / three-cylinder structure.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("impossible-trinomial/impossible-trinomial-core.js", "ImpossibleTrinomialCore");
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const same = (label, actual, expected) => check(label, JSON.stringify(actual) === JSON.stringify(expected),
  `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the applet's canvas size (the page embeds 600 x 300)", [s.width, s.height], [600, 300]);
  equal("both scrollbars start at 1", [s.W, s.D], [1, 1]);
  equal("the two scrollbar ranges", [C.W_MIN, C.W_MAX, C.D_MIN, C.D_MAX], [1, 60, 1, 110]);
  check("the picture has no win or loss", !/\b(?:win|won|lose|lost)\b/i.test(C.describe(s)));
  check("start never changes its argument", s.W === 1 && s.D === 1);
  check("a W below the minimum clamps to 1", C.clampW(-40) === 1);
  check("a W above the maximum clamps to 60", C.clampW(999) === 60);
  check("a D below the minimum clamps to 1", C.clampD(0) === 1);
  check("a D above the maximum clamps to 110", C.clampD(999) === 110);
  equal("withW only changes W", C.withW(s, 999), { width: 600, height: 300, W: 60, D: 1 });
  equal("withD only changes D", C.withD(s, -2), { width: 600, height: 300, W: 1, D: 1 });
  equal("reset restores the default scrollbars", C.reset(C.withD(C.withW(s, 32), 80)), s);

  const g = C.geometry(s);
  equal("init: t = height / 7", g.t, 42);
  equal("init: X0 = X = t / 2 (integer division)", [g.X0, g.X], [21, 21]);
  equal("init: Y0 = height - 2t", g.Y0, 216);
  check("init: Y = t / sqrt(3)", near(g.Y, 42 / Math.sqrt(3)));
  equal("init: Z = width * 7 / 15", g.Z, 280);
  const expectedPoints = {
    p2: [63, 216],
    p3: [42, 216 - 42 / Math.sqrt(3)],
    p4: [105, 216 - 84 / Math.sqrt(3)],
    p5: [147, 216 - 84 / Math.sqrt(3)],
    p6: [168, 216 - 126 / Math.sqrt(3)],
    p7: [147, 216 - 168 / Math.sqrt(3)],
    p8: [126, 216 - 210 / Math.sqrt(3)],
  };
  check("the applet's local points p2..p8", Object.keys(expectedPoints).every((k) => {
    const p = g.points[k];
    const e = expectedPoints[k];
    return near(p.x, e[0]) && near(p.y, e[1], 1e-12);
  }));
}

/* ------------------------- 2. the page's claim: two prongs, three cylinders */

{
  const g = C.geometry(C.start({}));
  equal("Draw makes exactly three drawOval ends", g.ovals.length, 3);
  equal("ExtendFrom makes exactly six rails", g.rails.length, 6);
  equal("the ovals sit on rails p3, p6 and p8", g.ovals.map((o) => o.name), ["lower", "middle", "upper"]);
  check("each oval is centred on its rail", g.ovals.every((o, i) => {
    const rail = [g.rails[1], g.rails[3], g.rails[5]][i];
    return o.y === rail.from.y && o.w === Math.round(g.X) && o.h === Math.round(g.Y);
  }));
  check("the three cylinder ends are evenly spaced by 2Y",
    near(Math.abs(g.ovals[1].y - g.ovals[0].y), 2 * g.Y, 1)
      && near(Math.abs(g.ovals[2].y - g.ovals[1].y), 2 * g.Y, 1));

  // The lower prong is closed by the one-stroke cap p2--p3. The upper prong
  // is the little quadrilateral p4--p7--p6--p5, whose bottom edge is the rail
  // starting at p4 (which runs through p5). No third left-hand end is drawn.
  const caps = g.strokes.filter((s) => s.name === "lower-end");
  const quad = g.strokes.filter((s) => ["upper-left", "notch-lower", "notch-upper"].includes(s.name));
  equal("one oblique cap closes the lower prong", caps.length, 1);
  check("the lower cap joins the first two rails", caps[0].a === g.points.p2 && caps[0].b === g.points.p3);
  equal("three oblique strokes close the upper prong", quad.length, 3);
  check("the upper cap is p4--p7--p6--p5", quad[0].a === g.points.p4 && quad[0].b === g.points.p7
    && quad[1].a === g.points.p5 && quad[1].b === g.points.p6
    && quad[2].a === g.points.p6 && quad[2].b === g.points.p7);
  check("the rail from p4 runs through p5, closing that quadrilateral",
    g.points.p4.y === g.points.p5.y && g.points.p5.x > g.points.p4.x
      && g.rails[2].from.x <= g.points.p5.x && g.rails[2].to.x >= g.points.p5.x);
  check("all five oblique strokes are the applet's five", g.strokes.length === 5
    && g.strokes.filter((s) => s.name === "long-edge").length === 1);
}

/* ------------------- 3. a second transcription of the applet's own methods */

/* Straight from javap -c -p ImpossibleTrinomialCanvas: no helper is shared
 * with the core except Math (Java Math.round and integer division are written
 * out here again). Local slots 2..8 are called P[2]..P[8] as in the bytecode. */
function appletPicture(width, height) {
  const size = { width, height };
  const t = Math.trunc(size.height / 7); // idiv
  const X0 = Math.trunc(t / 2); // int division, then i2d
  const Y0 = size.height - 2 * t;
  const X = Math.trunc(t / 2);
  const Y = t / Math.sqrt(3);
  const Z = Math.trunc(size.width * 7 / 15);

  const P = [];
  P[2] = { x: X0 + 2 * X, y: Y0 };
  P[3] = { x: X0 + X, y: Y0 - Y };
  P[4] = { x: X0 + 4 * X, y: Y0 - 2 * Y };
  P[5] = { x: P[4].x + 2 * X, y: P[4].y };
  P[6] = { x: P[5].x + X, y: P[5].y - Y };
  P[7] = { x: P[6].x - X, y: P[6].y - Y };
  P[8] = { x: X0 + 5 * X, y: Y0 - 5 * Y };

  // ExtendFrom(Graphics, DoubPoint, length): drawLine(round(x), round(y),
  // round(x + length), round(y)).
  function extend(index, length) {
    return {
      from: { x: Math.round(P[index].x), y: Math.round(P[index].y) },
      to: { x: Math.round(P[index].x + length), y: Math.round(P[index].y) },
    };
  }
  const rails = [
    extend(2, Z + 7 * X), extend(3, Z + 8 * X), extend(4, Z + 6 * X),
    extend(6, Z + 3 * X), extend(7, Z + 5 * X), extend(8, Z + 6 * X),
  ];

  // Three drawOval calls at the ends of rails 3, 6 and 8.
  function oval(index, shift) {
    return {
      x: Math.round(P[index].x + Z + shift * X + X / 2),
      y: Math.round(P[index].y),
      w: Math.round(X),
      h: Math.round(Y),
    };
  }
  const ovals = [oval(3, 7), oval(6, 2), oval(8, 5)];
  return { t, X0, Y0, X, Y, Z, P, rails, ovals };
}

function appletCover(width, height, W, D) {
  const size = { width, height };
  const band = Math.trunc(size.width * W / 100);
  const x = Math.trunc((size.width - band) * D / 100);
  return { x, y: 0, width: band, height: size.height - 1 };
}

{
  let wrong = 0;
  let cases = 0;
  for (let w = 60; w <= 900; w += 7) {
    for (let h = 40; h <= 600; h += 7) {
      const s = C.start({ width: w, height: h });
      const g = C.geometry(s);
      const a = appletPicture(w, h);
      const corePoints = Object.keys(a.P).map((k) => g.points["p" + k]);
      const samePoints = a.P[2].x === g.points.p2.x && a.P[8].y === g.points.p8.y
        && corePoints.every((p, i) => p !== undefined)
        && JSON.stringify([2, 3, 4, 5, 6, 7, 8].map((k) => [a.P[k].x, a.P[k].y]))
          === JSON.stringify([2, 3, 4, 5, 6, 7, 8].map((k) => [g.points["p" + k].x, g.points["p" + k].y]));
      if (!samePoints || !near(a.X, g.X) || !near(a.Y, g.Y) || !near(a.Z, g.Z)
        || JSON.stringify(a.rails) !== JSON.stringify(g.rails.map(({ from, to }) => ({ from, to })))
        || JSON.stringify(a.ovals) !== JSON.stringify(g.ovals.map(({ x, y, w: ow, h: oh }) => ({ x, y, w: ow, h: oh })))) {
        wrong++;
      }
      cases++;
    }
  }
  check(`the core matches bytecode Draw on all ${cases} canvas sizes`, wrong === 0, `${wrong} wrong`);
  equal("the exhaustive size sweep ran 9,801 pictures", cases, 9801);

  // The original page embeds the applet at 600 x 300, so check that exact
  // canvas with the second transcription too, including the raw drawOval args.
  const g = C.geometry(C.start({}));
  const a = appletPicture(600, 300);
  same("six rails at 600 x 300", g.rails.map(({ from, to }) => ({ from, to })), a.rails);
  same("three ovals at 600 x 300", g.ovals.map(({ x, y, w, h }) => ({ x, y, w, h })), a.ovals);
  same("the lower oval reaches column 479.5 (rounded 480)", g.ovals[0].x, Math.round(42 + 280 + 7 * 21 + 10.5));
}

/* --------------------------------- 4. every scrollbar setting, exhaustively */

{
  let coverWrong = 0;
  let changedGeometry = 0;
  const base = JSON.stringify(C.geometry(C.start({ W: 1, D: 1 })).rails.map(({ from, to }) => ({ from, to })));
  const reference = JSON.stringify(C.geometry(C.start({ W: 1, D: 1 })).ovals.map(({ x, y, w, h }) => ({ x, y, w, h })));
  for (let W = C.W_MIN; W <= C.W_MAX; W++) {
    for (let D = C.D_MIN; D <= C.D_MAX; D++) {
      const s = C.start({ W, D });
      if (JSON.stringify(C.cover(s)) !== JSON.stringify(appletCover(600, 300, W, D))) coverWrong++;
      const g = C.geometry(s);
      if (JSON.stringify(g.rails.map(({ from, to }) => ({ from, to }))) !== base
        || JSON.stringify(g.ovals.map(({ x, y, w, h }) => ({ x, y, w, h }))) !== reference) changedGeometry++;
    }
  }
  check("DrawCover matches bytecode on all 60 x 110 = 6,600 settings", coverWrong === 0, `${coverWrong} wrong`);
  check("the cover never changes the fork's lines or ovals", changedGeometry === 0, `${changedGeometry} changed`);
  check("the cover band never has a negative width", C.cover(C.start({ W: 1, D: 1 })).width > 0);
  same("at W = 60 the band covers 60 percent of 600", C.cover(C.start({ W: 60, D: 1 })).width, 360);
  same("at D = 100 the band is flush with the right edge", C.cover(C.start({ W: 37, D: 100 })).x, 600 - 222);
  check("at D = 110 a narrow band slides completely past the fork", C.cover(C.start({ W: 1, D: 110 })).x >= 600);
  check("at D = 110 a wide band still hides part of the picture", C.cover(C.start({ W: 60, D: 110 })).x < 600);
  check("at D = 1 the band starts at the left edge", C.cover(C.start({ W: 60, D: 1 })).x === 2);
  check("the band always covers at most W = 60 percent", C.cover(C.start({ W: 999, D: 1 })).width === 360);

  // Status words must say what changed, not just print the numbers.
  check("an uncovered fork is described as two prongs and three tubes",
    /two flat prongs/.test(C.describe(C.start({ W: 1, D: 110 })))
      && /three round tubes/.test(C.describe(C.start({ W: 1, D: 110 }))));
  check("a covered fork is described in words", /hides columns/.test(C.describe(C.start({ W: 40, D: 30 }))));
}

done("impossible-trinomial");
