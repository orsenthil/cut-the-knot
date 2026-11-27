#!/usr/bin/env node
"use strict";

/*
 * Logic test for deco-symmetry-4/deco-symmetry-4-core.js.
 *
 *   node porting/check-deco-symmetry-4.mjs
 *
 * The page's claims are checked, not copied: "It can be done in just two
 * cuts", "the above decomposition shows that every triangle can be decomposed
 * into 4 isosceles triangles", the acute/circumcenter claim and the
 * right-triangle/midpoint claim. They are tested on a grid of the applet's own
 * configurations, on thousands of random ones, and on arbitrary triangles
 * turned so a suitable side is horizontal. The applet's Compute(), NoDraw and
 * SetRotatingPoly() are also written out a second time, straight from the
 * bytecode, and compared point by point with the core.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("deco-symmetry-4/deco-symmetry-4-core.js", "DecoSymmetry4Core");
const TOL = 1e-7;
const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
const close = (a, b, tol = TOL) => !!a && !!b && Number.isFinite(a.x) && Number.isFinite(b.x) &&
  Number.isFinite(a.y) && Number.isFinite(b.y) && near(a.x, b.x, tol) && near(a.y, b.y, tol);
const at = (ax, ay, bx, cx, by = 200) => ({
  A: { x: ax, y: ay }, B: { x: bx, y: by }, C: { x: cx, y: by },
  showNames: false, showHint: false,
});

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const twiceArea = (pts) => pts.reduce((s, p, i) => {
  const q = pts[(i + 1) % pts.length];
  return s + p.x * q.y - p.y * q.x;
}, 0);
const area = (pts) => Math.abs(twiceArea(pts)) / 2;
const sides = (pts) => pts.map((p, i) => dist(p, pts[(i + 1) % pts.length])).sort((a, b) => a - b);
const isosceles = (pts) => {
  const [a, b, c] = sides(pts);
  return near(a, b, 1e-6) || near(b, c, 1e-6);
};
const inside = (p, tri, tol = 1e-6) => {
  const d1 = cross(tri[0], tri[1], p), d2 = cross(tri[1], tri[2], p), d3 = cross(tri[2], tri[0], p);
  const pos = d1 >= -tol && d2 >= -tol && d3 >= -tol;
  const neg = d1 <= tol && d2 <= tol && d3 <= tol;
  return pos || neg;
};
const foot = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return { x: a.x + t * dx, y: a.y + t * dy };
};
const circumcentre = (a, b, c) => {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-10) return null;
  const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
};
const acute = (a, b, c) => {
  const s = [dist(a, b) ** 2, dist(b, c) ** 2, dist(c, a) ** 2].sort((x, y) => x - y);
  return s[2] < s[0] + s[1] - 1e-9;
};

/* ------------------------------------------- 1. the opening illustration */

{
  const s = C.start();
  equal("the opening vertices use the applet's init fractions",
    [s.A, s.B, s.C],
    [{ x: 400 / 3, y: 250 / 6 }, { x: 100, y: 1250 / 6 }, { x: 300, y: 1250 / 6 }]);
  check("the opening checkboxes are unchecked, as in the applet", !s.showNames && !s.showHint);
  const f = C.compute(s);
  check("the opening A' lies on the base BC", f.valid && close(f.Ap, { x: s.A.x, y: s.B.y }));
  check("the opening D is the midpoint of AB", close(f.D, { x: (s.A.x + s.B.x) / 2, y: (s.A.y + s.B.y) / 2 }));
  check("the opening E is the midpoint of AC", close(f.E, { x: (s.A.x + s.C.x) / 2, y: (s.A.y + s.C.y) / 2 }));
  check("the opening cuts are A'D and A'E, so there are three pieces",
    f.pieces.length === 3 && f.pieces[0].points.length === 3 &&
    f.pieces[1].points.length === 4 && f.pieces[2].points.length === 3);
}

/* ------------------------------------- 2. dragging and the applet's options */

{
  const s = C.start();
  const moved = C.move(s, "B", { x: 137, y: 20 });
  check("B keeps its fixed y while sliding horizontally", moved.B.x === 137 && moved.B.y === s.B.y);
  check("C keeps its fixed y too", C.move(s, "C", { x: 60, y: 999 }).C.y === s.C.y);
  check("A is free in both directions", close(C.move(s, "A", { x: 55, y: 17 }).A, { x: 55, y: 17 }));
  check("dragging never changes the state it was given", s.B.x === 100 && s.A.y === 250 / 6);
  check("handles are kept on the board", C.move(s, "A", { x: -20, y: 999 }).A.x === 10 &&
    C.move(s, "A", { x: -20, y: 999 }).A.y === C.HEIGHT - 10);
  check("checkboxes only change their own flag", C.option(C.option(s, "showNames", true), "showHint", true).showNames &&
    C.option(s, "showHint", true).showNames === false);
}

