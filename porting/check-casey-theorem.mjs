#!/usr/bin/env node
"use strict";

/*
 * Logic test for casey-theorem/casey-theorem-core.js.
 *
 *   node porting/check-casey-theorem.mjs
 *
 * Checked: the starting four points and the radii/Inside flags against the
 * applet's Reset() and Compute(); the six drawn tangents against a second,
 * literal transcription of the applet's Tangents/Inversion bytecode (circle
 * intersections, homothety tangency points and SelectTangent) over hundreds of
 * mixed inside/outside configurations; and the page's claim
 * t12*t34 + t14*t23 = t13*t24 on those configurations. Also checks the
 * Ptolemy zero-radius limit, the failure of the identity when the four
 * circles leave cyclic order, independence of the big radius, and safe
 * behaviour for missing tangents and degenerate input.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("casey-theorem/casey-theorem-core.js", "CaseyTheoremCore");

const TWO_PI = 2 * Math.PI;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const closeSegment = (a, b, tol) => {
  if (!a || !b) return false;
  const key = (p) => `${p.x.toFixed(7)},${p.y.toFixed(7)}`;
  return (
    (closePoint(a.p, b.p, tol) && closePoint(a.q, b.q, tol)) ||
    (closePoint(a.p, b.q, tol) && closePoint(a.q, b.p, tol)) ||
    (key(a.p) === key(b.q) && key(a.q) === key(b.p))
  );
};

/* ------------------------------------------------ the applet, transcribed */

