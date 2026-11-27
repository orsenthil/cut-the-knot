#!/usr/bin/env node
"use strict";

/*
 * Logic test for half-plane-test/half-plane-test-core.js.
 *
 *   node porting/check-half-plane-test.mjs
 *
 * 1. A second transcription of the applet's own bytecode: GeoSDoub's
 *    FindOrientation, Intersect and MoveableLineAdvanced's SqueezeIn and
 *    Inside, compared with the core over thousands of lines and pointers.
 * 2. The page's claims, over hundreds of configurations: the clipped overlap
 *    is a convex polygon (or empty), equals the common side of every line,
 *    and the intersection of convex half planes is convex; the empty case and
 *    the unbounded-whole-plane caveat are checked explicitly.
 * 3. The controls, ranges, drag modes and the demo's "done" state.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("half-plane-test/half-plane-test-core.js", "HalfPlaneTestCore");
const BOX = C.BOUNDS;

/* ----------------- the applet's own methods, transcribed a second time ----- */

// GeoSDoub.FindOrientation, straight from its bytecode: the three-term determinant.
function javaOrientation(a, b, p) {
  const z = p.x * (a.y - b.y) + p.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return z > 0 ? 1 : -1;
}

// HalfPlane2D.contains: FindOrientation(P1, P2, point) == 1.
function javaContains(line, p) {
  return javaOrientation(line.p1, line.p2, p) === 1;
}

// GeoSDoub.Intersect, using its implicit-line coefficients and its |det| < 1 test.
function javaIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

// MoveableLineAdvanced.SqueezeIn, with the applet's four edges in its order.
function javaSqueeze(line) {
  const a = line.p1, b = line.p2;
  const box = BOX;
  const ends = [];
  const add = (p) => ends.push(p);
  if (Math.abs(a.x - b.x) < 0.1) {
    add({ x: b.x, y: box.y - 5 });
    add({ x: b.x, y: box.y + box.height + 5 });
  } else {
    const slope = (b.y - a.y) / (b.x - a.x);
    const top = javaIntersect(a, b, { x: box.x, y: box.y }, { x: box.x + box.width, y: box.y });
    if (!Number.isNaN(top.x) && top.x >= box.x && top.x <= box.x + box.width) add(top);
    const right = javaIntersect(a, b, { x: box.x + box.width, y: box.y }, { x: box.x + box.width, y: box.y + box.height });
    if (!Number.isNaN(right.y) && right.y >= box.y && right.y <= box.y + box.height) add(right);
    if (ends.length < 2) {
      const bottom = javaIntersect(a, b, { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height });
      if (!Number.isNaN(bottom.x) && bottom.x >= box.x && bottom.x <= box.x + box.width) add(bottom);
    }
    if (ends.length < 2) {
      const left = javaIntersect(a, b, { x: box.x, y: box.y + box.height }, { x: box.x, y: box.y });
      if (!Number.isNaN(left.y) && left.y >= box.y && left.y <= box.y + box.height) add(left);
    }
    while (ends.length < 2) {
      const k = ends.length;
      add({ x: box.x + k * box.width, y: box.y + k * box.height });
    }
  }
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (javaOrientation(a, b, centre) !== javaOrientation(ends[0], ends[1], centre)) {
    ends.reverse();
  }
  return { p1: ends[0], p2: ends[1] };
}

// MoveableLineAdvanced.Inside: distance to the line and the 0.1 / 0.9 tests.
function javaMotion(line, p) {
  const a = line.p1, b = line.p2;
  const dx = a.x - b.x, dy = a.y - b.y;
  const len2 = dx * dx + dy * dy;
  if (!len2) return null;
  const dot = (a.x - p.x) * dx + (a.y - p.y) * dy;
  const t = dot / len2;
  const dist = Math.sqrt((a.x - p.x) ** 2 + (a.y - p.y) ** 2 - (dot * dot) / len2);
  if (dist >= 5) return null;
  if (t < 0.1) return "rotate1";
  if (t > 0.9) return "rotate2";
  return "translate";
}

// An independent clip: keep the corners for which the applet's contains is true.
function javaClip(poly, line) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ina = javaContains(line, a), inb = javaContains(line, b);
    if (ina) out.push(a);
    if (ina !== inb) {
      const p = javaIntersect(a, b, line.p1, line.p2);
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) out.push(p);
    }
  }
  return out;
}

