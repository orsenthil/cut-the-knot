#!/usr/bin/env node
"use strict";

/*
 * Logic test for droz-farny/droz-farny-core.js.
 *
 *   node porting/check-droz-farny.mjs
 *
 * The core is checked against a second, independent transcription of the
 * applet's own Compute() bytecode: GeoSDoub.Intersect's line coefficients,
 * FindAltitude's far point, FindCircumcenter's bisectors, GetCircle's averaged
 * radius, Perp's 100-unit quarter turn, and IntersectCirclesX/Y's slope form.
 * The two are compared over a grid of triangles times twelve line directions
 * and over 1,200 random configurations, not a handful of samples.
 *
 * Every claim on the applet's page is then checked over the same set: the
 * three midpoints are collinear, so are the three points tX+(1-t)X' for the
 * same t (the determinant really picks up t(1-t)), each pair XX', YY', ZZ' is
 * a diameter of a circle through H, and the reflected points Ka, Kb, Kc and
 * Q lie on the circumcircle. The sibling applet DrozFarnyCircles makes a
 * different claim (two congruent circles for isogonal conjugates); none of
 * that is asserted here.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("droz-farny/droz-farny-core.js", "DrozFarnyCore");
const TOL = 1e-6;
const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
const nearPoint = (a, b, tol = TOL) => C.finite(a) && C.finite(b) && C.dist(a, b) <= tol;
const okPoint = (p) => C.finite(p);

/* -------------------------------------------------- 1. the opening picture */

{
  const s = C.start();
  const k = Math.min(C.WIDTH, C.HEIGHT) / 4;
  check("the opening A follows the applet's angle -1.6",
    nearPoint(s.A, { x: 200 + k * Math.cos(-1.6), y: 150 + k * Math.sin(-1.6) }));
  check("the opening B follows the applet's angle -4.0",
    nearPoint(s.B, { x: 200 + k * Math.cos(-4.0), y: 150 + k * Math.sin(-4.0) }));
  check("the opening C follows the applet's angle -0.2",
    nearPoint(s.C, { x: 200 + k * Math.cos(-0.2), y: 150 + k * Math.sin(-0.2) }));
  check("the opening P lies inside the applet's canvas",
    s.P.x >= 0 && s.P.x <= C.WIDTH && s.P.y >= 0 && s.P.y <= C.HEIGHT);
  check("all fourteen panel checkboxes start unchecked",
    C.OPTION_KEYS.length === 14 && C.OPTION_KEYS.every((key) => s[key] === false));
  const f = C.compute(s);
  check("the opening orthocenter is constructed", okPoint(f.H));
  check("the opening six cuts exist", [f.X, f.Xp, f.Y, f.Yp, f.Z, f.Zp].every(okPoint));
  check("the opening midpoints are collinear", Math.abs(C.collinearity(f, 0.5)) < TOL,
    `error ${C.collinearity(f, 0.5)}`);
}

/* --------------------------------- 2. literal transcription of the bytecode */

/*
 * This is deliberately not built from the core's helpers. Each routine below
 * follows the order of operations in GeoSDoub and DrozFarnyCanvas.Compute().
 */
