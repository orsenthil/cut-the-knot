#!/usr/bin/env node
"use strict";

/*
 * Logic test for droz-farny-circles/droz-farny-circles-core.js.
 *
 *   node porting/check-droz-farny-circles.mjs
 *
 * The applet is an illustration, so there is no finite game tree to walk.
 * Instead the test visits thousands of configurations: it checks the page's
 * two concrete claims (the six cut points lie on one circle centred at P, and
 * the P-circle and Q-circle have equal radius), the page's metric formula
 * PY² = 2·PaM² + PQ²/2, the coincidence of the two pedal circles, and that the
 * applet's rotating-arcs construction gives the barycentric isogonal
 * conjugate. The circumcentre/orthocentre special case is checked separately.
 * A second transcription of DrawArcs, NearestPoint, Intersect(circle, line)
 * and GetCircle, written straight from the bytecode, is compared with the
 * core everywhere, including P on the circumcircle where Q disappears.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("droz-farny-circles/droz-farny-circles-core.js", "DrozFarnyCirclesCore");
const rand = rng(20261127);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  check("an illustration is never won or lost", C.result(s) === null);
  const area = Math.abs(C.cross(s.A, s.B, s.C)) / 2;
  check("the opening triangle has a real area", area > 1000, String(area));
  equal("the opening circumradius is floor(min(400,250)/3)", Math.round(C.measurements(s).circum.r * 1e6) / 1e6, 83);
  check("P is inside the triangle and off the circumcircle", !C.measurements(s).onCircle && C.measurements(s).Q !== null);
  const m = C.measurements(s);
  const mix = (a, b, c) => (a + 3 * b + 5 * c) / 9;
  check("P is the applet's (A + 3B + 5C)/9", Math.abs(s.P.x - mix(s.A.x, s.B.x, s.C.x)) < 1e-12 &&
    Math.abs(s.P.y - mix(s.A.y, s.B.y, s.C.y)) < 1e-12);
  const q = C.conjugate(s, s.P);
  check("Q from the rotating arcs is the isogonal conjugate", q && C.distance(q, m.Q) < 1e-6);
  const before = { ...s.P };
  const moved = C.withPoint(s, "P", { x: before.x + 7, y: before.y - 3 });
  check("withPoint leaves the old position alone", s.P.x === before.x && s.P.y === before.y &&
    moved.P.x === before.x + 7 && moved.P.y === before.y - 3);
  const shifted = C.shiftTriangle(s, 12, -8);
  check("shifting the triangle moves ABC but not P", shifted.A.x === s.A.x + 12 && shifted.B.y === s.B.y - 8 && shifted.P.x === s.P.x);
  check("P moved back after a shift is still P", C.shiftTriangle(s, 0, 0).P.y === s.P.y);
  check("three collinear corners are degenerate", C.isDegenerate({ A: { x: 0, y: 0 }, B: { x: 1, y: 1 }, C: { x: 2, y: 2 }, P: s.P }));
  check("a real triangle is not degenerate", !C.isDegenerate(s));
}

/* ------------------------------------------- 2. every case, where it is small */

/* Random positions with room for the circles to meet the side lines. */
function randomState() {
  for (;;) {
    const pt = () => ({ x: 40 + rand() * 320, y: 20 + rand() * 210 });
    const s = { A: pt(), B: pt(), C: pt(), P: pt() };
    const area = Math.abs(C.cross(s.A, s.B, s.C)) / 2;
    const sides = [C.distance(s.A, s.B), C.distance(s.B, s.C), C.distance(s.C, s.A)];
    if (area > 2500 && Math.min(...sides) > 50) return s;
  }
}

