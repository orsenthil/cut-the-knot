#!/usr/bin/env node
"use strict";

/*
 * Logic test for bol-9/bol-9-core.js.
 *
 *   node porting/check-bol-9.mjs
 *
 * Checked: the starting diagram, the withChord limits, every one of the
 * article's claims at telling configurations and on hundreds of random ones
 * (including chords that pass through the centre), and the page's exact claim
 * that arc AD + arc CB and arc AC + arc DB are both a semicircle. The last
 * group is a literal second transcription of the applet's computation from the
 * bytecode — GeoSDoub.IntersectX/IntersectY, FindOrientation,
 * ComputeSignedAngle, Arc.MoveToFirstCircle and Arc.SetAngle — compared with
 * the core's start/value/measure for every arc over several hundred diagrams.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bol-9/bol-9-core.js", "Bol9Core");
const PI = Math.PI;
const TAU = 2 * PI;
const close = (a, b, tol = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const allClaims = (s) => Object.values(C.claims(s)).every(Boolean);
const state = (o) => C.start(o);

/* --------------- the applet's own computation, transcribed from bytecode ---- */

/* GeoSDoub.SqDist and FindOrientation. */
const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
function findOrientation(a, b, c) {
  const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return v > 0 ? 1 : -1;
}

/* GeoSDoub.ComputeSignedAngle: law of cosines, sign from FindOrientation. */
function computeSignedAngle(o, p, q) {
  const t = ((sqDist(o, p) + sqDist(o, q) - sqDist(p, q)) / 2) /
    Math.sqrt(sqDist(o, p)) / Math.sqrt(sqDist(o, q));
  return findOrientation(o, p, q) === 1 ? Math.acos(t) : -Math.acos(t);
}

/* BOL9Canvas$Arc.MoveToFirstCircle: while(a<0) a+=2*pi; while(a>=2*pi) a-=2*pi. */
function moveToFirstCircle(a) {
  while (a < 0) a += TAU;
  while (a >= TAU) a -= TAU;
  return a;
}

/* BOL9Canvas$Arc.SetAngle(p, q): Value from q->p, Start from p->Ro. */
function setArc(center, p, q, ro) {
  return {
    Value: computeSignedAngle(center, q, p),
    Start: moveToFirstCircle(computeSignedAngle(center, p, ro)),
  };
}

/*
 * GeoSDoub.IntersectY(line, circle) with the horizontal line (0,y)-(width,y):
 * m = (y1-y2)/(x1-x2) = 0, b = y2 - m*x2, A = m*m+1,
 * s8 = m*(b-cy)-cx (half the usual B), C = cx*cx + (b-cy)^2 - r*r,
 * disc = s8*s8 - A*C, root = (-s8 +/- sqrt(disc))/A.
 */
function intersectHorizontal(y, cx, cy, r) {
  const m = 0, b = y, A = m * m + 1;
  const halfB = m * (b - cy) - cx;
  const Cc = cx * cx + (b - cy) * (b - cy) - r * r;
  const disc = halfB * halfB - A * Cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const at = (t) => {
    const x = (-halfB + t) / A;
    return { x, y: m * x + b };
  };
  return [at(root), at(-root)];
}

/* GeoSDoub.IntersectX(line, circle) with the vertical line (x,0)-(x,height). */
function intersectVertical(x, cx, cy, r) {
  const m = 0, b = x, A = m * m + 1;
  const halfB = m * (b - cx) - cy;
  const Cc = cy * cy + (b - cx) * (b - cx) - r * r;
  const disc = halfB * halfB - A * Cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const at = (t) => {
    const y = (-halfB + t) / A;
    return { x: m * y + b, y };
  };
  return [at(root), at(-root)];
}

/* BOL9Canvas.init: circle at (width/2,height/2) radius min/2*7/12, Ro east. */
function appletCompute(s) {
  const center = { x: s.cx, y: s.cy };
  const ro = { x: s.cx + s.r, y: s.cy };
  const ab = intersectHorizontal(s.abY, s.cx, s.cy, s.r);
  const cd = intersectVertical(s.cdX, s.cx, s.cy, s.r);
  if (!ab || !cd) return null;
  // ComputePoints: A left of B, C below D (screen y grows downwards).
  const A = { x: Math.min(ab[0].x, ab[1].x), y: ab[0].y };
  const B = { x: Math.max(ab[0].x, ab[1].x), y: ab[0].y };
  const C = { x: cd[0].x, y: Math.max(cd[0].y, cd[1].y) };
  const D = { x: cd[0].x, y: Math.min(cd[0].y, cd[1].y) };
  return {
    A, B, C, D,
    BC: setArc(center, B, C, ro),
    AD: setArc(center, A, D, ro),
    AC: setArc(center, A, C, ro),
    BD: setArc(center, B, D, ro),
  };
}

