#!/usr/bin/env node
"use strict";

/*
 * Logic test for bulging-lines/bulging-lines-core.js.
 *
 *   node porting/check-bulging-lines.mjs
 *
 * The second half of section 1 is a literal second transcription of
 * BulgingLinesCanvas.Draw(g, dx, dy), SetColors and init(), written straight
 * from `javap -c -p`: the 9x9 fillRect loop, the 8x8 BW table and fillOval
 * loop, and the eight vertical plus eight horizontal drawLine calls. It is
 * compared with the core over all 24 colour orders, all 19 radius values the
 * scrollbar can take, and many offsets and canvas sizes.
 *
 * The page says that GLWB lines appear to bulge away from the centre and
 * GLBW towards it, and that sliding the half-transparent top layer lets you
 * see the lines are straight. The perception itself cannot be measured by a
 * program. What can be measured — and is checked here over thousands of
 * configurations — is the geometric claim: every drawn line is a straight,
 * horizontal or vertical segment, the lines are equally spaced, and the top
 * layer is the same picture translated by whole canvas units.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("bulging-lines/bulging-lines-core.js", "BulgingLinesCore");

/* ------------------------------ the applet's own computation, transcribed */

const APPLET_BW = [
  [0, 1, 0, 1, 1, 0, 1, 0],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [0, 1, 0, 1, 1, 0, 1, 0],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [0, 1, 0, 1, 1, 0, 1, 0],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [0, 1, 0, 1, 1, 0, 1, 0],
];

function applet(opts, size) {
  // Constructor: Radius=20, N=9, BW=..., Colors[G,L,W,B] with alpha 128 twins.
  // init(): Side = min(width,height)/(N+1), X0=Y0=..., SetR(10),
  // SetColors(0,1,2,3), Reset() -> top layer at (0,0).
  const N = 9;
  let Radius = opts.radius;
  let TwoR = 2 * Radius;
  const Side = Math.trunc(Math.min(size.width, size.height) / (N + 1));
  const X0 = Math.trunc((size.width - N * Side) / 2);
  const Y0 = Math.trunc((size.height - N * Side) / 2);

  // BulgingLinesVPanel.itemStateChanged picks one of 24 SetColors calls.
  const letters = { G: 0, L: 1, W: 2, B: 3 };
  const [c0, c1, c2, c3] = [...opts.order].map((ch) => letters[ch]);

  // Draw(Graphics g, int dx, int dy). `base` is the (0,0) call of update().
  function Draw(dx, dy) {
    const base = dx === 0 && dy === 0;
    const squares = [], dots = [], lines = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        squares.push({
          i, j,
          x: X0 + dx + i * Side, y: Y0 + dy + j * Side,
          size: Side,
          color: (i + j) % 2 === 0 ? c0 : c1,
        });
      }
    }
    const K = Math.trunc((9 - N) / 2);
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const bit = APPLET_BW[K + i][K + j];
        dots.push({
          i, j,
          x: X0 + dx + (i + 1) * Side, y: Y0 + dy + (j + 1) * Side,
          r: Radius, color: bit === 0 ? c3 : c2, bit,
        });
      }
    }
    for (let i = 0; i < N - 1; i++) {
      const at = X0 + dx + (i + 1) * Side;
      lines.push({ i, dir: "v", x1: at, y1: Y0 + dy + Side, x2: at,
        y2: Y0 + dy + (N - 1) * Side, color: c1 });
    }
    for (let i = 0; i < N - 1; i++) {
      const at = Y0 + dy + (i + 1) * Side;
      lines.push({ i, dir: "h", x1: X0 + dx + Side, y1: at,
        x2: X0 + dx + (N - 1) * Side, y2: at, color: c1 });
    }
    return { dx, dy, squares, dots, lines, base };
  }
  return {
    Side, X0, Y0, Radius, TwoR, palette: [c0, c1, c2, c3],
    bw: APPLET_BW,
    layers: [Draw(0, 0), Draw(Math.trunc(opts.offset.x), Math.trunc(opts.offset.y))],
  };
}