{
  /* A cut point very close to a vertex, or three nearly collinear chosen cut
     points, make the applet's own reconstruction unstable. Those configurations
     are counted and skipped: the six-point claim itself is still checked on
     every well-conditioned position. */
  const distToLine = (p, a, b) => Math.abs(C.cross(a, b, p)) / C.distance(a, b);
  const wellConditioned = (s, m) => {
    const sides = [[s.B, s.C], [s.C, s.A], [s.A, s.B]];
    if (sides.some(([a, b]) => distToLine(s.P, a, b) < 2 || distToLine(m.Q, a, b) < 2)) return false;
    const scale = Math.max(C.distance(s.A, s.B), C.distance(s.B, s.C), C.distance(s.C, s.A), m.PQ);
    for (const cuts of [m.cuts.P, m.cuts.Q]) {
      const [u, v, w] = cuts.map((pair) => pair && pair[0]);
      if (!u || !v || !w || Math.abs(C.cross(u, v, w)) < 1e-3 * scale ** 2) return false;
    }
    return true;
  };

  let usable = 0, skipped = 0;
  let sixP = 0, sixQ = 0, circleP = 0, circleQ = 0, equalRadius = 0;
  let pedalSame = 0, formulaOk = 0, bigAtP = 0, bigAtQ = 0;
  let worstFormula = 0, worstRadius = 0;

  for (let t = 0; t < 320; t++) {
    const tri = randomState();
    for (let k = 0; k < 12; k++) {
      const s = { ...tri, P: { x: 15 + rand() * 370, y: 10 + rand() * 230 } };
      const m = C.measurements(s);
      if (m.degenerate || !m.Q || !m.big.P || !m.big.Q ||
          m.allCuts.P.length !== 6 || m.allCuts.Q.length !== 6 ||
          !Number.isFinite(m.big.P.r) || !Number.isFinite(m.big.Q.r) ||
          !wellConditioned(s, m)) { skipped++; continue; }
      usable++;
      const scale = Math.max(C.distance(s.A, s.B), C.distance(s.B, s.C), C.distance(s.C, s.A), m.PQ);
      const tol = 1e-7 * scale;

      // The page: all six points from the P-feet circles sit on one circle at P.
      const dP = m.allCuts.P.map((y) => C.distance(s.P, y));
      const dQ = m.allCuts.Q.map((y) => C.distance(m.Q, y));
      if (dP.every((d) => Math.abs(d - dP[0]) < tol)) sixP++;
      if (dQ.every((d) => Math.abs(d - dQ[0]) < tol)) sixQ++;
      if (Math.abs(dP[0] - dQ[0]) < tol) equalRadius++;

      // The applet's own reconstructed circles: circumcentre of three cuts,
      // radius the mean of the three distances to it.
      if (C.distance(m.big.P.center, s.P) < tol) bigAtP++;
      if (C.distance(m.big.Q.center, m.Q) < tol) bigAtQ++;
      if (Math.abs(m.big.P.r - m.big.Q.r) < tol &&
          Math.abs(m.big.P.r - dP[0]) < tol) circleP++;
      if (Math.abs(m.big.Q.r - dQ[0]) < tol) circleQ++;

      // The pedal circles of P and Q share a centre and a radius, and the
      // page's formula gives the radius of both large circles.
      const feet = [...Object.values(m.feet.P), ...Object.values(m.feet.Q)];
      const radii = feet.map((f) => C.distance(f, m.M));
      if (radii.every((r) => Math.abs(r - radii[0]) < tol)) pedalSame++;
      const expect = 2 * m.pedalR ** 2 + m.PQ ** 2 / 2;
      const err = Math.abs(m.formulaR ** 2 - expect) / Math.max(1, expect);
      worstFormula = Math.max(worstFormula, err);
      worstRadius = Math.max(worstRadius, Math.abs(m.formulaR - dP[0]) / Math.max(1, dP[0]));
      if (err < 1e-12) formulaOk++;
    }
  }

  check(`enough usable configurations (${usable} of ${320 * 12}, ${skipped} skipped)`, usable > 3000, String(usable));
  check(`all six P-foot cut points lie on one circle at P (${sixP})`, sixP === usable);
  check(`all six Q-foot cut points lie on one circle at Q (${sixQ})`, sixQ === usable);
  check(`the two circles have the same radius (${equalRadius})`, equalRadius === usable);
  check(`the applet's GetCircle finds the centre P (${bigAtP})`, bigAtP === usable);
  check(`the applet's GetCircle finds the centre Q (${bigAtQ})`, bigAtQ === usable);
  check(`its radius matches the P cut points (${circleP})`, circleP === usable);
  check(`its radius matches the Q cut points (${circleQ})`, circleQ === usable);
  check(`the two pedal circles coincide (${pedalSame})`, pedalSame === usable);
  check(`PY² = 2·PaM² + PQ²/2 at every position (${formulaOk})`, formulaOk === usable,
    `worst relative error ${worstFormula.toExponential(2)}`);
  check("the formula's radius is the one drawn", worstRadius < 1e-9, worstRadius.toExponential(2));
}

{
  // Conjugating is an involution; the barycentric formula agrees with the
  // applet's construction wherever Q is finite.
  let agree = 0, back = 0, bad = 0;
  for (let t = 0; t < 500; t++) {
    const s = randomState();
    const m = C.measurements(s);
    if (!m.Q) continue;
    const q = C.conjugate(s, s.P);
    const scale = C.distance(s.A, s.B) + C.distance(s.B, s.C);
    if (q && C.distance(q, m.Q) < 1e-7 * Math.max(scale, m.PQ)) agree++;
    else bad++;
    const p2 = C.conjugate(s, q);
    if (p2 && C.distance(p2, s.P) < 1e-7 * Math.max(scale, m.PQ)) back++;
  }
  check(`the drawn Q is the isogonal conjugate (${agree} cases)`, bad === 0 && agree > 400, `${bad} differ`);
  check(`conjugating Q gives P back (${back} cases)`, back > 400, `${back}`);
}