function javaIntersection(lines) {
  let poly = [
    { x: BOX.x, y: BOX.y }, { x: BOX.x + BOX.width, y: BOX.y },
    { x: BOX.x + BOX.width, y: BOX.y + BOX.height }, { x: BOX.x, y: BOX.y + BOX.height },
  ];
  for (const line of lines) {
    poly = javaClip(poly, line);
    if (!poly.length) break;
  }
  return poly;
}

function javaArea(poly) {
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    twice += p.x * q.y - q.x * p.y;
  }
  return Math.abs(twice) / 2;
}

function javaInside(poly, p) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const samePair = (a, b) => {
  const same = (p, q) => near(p.x, q.x) && near(p.y, q.y);
  return (same(a.p1, b.p1) && same(a.p2, b.p2)) || (same(a.p1, b.p2) && same(a.p2, b.p1));
};

/** A vertex of one clipped polygon lies on the boundary of the other. */
function onOrInside(poly, p, tol = 1e-6) {
  if (javaInside(poly, p)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
    if (Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)) <= tol) return true;
  }
  return false;
}

/* ------------------------------------------------------- 1. the start state */

{
  const s = C.start({});
  equal("the applet starts with one line", s.n, 1);
  equal("one line in a fresh state", s.lines.length, 1);
  equal("the overlap is not shown at first", s.showIntersection, false);
  equal("a fresh illustration is not done", C.result(s), null);
}

{
  const r = rng(11);
  let bands = 0;
  for (let i = 0; i < 2000; i++) {
    const raw = { p1: { x: r() * C.WIDTH, y: r() * C.BAND },
      p2: { x: r() * C.WIDTH, y: C.HEIGHT - C.BAND + r() * C.BAND } };
    if (raw.p1.y >= 0 && raw.p1.y < C.BAND && raw.p2.y >= C.HEIGHT - C.BAND && raw.p2.y < C.HEIGHT) bands++;
    const line = C.randomLine(r);
    if (!Number.isFinite(line.p1.x + line.p1.y + line.p2.x + line.p2.y)) throw new Error("non-finite line");
  }
  check("Reset draws P1 from the top band and P2 from the bottom band", bands === 2000);
}

/* ------------------------------- 2. the bytecode transcribed a second time */

{
  const r = rng(4242);
  let agree = 0, total = 0;
  for (let i = 0; i < 12000; i++) {
    const a = { x: r() * 500 - 50, y: r() * 400 - 50 };
    const b = { x: r() * 500 - 50, y: r() * 400 - 50 };
    const p = { x: r() * 500 - 50, y: r() * 400 - 50 };
    if (javaOrientation(a, b, p) === C.orientation(a, b, p)) agree++;
    total++;
  }
  check("FindOrientation agrees at 12,000 random point triples", agree === total, `${agree}/${total}`);
}

{
  const r = rng(555);
  let agree = 0;
  const cases = [];
  for (let i = 0; i < 4000; i++) {
    cases.push({ p1: { x: r() * 400, y: r() * 300 }, p2: { x: r() * 400, y: r() * 300 } });
  }
  for (let i = 0; i < 2000; i++) {
    cases.push({ p1: { x: r() * 400, y: r() * C.BAND }, p2: { x: r() * 400, y: C.HEIGHT - C.BAND + r() * C.BAND } });
  }
  for (const line of cases) {
    if (samePair(C.squeeze(line), javaSqueeze(line))) agree++;
  }
  check("SqueezeIn agrees with the core on 6,000 lines", agree === cases.length, `${agree}/${cases.length}`);
}

{
  const r = rng(777);
  let agree = 0, total = 0;
  for (let i = 0; i < 3000; i++) {
    const line = {
      p1: { x: r() * 400, y: r() * 300 },
      p2: { x: r() * 400, y: r() * 300 },
    };
    if (Math.hypot(line.p1.x - line.p2.x, line.p1.y - line.p2.y) < 20) continue;
    for (let j = 0; j < 8; j++) {
      const t = r();
      const hit = javaMotion(line, { x: line.p1.x + (line.p2.x - line.p1.x) * t,
        y: line.p1.y + (line.p2.y - line.p1.y) * t });
      total++;
      if (hit === C.hitMotion(line, { x: line.p1.x + (line.p2.x - line.p1.x) * t,
        y: line.p1.y + (line.p2.y - line.p1.y) * t })) agree++;
    }
  }
  check("Inside picks the same rotate/slide mode at 3,000 lines", agree === total && total > 20000, `${agree}/${total}`);
}