const strip = (layer) => JSON.stringify({
  dx: layer.dx, dy: layer.dy, squares: layer.squares,
  dots: layer.dots, lines: layer.lines,
});
const samePicture = (state, size) => {
  const core = C.layout(state, size);
  const old = applet(state, size);
  return core.side === old.Side && core.x0 === old.X0 && core.y0 === old.Y0 &&
    core.radius === old.Radius && core.twoR === old.TwoR &&
    JSON.stringify(core.palette) === JSON.stringify(old.palette) &&
    JSON.stringify(core.bw) === JSON.stringify(old.bw) &&
    strip(core.layers[0]) === strip(old.layers[0]) &&
    strip(core.layers[1]) === strip(old.layers[1]);
};

/* --------------------------------------------- 1. defaults and slider ranges */

{
  equal("init() gives GLWB, radius 10 and an offset of (0,0)", C.start(), C.DEFAULTS);
  check("the applet's 24 checkbox orders are all present, in order",
    JSON.stringify(C.ORDERS) === JSON.stringify([
      "GLWB", "GLBW", "GWLB", "GWBL", "GBWL", "GBLW",
      "BLWG", "BLGW", "BWLG", "BWGL", "BGWL", "BGLW",
      "LBWG", "LBGW", "LGBW", "LGWB", "LWBG", "LWGB",
      "WBGL", "WBLG", "WLGB", "WLBG", "WGBL", "WGLB",
    ]));
  check("the 24 orders are distinct arrangements of G, L, W and B",
    new Set(C.ORDERS).size === 24 &&
    C.ORDERS.every((o) => [...o].sort().join("") === "BGLW"));
  check("the radius scrollbar runs from 2 to 19 with value 10",
    C.RADIUS_MIN === 2 && C.RADIUS_MAX === 19 && C.DEFAULTS.radius === 10);
  check("out-of-range radius and order are rejected or clamped", (() => {
    const s = C.start({ radius: 900, order: "ZZZZ", offset: { x: 3.9, y: -3.9 } });
    return s.radius === 19 && s.order === "GLWB" &&
      s.offset.x === 3 && s.offset.y === -3;
  })());
  check("withSetting returns a new position and leaves the old one alone", (() => {
    const s = C.start(), n = C.withSetting(s, "radius", 2);
    return s.radius === 10 && n.radius === 2 && s.order === n.order;
  })());
  check("the colours are the applet's grayscale values with alpha 128 on top",
    JSON.stringify(C.COLORS) === JSON.stringify([
      { rgb: [128, 128, 128], alpha: 255, topAlpha: 128 },
      { rgb: [192, 192, 192], alpha: 255, topAlpha: 128 },
      { rgb: [255, 255, 255], alpha: 255, topAlpha: 128 },
      { rgb: [0, 0, 0], alpha: 255, topAlpha: 128 },
    ]));
  check("GLWB maps colours to G=0, L=1, W=2, B=3",
    JSON.stringify(C.palette(C.start())) === "[0,1,2,3]");
  check("GLBW swaps W and B, as the page's two named orders do", (() => {
    const a = C.palette(C.start({ order: "GLWB" }));
    const b = C.palette(C.start({ order: "GLBW" }));
    return JSON.stringify(a) === "[0,1,2,3]" && JSON.stringify(b) === "[0,1,3,2]";
  })());
  check("an illustration has no win or loss", C.result(C.start()) === null);
  check("the default picture matches the bytecode transcription",
    samePicture(C.start(), { width: 400, height: 300 }));
}

/* ------------------- 2. the whole drawing, against the bytecode second */

