#!/usr/bin/env node
"use strict";

/*
 * Logic test for circular-poggendorf/circular-poggendorf-core.js.
 *
 *   node porting/check-circular-poggendorf.mjs
 *
 * The page's exact claim is: "The parallel lines that obscure parts of a
 * circle break the circle off so that its pieces do not appear to fit
 * together." What can be checked is the geometric substrate: the applet draws
 * ONE circle with drawOval(W/2-R, H/2-R, 2R, 2R), paints a background strip
 * fillRect(X0, 0, Width, H-1) over it, then draws that rectangle's outline.
 * The two edges are parallel vertical lines; the cut ends of the visible arcs
 * lie on the same circle, symmetric about the horizontal centre line. The
 * "do not appear" part is perception and is deliberately not computed.
 *
 * Everything here is compared with a second, literal transcription of
 * CircularPoggendorfCanvas's constructor and Draw() from javap bytecode, over
 * thousands of parameter triples and configurations (including the page's own
 * params Radius=250, BarWidth=100, X0=200 in a 420x400 applet).
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("circular-poggendorf/circular-poggendorf-core.js", "CircularPoggendorfCore");

/* -------------------------- a second transcription, straight from the bytecode */

/** Constructor, offsets 14-161: three getParameter/parseInt/2 fields, else 200. */
function appletCanvas(params) {
  const p = params || {};
  const read = (name) => {
    const n = parseInt(p[name], 10);
    if (!Number.isFinite(n)) throw new Error("Integer.parseInt");
    return Math.trunc(n / 2); // Java's int / 2 truncates toward zero
  };
  try {
    return { radius: read("Radius"), barWidth: read("BarWidth"), x0: read("X0") };
  } catch {
    return { radius: 200, barWidth: 200, x0: 200 };
  }
}

/** Draw(), offsets 13-48: drawOval(W/2-R, H/2-R, 2R, 2R). */
function appletOval(radius, W, H) {
  return { x: Math.trunc(W / 2) - radius, y: Math.trunc(H / 2) - radius,
    width: 2 * radius, height: 2 * radius };
}

/** Draw(), offsets 59-102: fillRect/drawRect(X0, 0, Width, H-1). */
function appletBar(x0, width, H) {
  return { x: x0, y: 0, width: width, height: H - 1 };
}

/** Panel constructor: Scrollbar(0, V/2, 1, 2*V) for each page parameter. */
function appletScrollbar(pageValue) {
  const n = parseInt(pageValue, 10);
  const v = Number.isFinite(n) ? n : 200;
  return { value: Math.trunc(v / 2), min: 1, max: 2 * v };
}

const PAGE_CLAIM = "The parallel lines that obscure parts of a circle break the circle off " +
  "so that its pieces do not appear to fit together.";
const W = C.VIEW.width, H = C.VIEW.height, CX = C.CENTER.x, CY = C.CENTER.y;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* ---------------------------------------- 1. the page's parameters and ranges */

{
  equal("the page's params halved give the applet's three canvas fields",
    C.fromPageParams({ Radius: "250", BarWidth: "100", X0: "200" }),
    { radius: 125, barWidth: 50, x0: 100 });
  equal("the canvas fields match the second transcription of the constructor",
    C.fromPageParams({ Radius: "250", BarWidth: "100", X0: "200" }),
    appletCanvas({ Radius: "250", BarWidth: "100", X0: "200" }));
  equal("the start position is exactly the three scrollbar starting values", C.start(),
    { radius: 125, barWidth: 50, x0: 100, reveal: false, touches: 0 });
  equal("missing params fall back to 200 each, as the constructor's catch does",
    C.fromPageParams({}), { radius: 200, barWidth: 200, x0: 200 });
  equal("the page's radius scrollbar is 1..500 starting at 125",
    C.scrollbar("radius", "250"), { value: 125, min: 1, max: 500 });
  equal("the page's bar-width scrollbar is 1..200 starting at 50",
    C.scrollbar("barWidth", "100"), { value: 50, min: 1, max: 200 });
  equal("the page's X0 scrollbar is 1..400 starting at 100",
    C.scrollbar("x0", "200"), { value: 100, min: 1, max: 400 });
  equal("the core's clamps are the scrollbars' ranges", C.LIMITS,
    { radius: [1, 500], barWidth: [1, 200], x0: [1, 400] });
  equal("the page's claim is kept word for word", C.claims(C.start()).pageClaim, PAGE_CLAIM);
}

/* ---------------- 2. the param translation and the drawing, over many configs */