/* ------------------ 3. a second transcription of Compute() from the bytecode */

function legacyIntersect(p, q, r, s) {
  // GeoSDoub.Intersect: line coefficients L(p,q) = (y_p-y_q, x_q-x_p, x_p*y_q-y_p*x_q)
  const l1 = { a: p.y - q.y, b: q.x - p.x, c: p.x * q.y - p.y * q.x };
  const l2 = { a: r.y - s.y, b: s.x - r.x, c: r.x * s.y - r.y * s.x };
  const den = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (l1.b * l2.c - l2.b * l1.c) / den, y: (l1.c * l2.a - l2.c * l1.a) / den };
}

function legacyNoDraw(a, b, c) {
  // The nested dcmpg branches of DecoSymmetry4Canvas.Compute, literally.
  if (b.x - a.x >= 0) {
    if (c.x - a.x >= 0) return true;
    return !(a.x - b.x < 0);
  }
  if (a.x - c.x < 0) return false;
  if (c.x - a.x >= 0) return true;
  return !(a.x - b.x < 0);
}

function legacyCompute(st) {
  const a = st.A, b = st.B, c = st.C;
  const ap = { x: a.x, y: b.y }, bp = { x: b.x, y: a.y }, cp = { x: c.x, y: a.y };
  return { ap, bp, cp, d: legacyIntersect(a, b, ap, bp), e: legacyIntersect(a, c, ap, cp), noDraw: legacyNoDraw(a, b, c) };
}

{
  let cases = 0, badPoints = 0, badFlag = 0, worst = 0;
  for (const bx of [40, 100, 160]) for (const cx of [220, 300, 360]) {
    for (let ax = bx - 30; ax <= cx + 30; ax += 5) for (const ay of [20, 60, 100, 150]) {
      const f = C.compute(at(ax, ay, bx, cx));
      const l = legacyCompute(at(ax, ay, bx, cx));
      for (const [mine, theirs] of [[f.Ap, l.ap], [f.Bp, l.bp], [f.Cp, l.cp], [f.D, l.d], [f.E, l.e]]) {
        const bothNaN = !Number.isFinite(mine.x) && !Number.isFinite(theirs.x);
        if (!bothNaN && !close(mine, theirs)) badPoints++;
        if (Number.isFinite(theirs.x)) worst = Math.max(worst, Math.hypot(mine.x - theirs.x, mine.y - theirs.y));
      }
      if (f.valid === l.noDraw) badFlag++;
      cases++;
    }
  }
  check(`${cases} configurations were compared with the applet's Compute`, cases === 1860);
  check(`every reflected point and cut matches the bytecode transcription (max ${worst})`, badPoints === 0 && worst < TOL);
  check("the Move them enable flag matches the applet's NoDraw in every case", badFlag === 0);
}

/* ---------------- 4. the second transcription of SetRotatingPoly's goal */

function legacySignedAngle(a, b, c) {
  const sq = (p, q) => (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y);
  const cosine = (sq(a, b) + sq(a, c) - sq(b, c)) / 2 / Math.sqrt(sq(a, b)) / Math.sqrt(sq(a, c));
  const angle = Math.acos(cosine);
  const cross2 = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (angle > 0.99 && !((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y) >= 0)) return Math.PI;
  return cross2 > 0 ? angle : -angle;
}

function legacyGoal(from, to) {
  const target = { x: from[0].x + to[1].x - to[0].x, y: from[0].y + to[1].y - to[0].y };
  let angle = legacySignedAngle(from[0], from[1], target);
  if (Number.isNaN(angle)) angle = Math.PI;
  return {
    centre: { x: to.reduce((s, p) => s + p.x, 0) / 3, y: to.reduce((s, p) => s + p.y, 0) / 3 },
    angle,
  };
}