{
  const a = { x: 20, y: 30 }, b = { x: 380, y: 250 };
  const c = { x: 0, y: 250 }, d = { x: 400, y: 20 };
  const p = javaIntersect(a, b, c, d);
  const q = C.intersect(a, b, c, d);
  check("Intersect agrees on a crossing pair", near(p.x, q.x) && near(p.y, q.y));
  const flatA = { x: 20, y: 30 }, flatB = { x: 380, y: 30 };
  const par = javaIntersect(flatA, flatB, { x: 0, y: 30 }, { x: 400, y: 30 });
  check("Intersect gives NaN for parallel lines, like the applet",
    Number.isNaN(par.x) && Number.isNaN(C.intersect(flatA, flatB, { x: 0, y: 30 }, { x: 400, y: 30 }).x));
}

/* --------------------------------------------- 3. the page's claims, checked */

{
  const r = rng(90210);
  let convex = 0, areas = 0, vertices = 0, samples = 0;
  const configs = 400;
  for (let k = 0; k < configs; k++) {
    const n = 1 + (k % 8);
    const lines = [];
    for (let i = 0; i < n; i++) lines.push(C.randomLine(r));
    const poly = C.intersection(lines);
    const javaPoly = javaIntersection(lines);
    if (C.isConvex(poly)) convex++;
    if (near(C.area(poly), javaArea(javaPoly), 1e-6)) areas++;
    if (poly.every((p) => onOrInside(javaPoly, p)) &&
        javaPoly.every((p) => onOrInside(poly, p))) vertices++;
    for (let gy = 0; gy < 13; gy++) for (let gx = 0; gx < 17; gx++) {
      const p = { x: 12 + gx * 23, y: 11 + gy * 23 };
      if (javaInside(javaPoly, p) === C.inPolygon(poly, p)) samples++;
    }
  }
  check(`the overlap is convex in all ${configs} configurations`, convex === configs, `${convex}/${configs}`);
  check("the overlap area matches the second transcription", areas === configs, `${areas}/${configs}`);
  check("both polygons contain the other's vertices", vertices === configs, `${vertices}/${configs}`);
  equal("the overlap agrees with the bytecode side on every sample point", samples, configs * 13 * 17);
}

{
  // Convexity of the intersection, from the definition: midpoints stay inside.
  const r = rng(31415);
  let pairs = 0, ok = 0;
  for (let k = 0; k < 120; k++) {
    const lines = Array.from({ length: 1 + (k % 6) }, () => C.randomLine(r));
    const inside = [];
    for (let gy = 1; gy < 12; gy++) for (let gx = 1; gx < 16; gx++) {
      const p = { x: gx * 25, y: gy * 25 };
      if (lines.every((line) => javaContains(line, p))) inside.push(p);
    }
    for (let i = 0; i < Math.min(12, inside.length); i++) {
      const a = inside[i], b = inside[(i * 7 + 3) % inside.length];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pairs++;
      if (lines.every((line) => javaContains(line, mid))) ok++;
    }
  }
  check("every midpoint of two points in the overlap is in the overlap", ok === pairs && pairs > 1000, `${ok}/${pairs}`);
}

{
  const verticalA = { p1: { x: 0, y: 0 }, p2: { x: 0, y: 300 } }; // keeps x < 0
  const verticalB = { p1: { x: 400, y: 300 }, p2: { x: 400, y: 0 } }; // keeps x > 400
  const empty = C.intersection([verticalA, verticalB]);
  equal("opposite half planes give an empty overlap", empty, []);
  equal("the empty overlap has zero area", C.area(empty), 0);
  check("the second transcription also finds it empty", javaIntersection([verticalA, verticalB]).length === 0);
}