{
  const r = rng(20346);
  let halves = 0, ovals = 0, bars = 0, scb = 0, ranges = 0;
  for (let t = 0; t < 6000; t++) {
    const params = {
      Radius: String(2 + Math.floor(r() * 999)),
      BarWidth: String(2 + Math.floor(r() * 399)),
      X0: String(2 + Math.floor(r() * 799)),
    };
    const mine = C.fromPageParams(params);
    const theirs = appletCanvas(params);
    if (JSON.stringify(mine) === JSON.stringify(theirs)) halves++;
    for (const [name, key] of [["radius", "Radius"], ["barWidth", "BarWidth"], ["x0", "X0"]]) {
      if (JSON.stringify(C.scrollbar(name, params[key])) === JSON.stringify(appletScrollbar(params[key]))) scb++;
    }
    const state = C.start({ radius: mine.radius, barWidth: mine.barWidth, x0: mine.x0 });
    const g = C.geometry(state);
    if (JSON.stringify(g.oval) === JSON.stringify(appletOval(theirs.radius, W, H))) ovals++;
    if (JSON.stringify(g.bar) === JSON.stringify(appletBar(theirs.x0, theirs.barWidth, H))) bars++;
    if (state.radius >= 1 && state.radius <= 500 && state.barWidth >= 1 &&
        state.barWidth <= 200 && state.x0 >= 1 && state.x0 <= 400) ranges++;
  }
  equal("6000 random page triples: the core halves exactly like the constructor", halves, 6000);
  equal("18000 scrollbar values match the panel's Scrollbar(0, V/2, 1, 2V)", scb, 18000);
  equal("6000 circles: the core's oval is drawOval(W/2-R, H/2-R, 2R, 2R)", ovals, 6000);
  equal("6000 bars: the core's strip is fillRect/drawRect(X0, 0, Width, H-1)", bars, 6000);
  equal("all generated states are inside the applet's scrollbar ranges", ranges, 6000);
}

/* -------------------- 3. the circle, the two parallel edges and their cuts */

{
  const r = rng(777);
  let edged = 0, cutCircle = 0, cutEdges = 0, symmetric = 0, counts = 0, fits = 0;
  for (let t = 0; t < 8000; t++) {
    const state = C.start({ radius: 1 + Math.floor(r() * 500),
      barWidth: 1 + Math.floor(r() * 200), x0: 1 + Math.floor(r() * 400) });
    const g = C.geometry(state);
    const e0 = g.edges[0], e1 = g.edges[1];
    if (e0.x === state.x0 && e1.x === state.x0 + state.barWidth &&
        e0.y1 === e1.y1 && e0.y2 === e1.y2 && e1.x > e0.x) edged++;
    const cs = C.cuts(state);
    if (cs.every((p) => C.onCircle(state, p))) cutCircle++;
    if (cs.every((p) => p.x === e0.x || p.x === e1.x)) cutEdges++;
    if (g.edges.every((e) => {
      const ec = C.edgeCuts(state, e.x);
      return ec.length !== 2 || Math.abs(ec[0].y + ec[1].y - 2 * CY) < 1e-9;
    })) symmetric++;
    const expect = g.edges.reduce((n, e) => n + C.edgeCuts(state, e.x).length, 0);
    if (cs.length === expect) counts++;
    const cl = C.claims(state);
    if (cl.piecesFit && cl.edgesParallel && cl.cutsOnCircle && cl.cutsOnEdges && cl.cutsSymmetric &&
        cl.seemMisaligned === null) fits++;
  }
  equal("8000 configurations: the bar's two edges are parallel vertical lines", edged, 8000);
  equal("8000 configurations: every cut end lies on the circle", cutCircle, 8000);
  equal("8000 configurations: every cut end lies on one of the two edges", cutEdges, 8000);
  equal("8000 configurations: cut ends are symmetric about the centre line", symmetric, 8000);
  equal("8000 configurations: the cut count matches the edge-circle intersections", counts, 8000);
  equal("8000 configurations: all geometric claims hold; perception is not computed", fits, 8000);
}

/* ------------------------------------ 4. the interesting boundary cases */

