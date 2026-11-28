#!/usr/bin/env node
"use strict";

/*
 * Logic test for illusion/illusion-core.js.
 *
 *   node porting/check-illusion.mjs
 *
 * The live cut-the-knot page (checked 27 November 2026) still embeds the Java
 * applet and says: "Parallel lines appear to break the transversals off. The
 * closer the inclination of the lines in the two families, the more pronounced
 * is the effect." The first half is about geometry: both families are straight
 * lines, and the hidden pieces continue on exactly the same line. The second
 * half is about perception: no coordinate can measure how strong the effect
 * looks, so it is reported as null and is not faked.
 *
 * Every drawing is compared with a second, literal transcription of
 * IllusionCanvas.DrawLines/DrawOcclusion and DoubLine.Draw from javap bytecode,
 * exhaustively over all 76 angles x 46 gaps, all 81 spacings x 86 widths, and
 * 4000 further random configurations. The page's angular-separation claim is
 * checked for every angle; the collinearity claim for every configuration.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("illusion/illusion-core.js", "IllusionCore");

const PAGE_CLAIM = "Parallel lines appear to break the transversals off. " +
  "The closer the inclination of the lines in the two families, the more pronounced is the effect.";
const W = C.VIEW.width, H = C.VIEW.height;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const samePoint = (a, b) => near(a.x, b.x) && near(a.y, b.y);

/* -------------------------- a second transcription, straight from the bytecode */

/** IllusionPanel: Scrollbar(HORIZONTAL, value, visible, minimum, maximum). */
function appletScrollbar(args) {
  return { value: args[1], visible: args[2], min: args[3], max: args[4] };
}

/** DoubLine.Draw, offsets 51-364: clip an infinite line to the bounds rect. */
function javapClip(a, b, r) {
  if (Math.abs(a.x - b.x) < 0.1) {
    const x = Math.round(a.x);
    return [{ x, y: r.y0 }, { x, y: r.y1 }];
  }
  const m = (b.y - a.y) / (b.x - a.x);
  if (Math.abs(m) < 1) {
    return [
      { x: r.x0, y: Math.round(a.y + m * (r.x0 - a.x)) },
      { x: r.x1, y: Math.round(a.y + m * (r.x1 - a.x)) },
    ];
  }
  return [
    { x: Math.round(a.x + (r.y0 - a.y) / m), y: r.y0 },
    { x: Math.round(a.x + (r.y1 - a.y) / m), y: r.y1 },
  ];
}

/** IllusionCanvas.DrawLines + DrawLine, with the three calls made per x. */
function appletLines(st) {
  const rad = st.angle * 3.141592653589793 / 180;
  const spacing = st.dist / Math.sin(rad);
  const along = st.dist / Math.tan(rad);
  const offX = along * Math.cos(rad);
  const offY = along * Math.sin(rad);
  const bounds = { x0: 0, y0: 0, x1: W, y1: H };
  const out = [];
  for (let sx = -2 * W; sx <= 2 * W; sx += spacing) {
    const calls = [
      [sx, offX, H / 2, offY],
      [sx + 1, offX, H / 2, offY],
      [sx + 1, offX, H / 2 + 1, offY],
    ];
    for (const [a, b, c, d] of calls) {
      const p = { x: a + b, y: c - d + 1 };
      const q = { x: a - b, y: c + d + 1 };
      out.push({ p, q, ends: javapClip(p, q, bounds) });
    }
  }
  return out;
}

/** IllusionCanvas.DrawOcclusion, offsets 0-68: red full-height fillRects. */
function appletBars(st) {
  const half = Math.trunc(st.width / 2);
  const out = [];
  for (let x = Math.trunc(-st.space / 2); x < W + st.space; x += st.space) {
    out.push({ x: x - half, y: 0, width: 2 * half, height: H });
  }
  return out;
}

function sameGeometry(st) {
  const mine = C.geometry(st);
  const theirs = appletLines(st);
  if (mine.lines.length !== theirs.length) return false;
  for (let i = 0; i < theirs.length; i++) {
    const a = mine.lines[i], b = theirs[i];
    if (!samePoint(a.p, b.p) || !samePoint(a.q, b.q) ||
        !samePoint(a.clipped[0], b.ends[0]) || !samePoint(a.clipped[1], b.ends[1])) return false;
  }
  const bars = appletBars(st);
  return mine.bars.length === bars.length &&
    mine.bars.every((b, i) => samePoint(b, bars[i]) && b.width === bars[i].width);
}

