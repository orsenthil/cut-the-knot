#!/usr/bin/env node
"use strict";

/*
 * Logic test for lemma/lemma-core.js.
 *
 *   node porting/check-lemma.mjs
 *
 * The cut-the-knot article makes these claims: Euclid II.10 in the forms
 * (2m+n)^2 + n^2 = 2(m^2+(m+n)^2) and (a+b)^2+(a-b)^2 = 2(a^2+b^2); and
 * Archimedes Proposition 14, that the salinon's area equals the circle on CF.
 * Its proof also asserts EA^2+AD^2 = 2(EO^2+OA^2), CF = OA+EO = EA,
 * AB^2+DE^2 = 2(CF^2+AD^2), and the semicircle/square area identity.
 * Every one is checked for all 111 integral values of AD = BE the applet can
 * draw, plus 2000 random pairs for Euclid's algebra.
 *
 * The second transcription below is taken straight from LemmaCanvas.init,
 * DoubLine.CreateMidPoint/UpdateMidPoint, DrawLemma and FillLemma1/2: the
 * min() rectangle, the 0.3 point on A..O (NOT on all of AB), the truncation to
 * whole pixels, the four arc bounding boxes, the oval on CF, the projection
 * that recovers m_T, and PointIsEligible's strict upper-half region.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("lemma/lemma-core.js", "LemmaCore");
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const PI = Math.PI;

/* ------------- a second transcription, straight from the Java bytecode ----- */

/** init(): side = min(width-2m, height-2m); rect = (m, height-m-side, side, side). */
function appletRect(width, height, margin) {
  const side = Math.min(width - 2 * margin, height - 2 * margin);
  return { x: margin, y: height - margin - side, width: side, height: side };
}

/** DoubLine.init: m_1 = A = (rect.x, base), m_2 = O = (rect.x+side/2, base). */
function appletLine(rect) {
  const base = rect.y + rect.height / 2;
  return [{ x: rect.x, y: base }, { x: rect.x + rect.width / 2, y: base }];
}

/** DoubLine.CreateMidPoint(t): p = m_1*t + m_2*(1-t). */
function appletCreateMidPoint(line, t) {
  return {
    x: line[0].x * t + line[1].x * (1 - t),
    y: line[0].y * t + line[1].y * (1 - t),
  };
}

function dot(ax, ay, bx, by) { return ax * bx + ay * by; }

/** DoubLine.UpdateMidPoint(p): m_T = -dot(m_1-m_2, m_2-p)/dot(m_1-m_2,m_2-m_2). */
function appletUpdateT(line, p) {
  const dx = line[0].x - line[1].x;
  const dy = line[0].y - line[1].y;
  const t = -dot(dx, dy, line[1].x - p.x, line[1].y - p.y) / dot(dx, dy, dx, dy);
  return line[1].x >= line[0].x ? Math.max(0, Math.min(1, t)) : t; // RestrictToSegment(true)
}

/** PointIsEligible(x, y): x > rect.x+2, y > rect.y, x < right, y < base-2. */
function appletEligible(rect, x, y) {
  return x > rect.x + 2 && y > rect.y &&
    x < rect.x + rect.width && y < rect.y + rect.height / 2 - 2;
}

/** DrawLemma: the (int) cast of point.x - rect.x, and the four arc boxes. */
function appletBoxes(rect, point) {
  const L = Math.trunc(point.x - rect.x);
  const base = rect.y + rect.height / 2;
  const de = rect.width - 2 * L;
  return {
    L: L,
    left: { x: rect.x, y: base - L / 2, w: L, h: L, start: 0 },
    right: { x: rect.x + rect.width - L, y: base - L / 2, w: L, h: L, start: 0 },
    bottom: { x: rect.x + L, y: base - de / 2, w: de, h: de, start: 180 },
    circle: {
      x: rect.x + L / 2, y: rect.y,
      w: rect.height - L, h: rect.height - L,
    },
  };
}

/** FillLemma2: the circle has diameter height-L and its vertical diameter is CF. */
function appletCF(rect, L) {
  return rect.height - L;
}

/* ---------------------------------------- 1. the applet's own constants ----- */

{
  const r = appletRect(C.WIDTH, C.HEIGHT, C.MARGIN);
  check("the board is 360 x 240 with a margin of 10",
    C.WIDTH === 360 && C.HEIGHT === 240 && C.MARGIN === 10);
  check("the rectangle follows init() exactly", JSON.stringify(C.RECT) === JSON.stringify(r));
  check("the drawing side is min(w-2m, h-2m) = 220",
    C.SIDE === 220 && C.SIDE === r.width && C.SIDE === r.height);
  check("AB lies on the middle of the rectangle", C.BASE_Y === r.y + r.height / 2);
  check("the point slides on A..O, the left half of AB", C.HALF === 110);
  check("the point starts at CreateMidPoint(0.3)",
    C.START_T === 0.3 && C.start({}).t === 0.3);
}