{
  let cases = 0, badCentre = 0, badAngle = 0, badLanding = 0;
  for (const bx of [50, 130]) for (const cx of [260, 340]) {
    for (let ax = bx + 10; ax < cx; ax += 10) for (const ay of [30, 90, 150]) {
      const f = C.compute(at(ax, ay, bx, cx));
      for (const g of f.moving) {
        const legacy = legacyGoal(f.pieces[g.index].points, f.pieces[g.index].final);
        if (!close(g.centre, legacy.centre)) badCentre++;
        if (!near(g.angle, legacy.angle)) badAngle++;
        // The applet's half turn about the crossing point carries each moving
        // piece exactly onto its stored final position.
        const landing = C.movingPoints(f, g.index, 1);
        f.pieces[g.index].final.forEach((p, i) => { if (!close(landing[i], p, 1e-6)) badLanding++; });
        cases++;
      }
    }
  }
  check(`${cases} moving pieces were compared with SetRotatingPoly`, cases > 300);
  check("the goal barycentre matches the bytecode transcription", badCentre === 0);
  check("the goal signed angle matches the bytecode transcription", badAngle === 0);
  check("a half turn about D or E lands every moving vertex on its target", badLanding === 0);
}

/* --------------------------------- 5. the page's two-cuts claim, exhaustively */

function fourIsosceles(f) {
  if (!f.valid || !Number.isFinite(f.D.x) || !Number.isFinite(f.E.x)) return false;
  const half1 = [f.Ap, f.D, f.A];
  const half2 = [f.Ap, f.A, f.E];
  return [f.pieces[0].points, half1, half2, f.pieces[2].points].every(isosceles);
}

function twoCutsWork(f) {
  const source = [f.A, f.B, f.C];
  const mirror = [f.Ap, f.Bp, f.Cp];
  const startArea = f.pieces.reduce((s, p) => s + area(p.points), 0);
  const endArea = area(f.pieces[0].final) + area(f.pieces[1].points) + area(f.pieces[2].final);
  if (!near(startArea, area(source), 1e-6) || !near(endArea, area(mirror), 1e-6)) return false;
  if (!f.pieces.every((p) => p.points.every((v) => inside(v, source)))) return false;
  if (![f.pieces[0].final, f.pieces[1].points, f.pieces[2].final]
    .every((poly) => poly.every((v) => inside(v, mirror)))) return false;
  // Congruence by rotation: matching side lengths and the same orientation.
  for (const i of [0, 2]) {
    const s1 = sides(f.pieces[i].points), s2 = sides(f.pieces[i].final);
    if (!s1.every((v, k) => near(v, s2[k], 1e-6))) return false;
    if (Math.sign(twiceArea(f.pieces[i].points)) !== Math.sign(twiceArea(f.pieces[i].final))) return false;
  }
  return true;
}

{
  let cases = 0, cuts = 0, iso = 0, worstArea = 0;
  for (let bx = 40; bx <= 160; bx += 20) for (let cx = 240; cx <= 360; cx += 20) {
    for (let ax = bx + 10; ax < cx; ax += 10) for (const ay of [20, 50, 80, 110, 140]) {
      const f = C.compute(at(ax, ay, bx, cx));
      cases++;
      if (twoCutsWork(f)) cuts++;
      if (fourIsosceles(f)) iso++;
      worstArea = Math.max(worstArea, Math.abs(f.pieces.reduce((s, p) => s + area(p.points), 0) - area([f.A, f.B, f.C])));
    }
  }
  check(`${cases} valid applet configurations were checked`, cases === 4655);
  check(`"just two cuts": the three pieces tile both triangles by half turns (${cuts}/${cases})`, cuts === cases);
  check(`four isosceles triangles after splitting the middle piece (${iso}/${cases})`, iso === cases);
  check(`piece areas add up to the triangle's area (max error ${worstArea})`, worstArea < 1e-6);
}

/* ----------------------- 6. arbitrary triangles, turned so BC is horizontal */

{
  const rnd = rng(4082);
  let cases = 0, worked = 0;
  for (let i = 0; i < 500; i++) {
    const a = { x: rnd() * 100, y: rnd() * 100 };
    const b = { x: rnd() * 100, y: rnd() * 100 };
    const c = { x: rnd() * 100, y: rnd() * 100 };
    if (Math.abs(cross(a, b, c)) < 200) continue; // skip nearly degenerate triangles
    // Turn a side whose opposite corner stands over it into the applet's base.
    let base = null;
    for (const [p, q, r] of [[b, c, a], [c, a, b], [a, b, c]]) {
      const f = foot(r, p, q);
      const t = dist(p, f) / dist(p, q);
      if (t > 1e-6 && t < 1 - 1e-6) { base = { p, q, r, t }; break; }
    }
    if (!base) continue;
    const { p, q, r, t } = base;
    const L = dist(p, q), h = Math.sign(cross(p, q, r)) * dist(r, foot(r, p, q));
    const turned = at(t * L, h, 0, L, 0);
    cases++;
    if (C.compute(turned).valid && fourIsosceles(C.compute(turned))) worked++;
  }
  check(`${cases} arbitrary triangles were turned into the applet's layout`, cases > 400);
  check(`every one can be split into four isosceles triangles (${worked}/${cases})`, worked === cases);
}