{
  const named = [
    {}, { order: "GLBW" }, { order: "WGBL" }, { radius: 2 }, { radius: 19 },
    { offset: { x: 32, y: 0 } }, { offset: { x: -48, y: 37 } },
    { order: "BLWG", radius: 7, offset: { x: 20, y: -19 } },
  ];
  for (const opts of named) {
    check(`named picture ${JSON.stringify(opts)} matches the applet`,
      samePicture(C.start(opts), { width: 400, height: 300 }));
  }

  const sizes = [{ width: 400, height: 300 }, { width: 320, height: 320 },
    { width: 375, height: 281 }, { width: 900, height: 900 }];
  const offsets = [{ x: 0, y: 0 }, { x: 1, y: -1 }, { x: 13, y: 29 },
    { x: -32, y: 32 }, { x: 97, y: -83 }, { x: -127, y: -111 }];
  let compared = 0, ok = true;
  for (const size of sizes) {
    for (const order of C.ORDERS) {
      for (let radius = C.RADIUS_MIN; radius <= C.RADIUS_MAX; radius++) {
        for (const offset of offsets) {
          const state = C.start({ order, radius, offset });
          if (!samePicture(state, size)) {
            ok = false;
            console.error(`  mismatch at ${JSON.stringify({ order, radius, offset, size })}`);
            break;
          }
          compared++;
        }
      }
    }
  }
  check(`core and bytecode agree on all ${compared} order x radius x offset x canvas cases`, ok);
  check("every comparison found the same 81 squares, 64 dots and 16 lines", (() => {
    const L = C.layout(C.start(), { width: 400, height: 300 });
    return L.layers.every((layer) => layer.squares.length === 81 &&
      layer.dots.length === 64 && layer.lines.length === 16);
  })());
}

/* ------------------------------------------- 3. the page's geometric claim */

{
  let tested = 0, ok = true;
  for (const order of C.ORDERS) {
    for (let radius = C.RADIUS_MIN; radius <= C.RADIUS_MAX; radius++) {
      for (const offset of [{ x: 0, y: 0 }, { x: 15, y: -22 }, { x: -41, y: 33 }]) {
        const cl = C.claims(C.start({ order, radius, offset }), { width: 320, height: 320 });
        const all = ["straight", "perpendicular", "equalSpacing", "translation",
          "checkerboard", "dotsOnIntersections", "halfTransparent",
          "baseAtOrigin", "topAtOffset"];
        if (!all.every((key) => cl[key]) ||
            cl.counts.squares !== 81 || cl.counts.dots !== 64 || cl.counts.lines !== 16) {
          ok = false;
          console.error(`  failed claim at ${order} ${radius} ${JSON.stringify(offset)}: ${JSON.stringify(cl)}`);
          break;
        }
        tested++;
      }
    }
  }
  check(`the lines are straight and the top layer is a translation in ${tested} configurations`, ok);

  const a = C.claims(C.start({ order: "GLWB", offset: { x: 61, y: -29 } }), { width: 400, height: 300 });
  const b = C.claims(C.start({ order: "GLBW", offset: { x: 61, y: -29 } }), { width: 400, height: 300 });
  check("GLWB and GLBW share exactly the same straight-line geometry",
    JSON.stringify(a) === JSON.stringify(b));
  check("the grid really has 8 vertical and 8 horizontal lines per layer", (() => {
    const L = C.layout(C.start(), { width: 400, height: 300 });
    return L.layers.every((layer) =>
      layer.lines.filter((ln) => ln.dir === "v").length === 8 &&
      layer.lines.filter((ln) => ln.dir === "h").length === 8);
  })());
  check("the 8x8 dot pattern is the applet's own BW table", (() => {
    const L = C.layout(C.start(), { width: 400, height: 300 });
    return L.layers.every((layer) => layer.dots.every((dot) =>
      dot.bit === C.BW[dot.i][dot.j]));
  })());
  check("the circles sit on grid intersections, with diameter twice the radius", (() => {
    const L = C.layout(C.start({ radius: 17 }), { width: 400, height: 300 });
    return L.twoR === 34 && L.layers.every((layer) => layer.dots.every((dot) =>
      dot.r === 17 && dot.x === L.x0 + layer.dx + (dot.i + 1) * L.side &&
      dot.y === L.y0 + layer.dy + (dot.j + 1) * L.side));
  })());
  check("the two checkerboard colours alternate on every square", (() => {
    const cl = C.claims(C.start({ order: "WGBL" }), { width: 400, height: 300 });
    return cl.checkerboard;
  })());
  check("dragging the top layer never bends a line", (() => {
    const before = C.layout(C.start(), { width: 400, height: 300 }).layers[0].lines;
    const after = C.layout(C.start({ offset: { x: 57, y: -63 } }), { width: 400, height: 300 }).layers[0].lines;
    return JSON.stringify(before) === JSON.stringify(after) &&
      C.claims(C.start({ offset: { x: 57, y: -63 } }), { width: 400, height: 300 }).straight;
  })());
}

done("bulging-lines");