/* --------------------------- 2. start, state, and the saved position -------- */

{
  const s = C.start({});
  check("start is plain data and nothing more", JSON.stringify(s) === '{"t":0.3}');
  check("the start drives only from its options",
    JSON.stringify(C.start({ t: 0.72 })) === JSON.stringify(C.start({ t: 0.72 })));
  const moved = C.setT(s, 0.8);
  check("setT returns a new state and leaves the old one alone",
    s.t === 0.3 && moved.t === 0.8 && moved !== s);
  check("a bad t falls back to CreateMidPoint's 0.3",
    C.clampT(undefined) === 0.3 && C.clampT(NaN) === 0.3);
  check("t is clamped to the segment A..O",
    C.clampT(-9) === 0 && C.clampT(9) === 1 && C.pointX(C.setT(s, -9)) === 120 &&
    C.pointX(C.setT(s, 9)) === 10);
  const p = C.position(s);
  check("the saved position is JSON-safe and has the drawn quantities",
    JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))) &&
    p.t === 0.3 && p.L === 77 && p.cf === 143 && p.de === 66 &&
    near(p.salinon, p.circleArea, 1e-5));
}

/* ------------------- 3. the point: CreateMidPoint and UpdateMidPoint -------- */

{
  const rect = appletRect(C.WIDTH, C.HEIGHT, C.MARGIN);
  const line = appletLine(rect);
  let created = true, inverted = true, lengths = true;
  for (let i = 0; i <= 1000; i++) {
    const t = i / 1000;
    const p = appletCreateMidPoint(line, t);
    const g = C.geometry(C.setT({}, t));
    created = created && near(g.point.x, p.x) && near(g.point.y, p.y);
    inverted = inverted && near(C.setPointX({}, p.x).t, appletUpdateT(line, p))
      && near(C.setPointX({}, p.x).t, t, 1e-9);
    // At an exact integer pixel, binary round-off can put the double a hair
    // below it; the core snaps that one-pixel boundary, as the page's handle
    // always sits on a whole pixel.
    lengths = lengths && Math.abs(C.lengthAD(t) - Math.trunc(p.x - rect.x)) <= 1;
  }
  check("the core's point is DoubLine.CreateMidPoint at 1001 positions", created);
  check("setPointX inverts DoubLine.UpdateMidPoint at 1001 positions", inverted);
  check("AD = (int)(point.x - rect.x) within one pixel at 1001 positions", lengths);

  const random = rng(1492);
  let projected = true;
  for (let i = 0; i < 2000; i++) {
    const px = rect.x + random() * C.HALF;
    const t1 = C.setPointX({}, px).t;
    const t2 = appletUpdateT(line, { x: px, y: C.BASE_Y });
    projected = projected && near(t1, t2, 1e-9) &&
      near(C.pointX({ t: t1 }), 10 + 110 * (1 - t1));
  }
  check("2000 random mouse positions project onto A..O as the applet does", projected);
  check("a point past O still clamps to O, as RestrictToSegment does",
    C.setPointX({}, 250).t === 0 && C.pointX(C.setPointX({}, 250)) === 120);
}

/* ------------- 4. the drawn boxes, the oval, and the eligibility quirk ----- */

{
  const rect = appletRect(C.WIDTH, C.HEIGHT, C.MARGIN);
  let boxes = true, ovals = true, eligibleOK = true, quirk = true;
  for (let i = 3; i <= 110; i++) {
    const point = { x: rect.x + i, y: rect.y + rect.height / 2 };
    const b = appletBoxes(rect, point);
    const g = C.geometry(C.setPointX({}, point.x));
    boxes = boxes && g.L === b.L && g.de === b.bottom.w &&
      near(g.D.x, b.left.x + b.left.w) && near(g.E.x, b.right.x) &&
      near(g.F.y, b.bottom.y + b.bottom.h) &&
      near(g.circle.center.x, b.circle.x + b.circle.w / 2) &&
      near(g.circle.center.y, b.circle.y + b.circle.h / 2) &&
      near(2 * g.circle.radius, b.circle.w);
    ovals = ovals && b.circle.w === appletCF(rect, g.L) && near(g.cf, b.circle.w);
    // The point really sits on AB; the applet's own release test requires a y
    // strictly ABOVE AB-2. That harmless quirk is deliberately not copied.
    eligibleOK = eligibleOK && !appletEligible(rect, point.x, point.y) &&
      appletEligible(rect, point.x, point.y - 5);
    quirk = quirk && !appletEligible(rect, rect.x + 1, rect.y + 1) &&
      !appletEligible(rect, rect.x + rect.width, rect.y + 1);
  }
  check("every arc box matches DrawLemma for all 111 values of AD", boxes);
  check("the oval diameter is height-AD = CF at every value", ovals);
  check("the applet rejects drops on AB itself (the quirk is left out)", eligibleOK);
  check("PointIsEligible also excludes the two ends of AB", quirk);
  check("CF = OA + EO = EA = AB - AD", (() => {
    let ok = true;
    for (let L = 0; L <= 110; L++) {
      const g = C.geometry(C.setPointX({}, C.RECT.x + L));
      ok = ok && g.cf === C.SIDE - L && g.cf === g.oa + g.eo && g.cf === g.ea;
    }
    return ok;
  })());
}