/* ----------------- 7. the page's acute and right-triangle claims */

{
  let acuteCases = 0, acuteGood = 0, rightCases = 0, rightGood = 0;
  for (let ax = 1; ax <= 99; ax += 2) for (const ay of [10, 25, 40, 60, 80]) {
    const a = { x: ax, y: ay }, b = { x: 0, y: 0 }, c = { x: 100, y: 0 };
    if (acute(a, b, c)) {
      const o = circumcentre(a, b, c);
      acuteCases++;
      if (o && inside(o, [a, b, c]) && near(dist(o, a), dist(o, b)) && near(dist(o, b), dist(o, c)) &&
          [a, b, c].every((p, i) => isosceles([p, o, [a, b, c][(i + 1) % 3]]))) acuteGood++;
    }
  }
  for (let h = 10; h <= 200; h += 10) {
    // The right angle is at A: B and C are the ends of a diameter of the
    // circle through A, so M is the midpoint of the hypotenuse BC.
    const a = { x: 0, y: h }, b = { x: -h, y: 0 }, c = { x: h, y: 0 };
    const m = { x: 0, y: 0 };
    rightCases++;
    if (near(dist(m, a), dist(m, b)) && near(dist(m, a), dist(m, c)) && isosceles([a, m, b]) && isosceles([a, m, c])) rightGood++;
  }
  check(`${acuteCases} acute triangles were checked against the circumcenter claim`, acuteCases > 100);
  check(`joining an acute triangle's circumcenter to its vertices gives 3 isosceles triangles (${acuteGood}/${acuteCases})`, acuteGood === acuteCases);
  check(`${rightCases} right triangles were checked against the midpoint claim`, rightCases === 20);
  check(`a right angle joined to the hypotenuse's midpoint gives 2 isosceles triangles (${rightGood}/${rightCases})`, rightGood === rightCases);
}

/* ---------------------------- 8. random applet configurations and edge cases */

{
  const rnd = rng(1234567);
  let valid = 0, validGood = 0, invalid = 0, invalidGood = 0;
  for (let i = 0; i < 2000; i++) {
    const bx = 20 + rnd() * 140, cx = 240 + rnd() * 140, ay = 10 + rnd() * 180;
    const ax = bx - 40 + rnd() * (cx - bx + 80);
    const f = C.compute(at(ax, ay, bx, cx));
    if (f.valid) {
      valid++;
      if (twoCutsWork(f) && fourIsosceles(f) && !legacyCompute(at(ax, ay, bx, cx)).noDraw) validGood++;
    } else {
      invalid++;
      // The applet disables Move them when A is not over the segment BC.
      if (legacyNoDraw(f.A, f.B, f.C) && C.describe(f).includes("not on the base")) invalidGood++;
    }
  }
  check(`${valid} random valid configurations passed both cuts and four isosceles (${validGood})`, valid > 1300 && validGood === valid);
  check(`${invalid} random invalid configurations switched Move them off (${invalidGood})`, invalidGood === invalid);
}

{
  for (const bx of [100, 300]) {
    const f = C.compute(at(bx, 50, 100, 300));
    check(`A exactly above B or C (x=${bx}) is rejected, as in NoDraw`,
      !f.valid && C.describe(f).includes("not on the base"));
  }
  const good = C.compute(at(150, 50, 100, 300));
  check("the status explains the two cuts when A is over the base", C.describe(good).includes("Two cuts"));
  check("the status explains the result after Move them", C.describe(good, true).includes("no flipping"));
  // A degenerate triangle (A level with BC) gives NaN from GeoSDoub.Intersect.
  const flat = C.compute(at(150, 200, 100, 300));
  check("a flat triangle has no usable cuts", !Number.isFinite(flat.D.x) && !Number.isFinite(flat.E.x));
}

done("deco-symmetry-4");
