#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-touching-circles-3/four-touching-circles-3-core.js.
 *
 *   node porting/check-four-touching-circles-3.mjs
 *
 * The cut-the-knot page claims: four circles tangent in a cycle give four
 * contact points, which lie on a circle if the number of external tangencies
 * is even and do not otherwise. Section 4 builds chains for every one of the
 * 16 external/internal patterns, with several sets of radii and hundreds of
 * closing angles, and tests both the concyclicity determinant and the
 * applet's own "circle through the first three contacts" for each one.
 *
 * Section 3 compares the core with a second, independent transcription of
 * FourTouchingCircles3Canvas.Compute, Common, GetTangent, GetExternalTangent,
 * GetInternalTangent, Canvas.GetCircle, GeoSDoub.FindCircumcenter and
 * InvLine.InvertCinC, over a grid of configurations, random drags and
 * deliberately near-tangent configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-touching-circles-3/four-touching-circles-3-core.js", "FourTouchingCircles3Core");

const near = (a, b, tol = 1e-7) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return (Number.isNaN(a) && Number.isNaN(b)) || (a === b);
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
};
const nearPt = (p, q, tol = 1e-7) => p && q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const nearCircle = (p, q, tol = 1e-7) => nearPt(p, q, tol) && near(p.r, q.r, tol);
const hypot = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* -------------------------------------------------------------------------- */
/* A second transcription, written straight from the class files.             */
/* Nothing here calls the core: it is the applet's own arithmetic again.       */
/* -------------------------------------------------------------------------- */

function appletCircles(state) {
  return state.circles.map((d) => {
    const dx = d.b.x - d.c.x;
    const dy = d.b.y - d.c.y;
    return { x: d.c.x, y: d.c.y, r: Math.sqrt(dx * dx + dy * dy) };
  });
}

// FourTouchingCircles3Canvas.Common.
function appletCommon(c1, c2, size) {
  const eps = size > 2 ? 3.0 : 2.0;
  const r1 = c1.r;
  const r2 = c2.r;
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (Math.abs(r1 + r2 - d) < eps) return true;
  if (Math.abs(Math.abs(r1 - r2) - d) < eps) return true;
  return false;
}

// DoubCircle.Tangent.
function appletTangentPoint(c, p) {
  const dx = c.x - p.x;
  const dy = c.y - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (Math.abs(d - c.r) > 1) return null;
  return { x: p.x + dy, y: p.y - dx };
}

// Canvas.GetExternalTangent.
function appletExternal(a, b) {
  const ra = a.r;
  const rb = b.r;
  const sum = ra + rb;
  const p = {
    x: a.x + ((b.x - a.x) * ra) / sum,
    y: a.y + ((b.y - a.y) * ra) / sum,
  };
  const tangent = appletTangentPoint(a, p);
  return tangent ? { point: p, tangent, external: true } : null;
}

// Canvas.GetInternalTangent.
function appletInternal(a, b) {
  const ra = a.r;
  const rb = b.r;
  const diff = Math.abs(ra - rb);
  const s = ra < rb ? a : b;
  const l = ra < rb ? b : a;
  const rs = ra < rb ? ra : rb;
  const p = {
    x: s.x + ((s.x - l.x) * rs) / diff,
    y: s.y + ((s.y - l.y) * rs) / diff,
  };
  const tangent = appletTangentPoint(a, p);
  return tangent ? { point: p, tangent, external: false } : null;
}

// Canvas.GetTangent.
function appletTangent(a, b) {
  const eps = 0.1;
  const ra = a.r;
  const rb = b.r;
  if (!(ra >= eps) || !(rb >= eps)) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= ra && d >= rb) return appletExternal(a, b);
  return appletInternal(a, b);
}

// GeoSDoub.Intersect (the point-point form), then FindCircumcenter.
function appletIntersection(a, b, c, d) {
  const a1 = a.y - b.y;
  const b1 = b.x - a.x;
  const c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y;
  const b2 = d.x - c.x;
  const c2 = c.x * d.y - c.y * d.x;
  const numeratorX = b1 * c2 - b2 * c1;
  const numeratorY = c1 * a2 - c2 * a1;
  const denominator = a1 * b2 - a2 * b1;
  if (Math.abs(denominator) < 1) return { x: NaN, y: NaN };
  return { x: numeratorX / denominator, y: numeratorY / denominator };
}

