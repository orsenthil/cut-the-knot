#!/usr/bin/env node
"use strict";

/*
 * Logic test for existence-of-circumcenter/existence-of-circumcenter-core.js.
 *
 *   node porting/check-existence-of-circumcenter.mjs
 *
 * Section 1 checks the starting triangle and the applet's drag rules.
 * Section 2 is a second, literal transcription of the applet's bytecode:
 * GeoSDoub.FindCircumcenter / Intersect, ExistenceOfCircumcenterCanvas.GetPerp,
 * UpgradePoint, UpgradeCoefs and the three 2-pixel "hit" tests. It is compared
 * with the core over every triangle on a 7x7 lattice (18,424 ordered triples)
 * and 800 random triangles, plus random positions of the three side dots.
 * Section 3 checks the page's claims on all of those triangles: the midpoints
 * are equidistant, the perpendicular bisectors are perpendicular and meet at
 * O, AO = BO = CO, the circle passes through all three vertices, and O lies
 * inside, on a side (right angle), or outside as the angle at A varies.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("existence-of-circumcenter/existence-of-circumcenter-core.js", "ExistenceOfCircumcenterCore");

const dist = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) =>
  Boolean(p && q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const vec = (p, q) => ({ x: q.x - p.x, y: q.y - p.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });

/* ------------------------- the applet's methods, transcribed from bytecode */

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint). */
function javaIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN }; // Java: dcmpg with 1.0d
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindCircumcenter: two side midpoints, each moved perpendicularly. */
function javaCircumcenter(A, B, Cc) {
  const M1 = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const M2 = { x: (B.x + Cc.x) / 2, y: (B.y + Cc.y) / 2 };
  const P = { x: M1.x + (B.y - A.y), y: M1.y - (B.x - A.x) };
  const Q = { x: M2.x + (Cc.y - B.y), y: M2.y - (Cc.x - B.x) };
  return javaIntersect(M1, P, M2, Q);
}

/* ExistenceOfCircumcenterCanvas.GetPerp(P, Q, R). */
function javaPerp(P, Q, R) {
  return { x: Q.x + P.y - R.y, y: Q.y - P.x + R.x };
}

/* ExistenceOfCircumcenterCanvas.UpgradePoint(p, q1, q2, coef). */
function javaUpgradePoint(p, q1, q2, coef) {
  return {
    x: coef * q1.x + (1 - coef) * q2.x,
    y: coef * q1.y + (1 - coef) * q2.y,
  };
}

/* ExistenceOfCircumcenterCanvas.coef(P, P1, P2), used by UpgradeCoefs. */
function javaCoef(P, P1, P2) {
  if (dist(P1, P2) < 1) return 0;
  return dot(vec(P2, P1), vec(P2, P)) / dot(vec(P2, P1), vec(P2, P1));
}

/* ExistenceOfCircumcenterCanvas.Compute's hit tests. */
function javaHits(L, M, N, A, B, Cc) {
  return {
    L: Math.abs(dist(L, B) - dist(L, Cc)) < 2,
    M: Math.abs(dist(M, Cc) - dist(M, A)) < 2,
    N: Math.abs(dist(N, A) - dist(N, B)) < 2,
  };
}

/* ExistenceOfCircumcenterCanvas.GetCircle: the mean of the three radii. */
function javaRadius(O, A, B, Cc) {
  return (dist(O, A) + dist(O, B) + dist(O, Cc)) / 3;
}