function appletCompute(s) {
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const inter = (p, q, r, t) => {
    const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
    const a2 = r.y - t.y, b2 = t.x - r.x, c2 = r.x * t.y - r.y * t.x;
    const d = a * b2 - a2 * b;
    if (Math.abs(d) < 1) return null;
    return { x: (b * c2 - b2 * c) / d, y: (c * a2 - c2 * a) / d };
  };
  const altitude = (p, q, r) => inter(p,
    { x: p.x + r.y - q.y, y: p.y - (r.x - q.x) }, q, r);
  const circum = (p, q, r) => {
    const m1 = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const m2 = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
    const f1 = { x: m1.x + q.y - p.y, y: m1.y - (q.x - p.x) };
    const f2 = { x: m2.x + r.y - q.y, y: m2.y - (r.x - q.x) };
    return inter(m1, f1, m2, f2);
  };
  const circle = (p, q, r) => {
    const o = circum(p, q, r);
    if (!o || !Number.isFinite(o.x)) return null;
    return { centre: o, r: (dist(o, p) + dist(o, q) + dist(o, r)) / 3 };
  };
  const circlesMeet = (c1, c2) => {
    if (!c1 || !c2) return null;
    if (Math.abs(c1.centre.x - c2.centre.x) > 1) {
      const m = -(c1.centre.y - c2.centre.y) / (c1.centre.x - c2.centre.x);
      const xr = (c1.centre.x ** 2 - c2.centre.x ** 2 +
        c1.centre.y ** 2 - c2.centre.y ** 2 - c1.r ** 2 + c2.r ** 2) /
        (2 * (c1.centre.x - c2.centre.x));
      const dx = xr - c1.centre.x;
      const A = m * m + 1, B = m * dx - c1.centre.y;
      const Cc = dx * dx + c1.centre.y ** 2 - c1.r ** 2;
      const disc = B * B - A * Cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const t1 = (-B + root) / A, t2 = (-B - root) / A;
      return [{ x: m * t1 + xr, y: t1 }, { x: m * t2 + xr, y: t2 }];
    }
    if (Math.abs(c1.centre.y - c2.centre.y) > 1) {
      const m = -(c1.centre.x - c2.centre.x) / (c1.centre.y - c2.centre.y);
      const yr = (c1.centre.y ** 2 - c2.centre.y ** 2 +
        c1.centre.x ** 2 - c2.centre.x ** 2 - c1.r ** 2 + c2.r ** 2) /
        (2 * (c1.centre.y - c2.centre.y));
      const dy = yr - c1.centre.y;
      const A = m * m + 1, B = m * dy - c1.centre.x;
      const Cc = dy * dy + c1.centre.x ** 2 - c1.r ** 2;
      const disc = B * B - A * Cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const t1 = (-B + root) / A, t2 = (-B - root) / A;
      return [{ x: t1, y: m * t1 + yr }, { x: t2, y: m * t2 + yr }];
    }
    return [c1.centre, c1.centre];
  };
  const other = (pts, p) => dist(pts[0], p) < 0.1 ? pts[1] : pts[0];
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const reflectPoint = (p, q) => ({ x: 2 * q.x - p.x, y: 2 * q.y - p.y });
  // Perp(MPoint, H) in the applet: the second argument is the new base point.
  const perp = (p, q) => ({ x: q.x + (p.y - q.y) * 100, y: q.y - (p.x - q.x) * 100 });
  const live = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  const { A, B, C: Cc, P } = s;
  const Circle = circle(A, B, Cc);
  const Ha = altitude(A, B, Cc), Hb = altitude(B, A, Cc), Hc = altitude(Cc, B, A);
  const H = inter(A, Ha, B, Hb);
  const Ka = live(H) ? reflectPoint(H, Ha) : null;
  const Kb = live(H) ? reflectPoint(H, Hb) : null;
  const Kc = live(H) ? reflectPoint(H, Hc) : null;
  const l1 = { m1: P, m2: H };
  const l2 = live(H) ? { m1: H, m2: perp(P, H) } : { m1: null, m2: null };
  const cut = (l, p, q) => live(l.m2) ? inter(l.m1, l.m2, p, q) : null;
  const X = cut(l1, B, Cc), Xp = cut(l2, B, Cc);
  const Y = cut(l1, Cc, A), Yp = cut(l2, Cc, A);
  const Z = cut(l1, A, B), Zp = cut(l2, A, B);
  const Ma = live(X) && live(Xp) ? mid(X, Xp) : null;
  const Mb = live(Y) && live(Yp) ? mid(Y, Yp) : null;
  const Mc = live(Z) && live(Zp) ? mid(Z, Zp) : null;
  const Ca = live(H) && live(X) && live(Xp) ? circle(H, X, Xp) : null;
  const Cb = live(H) && live(Y) && live(Yp) ? circle(H, Y, Yp) : null;
  const Cc2 = live(H) && live(Z) && live(Zp) ? circle(H, Z, Zp) : null;
  const meet = live(H) ? circlesMeet(Ca, Cb) : null;
  const M = meet ? other(meet, H) : null;
  const Q = live(X) && live(Ka) && live(Y) && live(Kb) ? inter(X, Ka, Y, Kb) : null;
  return {
    H, Ha, Hb, Hc, Ka, Kb, Kc, X, Xp, Y, Yp, Z, Zp, Ma, Mb, Mc, M, Q,
    Circle, Ca, Cb, Cc: Cc2,
  };
}

const pointNames = [
  "H", "Ha", "Hb", "Hc", "Ka", "Kb", "Kc",
  "X", "Xp", "Y", "Yp", "Z", "Zp", "Ma", "Mb", "Mc", "M", "Q",
];
const circleNames = ["Circle", "Ca", "Cb", "Cc"];

/* ------------------------------------------- 3. grid and random configurations */