function appletCircumcenter(a, b, c) {
  const ab = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const bc = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const p = { x: ab.x + (b.y - a.y), y: ab.y - (b.x - a.x) };
  const q = { x: bc.x + (c.y - b.y), y: bc.y - (c.x - b.x) };
  return appletIntersection(ab, p, bc, q);
}

// Canvas.GetCircle: the mean of the three circumcentre distances.
function appletCircle3(a, b, c) {
  const o = appletCircumcenter(a, b, c);
  const d1 = Math.sqrt((o.x - a.x) * (o.x - a.x) + (o.y - a.y) * (o.y - a.y));
  const d2 = Math.sqrt((o.x - b.x) * (o.x - b.x) + (o.y - b.y) * (o.y - b.y));
  const d3 = Math.sqrt((o.x - c.x) * (o.x - c.x) + (o.y - c.y) * (o.y - c.y));
  return { x: o.x, y: o.y, r: (d1 + d2 + d3) / 3 };
}

// FourTouchingCircles3Canvas.Compute.
function appletCompute(state) {
  const circles = appletCircles(state);
  const contacts = [];
  const lines = [];
  const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  for (const [i, j] of pairs) {
    if (!appletCommon(circles[i], circles[j], contacts.length)) continue;
    const hit = appletTangent(circles[i], circles[j]);
    if (!hit) continue;
    contacts.push({ point: hit.point, tangent: hit.tangent, pair: [i, j], external: hit.external });
    lines.push([i, j]);
  }
  const circle = contacts.length >= 3
    ? appletCircle3(contacts[0].point, contacts[1].point, contacts[2].point)
    : null;
  return { circles, contacts, lines, circle };
}

// InvLine.InvertCinC with flip=false, as used by Canvas.ShowInversion.
function appletInvert(c, inv) {
  const R = Math.sqrt((inv.b.x - inv.c.x) ** 2 + (inv.b.y - inv.c.y) ** 2);
  const power = (c.x - inv.c.x) ** 2 + (c.y - inv.c.y) ** 2 - c.r * c.r;
  if (Math.abs(power) > 100) {
    const k = (R * R) / power;
    return {
      kind: "circle",
      x: c.x + (inv.c.x - c.x) * k,
      y: c.y + (inv.c.y - c.y) * k,
      r: c.r * Math.abs(k),
    };
  }
  const q = { x: 2 * inv.c.x - c.x, y: 2 * inv.c.y - c.y };
  const dq = Math.hypot(q.x - inv.c.x, q.y - inv.c.y);
  const k = (R * R) / (dq * dq);
  return {
    kind: "line",
    p: { x: inv.c.x + (q.x - inv.c.x) * k, y: inv.c.y + (q.y - inv.c.y) * k },
    direction: { x: R * 100 * (q.y - inv.c.y) * k / R, y: -R * 100 * (q.x - inv.c.x) * k / R },
  };
}

/* ------------------------------- configurations -------------------------- */

function config(circles, inv, show) {
  // Point each rim towards the middle of the board so that dragging limits
  // do not quietly change the radius of a chain circle.
  const d = circles.map((z) => {
    const dx = 240 - z.x;
    const dy = 160 - z.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      c: { x: z.x, y: z.y },
      b: { x: z.x + (z.r * dx) / len, y: z.y + (z.r * dy) / len },
    };
  });
  return {
    circles: d,
    inv: inv || { c: { x: 240, y: 160 }, b: { x: 340, y: 160 } },
    show: show || { circles: true, points: false, inversion: false, centers: false },
  };
}

