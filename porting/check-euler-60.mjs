#!/usr/bin/env node
"use strict";

/*
 * Logic test for euler-60/euler-60-core.js.
 *
 *   node porting/check-euler-60.mjs
 *
 * The first half is a second, literal transcription of the applet's own
 * bytecode (Euler60Canvas.init / CheckIfFinished, GeoSDoub.ComputeAngle,
 * FindCircumcenter, FindAltitude and Intersect) compared with the core over a
 * grid of board sizes and many triangles. The second half checks the page's
 * claims: the Euler line of a triangle with a 60 degree angle cuts off an
 * equilateral triangle with BP = BQ = PQ = (AB + BC)/3, and the condition
 * AP + CQ = PQ holds for every side ratio in [1/2, 2] and fails outside it.
 * It also checks the page's printed slope 1/sqrt(1), which is a typo for
 * 1/sqrt(3), and the applet's one-corner-early arc quirk.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("euler-60/euler-60-core.js", "Euler60Core");

const close = (label, a, b, tol = 1e-8) =>
  check(label, Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol,
    `${a} vs ${b}`);
const nearPoint = (label, p, q, tol = 1e-7) => {
  for (const axis of ["x", "y"]) {
    if (Number.isNaN(p[axis]) && Number.isNaN(q[axis])) continue; // parallel lines
    close(`${label}.${axis}`, p[axis], q[axis], tol);
  }
};

/* ------------------------------------------------- second transcription */
/* Written straight from javap, without using any core helper. */

const jq = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
const jd = (p, q) => Math.sqrt(jq(p, q));

function jAngle(p, q, r) {
  const t = (jq(p, q) + jq(q, r) - jq(p, r)) / 2 / jd(p, q) / jd(q, r);
  return Math.acos(t);
}

function jIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}

function jCircum(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  return jIntersect(m1, p, m2, q);
}

function jFoot(p, q, r) {
  const s = { x: p.x + (r.y - q.y), y: p.y - (r.x - q.x) };
  return jIntersect(p, s, q, r);
}

function jOrtho(a, b, c) {
  return jIntersect(a, jFoot(a, b, c), b, jFoot(b, c, a));
}

function jStart(width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const u = Math.floor(Math.min(width, height) / 4);
  const c = { x: cx + 2 * u * Math.cos(0.5), y: cy + 2 * u * Math.sin(0.5) };
  const b = { x: width - c.x, y: c.y };
  const a = { x: (9 * b.x + c.x) / 10, y: cy + u * Math.sin(-1.6) };
  return { A: a, B: b, C: c };
}

/* CheckIfFinished's literal field assignments, including the early S. */
function jFinished(s) {
  const targets = [
    [jAngle(s.A, s.B, s.C), { S: s.A, T: s.B, U: s.C }],
    [jAngle(s.B, s.C, s.A), { S: s.B, T: s.C, U: s.A }],
    [jAngle(s.C, s.A, s.B), { S: s.C, T: s.A, U: s.B }],
  ];
  for (const [angle, out] of targets) {
    if (Math.abs(angle - Math.PI / 3) < 0.01) return { angle, ...out };
  }
  return null;
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  nearPoint("default A", s.A, jStart(400, 300).A);
  nearPoint("default B", s.B, jStart(400, 300).B);
  nearPoint("default C", s.C, jStart(400, 300).C);
  equal("checkboxes start unchecked", s.show,
    { centroid: false, circumcenter: false, orthocenter: false });
  equal("board size is kept", [s.width, s.height], [400, 300]);
}

for (const [width, height] of [[400, 300], [640, 480], [320, 480], [1200, 800], [80, 120]]) {
  const s = C.start({ width, height });
  const j = jStart(width, height);
  nearPoint(`init A ${width}x${height}`, s.A, j.A);
  nearPoint(`init B ${width}x${height}`, s.B, j.B);
  nearPoint(`init C ${width}x${height}`, s.C, j.C);
}

{
  const s0 = C.start({});
  const s1 = C.move(s0, "B", { x: 111, y: 222 });
  nearPoint("move B writes the new corner", s1.B, { x: 111, y: 222 });
  nearPoint("move does not change A", s1.A, s0.A);
  nearPoint("move does not mutate the old state", s0.B, jStart(400, 300).B);
  const s2 = C.toggle(s1, "centroid");
  equal("toggle sets the checkbox", s2.show,
    { centroid: true, circumcenter: false, orthocenter: false });
  equal("toggle leaves the old state alone", s1.show.centroid, false);
}