const configs = [];
{
  const B = { x: 55, y: 235 }, Cc = { x: 345, y: 200 };
  for (let ax = 90; ax <= 290; ax += 40) {
    for (let ay = 25; ay <= 175; ay += 30) {
      const A = { x: ax, y: ay };
      const H = C.compute({ A, B, C: Cc, P: { x: 60, y: 60 } }).H;
      if (!okPoint(H)) continue;
      for (let k = 0; k < 12; k++) {
        const angle = (k * Math.PI) / 6;
        configs.push({
          A, B, C: Cc,
          P: { x: H.x + 90 * Math.cos(angle), y: H.y + 90 * Math.sin(angle) },
        });
      }
    }
  }
  const rnd = rng(1899);
  for (let i = 0; i < 1500; i++) {
    const A = { x: 40 + rnd() * 320, y: 20 + rnd() * 160 };
    const B = { x: 20 + rnd() * 120, y: 180 + rnd() * 110 };
    const Cc = { x: 260 + rnd() * 120, y: 140 + rnd() * 120 };
    const area = Math.abs((B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x));
    if (area < 1000) continue; // nearly collinear: no orthocenter to compare
    configs.push({ A, B, C: Cc, P: { x: rnd() * C.WIDTH, y: rnd() * C.HEIGHT } });
  }
}
check(`a wide set of configurations was generated (${configs.length})`, configs.length > 1800);

{
  const worst = {};
  const compared = {};
  for (const name of pointNames) { worst[name] = 0; compared[name] = 0; }
  for (const name of circleNames) { worst[name] = 0; compared[name] = 0; }
  let skippedM = 0;
  for (const cfg of configs) {
    const f = C.compute(cfg);
    const ref = appletCompute(cfg);
    for (const name of pointNames) {
      if (!okPoint(f[name]) || !okPoint(ref[name])) {
        if (name === "M") skippedM++;
        continue;
      }
      compared[name]++;
      const tol = TOL * Math.max(1, Math.abs(f[name].x), Math.abs(f[name].y),
        Math.abs(ref[name].x), Math.abs(ref[name].y));
      worst[name] = Math.max(worst[name], C.dist(f[name], ref[name]) / tol);
    }
    for (const name of circleNames) {
      if (!f[name] || !ref[name] || !okPoint(f[name].centre) || !okPoint(ref[name].centre)) continue;
      compared[name]++;
      const err = Math.max(C.dist(f[name].centre, ref[name].centre), Math.abs(f[name].r - ref[name].r));
      worst[name] = Math.max(worst[name], err / (TOL * Math.max(1, f[name].r, ref[name].r)));
    }
  }
  for (const name of pointNames.concat(circleNames)) {
    check(`the core matches the applet's Compute() for ${name} (${compared[name]} cases)`,
      compared[name] > configs.length * 0.7 && worst[name] <= 1,
      `${compared[name]} compared, worst scaled error ${worst[name].toExponential(2)}`);
  }
  check("the second transcription reproduces the auxiliary point M too",
    compared.M > configs.length * 0.7, `${compared.M} cases, ${skippedM} skipped`);
}

/* ---------------------------------------------------- 4. the page's claims */

{
  const worstMid = { mid: 0, t0: 0, t1: 0, diameter: 0, right: 0, onCircle: 0 };
  let cases = 0;
  for (const cfg of configs) {
    const f = C.compute(cfg);
    const e = C.errors(f);
    if (!Number.isFinite(e.midpoints)) continue;
    cases++;
    worstMid.mid = Math.max(worstMid.mid, Math.abs(e.midpoints));
    worstMid.t0 = Math.max(worstMid.t0, Math.abs(C.collinearity(f, 0)));
    worstMid.t1 = Math.max(worstMid.t1, Math.abs(C.collinearity(f, 1)));
    worstMid.anyT = Math.max(worstMid.anyT || 0, Number.isFinite(e.anyT) ? e.anyT : 0);
    const pairs = [
      ["xDiameter", "rightX"], ["yDiameter", "rightY"], ["zDiameter", "rightZ"],
    ];
    for (const [diam, right] of pairs) {
      if (Number.isFinite(e[diam])) worstMid.diameter = Math.max(worstMid.diameter, e[diam]);
      if (Number.isFinite(e[right])) worstMid.right = Math.max(worstMid.right, e[right]);
    }
    for (const key of ["hOnX", "hOnY", "hOnZ", "kaOnX", "kbOnY", "kcOnZ",
      "kaOnABC", "kbOnABC", "kcOnABC", "qOnABC", "mOnX", "mOnY", "mOnZ"]) {
      if (Number.isFinite(e[key])) worstMid.onCircle = Math.max(worstMid.onCircle, e[key]);
    }
  }
  check(`the page's midpoint claim holds in all ${cases} configurations`,
    cases > 1800 && worstMid.mid < 1e-5, `max ${worstMid.mid.toExponential(2)}`);
  check("the same-t linear combination is collinear for every t tried",
    worstMid.anyT < 1e-5, `max ${worstMid.anyT.toExponential(2)}`);
  check("t = 0 and t = 1 put the three points on one of the given lines",
    worstMid.t0 < 1e-5 && worstMid.t1 < 1e-5,
    `${worstMid.t0.toExponential(2)}, ${worstMid.t1.toExponential(2)}`);

  check("each intercepted segment has its midpoint as circle centre", worstMid.diameter < 1e-6,
    `max ${worstMid.diameter.toExponential(2)}`);
  check("each intercepted segment subtends a right angle at H", worstMid.right < 1e-6,
    `max ${worstMid.right.toExponential(2)}`);
  check("H, the reflected points, Q and M lie on the circles of the proof",
    worstMid.onCircle < 1e-6, `max ${worstMid.onCircle.toExponential(2)}`);
}