function configurations() {
  const out = [C.start({})];
  // The odd-parity position used by the play scenario: circle 3 slides inside
  // circle 2 while keeping its radius, giving three external touches.
  const odd = C.start({});
  const shift = { x: 252.2727 - odd.circles[3].c.x, y: 183.7758 - odd.circles[3].c.y };
  odd.circles[3] = {
    c: { x: 252.2727, y: 183.7758 },
    b: { x: odd.circles[3].b.x + shift.x, y: odd.circles[3].b.y + shift.y },
  };
  out.push(odd);

  // A grid: put two circles on a lattice of centres with fixed radii.
  for (let a = 0; a < 7; a++) {
    for (let b = 0; b < 6; b++) {
      for (let r = 0; r < 4; r++) {
        out.push(config([
          { x: 30 + 60 * a, y: 30 + 40 * b, r: 30 + 9 * r },
          { x: 430 - 30 * a, y: 280 - 35 * b, r: 25 + 11 * r },
          { x: 60 + 50 * b, y: 260 - 45 * a, r: 35 + 7 * r },
          { x: 250 + 25 * a, y: 30 + 55 * b, r: 40 + 5 * r },
        ]));
      }
    }
  }

  // Deterministic random drags of every centre and rim point.
  const rnd = rng(50822026);
  for (let i = 0; i < 600; i++) {
    const pt = () => ({ x: 10 + rnd() * 460, y: 10 + rnd() * 300 });
    const state = C.start({});
    for (let k = 0; k < 4; k++) {
      state.circles[k].c = pt();
      state.circles[k].b = pt();
    }
    state.inv.c = pt();
    state.inv.b = pt();
    out.push(state);
  }

  // Near-tangent cases: a rim point moved to within a fraction of a pixel of
  // the 2px and 3px thresholds of Common, and almost-zero radii.
  for (const delta of [-3.1, -2.1, -1.9, -0.5, 0, 0.5, 1.9, 2.1, 3.1]) {
    for (const k of [1, 2, 3]) {
      const s = C.start({});
      s.circles[k].b.x += delta;
      out.push(s);
      const tiny = C.start({});
      tiny.circles[k].b = { x: tiny.circles[k].c.x + 0.05, y: tiny.circles[k].c.y };
      out.push(tiny);
    }
  }
  return out;
}

const ALL = configurations();

/* --------------------------------- 1. the applet's controls and opening --- */

{
  const s = C.start({});
  check("start has four circles", s.circles.length === 4);
  check("the panel's four checkboxes start as circles-only",
    s.show.circles === true && s.show.points === false &&
    s.show.inversion === false && s.show.centers === false);
  check("the inversion circle starts at the canvas centre with radius 100",
    nearPt(s.inv.c, { x: 240, y: 160 }) && near(C.dist(s.inv.c, s.inv.b), 100));
  const radii = C.circleData(s).map((c) => c.r);
  check("the opening radii are 60, 50, 70 and 45", radii.every((r, i) => near(r, [60, 50, 70, 45][i])));
  const g = C.geometry(s);
  check("the opening chain has four external contacts",
    g.contacts.length === 4 && g.contacts.every((t) => t.external) &&
    g.contacts.map((t) => t.pair.join("-")).join(" ") === "0-1 0-3 1-2 2-3");
  check("the opening circle passes through its first three contacts",
    g.contacts.slice(0, 3).every((t) => near(C.dist(g.circle, t.point), g.circle.r, 1e-9)));
  check("the opening chain is reported as even and concyclic",
    g.chain.external === 4 && g.chain.onCircle === true);
  check("the opening non-neighbouring pairs are not tangent",
    !g.contacts.some((t) => t.pair.join("-") === "0-2" || t.pair.join("-") === "1-3"));
}

/* ---------------------------- 2. dragging and options -------------------- */

{
  const s = C.start({});
  const moved = C.setPoint(s, "c2", { x: 333.3, y: 77.7 });
  check("dragging a centre leaves the original position unchanged",
    nearPt(s.circles[2].c, { x: 260, y: 160 }));
  check("dragging a centre moves only that centre",
    nearPt(moved.circles[2].c, { x: 333.3, y: 77.7 }) &&
    moved.circles.every((d, i) => i === 2 || (nearPt(d.c, s.circles[i].c) && nearPt(d.b, s.circles[i].b))));
  const resized = C.setPoint(s, "b0", { x: 150, y: 40 });
  check("dragging a rim point changes that circle's radius",
    near(C.circleData(resized)[0].r, 120));
  const clamped = C.setPoint(s, "ib", { x: -900, y: 9000 });
  check("draggable points are clamped to the canvas",
    clamped.inv.b.x === C.EDGE && clamped.inv.b.y === C.HEIGHT - C.EDGE);
  const unknown = C.setPoint(s, "nope", { x: 1, y: 2 });
  check("an unknown handle is ignored", JSON.stringify(unknown) === JSON.stringify(s));
  check("setOption changes one panel checkbox without moving any circle",
    C.setOption(s, "inversion", true).show.inversion === true &&
    JSON.stringify(C.setOption(s, "inversion", true).circles) === JSON.stringify(s.circles));
  const round = C.position(moved);
  check("a saved position is plain JSON and restores exactly",
    JSON.stringify(C.start(round)) === JSON.stringify(moved));
  const odd = C.setPoint(C.start({}), "c3", { x: 252.2727, y: 183.7758 });
  const shifted = { ...odd, circles: odd.circles.map((d, i) => i === 3
    ? { c: d.c, b: { x: d.b.x + 57.2727, y: d.b.y - 71.0925 } } : d) };
  const oh = C.geometry(shifted);
  check("the odd position gives exactly four contacts, one inside a circle",
    oh.contacts.length === 4 && oh.contacts.filter((t) => t.external).length === 3 &&
    oh.chain.external === 3 && oh.chain.onCircle === false);
}