/* ---------------------------------------- 1. page parameters, four scrollbars */

{
  equal("the live page's colours parse as black foreground on white background",
    C.pageColors({ fcolor: "000000", bcolor: "ffffff" }),
    { background: 0xffffff, foreground: 0x000000 });
  equal("the constructors' catch keeps lightGray and black", C.pageColors({}),
    { background: 0xc0c0c0, foreground: 0x000000 });
  equal("Dist scrollbar matches its five constructor ints", C.scrollbar([0, 20, 5, 5, 50]), C.SCROLLBARS.dist);
  equal("Angle scrollbar matches its five constructor ints", C.scrollbar([0, 60, 5, 15, 90]), C.SCROLLBARS.angle);
  equal("Space scrollbar matches its five constructor ints", C.scrollbar([0, 50, 5, 20, 100]), C.SCROLLBARS.space);
  equal("Width scrollbar matches its five constructor ints", C.scrollbar([0, 30, 5, 5, 90]), C.SCROLLBARS.width);
  equal("the canvas fields start at the four scrollbar values", C.start(),
    { dist: 20, angle: 60, space: 50, width: 30, reveal: false, touches: 0 });
  equal("the core's clamps are the four scrollbars' ranges", C.LIMITS,
    { dist: [5, 50], angle: [15, 90], space: [20, 100], width: [5, 90] });
  equal("the page's claim is kept word for word", C.claims(C.start()).pageClaim, PAGE_CLAIM);
}

/* ---------------- 2. exhaustive drawing comparison: angle x gap, space x width */

{
  let pairs = 0, spaced = 0;
  for (let angle = 15; angle <= 90; angle++) {
    for (let dist = 5; dist <= 50; dist++) {
      const st = C.start({ angle, dist });
      if (sameGeometry(st)) pairs++;
    }
  }
  equal("all 76 angles x 46 gaps give exactly the applet's transversals", pairs, 76 * 46);

  for (let space = 20; space <= 100; space++) {
    for (let width = 5; width <= 90; width++) {
      const st = C.start({ space, width });
      if (sameGeometry(st)) spaced++;
    }
  }
  equal("all 81 spacings x 86 widths give exactly the applet's bars", spaced, 81 * 86);
}

/* --------------------- 3. further random configurations and the page's claims */

{
  const r = rng(5592);
  let configs = 0, straight = 0, collinear = 0, perceived = 0, pooled = 0;
  for (let i = 0; i < 4000; i++) {
    const st = C.start({
      dist: 5 + Math.floor(r() * 46),
      angle: 15 + Math.floor(r() * 76),
      space: 20 + Math.floor(r() * 81),
      width: 5 + Math.floor(r() * 86),
      reveal: r() < 0.5,
    });
    if (sameGeometry(st)) configs++;
    const cl = C.claims(st);
    if (cl.parallel && cl.clippedStraight && cl.verticalBars) straight++;
    if (cl.onOneLine) collinear++;
    if (cl.perceivedStrength === null && cl.pageClaim === PAGE_CLAIM) perceived++;
    if (C.geometry(st).lines.length <= C.maxLineCount() &&
        C.geometry(st).bars.length <= C.maxBarCount()) pooled++;
  }
  equal("4000 random configurations match the bytecode's lines and bars", configs, 4000);
  equal("4000 configurations: both families are straight, clipped lines stay on them", straight, 4000);
  equal("4000 configurations: hidden and visible pieces lie on one straight line", collinear, 4000);
  equal("4000 configurations: perception is not measured and the claim is verbatim", perceived, 4000);
  equal("4000 configurations: the UI's shape pools are always large enough", pooled, 4000);
}

/* --------------------------- 4. the page's inclination claim, checked by angle */