/* ---------------------------------- 2. every geometry value against javap */

{
  const random = rng(6040);
  for (let i = 0; i < 300; i++) {
    const s = C.start({});
    const t = {
      A: { x: 20 + random() * 360, y: 20 + random() * 260 },
      B: { x: 20 + random() * 360, y: 20 + random() * 260 },
      C: { x: 20 + random() * 360, y: 20 + random() * 260 },
    };
    const state = C.move(C.move(C.move(s, "A", t.A), "B", t.B), "C", t.C);
    const g = C.geometry(state);
    const j = jFinished(state);
    check(`angles ${i} B`, Math.abs(g.angles.B - jAngle(t.A, t.B, t.C)) < 1e-12);
    check(`angles ${i} C`, Math.abs(g.angles.C - jAngle(t.B, t.C, t.A)) < 1e-12);
    check(`angles ${i} A`, Math.abs(g.angles.A - jAngle(t.C, t.A, t.B)) < 1e-12);
    nearPoint(`centroid ${i}`, g.G,
      { x: (t.A.x + t.B.x + t.C.x) / 3, y: (t.A.y + t.B.y + t.C.y) / 3 });
    nearPoint(`circumcenter ${i}`, g.O, jCircum(t.A, t.B, t.C));
    nearPoint(`orthocenter ${i}`, g.H, jOrtho(t.A, t.B, t.C));
    check(`finished flag ${i}`, g.finished === !!j);
    if (j) {
      check(`finished order ${i}`, g.sixty.name ===
        (Math.abs(j.angle - jAngle(t.A, t.B, t.C)) < 1e-12 ? "B"
          : Math.abs(j.angle - jAngle(t.B, t.C, t.A)) < 1e-12 ? "C" : "A"));
      nearPoint(`arc centre S ${i}`, g.sixty.S, j.S);
      nearPoint(`arc point T ${i}`, g.sixty.T, j.T);
      nearPoint(`arc point U ${i}`, g.sixty.U, j.U);
    }
    check(`Euler line drawn ${i}`, g.lineVisible === (jd(g.O, g.H) > 0.5));
  }
}

/* ------------------------------------------- 3. the 60 degree tolerance */

{
  const s = C.withSixty(C.start({}), "B", 1.2);
  const g = C.geometry(s);
  close("preset angle B is exactly 60 degrees", g.angles.B, Math.PI / 3);
  check("preset wakes the applet", g.finished && g.sixty.name === "B");
  nearPoint("applet draws its arcs one corner early", g.sixty.S, s.A);
  const a = C.point(s.B.x + 100, s.B.y);
  const b = C.point(s.B.x + 100 * Math.cos(Math.PI / 3 - 0.03), s.B.y - 100 * Math.sin(Math.PI / 3 - 0.03));
  const c = C.point(s.B.x + 100 * Math.cos(Math.PI / 3 + 0.03), s.B.y - 100 * Math.sin(Math.PI / 3 + 0.03));
  const state = C.move(C.move(C.move(C.start({}), "A", a), "B", s.B), "C", b);
  check("just outside tolerance (0.02 rad) is asleep", !C.geometry(state).finished);
  const state2 = C.move(C.move(C.move(C.start({}), "A", a), "B", s.B), "C", c);
  check("the other side of 60 is asleep too", !C.geometry(state2).finished);
  const tight = C.move(C.move(C.move(C.start({}), "A", a), "B", s.B), "C",
    C.point(s.B.x + 100 * Math.cos(Math.PI / 3 + 0.005), s.B.y - 100 * Math.sin(Math.PI / 3 + 0.005)));
  check("inside tolerance (0.005 rad) wakes", C.geometry(tight).finished);
}

/* ------------------------- 4. the page's equilateral-cut claim, exhaustively */