{
  // The page's special case: the circumcenter O and orthocenter H are a pair
  // of isogonal conjugates, and the two circles still have equal radii.
  let ok = 0;
  for (let t = 0; t < 120; t++) {
    const tri = randomState();
    const O = C.circumcenter(tri.A, tri.B, tri.C);
    const H = {
      x: tri.A.x + tri.B.x + tri.C.x - 2 * O.x,
      y: tri.A.y + tri.B.y + tri.C.y - 2 * O.y,
    };
    const s = { ...tri, P: O };
    const m = C.measurements(s);
    const scale = C.distance(tri.A, tri.B) + tri.B.x;
    const cl = C.claims(s);
    if (!m.Q || C.distance(m.Q, H) > 1e-6 * scale || !cl.applicable ||
        !cl.onP || !cl.onQ || !cl.equalR || !cl.formula) continue;
    ok++;
  }
  check(`O and H work in ${ok} of 120 triangles`, ok >= 110, String(ok));
}

/* ----------------------------- 3. the same answers as the applet's own method */

{
  /* Fresh transcription of the Java methods, not calling the core's helpers.
     GeoSDoub: FindOrientation, ComputeSignedAngle, Rotate, Intersect,
     NearestPoint, Intersect(circle,line), FindCircumcenter.
     Canvas: DrawMatchingArcs, DrawArcs, GetCircle, DrawOneCircle, ComputePerps. */
  const dist = (p, q) => Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
  const orient = (p, q, r) =>
    (r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y > 0 ? 1 : -1);
  const angle = (o, p, q) => {
    const a = dist(o, p), b = dist(o, q);
    if (!a || !b) return 0;
    const cs = (dist(o, p) ** 2 + dist(o, q) ** 2 - dist(p, q) ** 2) / (2 * a * b);
    return orient(o, p, q) * Math.acos(Math.max(-1, Math.min(1, cs)));
  };
  const rotate = (c, p, t) => {
    const co = Math.cos(t), si = Math.sin(t);
    return {
      x: c.x + co * (p.x - c.x) - si * (p.y - c.y),
      y: c.y + si * (p.x - c.x) + co * (p.y - c.y),
    };
  };
  const meet = (a, b, c, d) => {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  };
  const match = (P, V, X, Y) => rotate(V, Y, angle(V, P, X));
  const circum = (a, b, c) => {
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const n1 = { x: m1.x + b.y - a.y, y: m1.y - b.x + a.x };
    const n2 = { x: m2.x + c.y - b.y, y: m2.y - c.x + b.x };
    return meet(m1, n1, m2, n2);
  };
  const circleOf = (a, b, c) => {
    const o = circum(a, b, c);
    return { center: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
  };
  /* A different derivation of circle-line intersection: project the centre
     onto the line, then step along it by the right-triangle half-chord. */
  const cuts = (c, r, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
    if (len <= 1) return null;
    const t = ((c.x - a.x) * dx + (c.y - a.y) * dy) / len;
    const h2 = dist(a, c) ** 2 - t * t;
    if (h2 > r * r) return null;
    const u = Math.sqrt(Math.max(0, r * r - h2));
    const pair = [
      { x: a.x + ((t - u) * dx) / len, y: a.y + ((t - u) * dy) / len },
      { x: a.x + ((t + u) * dx) / len, y: a.y + ((t + u) * dy) / len },
    ];
    /* The bytecode's IntersectX returns the larger y first, IntersectY the
       larger x first; GetCircle uses that first point, so keep that order. */
    return Math.abs(a.y - b.y) > 1
      ? pair.sort((p, q) => q.y - p.y)
      : pair.sort((p, q) => q.x - p.x);
  };
  const foot = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return { x: p.x, y: p.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  };
  const java = (s) => {
    const cc = circleOf(s.A, s.B, s.C);
    const onCircle = Math.abs(dist(s.P, cc.center) - cc.r) < 2;
    if (onCircle) return { onCircle, Q: null };
    const rA = match(s.P, s.A, s.B, s.C);
    const rB = match(s.P, s.B, s.A, s.C);
    const tB = angle(s.C, s.P, s.B), tA = angle(s.C, s.P, s.A);
    const rC = Math.abs(tB) < Math.abs(tA) ? match(s.P, s.C, s.B, s.A) : match(s.P, s.C, s.A, s.B);
    const Q = meet(s.A, rA, s.B, rB);
    if (!Number.isFinite(Q.x) || !Number.isFinite(Q.y)) return { onCircle, Q: null, rA, rB, rC };
    const Pa = foot(s.P, s.B, s.C), Pb = foot(s.P, s.C, s.A), Pc = foot(s.P, s.A, s.B);
    const Qa = foot(Q, s.B, s.C), Qb = foot(Q, s.C, s.A), Qc = foot(Q, s.A, s.B);
    const group = (f, through, x, y) => cuts(f, dist(f, through), x, y);
    const p1 = group(Pa, Q, s.B, s.C), p2 = group(Pb, Q, s.C, s.A), p3 = group(Pc, Q, s.A, s.B);
    const q1 = group(Qa, s.P, s.B, s.C), q2 = group(Qb, s.P, s.C, s.A), q3 = group(Qc, s.P, s.A, s.B);
    const ok = (xs) => xs.every(Boolean);
    return {
      onCircle, Q, rA, rB, rC,
      feet: { P: [Pa, Pb, Pc], Q: [Qa, Qb, Qc] },
      cutsP: [p1, p2, p3], cutsQ: [q1, q2, q3],
      bigP: ok([p1, p2, p3]) ? circleOf(p1[0], p2[0], p3[0]) : null,
      bigQ: ok([q1, q2, q3]) ? circleOf(q1[0], q2[0], q3[0]) : null,
    };
  };

  const same = (p, q, tol) => {
    if (!p || !q) return Boolean(p) === Boolean(q);
    if (!Number.isFinite(p.x) || !Number.isFinite(q.x)) return Number.isFinite(p.x) === Number.isFinite(q.x);
    return dist(p, q) < tol;
  };
  /* Match unordered pairs of cut points numerically, rather than by rounding. */
  const sameCuts = (a, b, tol) => {
    if (!a || !b) return !a && !b;
    const left = [...a], right = [...b];
    for (const p of left) {
      const i = right.findIndex((q) => dist(p, q) < tol);
      if (i < 0) return false;
      right.splice(i, 1);
    }
    return right.length === 0;
  };

  let compared = 0, onCircle = 0, bigPossible = 0;
  let qDiff = 0, footDiff = 0, cutDiff = 0, bigDiff = 0, arcDiff = 0, mismatch = 0;
  for (let t = 0; t < 1400; t++) {
    const s = randomState();
    const j = java(s);
    const m = C.measurements(s);
    if (m.degenerate) continue;
    compared++;
    if (j.onCircle) onCircle++;
    const tol = 1e-5 * Math.max(100, C.distance(s.A, s.B));
    if (!same(j.Q, m.Q, tol)) { mismatch++; continue; }
    const lines = [m.lines.A, m.lines.B, m.lines.C];
    const jlines = [j.rA, j.rB, j.rC];
    for (let i = 0; i < 3; i++) {
      if (jlines[i] && !same(jlines[i], lines[i].R, tol)) arcDiff++;
    }
    if (!j.Q) continue;
    for (let i = 0; i < 3; i++) {
      if (!same(j.feet.P[i], Object.values(m.feet.P)[i], tol)) footDiff++;
      if (!same(j.feet.Q[i], Object.values(m.feet.Q)[i], tol)) footDiff++;
      if (!sameCuts(j.cutsP[i], m.cuts.P[i], tol)) cutDiff++;
      if (!sameCuts(j.cutsQ[i], m.cuts.Q[i], tol)) cutDiff++;
    }
    /* Reconstructing a circle from three nearly collinear cut points (or two
       nearly coincident cuts) amplifies floating-point noise differently in
       the two algebra paths. Compare those circles only where they are
       well separated; Q and the cut points themselves were compared on all
       configurations above. */
    const stable = j.bigP && j.bigQ && m.big.P && m.big.Q &&
      [j.cutsP, j.cutsQ].every((group) => group.every((pair) => pair && dist(pair[0], pair[1]) > 2)) &&
      [m.cuts.P, m.cuts.Q].every((group) => {
        const [u, v, w] = group.map((pair) => pair && pair[0]);
        return u && v && w && Math.abs(C.cross(u, v, w)) > 1e-3 * C.distance(s.A, s.B) ** 2;
      });
    if (stable) {
      bigPossible++;
      if (same(j.bigP.center, m.big.P.center, tol) && Math.abs(j.bigP.r - m.big.P.r) < tol &&
          same(j.bigQ.center, m.big.Q.center, tol) && Math.abs(j.bigQ.r - m.big.Q.r) < tol) bigDiff++;
    }
  }

  check(`compared ${compared} configurations with the bytecode transcription`, compared > 1200, String(compared));
  check(`Q agrees everywhere, including ${onCircle} on-circle cases`, mismatch === 0, `${mismatch} differ`);
  check(`the three rotated arc endpoints agree`, arcDiff === 0, `${arcDiff} differ`);
  check(`all six feet agree`, footDiff === 0, `${footDiff} differ`);
  check(`all six circle-line cut pairs agree`, cutDiff === 0, `${cutDiff} differ`);
  check(`both reconstructed circles agree (${bigDiff} of ${bigPossible})`, bigDiff === bigPossible,
    `${bigPossible - bigDiff} differ`);
}

done("droz-farny-circles");