/* GeoSDoub.FindOrientation: sign of the cross product, +1 when positive. */
function orientation(a, b, c) {
  const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.IntersectCirclesX / IntersectCirclesY, straight from the bytecode. */
function circleIntersections(c1, r1, c2, r2) {
  const byX = Math.abs(c1.x - c2.x) > 1;
  const u1 = byX ? c1.x : c1.y, u2 = byX ? c2.x : c2.y;
  const v1 = byX ? c1.y : c1.x, v2 = byX ? c2.y : c2.x;
  const m = -(v1 - v2) / (u1 - u2);
  const b = (u1 * u1 - u2 * u2 + v1 * v1 - v2 * v2 - r1 * r1 + r2 * r2) / (2 * (u1 - u2));
  const t = b - u1;
  const A = 1 + m * m;
  const B = m * t - v1;
  const Cc = t * t + v1 * v1 - r1 * r1;
  const disc = B * B - A * Cc;
  if (!(disc >= 0)) return null;
  const root = Math.sqrt(disc);
  /* IntersectCirclesX solves for y and returns (m*y+b, y); Y solves for x
   * and returns (x, m*x+b). Getting that the wrong way round was the first
   * thing my transcription got wrong. */
  return [(-B + root) / A, (-B - root) / A].map((u) => {
    const v = m * u + b;
    return byX ? { x: v, y: u } : { x: u, y: v };
  });
}

/* Inversion.Tangent(circle, point): a line (point, tangency point) each way. */
function inversionTangent(circle, point) {
  const d2 = (circle.x - point.x) ** 2 + (circle.y - point.y) ** 2;
  const len = Math.sqrt(d2 - circle.r * circle.r);
  if (!Number.isFinite(len)) return null;
  const pts = circleIntersections(circle, circle.r, point, len);
  if (!pts) return null;
  return pts.map((t) => ({ m_1: point, m_2: t }));
}

/* Tangents.GetExternalTangents: shrink the larger circle by the smaller one. */
function externalTangents(c1, c2) {
  const big = c1.r > c2.r ? c1 : c2;
  const small = c1.r > c2.r ? c2 : c1;
  const diff = big.r - small.r;
  if (Math.abs(diff) < 1e-12) return null;
  const B = { x: big.x, y: big.y, r: diff };
  const lines = inversionTangent(B, small);
  if (!lines) return null;
  return lines.map((line) => ({
    m_1: {
      x: big.x + ((line.m_2.x - big.x) * big.r) / diff,
      y: big.y + ((line.m_2.y - big.y) * big.r) / diff,
    },
    m_2: {
      x: small.x + ((line.m_2.x - big.x) * small.r) / diff,
      y: small.y + ((line.m_2.y - big.y) * small.r) / diff,
    },
  }));
}

/* Tangents.GetInternalTangents: grow the first circle by the second one. */
function internalTangents(c1, c2) {
  const sum = c1.r + c2.r;
  if (sum < 1e-12) return null;
  const B = { x: c1.x, y: c1.y, r: sum };
  const lines = inversionTangent(B, c2);
  if (!lines) return null;
  return lines.map((line) => ({
    m_1: {
      x: c1.x + ((line.m_2.x - c1.x) * c1.r) / sum,
      y: c1.y + ((line.m_2.y - c1.y) * c1.r) / sum,
    },
    m_2: {
      x: c2.x - ((line.m_2.x - c1.x) * c2.r) / sum,
      y: c2.y - ((line.m_2.y - c1.y) * c2.r) / sum,
    },
  }));
}

/* Tangents.SelectTangent: keep the tangent facing the third circle. */
function selectTangent(c1, c2, lines, orient) {
  if (!lines) return null;
  const mid = { x: (lines[0].m_1.x + lines[0].m_2.x) / 2, y: (lines[0].m_1.y + lines[0].m_2.y) / 2 };
  return orientation(c1, c2, mid) * orient > 0 ? lines[0] : lines[1];
}

/* CaseyTheoremCanvas.Compute + DrawTangent for one pair and a third circle. */
function appletSegment(s, i, j, k) {
  const circles = C.circles(s);
  const a = circles[i], b = circles[j], c = circles[k];
  const c1 = { x: a.center.x, y: a.center.y, r: a.radius };
  const c2 = { x: b.center.x, y: b.center.y, r: b.radius };
  const same = a.inside === b.inside; // DrawTangent's S5
  const orient = orientation(a.center, b.center, c.center);
  const line = selectTangent(
    c1, c2,
    same ? externalTangents(c1, c2) : internalTangents(c1, c2),
    orient,
  );
  if (!line) return null;
  return { p: line.m_1, q: line.m_2, external: same, length: dist(line.m_1, line.m_2) };
}

/* --------------------------------------------- 1. the start and the options */

{
  const s = C.start();
  const S = { x: 200, y: 150 }, R = 75;
  equal("start S matches Reset's (width/2, height/2)", s.S, S);
  equal("start R matches Reset's min(width,height)/4", s.R, R);
  const angles = [Math.PI / 6, (5 * Math.PI) / 6, 3.765191430678208, (5 * Math.PI) / 3];
  const expected = angles.map((a, i) => ({
    x: S.x + (i === 1 ? 0.1 : 0) + R * Math.cos(a),
    y: S.y + R * Math.sin(a),
  }));
  for (let i = 0; i < 4; i++) {
    check(`start point ${i} matches Reset's cos/sin placement`, closePoint(s.points[i], expected[i], 1e-12));
  }
  check("the four start points come in cyclic order", C.cyclicOrder(s));
  check("a non-square canvas uses the applet's floor division",
    C.start({ width: 401, height: 301 }).R === 75 &&
    C.start({ width: 401, height: 301 }).S.x === 200);
  check("withPoint does not change the old position", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.points[0].x === expected[0].x && next.points[0].x === 10 && next.points[1].x === s.points[1].x;
  })());
  check("an unknown handle leaves the position alone", C.withPoint(s, "Z", { x: 1, y: 2 }).points[0].x === expected[0].x);
  check("an illustration cannot be won or lost", C.result(s) === null);
}

/* ------------------------------ 2. Compute's radii and the starting tangents */