/* ----------------- 3. core against the applet's own bytecode ------------- */

{
  let compared = 0;
  let contactMismatch = 0;
  let tangentMismatch = 0;
  let circleMismatch = 0;
  let lineMismatch = 0;
  let invMismatch = 0;
  for (const raw of ALL) {
    // start() applies the same clamping as a dragged handle, so both
    // transcriptions see exactly the same circles.
    const state = C.start(raw);
    const ours = C.geometry(state);
    const theirs = appletCompute(state);
    compared++;
    if (ours.contacts.length !== theirs.contacts.length ||
        ours.contacts.some((t, i) => t.pair.join() !== theirs.contacts[i].pair.join() ||
          t.external !== theirs.contacts[i].external || !nearPt(t.point, theirs.contacts[i].point))) {
      contactMismatch++;
    }
    if (ours.contacts.some((t, i) => !nearPt(t.tangent, theirs.contacts[i].tangent))) tangentMismatch++;
    if (!(nearCircle(ours.circle, theirs.circle) ||
        (!ours.circle && !theirs.circle))) circleMismatch++;
    if (ours.centerLines.some((l, i) => l.map((c) => c.x).join() !==
        theirs.lines[i].map((k) => theirs.circles[k].x).join())) lineMismatch++;
    const invSrc = state.inv;
    ours.inversions.forEach((image, i) => {
      const other = appletInvert(theirs.circles[i], invSrc);
      if (image.kind !== other.kind || (image.kind === "circle"
        ? !nearCircle(image, other)
        : !nearPt(image.p, other.p, 1e-6))) invMismatch++;
    });
  }
  check(`core contacts match Compute on ${compared} configurations`, contactMismatch === 0,
    `${contactMismatch} mismatches`);
  check("core tangent endpoints match DoubCircle.Tangent", tangentMismatch === 0,
    `${tangentMismatch} mismatches`);
  check("core circle through three contacts matches GetCircle", circleMismatch === 0,
    `${circleMismatch} mismatches`);
  check("core centre lines match CLines", lineMismatch === 0, `${lineMismatch} mismatches`);
  check("core inversions match InvLine.InvertCinC", invMismatch === 0, `${invMismatch} mismatches`);

  // The threshold in Common changes from 2 to 3 after the third contact.
  const nearPair = (gap) => config([
    { x: 100, y: 100, r: 40 },
    { x: 100 + gap, y: 100, r: 40 },
    { x: 300, y: 100, r: 10 },
    { x: 300, y: 200, r: 10 },
  ]);
  const commonCore = (gap, found) => C.common(C.circleData(nearPair(gap))[0], C.circleData(nearPair(gap))[1], found);
  const commonApplet = (gap, found) => appletCommon(appletCircles(nearPair(gap))[0], appletCircles(nearPair(gap))[1], found);
  check("Common's 2px threshold agrees with the bytecode",
    commonCore(78.5, 0) === commonApplet(78.5, 0) && commonCore(78.5, 0) === true &&
    commonCore(77.5, 0) === commonApplet(77.5, 0) && commonCore(77.5, 0) === false);
  check("Common's 3px threshold after three contacts agrees with the bytecode",
    commonCore(77.5, 3) === commonApplet(77.5, 3) && commonCore(77.5, 3) === true &&
    commonCore(76.5, 3) === commonApplet(76.5, 3) && commonCore(76.5, 3) === false);
  check("a radius below 0.1 is rejected by GetTangent",
    C.getTangent({ x: 0, y: 0, r: 0.05 }, { x: 40, y: 0, r: 30 }) === null &&
    appletTangent({ x: 0, y: 0, r: 0.05 }, { x: 40, y: 0, r: 30 }) === null);
  check("a contact point more than 1px off the circle is rejected",
    C.tangentEndpoint({ x: 0, y: 0, r: 10 }, { x: 30, y: 0 }) === null);
  check("a circle through the inversion centre inverts to a line",
    C.invertCircle({ x: 300, y: 160, r: 60 }, { c: { x: 240, y: 160 }, b: { x: 340, y: 160 } }).kind === "line" &&
    appletInvert({ x: 300, y: 160, r: 60 }, { c: { x: 240, y: 160 }, b: { x: 340, y: 160 } }).kind === "line");
  const far = C.invertCircle({ x: 100, y: 100, r: 20 }, { c: { x: 400, y: 200 }, b: { x: 480, y: 200 } });
  check("a far circle inverts to a circle with radius R^2*r/power",
    far.kind === "circle" && near(far.r, 20 * 80 * 80 / ((300 * 300 + 100 * 100) - 20 * 20)) &&
    nearCircle(far, appletInvert({ x: 100, y: 100, r: 20 },
      { c: { x: 400, y: 200 }, b: { x: 480, y: 200 } })));
}