/* ------------------------------------------------ 1. start and drag limits */

{
  const s = C.start();
  equal("circle centre follows the applet's width/2, height/2", { x: s.cx, y: s.cy }, { x: 200, y: 150 });
  check("circle radius is min(w,h)/2 * 7/12", close(s.r, 87.5));
  check("CD starts left of centre", s.cdX < s.cx);
  check("AB starts below centre", s.abY > s.cy);
  check("an illustration has no result", C.result(s) === null);
  check("the start is not degenerate", !C.geometry(s).degenerate);
  check("withChord does not change the given state", (() => {
    const next = C.withChord(s, "CD", 300);
    return s.cdX === 178.125 && next.cdX !== s.cdX;
  })());
  check("an unknown chord leaves the diagram alone", C.withChord(s, "ZZ", 0).cdX === s.cdX);
  check("CD can only be dragged left or right", C.withChord(s, "CD", 250).abY === s.abY);
  check("AB can only be dragged up or down", C.withChord(s, "AB", 100).cdX === s.cdX);
  check("a chord stop keeps the intersection 5 px inside the circle", (() => {
    const far = C.withChord(s, "CD", 10000);
    return close(Math.hypot(far.cdX - far.cx, far.abY - far.cy), far.r - C.GAP, 1e-8);
  })());
  check("dragging AB far away obeys the same joint limit", (() => {
    const far = C.withChord(s, "AB", -10000);
    return close(Math.hypot(far.cdX - far.cx, far.abY - far.cy), far.r - C.GAP, 1e-8);
  })());
  check("equal offsets are accepted", (() => {
    const t = C.withChord(s, "CD", s.cx);
    return t.cdX === s.cx && t.abY === s.abY;
  })());
}

/* -------------------------------- 2. the article's claims at fixed diagrams */

const fixed = [
  ["start", state()],
  ["horizontal chord through centre", state({ abOffset: 0 })],
  ["vertical chord through centre", state({ cdOffset: 0 })],
  ["both chords through centre", state({ abOffset: 0, cdOffset: 0 })],
  ["chords high and left", state({ abOffset: -0.6 * 87.5, cdOffset: -0.55 * 87.5 })],
  ["chords low and right", state({ abOffset: 0.6 * 87.5, cdOffset: 0.55 * 87.5 })],
  ["different board", state({ width: 560, height: 420, cdOffset: -31, abOffset: 44 })],
  ["shifted centre", state({ cx: -35, cy: 275, r: 120, cdOffset: 19, abOffset: -27 })],
];

for (const [name, s] of fixed) {
  const cl = C.claims(s);
  for (const [claim, value] of Object.entries(cl)) {
    check(`${name}: ${claim}`, value, JSON.stringify(cl));
  }
}

/* ----------------------------- 3. the article's exact numbers, explicitly */

{
  const s = state();
  const g = C.geometry(s);
  check("arc AD + arc CB is exactly 180 degrees", close(g.sumADCB, PI));
  check("arc AC + arc DB is exactly 180 degrees", close(g.sumACDB, PI));
  check("the two sums are equal", close(g.sumADCB, g.sumACDB));
  check("each sum is twice the right angle at O", close(g.sumADCB, 2 * g.angleAOD) && close(g.sumACDB, 2 * g.angleBOD));
  check("the four arcs make one full turn", close(g.circumference, TAU));
  check("the chords really meet at right angles", close(C.angleAt(g.O, g.A, g.D), PI / 2) && close(C.angleAt(g.O, g.B, g.C), PI / 2));
  check("A is left of B and D is above C", g.A.x < g.B.x && g.D.y < g.C.y);
  check("each arc measure is at most a half turn", Object.values(g.arcs).every((a) => a.measure <= PI + 1e-12));
  const moved = C.withChord(s, "AB", s.cy - 40);
  check("the sums survive a chord move", close(C.geometry(moved).sumADCB, PI) && close(C.geometry(moved).sumACDB, PI));
  check("names and order survive a chord move", (() => {
    const h = C.geometry(moved);
    return h.A.x < h.B.x && h.D.y < h.C.y && allClaims(moved);
  })());
}

/* ---------------------- 4. hundreds of configurations, fixed random seed */