{
  const s = C.start();
  const cs = C.circles(s);
  for (let i = 0; i < 4; i++) {
    const d = dist(s.S, s.points[i]);
    check(`circle ${i} radius is |d - R|`, close(cs[i].radius, Math.abs(d - s.R), 1e-12));
    check(`circle ${i} Inside flag matches d > R`, cs[i].inside === (d > s.R));
  }
  check("the start is essentially Ptolemy's zero-radius case", cs.every((c) => c.radius < 0.1));
  const m = C.measurements(s);
  check("all six start tangents exist", m.tangents.every((t) => t.length !== null));
  check("the start satisfies Casey's identity", C.claims(s).caseyIdentity);
  check("the start satisfies every claim", Object.values(C.claims(s)).every(Boolean));
  check("the start's products agree", close(m.left, m.right, 1e-5));
}

/* ------------------- 3. the applet's tangent construction vs the core's math */

{
  const rand = rng(1881);
  let compared = 0;
  let identity = 0;
  let mixed = 0;
  for (let trial = 0; trial < 260; trial++) {
    const S = { x: 200 + rand() * 20 - 10, y: 150 + rand() * 20 - 10 };
    const R = 65 + rand() * 20;
    /* Four directions in order around S, with varied distances: some circles
     * inside the big circle, some outside, and radii that differ a lot. */
    const a0 = rand() * TWO_PI;
    const gaps = [0.4 + rand() * 1.2, 0.4 + rand() * 1.2, 0.4 + rand() * 1.2];
    const angles = [a0, a0 + gaps[0], a0 + gaps[0] + gaps[1], a0 + gaps[0] + gaps[1] + gaps[2]];
    const ds = angles.map(() => R * (0.35 + rand() * 1.3));
    const points = angles.map((a, i) => ({
      x: S.x + ds[i] * Math.cos(a),
      y: S.y + ds[i] * Math.sin(a),
    }));
    const s = { S, R, points };
    const cs = C.circles(s);
    if (cs.some((c) => c.radius < 0.5)) continue;
    if (new Set(cs.map((c) => c.inside)).size > 1) mixed++;
    const cl = C.claims(s);
    if (!cl.tangentsExist || !cl.cyclicOrder) continue;
    const m = C.measurements(s);
    const tol = 2e-5 * Math.max(R, 1);

    for (const [i, j, k] of C.PAIRS) {
      const applet = appletSegment(s, i, j, k);
      const core = C.tangentSegment(s, i, j, k);
      if (!applet || !core) {
        check(`trial ${trial} pair ${i}${j}: both constructions find a tangent`, false);
        continue;
      }
      if (!closeSegment(applet, core, tol)) {
        check(`trial ${trial} pair ${i}${j}: applet tangency points match the core`, false,
          `applet ${JSON.stringify(applet)}, core ${JSON.stringify(core)}`);
      }
      if (!close(core.length, C.tangentLength(s, i, j), tol)) {
        check(`trial ${trial} pair ${i}${j}: segment length matches the closed form`, false);
      }
      if (applet.external !== core.external) {
        check(`trial ${trial} pair ${i}${j}: red/blue tangent type matches`, false);
      }
      compared++;
    }
    /* The identity, measured on the applet's own drawn segments. */
    const t = (i, j) => {
      const pair = m.tangents.find((x) => (x.i === i && x.j === j) || (x.i === j && x.j === i));
      const seg = appletSegment(s, pair.i, pair.j, pair.k);
      return seg ? seg.length : null;
    };
    const t01 = t(0, 1), t12 = t(1, 2), t23 = t(2, 3), t03 = t(0, 3), t02 = t(0, 2), t13 = t(1, 3);
    const left = t01 * t23 + t03 * t12, right = t02 * t13;
    if (!close(left, right, 1e-6 * Math.max(left, right))) {
      check(`trial ${trial}: the applet's drawn segments satisfy Casey's identity`, false,
        `${left} vs ${right}`);
    }
    if (!cl.caseyIdentity) check(`trial ${trial}: the core's identity claim holds`, false);
    identity++;
  }
  check(`applet and core agree on all ${compared} drawn tangents`, compared > 1200);
  check(`the identity holds on ${identity} configurations`, identity > 200);
  check(`some configurations mix inside and outside circles`, mixed > 40);
}