{
  let monotone = 0;
  for (let angle = 15; angle < 90; angle++) {
    const here = C.claims(C.start({ angle })).inclinationGap;
    const next = C.claims(C.start({ angle: angle + 1 })).inclinationGap;
    if (here === 90 - angle && next === here - 1) monotone++;
  }
  equal("all 75 steps: tilting towards vertical brings the families closer", monotone, 75);
  equal("at angle 90 the two inclinations agree exactly",
    C.claims(C.start({ angle: 90 })).inclinationGap, 0);
  equal("at the smallest angle the families are 75 degrees apart",
    C.claims(C.start({ angle: 15 })).inclinationGap, 75);
  check("the page's perceptual 'more pronounced' is left to the eye, not computed",
    C.claims(C.start()).perceivedStrength === null);
  const page = C.claims(C.start());
  check("the page's own picture has both visible and hidden parts of the lines",
    page.visibleCount > 0 && page.hiddenCount > 0);
  equal("the representative transversal meets the board centre", C.lineY(C.start(), C.CENTER.x), C.CENTER.y);
}

/* --------------------------------------- 5. plain-data state and the handles */

{
  const s = C.start();
  equal("a low gap clamps to the scrollbar minimum", C.setParam(s, "dist", -7).dist, 5);
  equal("a high angle clamps to the scrollbar maximum", C.setParam(s, "angle", 999).angle, 90);
  equal("spacing clamps to 20..100", [C.setParam(s, "space", 1).space, C.setParam(s, "space", 999).space], [20, 100]);
  equal("bar width clamps to 5..90", [C.setParam(s, "width", 1).width, C.setParam(s, "width", 999).width], [5, 90]);
  equal("an unknown or nonnumeric option is refused",
    [C.setParam(s, "colour", 4), C.setParam(s, "dist", "nope")], [s, s]);
  equal("changing an option does not mutate the old position",
    [s.dist, s.angle, s.space, s.width, s.touches], [20, 60, 50, 30, 0]);
  check("the reveal toggle is plain data", C.setReveal(s, true).reveal && !s.reveal);
  check("an illustration has no win, loss or finished play",
    [s, C.setParam(s, "angle", 90), C.setReveal(s, true)].every((p) => C.result(p) === null));

  let angles = 0, spacings = 0;
  for (let angle = 15; angle <= 90; angle++) {
    const p = C.angleHandle({ angle });
    if (C.angleFromPoint(p) === angle && Math.abs(Math.hypot(p.x - C.CENTER.x, p.y - C.CENTER.y) - C.HANDLE_RADIUS) < 1e-9) angles++;
  }
  equal("all 76 angles round-trip through the draggable angle point", angles, 76);
  for (let angle = 15; angle <= 90; angle += 3) {
    for (let dist = 5; dist <= 50; dist++) {
      const st = C.start({ angle, dist });
      const p = C.spacingHandle(st);
      if (C.distFromPoint(st, p) === dist && p.y === C.CENTER.y) spacings++;
    }
  }
  equal("all 26x46 slants and gaps round-trip through the spacing point", spacings, 26 * 46);
  const ca = C.clampAngleHandle({ x: -100, y: 500 });
  check("the angle point stays on its circle and inside the scrollbar range",
    C.angleFromPoint(ca) >= 15 && C.angleFromPoint(ca) <= 90 &&
    Math.abs(Math.hypot(ca.x - C.CENTER.x, ca.y - C.CENTER.y) - C.HANDLE_RADIUS) < 1e-9);
  const cs = C.clampSpacingHandle(s, { x: 1000, y: 123 });
  check("the spacing point stays on the middle line and in range",
    cs.y === C.CENTER.y && C.distFromPoint(s, cs) <= 50 && C.distFromPoint(s, cs) >= 5);
  equal("an unknown handle changes nothing", C.paramFromHandle(s, "corner", { x: 0, y: 0 }), null);
  equal("dragging the angle point sets the angle", C.paramFromHandle(s, "angle", C.angleHandle({ angle: 30 })).value, 30);
  equal("dragging the spacing point sets the gap", C.paramFromHandle(s, "spacing", C.spacingHandle({ angle: 60, dist: 40 })).value, 40);
  equal("the two labelled handles are the ones the page draws", C.handles(s).map((h) => h.name), ["angle", "spacing"]);
}

done("illusion");