{
  const rand = rng(2732);
  let tested = 0;
  for (let trial = 0; trial < 360; trial++) {
    const width = 240 + rand() * 700;
    const height = 200 + rand() * 500;
    const r = 30 + rand() * Math.min(width, height) * 0.35;
    let cdOffset = (rand() * 2 - 1) * (r - C.GAP - 1);
    let abOffset = (rand() * 2 - 1) * (r - C.GAP - 1);
    const d = Math.hypot(cdOffset, abOffset), lim = r - C.GAP - 1;
    if (d > lim) { cdOffset *= lim / d; abOffset *= lim / d; }
    const s = C.start({ width, height, cx: width / 2, cy: height / 2, r, cdOffset, abOffset });
    if (!allClaims(s)) {
      check(`random diagram ${trial} passes every claim`, false, JSON.stringify(C.claims(s)));
    }
    tested++;
  }
  check(`all claims hold on ${tested} random diagrams`, tested === 360);
}

/* --------------- 5. the applet's own start/value against the core's arcs */

{
  const offsets = [
    { cx: 200, cy: 150, r: 87.5 },
    { cx: 13, cy: 47, r: 61.25 },
    { cx: 456.5, cy: 280.25, r: 140 },
  ];
  let compared = 0;
  for (const o of offsets) {
    for (const r of [o.r, o.r * 0.6]) {
      for (let i = 0; i <= 24; i++) {
        for (let j = 0; j <= 3; j++) {
          let cdOffset = (r - C.GAP - 2) * (-1 + i / 12);
          let abOffset = (r - C.GAP - 2) * (-1 + j / 1.5);
          const d = Math.hypot(cdOffset, abOffset), lim = r - C.GAP - 2;
          if (d > lim) { cdOffset *= lim / d; abOffset *= lim / d; }
          const s = { width: o.cx * 2, height: o.cy * 2, cx: o.cx, cy: o.cy, r, cdX: o.cx + cdOffset, abY: o.cy + abOffset };
          const applet = appletCompute(s);
          const g = C.geometry(s);
          if (!applet) {
            check(`applet finds the intersections (r=${r}, i=${i}, j=${j})`, false);
            continue;
          }
          checkPointOrder(applet, g, s);
          for (const name of ["AD", "BC", "AC", "BD"]) {
            const a = applet[name], b = g.arcs[name];
            if (!close(a.Value, b.value, 1e-8) || !close(a.Start, b.start, 1e-8)) {
              check(`applet arc ${name} matches the core (r=${r}, i=${i}, j=${j})`, false,
                JSON.stringify([a, b]));
            }
          }
          compared++;
        }
      }
    }
  }
  check(`all four arcs match the applet's own computation on ${compared} diagrams`, compared === 600);
}

function checkPointOrder(applet, g, s) {
  check("applet's A is the core's A", close(applet.A.x, g.A.x, 1e-8) && close(applet.A.y, g.A.y, 1e-8), JSON.stringify([applet.A, g.A, s]));
  check("applet's B is the core's B", close(applet.B.x, g.B.x, 1e-8) && close(applet.B.y, g.B.y, 1e-8));
  check("applet's C is the core's C", close(applet.C.x, g.C.x, 1e-8) && close(applet.C.y, g.C.y, 1e-8));
  check("applet's D is the core's D", close(applet.D.x, g.D.x, 1e-8) && close(applet.D.y, g.D.y, 1e-8));
}

/* ------------------------------------------- 6. degenerate and odd inputs */

{
  const s = C.start();
  const tangent = C.withChord(s, "AB", s.cy + s.r + 100);
  // The drag limit keeps the intersection inside, but a chord can still be
  // almost tangent when the other one is far out; check the exact tangent too.
  const flat = { ...s, abY: s.cy + s.r };
  check("a tangent chord is degenerate", C.geometry(flat).degenerate);
  check("no claim passes on a tangent chord", !Object.values(C.claims(flat)).some(Boolean));
  check("the drag limit stops before tangency", !C.geometry(tangent).degenerate && C.geometry(tangent).halfAB > C.EPS);
  check("firstCircle wraps a negative angle", C.firstCircle(-0.25) > 0 && Math.abs(C.firstCircle(-0.25) - (TAU - 0.25)) < 1e-12);
  check("firstCircle wraps a large angle", C.firstCircle(TAU + 0.25) < TAU && close(C.firstCircle(TAU + 0.25), 0.25));
  check("a right angle has a positive orientation", C.orientation({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }) === 1);
  check("signed angle from east to south is a quarter turn", close(C.signedAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }), PI / 2));
}

done("bol-9");