/* -------------------------- 5. Euclid II.10, exhaustively ------------------- */

{
  let form1 = true, form2 = true;
  for (let m = 0; m <= 110; m++) {
    for (let n = 0; n <= 110; n++) {
      form1 = form1 && (2 * m + n) ** 2 + n ** 2 === 2 * (m ** 2 + (m + n) ** 2);
      form2 = form2 && (m + n + m) ** 2 + (m + n - m) ** 2 ===
        2 * ((m + n) ** 2 + m ** 2);
    }
  }
  check("(2m+n)^2 + n^2 = 2(m^2+(m+n)^2) for all 12321 pairs", form1);
  check("(a+b)^2 + (a-b)^2 = 2(a^2+b^2) for all 12321 pairs", form2);

  const random = rng(2718);
  let broad = true;
  for (let i = 0; i < 2000; i++) {
    const a = Math.floor(random() * 1e6), b = Math.floor(random() * 1e6);
    broad = broad && (a + b) ** 2 + (a - b) ** 2 === 2 * (a ** 2 + b ** 2);
  }
  check("the modern identity also holds for 2000 large random pairs", broad);
}

/* --------------- 6. Archimedes' proof and the salinon area, every L -------- */

{
  let ea = true, squares = true, semis = true, area = true, closed = true,
      symmetric = true, maximum = true;
  for (let L = 0; L <= 110; L++) {
    const g = C.geometry(C.setPointX({}, C.RECT.x + L));
    const a = g.oa, b = g.eo;
    // Euclid II.10 applied to ED bisected at O and produced to A.
    ea = ea && g.ea ** 2 + g.L ** 2 === 2 * (a ** 2 + b ** 2);
    squares = squares && C.SIDE ** 2 + g.de ** 2 ===
      4 * (a ** 2 + b ** 2) && C.SIDE ** 2 + g.de ** 2 ===
      2 * (g.cf ** 2 + g.L ** 2);
    // Semicircles are to one another as the squares on their diameters.
    semis = semis && near(g.sumOnABDE, g.sumOnCircleAndSmall);
    area = area && near(g.salinon, g.circleArea) &&
      near(g.salinon, PI * g.cf * g.cf / 4);
    closed = closed && near(g.salinon,
      PI * C.SIDE * C.SIDE / 8 + PI * g.de * g.de / 8 - PI * g.L * g.L / 4);
    // The area grows as D moves from O towards A: largest at L = 0.
    maximum = maximum && g.salinon <= PI * C.SIDE * C.SIDE / 4 + 1e-9;
  }
  check("EA^2 + AD^2 = 2(EO^2 + OA^2) for all 111 values", ea);
  check("AB^2 + DE^2 = 4(EO^2+OA^2) = 2(CF^2+AD^2) for all 111 values", squares);
  check("semicircles on AB,DE = circle on CF + semicircles on AD,BE", semis);
  check("Proposition 14: salinon = circle on CF for all 111 values", area);
  check("the salinon equals big + inverted - two small semicircles", closed);
  check("the area never exceeds its value at D = A", maximum);

  const mid = C.geometry(C.setPointX({}, C.RECT.x + C.HALF));
  const widest = C.geometry(C.setPointX({}, C.RECT.x));
  for (let L = 0; L <= 110; L++) {
    const g = C.geometry(C.setPointX({}, C.RECT.x + L));
    // Strictly decreasing: only the endpoints can give the two extremes.
    symmetric = symmetric &&
      (L === 110 || g.salinon > mid.salinon + 1e-9) &&
      (L === 0 || g.salinon < widest.salinon - 1e-9);
  }
  check("the area is strictly smallest only at the symmetric extreme D = E = O", symmetric);
  check("in that extreme DE = 0, CF = OA = 110, big = twice the two small semicircles",
    mid.de === 0 && mid.cf === 110 &&
    near(mid.bigSemi, 2 * mid.smallSemis) &&
    near(mid.salinon, PI * 110 * 110 / 4));
  check("in the other extreme D = A, AD = 0 and the two small arcs vanish",
    (() => {
      const g = C.geometry(C.setPointX({}, C.RECT.x));
      return g.L === 0 && g.smallSemis === 0 && g.de === C.SIDE &&
        near(g.salinon, PI * C.SIDE * C.SIDE / 4);
    })());
}

done("lemma");