/* ------------------------------------------ 4. Ptolemy and the order proviso */

{
  const S = { x: 200, y: 150 }, R = 75;
  const pts = [45, 135, 225, 315].map((a) => ({
    x: S.x + 100 * Math.cos((a * Math.PI) / 180),
    y: S.y + 100 * Math.sin((a * Math.PI) / 180),
  }));
  const cyclic = { S, R, points: pts };
  check("four equal-radius circles are cyclic", C.cyclicOrder(cyclic));
  check("their identity holds", C.claims(cyclic).caseyIdentity);

  /* Zero radii: the tangent segments are just chords, so this is Ptolemy. */
  const flat = { S, R: 0.000001, points: pts };
  const chord = (i, j) => dist(pts[i], pts[j]);
  const ptolemy = chord(0, 1) * chord(2, 3) + chord(0, 3) * chord(1, 2);
  const diagonal = chord(0, 2) * chord(1, 3);
  check("the near-zero-radius limit keeps the same circle touch", C.claims(flat).caseyIdentity);
  const zero = C.measurements({ S, R: 0, points: pts });
  check("with R=0 the products are the chord products", close(zero.left, ptolemy, 1e-9));
  check("Ptolemy's two sides agree here", close(ptolemy, diagonal, 1e-9));

  /* Moving B past D breaks the order, and the identity with it. */
  const crossed = C.withPoint(cyclic, "B", {
    x: S.x + 100 * Math.cos(5.5), y: S.y + 100 * Math.sin(5.5),
  });
  check("crossing two points breaks cyclic order", !C.cyclicOrder(crossed));
  check("the identity is not claimed out of cyclic order", !C.claims(crossed).caseyIdentity);
  check("the broken order really changes the products", Math.abs(C.measurements(crossed).difference) > 1);
}

/* ------------------------------------ 5. independence of R and empty tangents */

{
  const S = { x: 200, y: 150 };
  const pts = [0.3, 1.9, 3.6, 5.4].map((a) => ({
    x: S.x + 105 * Math.cos(a), y: S.y + 105 * Math.sin(a),
  }));
  const lengthsFor = (R) => C.measurements({ S, R, points: pts }).tangents.map((t) => t.length);
  const a = lengthsFor(40), b = lengthsFor(90);
  check("tangent lengths do not depend on the big radius: all six pairs",
    a.every((v, i) => close(v, b[i], 1e-9)));

  /* Two coincident centres have no tangent: the core must say null, not NaN. */
  const same = {
    S, R: 75,
    points: [pts[0], pts[0], pts[2], pts[3]],
  };
  check("coincident circles have no tangent length", C.tangentLength(same, 0, 1) === null);
  check("coincident circles have no tangent segment", C.tangentSegment(same, 0, 1, 2) === null);
  const cl = C.claims(same);
  check("missing tangents are not claimed", !cl.tangentsExist && !cl.caseyIdentity);

  /* Two centres on the same ray from S collapse their tangent to a point:
   * the triangle inequality makes d(ij) = |rho_i - rho_j| exactly. */
  const collinear = {
    S, R: 75,
    points: [
      { x: 200, y: 150 }, { x: 205, y: 150 },
      { x: 140, y: 220 }, { x: 260, y: 220 },
    ],
  };
  check("centres on one ray give a zero-length tangent",
    close(C.tangentLength(collinear, 0, 1), 0, 1e-12));
  check("a point at the big circle's centre has no defined angle order",
    !C.cyclicOrder(collinear));
}

done("casey-theorem");