/* ------------------------- 4b. the determinant identity, with arbitrary cuts */

{
  // In H-centred coordinates with the given lines as axes the six cuts are
  // (a,0),(0,b), ... . The page's algebra det(t) = t(1-t) det(1) is an identity
  // for ANY six numbers, not just those coming from a triangle, so test it on
  // arbitrary intercepts and insist that many of the determinants be nonzero.
  const det = (u, v) => u[0] * (v[1] - v[2]) + u[1] * (v[2] - v[0]) + u[2] * (v[0] - v[1]);
  const rnd = rng(1899);
  const ts = [-1, 0, 0.1, 0.25, 0.5, 0.75, 0.9, 1, 2];
  let worst = 0, nonzero = 0;
  for (let i = 0; i < 600; i++) {
    const u = [0, 1, 2].map(() => -100 + rnd() * 200);
    const v = [0, 1, 2].map(() => -100 + rnd() * 200);
    const base = det(u, v);
    if (Math.abs(base) > 1) nonzero++;
    for (const t of ts) {
      const ut = u.map((x) => t * x), vt = v.map((y) => (1 - t) * y);
      worst = Math.max(worst, Math.abs(det(ut, vt) - t * (1 - t) * base) / Math.max(1, Math.abs(base)));
    }
  }
  check(`det(t) = t(1-t) det(1) on 600 arbitrary cuts (${nonzero} nonzero)`,
    nonzero > 500 && worst < 1e-12, `max relative error ${worst.toExponential(2)}`);
}

/* --------------------------------------------- 5. edge cases and state rules */

{
  // The applet's page calls a right triangle and an altitude line trivial.
  const right = { A: { x: 0, y: 0 }, B: { x: 4, y: 0 }, C: { x: 0, y: 3 }, P: { x: 3, y: 2 } };
  const rf = C.compute(right);
  check("a right triangle still gives a finite orthocenter at A", nearPoint(rf.H, right.A));
  check("a right triangle still gives collinear cuts", Math.abs(C.collinearity(rf, 0.5)) < TOL,
    `${C.collinearity(rf, 0.5)}`);

  const s0 = C.start();
  const onAltitude = C.move(s0, "P", s0.A); // the first line is the altitude AH
  const af = C.compute(onAltitude);
  check("a line along an altitude makes the other line parallel to BC",
    !okPoint(af.Xp) && !okPoint(af.Ma));
  check("the page's trivial altitude case does not crash the description",
    typeof C.describe(af) === "string" && C.describe(af).length > 0);

  const atH = C.move(s0, "P", C.compute(s0).H);
  const hf = C.compute(atH);
  check("P at H has no cuts and an honest status", !okPoint(hf.X) && /Move the point P/.test(C.describe(hf)));

  const flat = { A: { x: 10, y: 10 }, B: { x: 200, y: 10 }, C: { x: 390, y: 10 }, P: { x: 30, y: 30 } };
  check("a collinear triangle is handled without NaN coordinates",
    !okPoint(C.compute(flat).H));

  const moved = C.move(s0, "A", { x: -999, y: 9999 });
  check("dragging clamps to the board", moved.A.x === C.MARGIN && moved.A.y === C.HEIGHT - C.MARGIN);
  check("move does not mutate the position it is given", s0.A.x !== moved.A.x);
  const toggled = C.option(s0, "ShowLine", true);
  check("an option can be switched on without mutating the position",
    toggled.ShowLine && !s0.ShowLine);
  check("an unknown option is ignored", C.option(s0, "nonsense", true) === s0);
  check("the status line stays useful after a drag",
    /line up|Move the point P/.test(C.describe(C.compute(moved))));

  // The sibling applet's claim is different: two circles of equal radius for
  // isogonal conjugates. The transcriptions above never assume it.
  check("this theorem is about collinear midpoints, not congruent pedal circles",
    C.errors(C.compute(s0)).anyT < TOL && C.OPTION_KEYS.includes("ABC"));
}

done("droz-farny");