{
  const line = { p1: { x: 200, y: 0 }, p2: { x: 200, y: 300 } };
  const poly = C.intersection([line]);
  const javaPoly = javaIntersection([line]);
  equal("one line clipped to the board has half the board's area", C.area(poly), C.WIDTH * C.HEIGHT / 2);
  check("the single-line polygon agrees with the bytecode", near(C.area(poly), javaArea(javaPoly)));
  check("the whole-plane intersection of one half plane is unbounded, so the board clip matters",
    C.contains(line, { x: -1000, y: 150 }) && !C.contains(line, { x: 1000, y: 150 }));
}

/* --------------------------------------------- 4. dragging and the controls */

{
  const line = { p1: { x: 100, y: 0 }, p2: { x: 300, y: 300 } };
  const state = C.start({ n: 1 });
  state.lines = [line];
  const at = (t) => ({ x: line.p1.x + (line.p2.x - line.p1.x) * t,
    y: line.p1.y + (line.p2.y - line.p1.y) * t });
  equal("a click near the first end rotates around the second", C.hitMotion(line, at(0.05)), "rotate1");
  equal("a click near the second end rotates around the first", C.hitMotion(line, at(0.95)), "rotate2");
  equal("a click in the middle slides the line", C.hitMotion(line, at(0.5)), "translate");
  equal("a click off the line grabs nothing", C.hitMotion(line, { x: 100, y: 300 }), null);

  const rotated = C.dragAt(state, 0, at(0.05));
  check("rotating keeps the far end fixed", near(rotated.lines[0].p2.x, 300) && near(rotated.lines[0].p2.y, 300));
  check("rotation keeps the kept side", C.orientation(line.p1, line.p2, { x: 150, y: 150 }) ===
    C.orientation(rotated.lines[0].p1, rotated.lines[0].p2, { x: 150, y: 150 }));
  const slid = C.dragAt(state, 0, at(0.5));
  const before = { x: line.p2.x - line.p1.x, y: line.p2.y - line.p1.y };
  const after = { x: slid.lines[0].p2.x - slid.lines[0].p1.x, y: slid.lines[0].p2.y - slid.lines[0].p1.y };
  check("sliding preserves the direction of the line", near(before.x / before.y, after.x / after.y, 1e-6));
  check("dragging marks the illustration as explored", C.result(rotated) === null && C.result(C.move(rotated, { type: "show", value: true })) === "done");
}

{
  const r = rng(1234);
  const s = C.start({ n: 3, rng: r });
  const low = C.setCount(s, 0, r), high = C.setCount(s, 99, r), bad = C.setCount(s, NaN, r);
  equal("the spin cannot go below one line", low.n, C.MIN_LINES);
  equal("the spin cannot go above twenty lines", high.n, C.MAX_LINES);
  equal("a blank spin leaves the count alone", bad.n, 3);
  const shorter = C.setCount(s, 2, r);
  check("removing lines keeps the earlier ones", shorter.n === 2 && samePair(shorter.lines[1], s.lines[1]));
  check("adding lines keeps the earlier ones", C.setCount(s, 7, r).lines.slice(0, 3).every((l, i) => samePair(l, s.lines[i])));
  check("the selected line stays in range after shrinking", C.setCount(C.move(s, { type: "select", value: 19 }), 2, r).selected < 2);
  equal("selection wraps around", C.move(s, { type: "select", value: -1 }).selected, 2);
  equal("slide mode toggles", C.move(s, { type: "slide", value: true }).slide, true);
  equal("New lines keeps the count", C.move(s, { type: "new", rng: r }).n, 3);
  check("New lines keeps what the visitor has explored", (() => {
    const seen = C.move(C.move(s, { type: "show", value: true }), { type: "new", rng: r });
    return seen.showIntersection && seen.explored.options && C.result(seen) === null;
  })());
  check("the keyboard end stays on the board", (() => {
    const q = C.moveEnd(s, 0, "p1", { x: 9999, y: -9999 });
    // A nearly vertical line uses the applet's five-pixel overshoot at top/bottom.
    return [q.lines[0].p1, q.lines[0].p2].every((p) =>
      p.x >= 0 && p.x <= 400 && p.y >= -5 && p.y <= 305);
  })());
}

done("half-plane-test");