for (let i = 1; i <= 41; i++) {
  const ratio = 0.2 + i * 0.09; // 0.29 .. 3.89, crossing both boundaries
  const s = C.withSixty(C.start({}), "B", ratio);
  const g = C.geometry(s);
  const k = C.cut(s, "B");
  const ab = C.dist(s.A, s.B);
  const bc = C.dist(s.B, s.C);
  close(`BP=BQ at ratio ${ratio}`, k.BP, k.BQ);
  close(`PQ=t at ratio ${ratio}`, k.PQ, (ab + bc) / 3);
  close(`BP=(AB+BC)/3 at ratio ${ratio}`, k.BP, (ab + bc) / 3);
  close(`PQ length at ratio ${ratio}`, C.dist(k.P, k.Q), k.PQ, 1e-7);
  const bp = C.dist(s.B, k.P);
  const bq = C.dist(s.B, k.Q);
  close(`P on the ray BA at ratio ${ratio}`, bp, k.BP, 1e-7);
  close(`Q on the ray BC at ratio ${ratio}`, bq, k.BQ, 1e-7);
  const expectedInside = ratio >= 0.5 - 1e-12 && ratio <= 2 + 1e-12;
  check(`cut lies on both segments iff 1/2<=AB/BC<=2 at ratio ${ratio}`,
    k.onSegments === expectedInside);
  if (expectedInside) {
    close(`AP+CQ=PQ at ratio ${ratio}`, k.AP + k.CQ, k.PQ, 1e-7);
    check(`Euler line exists at ratio ${ratio}`, g.line !== null);
    // O,H,P,Q collinear: the Euler line really is the cut PQ.
    const oh = C.point(g.H.x - g.O.x, g.H.y - g.O.y);
    const pq = C.point(k.Q.x - k.P.x, k.Q.y - k.P.y);
    close(`PQ parallel to OH at ratio ${ratio}`,
      oh.x * pq.y - oh.y * pq.x, 0, 1e-6);
    // Perpendicular to the bisector of the 60 degree angle.
    const ua = C.point((s.A.x - s.B.x) / ab, (s.A.y - s.B.y) / ab);
    const uc = C.point((s.C.x - s.B.x) / bc, (s.C.y - s.B.y) / bc);
    const bis = C.point(ua.x + uc.x, ua.y + uc.y);
    close(`OH perpendicular to the bisector at ratio ${ratio}`,
      oh.x * bis.x + oh.y * bis.y, 0, 1e-6);
  } else {
    check(`AP+CQ is not PQ off the segments at ratio ${ratio}`,
      Math.abs(k.AP + k.CQ - k.PQ) > 1e-9);
  }
}

/* ------------------------- 5. the page's WLOG algebra and its slope typo */

{
  for (let i = 1; i < 19; i++) {
    const k = i / 20;
    const m = 1 - k;
    const A = { x: -(1 + k), y: -k * Math.sqrt(3) };
    const B = { x: 0, y: Math.sqrt(3) };
    const Cc = { x: 1 + m, y: -m * Math.sqrt(3) };
    const state = C.move(C.move(C.move(C.start({}), "A", A), "B", B), "C", Cc);
    const g = C.geometry(state);
    close(`WLOG centroid x k=${k}`, g.G.x, (m - k) / 3);
    close(`WLOG centroid y k=${k}`, g.G.y, 0);
    close(`WLOG orthocenter x k=${k}`, g.H.x, k - m);
    close(`WLOG orthocenter y k=${k}`, g.H.y, 0);
    // Slope of AH: (y_H - y_A)/(x_H - x_A) = k*sqrt(3)/(2k+1-m) = 1/sqrt(3).
    close(`WLOG slope of AH is 1/sqrt(3) k=${k}`,
      (g.H.y - A.y) / (g.H.x - A.x), 1 / Math.sqrt(3));
    check(`page's printed 1/sqrt(1) is a typo k=${k}`,
      Math.abs((g.H.y - A.y) / (g.H.x - A.x) - 1) > 0.4);
  }
}

/* ------------------------------------- 6. degenerate cases and messages */

{
  const s = C.start({});
  const equi = C.withSixty(C.withSixty(s, "B", 1), "C", 1);
  const g = C.geometry(equi);
  close("equilateral angle B", g.angles.B, Math.PI / 3, 1e-9);
  close("equilateral angle C", g.angles.C, Math.PI / 3, 1e-9);
  close("equilateral angle A", g.angles.A, Math.PI / 3, 1e-9);
  check("the applet's first test wins in an equilateral triangle", g.sixty.name === "B");
  check("no Euler line when O=H", g.line === null && !g.lineVisible);
  const k = C.cut(equi, "B");
  close("equilateral cut length", k.BP, (C.dist(equi.A, equi.B) + C.dist(equi.B, equi.C)) / 3);
  const parallel = C.move(C.move(C.move(s, "A", { x: 0, y: 0 }), "B", { x: 10, y: 0 }), "C", { x: 20, y: 0 });
  check("parallel lines give NaN, as GeoSDoub.Intersect does",
    Number.isNaN(C.intersect(parallel.A, parallel.B, parallel.B, parallel.C).x));
}

done("euler-60");