/* CTKMoveableDoub.RestrictToLine, as far as the position is concerned. */
function javaOnLine(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return { x: a.x, y: a.y };
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2;
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/* ------------------------------------------------- 1. start and drag rules */

{
  const s = C.start();
  equal("applet init A = (width/5, height - height/5)", s.A, { x: 90, y: 320 });
  equal("applet init B = (4.5*width/5, A.y)", s.B, { x: 405, y: 320 });
  equal("applet init C = (4*width/5, 2*height/5)", s.C, { x: 360, y: 160 });
  equal("applet coefL starts at 0.3", s.coefL, 0.3);
  equal("applet coefM starts at 0.3", s.coefM, 0.3);
  equal("applet coefN starts at 0.4", s.coefN, 0.4);
  check("L starts at 0.3*C + 0.7*B", closePoint(s.L,
    javaUpgradePoint(null, s.C, s.B, 0.3), 1e-12));
  check("M starts at 0.3*A + 0.7*C", closePoint(s.M,
    javaUpgradePoint(null, s.A, s.C, 0.3), 1e-12));
  check("N starts at 0.4*B + 0.6*A", closePoint(s.N,
    javaUpgradePoint(null, s.B, s.A, 0.4), 1e-12));
  check("the starting picture is not finished", C.result(s) === null);
  check("a nondegenerate start has a circumcenter", !C.measurements(s).noDraw);
  check("the starting triangle is acute", C.measurements(s).inside);
  check("the position is plain data for Track.state",
    JSON.stringify(JSON.parse(JSON.stringify(s))) === JSON.stringify(s));

  const moved = C.moveVertex(s, "B", { x: 300, y: 100 });
  check("moving B leaves A and C alone", moved.A.x === 90 && moved.C.x === 360);
  check("moving B keeps L at coefficient 0.3 of C->B", closePoint(moved.L,
    javaUpgradePoint(null, moved.C, moved.B, s.coefL), 1e-12));
  check("moving B keeps N at coefficient 0.4 of B->A", closePoint(moved.N,
    javaUpgradePoint(null, moved.B, moved.A, s.coefN), 1e-12));
  check("moving B does not move M", closePoint(moved.M, s.M, 1e-12));
  check("an unknown point name changes nothing", C.moveVertex(s, "Z", { x: 1, y: 2 }).A.x === s.A.x);

  const raw = { x: 350, y: 260 };
  const dragged = C.dragMidpoint(s, "L", raw);
  check("dragging L restricts it to the BC line", closePoint(dragged.L,
    javaOnLine(raw, s.C, s.B), 1e-12));
  check("dragging L does not change the other dots",
    closePoint(dragged.M, s.M, 1e-12) && closePoint(dragged.N, s.N, 1e-12));
  const released = C.releaseMidpoint(dragged, "L");
  const rawCoefL = javaCoef(dragged.L, s.C, s.B);
  check("release recomputes coefL from the dragged position and snaps near 1/2",
    close(released.coefL, Math.abs(rawCoefL - 0.5) < 0.1 ? 0.5 : rawCoefL, 1e-12));
  const middle = C.snapMidpoints(s);
  const near = C.dragMidpoint(middle, "L", { x: middle.L.x - (middle.C.x - middle.B.x) * 0.02,
                                             y: middle.L.y - (middle.C.y - middle.B.y) * 0.02 });
  const snapped = C.releaseMidpoint(near, "L");
  check("within 0.1 of the middle, coefL snaps to 0.5", snapped.coefL === 0.5);
  const far = C.dragMidpoint(s, "N", { x: 340, y: s.N.y });
  check("away from the middle, coefN is kept",
    close(C.releaseMidpoint(far, "N").coefN, javaCoef(far.N, s.B, s.A), 1e-12));
  check("an unknown dot name is ignored", C.dragMidpoint(s, "X", raw) === s);
  const all = C.snapMidpoints(s);
  check("snapping all three dots completes the picture", all.L && all.M && all.N &&
    C.measurements(all).allHit && C.result(all) === "done");
}

/* ------------------- 2. the core vs the applet over many configurations */

const lattice = [];
for (let i = 0; i < 7; i++) {
  for (let j = 0; j < 7; j++) lattice.push({ x: 10 + i * 70, y: 10 + j * 60 });
}
const triangles = [];
for (let i = 0; i < lattice.length; i++) {
  for (let j = i + 1; j < lattice.length; j++) {
    for (let k = j + 1; k < lattice.length; k++) {
      const t = tri(lattice[i], lattice[j], lattice[k]);
      if (Math.abs(cross(vec(t.A, t.B), vec(t.A, t.C))) < 100) continue;
      triangles.push(t);
    }
  }
}
{
  const rand = rng(4722);
  for (let n = 0; n < 800; n++) {
    const t = tri(
      { x: 5 + rand() * 440, y: 5 + rand() * 390 },
      { x: 5 + rand() * 440, y: 5 + rand() * 390 },
      { x: 5 + rand() * 440, y: 5 + rand() * 390 },
    );
    if (Math.abs(cross(vec(t.A, t.B), vec(t.A, t.C))) < 100) continue;
    triangles.push(t);
  }
}

{
  let compared = 0, centerFails = 0, radiusFails = 0, perpFails = 0;
  let claimFails = 0, locationFails = 0;
  for (const t of triangles) {
    const s = C.start({ A: t.A, B: t.B, C: t.C });
    const core = C.measurements(s);
    const javaO = javaCircumcenter(t.A, t.B, t.C);
    const scale = Math.max(dist(t.A, t.B), dist(t.B, t.C), dist(t.C, t.A));
    const tol = 1e-8 * scale;
    if (!closePoint(core.center, javaO, tol)) {
      if (centerFails++ < 3) console.error("  center", JSON.stringify(t), core.center, javaO);
    }
    if (!close(core.radius, javaRadius(javaO, t.A, t.B, t.C), tol)) {
      if (radiusFails++ < 3) console.error("  radius", JSON.stringify(t));
    }
    /* The canvas builds each bisector through the side dot using GetPerp. */
    const jL = javaPerp(t.B, s.L, t.C), jM = javaPerp(t.C, s.M, t.A), jN = javaPerp(t.A, s.N, t.B);
    if (!closePoint(core.lines.L.to, jL, 1e-12) ||
        !closePoint(core.lines.M.to, jM, 1e-12) ||
        !closePoint(core.lines.N.to, jN, 1e-12)) {
      if (perpFails++ < 3) console.error("  perp line", JSON.stringify(t));
    }
    const cl = C.claims(s);
    for (const [name, ok] of Object.entries(cl)) {
      if (!ok && name !== "locationPossible" && claimFails++ < 3) {
        console.error("  claim", name, JSON.stringify(t));
      }
    }
    /*
     * Where the page says the two bisectors may meet: inside for an acute
     * triangle, on a side for a right angle, outside for an obtuse angle.
     */
    const dA = dot(vec(t.A, t.B), vec(t.A, t.C));
    const dB = dot(vec(t.B, t.A), vec(t.B, t.C));
    const dCc = dot(vec(t.C, t.A), vec(t.C, t.B));
    const angleTol = 1e-9 * scale * scale;
    let expected;
    if (Math.abs(dA) < angleTol) expected = "onBC"; // AB and AC perpendicular: O is the midpoint of BC
    else if (Math.abs(dB) < angleTol || Math.abs(dCc) < angleTol) expected = "outside";
    else if (dA > 0 && dB > 0 && dCc > 0) expected = "inside";
    else expected = "outside";
    const actual = core.inside ? "inside" : core.onBC ? "onBC" : "outside";
    if (actual !== expected && locationFails++ < 3) {
      console.error("  location", JSON.stringify(t), expected, actual);
    }
    compared++;
  }
  check(`applet circumcenter and core agree on all ${compared} triangles`, centerFails === 0);
  check("applet circle radius and core agree on every triangle", radiusFails === 0);
  check("applet GetPerp and core bisectors agree on every triangle", perpFails === 0);
  check("all five geometric claims hold on every triangle", claimFails === 0);
  check("circumcenter lies inside / on a side / outside exactly as the angle demands", locationFails === 0);
  check(`the exhaustive sweep covered ${compared} triangles`, compared > 18000);
}

/* Random side-dot positions: hit flags and coefficients against the applet. */
{
  const rand = rng(9001);
  let compared = 0, hitFails = 0, coefFails = 0, snapFails = 0;
  for (let n = 0; n < 1200; n++) {
    const t = tri(
      { x: 20 + rand() * 410, y: 20 + rand() * 360 },
      { x: 20 + rand() * 410, y: 20 + rand() * 360 },
      { x: 20 + rand() * 410, y: 20 + rand() * 360 },
    );
    if (Math.abs(cross(vec(t.A, t.B), vec(t.A, t.C))) < 100) continue;
    let s = C.start({ A: t.A, B: t.B, C: t.C });
    for (const name of ["L", "M", "N"]) {
      const p = { x: rand() * 450, y: rand() * 400 };
      s = C.dragMidpoint(s, name, p);
      const side = { L: [t.C, t.B], M: [t.A, t.C], N: [t.B, t.A] }[name];
      if (!closePoint(s[name], javaOnLine(p, side[0], side[1]), 1e-10)) hitFails++;
      const jCoef = javaCoef(s[name], side[0], side[1]);
      const snapped = Math.abs(jCoef - 0.5) < 0.1;
      const after = C.releaseMidpoint(s, name);
      const expectedCoef = snapped ? 0.5 : jCoef;
      if (!close(after[{ L: "coefL", M: "coefM", N: "coefN" }[name]], expectedCoef, 1e-10)) coefFails++;
      if (snapped && !C.measurements(after).hits[name]) snapFails++;
      s = after;
    }
    const m = C.measurements(s);
    const jH = javaHits(s.L, s.M, s.N, t.A, t.B, t.C);
    if (m.hits.L !== jH.L || m.hits.M !== jH.M || m.hits.N !== jH.N) hitFails++;
    compared++;
  }
  check(`side-dot dragging matches the applet on ${compared} random positions`, hitFails === 0);
  check("released coefficients match UpgradeCoefs, including the 0.1 snap", coefFails === 0);
  check("a snapped dot always satisfies the applet's 2-pixel hit test", snapFails === 0);
}

/* ---------------------------------------- 3. the page's named special cases */

{
  const right = tri({ x: 100, y: 200 }, { x: 300, y: 200 }, { x: 100, y: 50 });
  const mRight = C.measurements(C.start({ A: right.A, B: right.B, C: right.C }));
  check("right angle at A puts O on the side BC", mRight.onBC);
  check("and the center is the midpoint of BC", closePoint(mRight.center,
    { x: 200, y: 125 }, 1e-10));
  check("AO = BO = CO in the right-angle case", C.claims(C.start({ A: right.A, B: right.B, C: right.C })).equidistant);

  const obtuse = tri({ x: 200, y: 120 }, { x: 100, y: 100 }, { x: 300, y: 100 });
  const mObtuse = C.measurements(C.start({ A: obtuse.A, B: obtuse.B, C: obtuse.C }));
  check("an obtuse angle at A puts the circumcenter outside the triangle",
    !mObtuse.inside && !mObtuse.onBC);
  check("the two bisectors still meet at one point there",
    C.claims(C.start({ A: obtuse.A, B: obtuse.B, C: obtuse.C })).bisectorsConcurrent);

  const equilateral = tri({ x: 225, y: 40 }, { x: 75, y: 300 }, { x: 375, y: 300 });
  const mEq = C.measurements(C.start({ A: equilateral.A, B: equilateral.B, C: equilateral.C }));
  check("an acute triangle has its circumcenter inside", mEq.inside);
  check("the circle passes through all three vertices",
    C.claims(C.start({ A: equilateral.A, B: equilateral.B, C: equilateral.C })).circleThroughVertices);

  const flat = tri({ x: 10, y: 10 }, { x: 100, y: 100 }, { x: 200, y: 200 });
  const mFlat = C.measurements(C.start({ A: flat.A, B: flat.B, C: flat.C }));
  check("collinear points have no finite circumcenter (applet NoDraw)", mFlat.noDraw);
  check("and no circle is drawn", !Number.isFinite(mFlat.radius));
  check("a degenerate picture cannot be completed", C.result(C.start({ A: flat.A, B: flat.B, C: flat.C })) === null);
  check("all claims are withheld for collinear points",
    !Object.values(C.claims(C.start({ A: flat.A, B: flat.B, C: flat.C }))).some(Boolean));
  const duplicate = tri({ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 200, y: 100 });
  check("a doubled corner also gives no circumcenter",
    C.measurements(C.start({ A: duplicate.A, B: duplicate.B, C: duplicate.C })).noDraw);
}

done("existence-of-circumcenter");