/* ----------------------- 4. the page's parity claim ---------------------- */

function circleIntersections(c1, r1, c2, r2) {
  const d = Math.hypot(c2.x - c1.x, c2.y - c1.y);
  if (d === 0 || d > r1 + r2 + 1e-10 || d < Math.abs(r1 - r2) - 1e-10) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < -1e-9) return [];
  const h = Math.sqrt(Math.max(0, h2));
  const ux = (c2.x - c1.x) / d;
  const uy = (c2.y - c1.y) / d;
  const bx = c1.x + ux * a;
  const by = c1.y + uy * a;
  return [
    { x: bx - uy * h, y: by + ux * h },
    { x: bx + uy * h, y: by - ux * h },
  ];
}

/** Determinant of the four points in the circle equation (zero iff concyclic). */
function concyclicity(points) {
  const rows = points.map((p) => [p.x * p.x + p.y * p.y, p.x, p.y, 1]);
  const m = rows.map((r) => r.slice());
  let det = 1;
  for (let col = 0; col < 4; col++) {
    let pivot = col;
    for (let i = col + 1; i < 4; i++) {
      if (Math.abs(m[i][col]) > Math.abs(m[pivot][col])) pivot = i;
    }
    if (Math.abs(m[pivot][col]) < 1e-14) return 0;
    if (pivot !== col) { [m[col], m[pivot]] = [m[pivot], m[col]]; det = -det; }
    det *= m[col][col];
    for (let i = col + 1; i < 4; i++) {
      const f = m[i][col] / m[col][col];
      for (let k = col; k < 4; k++) m[i][k] -= f * m[col][k];
    }
  }
  return det;
}

/** Build a closed chain of four circles with the given tangency types. */
function makeChain(r, types, angle, index) {
  // Edge lengths around the cycle 0-1-2-3-0.
  const link = types.map((t, k) => {
    const j = (k + 1) % 4;
    return t === "e" ? r[k] + r[j] : Math.abs(r[k] - r[j]);
  });
  const c0 = { x: 160, y: 160 };
  const c1 = { x: c0.x + link[0], y: c0.y };
  const theta = (angle + 0.37) * 2 * Math.PI / 360;
  const c2 = {
    x: c1.x + link[1] * Math.cos(theta),
    y: c1.y + link[1] * Math.sin(theta),
  };
  // Close the linkage: circle 3 is link[2] from circle 2 and link[3] from 0.
  const close = circleIntersections(c0, link[3], c2, link[2]);
  if (!close.length) return null;
  const centres = [c0, c1, c2, close[index % close.length]];
  return config(centres.map((c, k) => ({ x: c.x, y: c.y, r: r[k] })));
}