{
  const tangent = C.start({ radius: 125, barWidth: 50, x0: CX + 125 });
  const tc = C.cuts(tangent);
  equal("a tangent left edge gives one cut at the circle's rightmost point", tc,
    [{ edge: "left", x: 335, y: 150 }]);
  check("the tangent strip misses the circle's interior", C.geometry(tangent).missesCircle ||
    tc.length === 1);

  const outside = C.start({ radius: 125, barWidth: 50, x0: 400 });
  equal("a strip wholly to the right of the circle has no cuts", C.cuts(outside), []);
  check("a strip wholly to the right of the circle is reported as missing",
    C.geometry(outside).missesCircle);

  const covering = C.start({ radius: 100, barWidth: 200, x0: 110 });
  check("a strip from x=110 to x=310 hides a circle of radius 100 completely",
    C.geometry(covering).hidesWholeCircle);
  equal("the fully hidden circle has no visible sample points",
    C.samples(covering, 720).filter((s) => s.visible).length, 0);
  check("the fully hidden circle's claim still says the pieces fit",
    C.claims(covering).piecesFit);

  const page = C.start();
  check("the page's own configuration shows four cut ends", C.cuts(page).length === 4);
  check("the page's configuration has visible pieces on both sides of the bar",
    C.samples(page, 720).some((s) => s.visible && s.point.x < page.x0) &&
    C.samples(page, 720).some((s) => s.visible && s.point.x > page.x0 + page.barWidth));
}

/* ----------------------------- 5. plain-data state handling and the handles */

{
  const s = C.start();
  const smaller = C.setParam(s, "radius", -5);
  equal("radius below the scrollbar's minimum clamps to 1", smaller.radius, 1);
  equal("the other parameters do not move", [smaller.barWidth, smaller.x0], [50, 100]);
  equal("setting a parameter does not mutate the old position",
    [s.radius, s.barWidth, s.x0, s.touches], [125, 50, 100, 0]);
  equal("radius above the scrollbar's maximum clamps to 500", C.setParam(s, "radius", 999).radius, 500);
  equal("bar width above 200 clamps to 200", C.setParam(s, "barWidth", 999).barWidth, 200);
  equal("X0 above 400 clamps to 400", C.setParam(s, "x0", 999).x0, 400);
  equal("a non-numeric parameter is refused", C.setParam(s, "radius", "nope"), s);
  equal("an unknown parameter is refused", C.setParam(s, "colour", 4), s);
  equal("the reveal toggle is plain data", C.setReveal(s, true).reveal, true);
  check("no configuration has a win or a loss",
    [s, smaller, C.setParam(s, "radius", 500), C.setReveal(s, true)]
      .every((p) => C.result(p) === null));

  const rh = C.radiusHandle(s);
  check("the radius handle sits on the circle at the fixed angle", C.onCircle(s, rh) &&
    Math.abs(Math.atan2(rh.y - CY, rh.x - CX) - C.HANDLE_ANGLE) < 1e-12);
  equal("dragging the radius handle out to 200 stops at the largest on-board circle",
    C.radiusFromPoint({ x: CX + 200, y: CY }), C.DRAG_MAX_RADIUS);
  check("the largest dragged circle still fits the drawing", C.DRAG_MAX_RADIUS <= CY &&
    C.DRAG_MAX_RADIUS <= CX && C.setParam(s, "radius", 500).radius === 500);
  const eh = C.edgeHandles(s);
  equal("the two edge handles sit at X0 and X0+Width",
    [eh[0].point.x, eh[1].point.x], [100, 150]);
  const moved = C.paramFromHandle(s, "x0", { x: 220, y: 14 });
  equal("dragging the left edge sets X0", [moved.name, moved.value], ["x0", 220]);
  const widened = C.paramFromHandle(s, "barWidth", { x: 250, y: 14 });
  equal("dragging the right edge sets the bar width", [widened.name, widened.value], ["barWidth", 150]);
  equal("an unknown handle changes nothing", C.paramFromHandle(s, "centre", { x: 0, y: 0 }), null);
  const clampL = C.clampEdgeHandle(s, "x0", { x: 500, y: 14 });
  check("the left-edge handle stays on the board", clampL.x <= W - 12 && clampL.y === C.EDGE_HANDLE_Y);
  const clampR = C.clampEdgeHandle(s, "barWidth", { x: 500, y: 14 });
  check("the right-edge handle stays on the board and keeps the width in range",
    clampR.x <= W - 12 && clampR.x - s.x0 <= 200 && clampR.x - s.x0 >= 1);
}

/* ---------------------------------------- 6. more samples of the whole circle */

{
  const r = rng(9182);
  let checked = 0;
  for (let t = 0; t < 3000; t++) {
    const state = C.start({ radius: 12 + Math.floor(r() * 138),
      barWidth: 1 + Math.floor(r() * 200), x0: 1 + Math.floor(r() * 300) });
    const sp = C.samples(state, 180);
    const cl = C.claims(state);
    if (sp.every((s) => C.onCircle(state, s.point)) &&
        sp.every((s) => s.visible === !C.inStrip(state, s.point)) &&
        cl.piecesFit && cl.pageClaim === PAGE_CLAIM) checked++;
  }
  equal("3000 circles: every sample is on one circle and 'visible' means outside the strip",
    checked, 3000);
}

done("circular-poggendorf");