{
  const radiusSets = [
    [60, 50, 70, 45], [60, 47, 73, 41], [100, 60, 90, 70], [30, 10, 80, 50],
    [55, 44, 66, 38], [80, 35, 95, 60], [42, 67, 51, 73], [90, 55, 40, 75],
    [72, 10, 30, 52], [82, 14, 90, 47],
  ];
  let evenTested = 0;
  let oddTested = 0;
  let evenFailures = 0;
  let oddFailures = 0;
  let parityFailures = 0;
  let minOddGap = Infinity;
  const masksSeen = new Set();
  for (const r of radiusSets) {
    for (let mask = 0; mask < 16; mask++) {
      const types = [0, 1, 2, 3].map((k) => (mask & (1 << k)) ? "i" : "e");
      const expectedExternal = types.filter((t) => t === "e").length;
      for (let angle = 0; angle < 360; angle += 5) {
        for (let branch = 0; branch < 2; branch++) {
          const state = makeChain(r, types, angle, branch);
          if (!state) continue;
          // Skip chains whose rim or centre would be clipped by the canvas;
          // a clipped radius is no longer the radius the theorem assumed.
          const actual = C.start(state);
          if (actual.circles.some((d, i) =>
            !near(d.b.x, state.circles[i].b.x, 1e-9) ||
            !near(d.b.y, state.circles[i].b.y, 1e-9) ||
            !near(d.c.x, state.circles[i].c.x, 1e-9) ||
            !near(d.c.y, state.circles[i].c.y, 1e-9))) continue;
          const g = C.geometry(state);
          // Only cases where the applet sees exactly the four chain contacts
          // have a claim about "the four contact points".
          const pairs = g.contacts.map((t) => t.pair.join("-")).sort().join(" ");
          if (pairs !== "0-1 0-3 1-2 2-3" || !g.circle || !Number.isFinite(g.circle.r)) continue;
          masksSeen.add(mask);
          const chainPoints = [0, 1, 2, 3].map((k) => {
            const j = (k + 1) % 4;
            return g.contacts.find((t) => t.pair.join("-") === [Math.min(k, j), Math.max(k, j)].join("-")).point;
          });
          // Compute takes its circle from pairs (0,1), (0,3), (1,2): the
          // remaining chain point (2,3) is the one the claim is about.
          const gap = Math.abs(C.dist(g.circle, chainPoints[2]) - g.circle.r);
          const det = Math.abs(concyclicity(chainPoints)) / Math.max(...r) ** 3;
          const externalCore = g.contacts.filter((t) => t.external).length;
          if (externalCore !== expectedExternal) parityFailures++;
          if (expectedExternal % 2 === 0) {
            evenTested++;
            if (gap > 1e-4 || det > 1e-6) evenFailures++;
          } else {
            oddTested++;
            minOddGap = Math.min(minOddGap, gap);
            if (gap < 0.05 || det < 1e-3) oddFailures++;
          }
        }
      }
    }
  }
  check(`even external tangencies: all ${evenTested} chains are concyclic`, evenFailures === 0,
    `${evenFailures} failures`);
  check(`odd external tangencies: all ${oddTested} chains are not concyclic`, oddFailures === 0,
    `${oddFailures} failures; smallest gap ${minOddGap.toFixed(4)}`);
  check("every constructed chain's external count matches its tangency pattern", parityFailures === 0,
    `${parityFailures} mismatches`);
  check("both parities and all 16 patterns were actually exercised",
    evenTested > 100 && oddTested > 100 && minOddGap > 0.05 && masksSeen.size === 16,
    `${masksSeen.size} of 16 patterns exercised; missing ${[...Array(16).keys()].filter((m) => !masksSeen.has(m)).join(",")}`);

  // The applet's own GetCircle uses the first three contacts, which for this
  // pair ordering are (0,1), (0,3) and (1,2). Test that exact selection.
  const s = C.start({});
  const g = C.geometry(s);
  const hitsByPair = (pair) => g.contacts.find((t) => t.pair.join("-") === pair).point;
  const three = [hitsByPair("0-1"), hitsByPair("0-3"), hitsByPair("1-2")];
  check("the supplied circle is the circumcircle of contacts (0,1), (0,3), (1,2)",
    nearCircle(g.circle, appletCircle3(three[0], three[1], three[2])) &&
    three.every((p) => near(C.dist(g.circle, p), g.circle.r, 1e-9)));
}

done("four-touching-circles-3");
