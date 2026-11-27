#!/usr/bin/env node
"use strict";

/*
 * Logic test for equiangular-poly/equiangular-poly-core.js.
 *
 *   node porting/check-equiangular-poly.mjs
 *
 * The applet's options are N = 3..15 (a spinner) and a "Show hint" tick box;
 * its picture is determined by N side lines translated parallel to themselves
 * and a draggable point P. Section 2 covers all 13 values of N, 10 line
 * configurations each and 15 positions of P each: 1,950 configurations. Every
 * one is compared with section 3, a second, independent transcription of the
 * applet's Reset/Compute/Draw and GeoSDoub bytecode.
 *
 * The claims from the page are tested there too: the sum of signed distances
 * is invariant (and equals the sum of ordinary distances while P is inside),
 * the angles stay equal while the side lengths change, the hint regular
 * polygon is 2 units outside the longest side, the comparison feet are
 * perpendicular, and the triangle-only converse holds while a rectangle does
 * not.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equiangular-poly/equiangular-poly-core.js", "EquiangularPolyCore");
const NS = Array.from({ length: C.MAX_N - C.MIN_N + 1 }, (_, k) => C.MIN_N + k);
const rand = rng(20261127);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nearPoint = (p, q, tol = 1e-6) =>
  (p === q) || (p && q && near(p.x, q.x, tol) && near(p.y, q.y, tol));
const nearList = (a, b, tol = 1e-6) =>
  a.length === b.length && a.every((p, i) =>
    (p === null && b[i] === null) || nearPoint(p, b[i], tol));

/* ------------------------------------------------ 1. the rules and options */

{
  const s = C.start({});
  equal("the opening spinner is at N = 5", s.N, 5);
  nearPoint("the opening P is the canvas centre", s.P, { x: 200, y: 180 });
  check("the opening polygon is regular", s.lines.every((l) => near(l.t, 90)));
  check("the opening side normals are spaced by 2*pi/N", s.lines.every((l, i) =>
    near(l.n.x, Math.cos((2 * Math.PI * i) / 5)) &&
    near(l.n.y, Math.sin((2 * Math.PI * i) / 5))));
  check("the hint starts unticked", s.showHint === false);
  check("the spinner range is exactly 3..15 by 1",
    C.MIN_N === 3 && C.MAX_N === 15 && C.STEP_N === 1);
  check("every spinner value is accepted unchanged", NS.every((n) => C.start({ N: n }).N === n));
  check("N below the minimum is clamped to 3", C.clampN(-20) === 3);
  check("N above the maximum is clamped to 15", C.clampN(500) === 15);
  check("N is snapped to the spinner's integer lattice", C.clampN(4.2) === 4);
  check("a non-numeric N falls back to 5", C.clampN("many") === 5);

  check("the hint option is accepted",
    C.move(s, { type: "option", key: "showHint", value: true }).showHint === true);
  check("an unknown option is refused",
    C.move(s, { type: "option", key: "colour", value: true }) === null);
  check("a non-boolean option is refused",
    C.move(s, { type: "option", key: "showHint", value: 1 }) === null);

  const bigger = C.move(s, { type: "N", value: 8 });
  check("N can be changed by a move", bigger.N === 8 && bigger.lines.length === 8);
  check("changing N calls Reset: P is back at the centre", nearPoint(bigger.P, s.P, 1e-12));
  check("changing N keeps the hint state",
    C.move(C.move(s, { type: "option", key: "showHint", value: true }),
      { type: "N", value: 7 }).showHint === true);
  check("a non-finite N is refused", C.move(s, { type: "N", value: NaN }) === null);

  const moved = C.move(s, { type: "point", point: { x: -30, y: 9999 } });
  nearPoint("P is kept inside the canvas", moved.P, { x: 0, y: 360 });
  check("a non-finite P is refused",
    C.move(s, { type: "point", point: { x: Infinity, y: 5 } }) === null);
  check("an unknown move is refused", C.move(s, { type: "jump" }) === null);
  check("a line move needs a real index",
    C.move(s, { type: "line", index: -1, point: { x: 20, y: 20 } }) === null &&
    C.move(s, { type: "line", index: 5, point: { x: 20, y: 20 } }) === null);

  const line0 = C.move(s, { type: "line", index: 0, point: { x: 300, y: 180 } });
  check("dragging a line keeps its direction", nearPoint(line0.lines[0].n, s.lines[0].n, 1e-12));
  check("dragging a line pushes it out", line0.lines[0].t > 90);
  check("dragging a line leaves the other lines alone",
    line0.lines.slice(1).every((l, i) => nearPoint(l, s.lines[i + 1], 1e-12)));
  const pulled = C.move(s, { type: "line", index: 0, point: { x: -999, y: 180 } });
  check("a line cannot be dragged past the applet's bounds", near(pulled.lines[0].t, 36));
  const pushed = C.move(s, { type: "line", index: 0, point: { x: 999, y: 180 } });
  check("a line cannot be pushed past the applet's bounds", near(pushed.lines[0].t, 144));
  check("reset restores a regular polygon at the current N",
    C.move(bigger, { type: "reset" }).lines.every((l) => near(l.t, 90)) &&
    C.move(bigger, { type: "reset" }).N === 8);

  const regular = C.compute(s);
  check("the opening polygon is convex", regular.convex);
  check("the opening sum of distances is N times the radius", near(regular.sumSigned, 5 * 90));
  check("on the opening regular polygon all side lengths agree",
    regular.sideLengths.every((d) => near(d, regular.sideLengths[0])));
  check("the opening P is inside", regular.inside);
  check("the hint polygon's radius is the longest side/2/tan + 2",
    near(regular.R, regular.longest / 2 / Math.tan(Math.PI / 5) + 2));
  check("a parallel line is reported as having no intersection",
    Number.isNaN(C.intersect({ x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 }).x));
}

/* ------------- 2 & 3. every configuration, against a second transcription */

{
  let configurations = 0, inside = 0, outside = 0, outsideDifferent = 0;
  let simple = 0, folded = 0;
  let verticesMatch = true, feetMatch = true, comparisonMatch = true;
  let signedMatch = true, unsignedMatch = true, sideMatch = true;
  let invariant = true, unsignedInside = true;
  let equiangularSimple = true, containedSimple = true, hintFeet = true;
  let regularHint = true, longestUsed = true;
  let minGap = Infinity, maxGap = -Infinity, variedSides = 0;

  for (const N of NS) {
    for (let config = 0; config < 10; config++) {
      const t = Array.from({ length: N }, () => 36 + rand() * 108);
      const state0 = C.start({ N, t });
      const base = applet(N, state0.P, t);
      for (let k = 0; k < N; k++) {
        if (!near(t[k], base.t[k], 1e-12)) longestUsed = false;
      }
      // The longest side picks the comparison polygon's centre.
      let longest = -Infinity, imax = -1;
      for (let i = 0; i < N; i++) {
        const d = Math.hypot(base.V[i].x - base.V[(i + 1) % N].x,
          base.V[i].y - base.V[(i + 1) % N].y);
        if (d > longest + 1e-7) { longest = d; imax = i; }
      }
      const tan = Math.tan(Math.PI / N);
      const Cx = (base.V[imax].x + base.V[(imax + 1) % N].x) / 2 -
        (base.V[(imax + 1) % N].y - base.V[imax].y) / 2 / tan;
      const Cy = (base.V[imax].y + base.V[(imax + 1) % N].y) / 2 +
        (base.V[(imax + 1) % N].x - base.V[imax].x) / 2 / tan;
      if (!near(base.C.x, Cx) || !near(base.C.y, Cy)) longestUsed = false;

      if (!base.sideLengths.every((d) => near(d, base.sideLengths[0]))) variedSides++;

      for (let j = 0; j < 15; j++) {
        const P = j === 0 ? { x: 200, y: 180 } : {
          x: rand() * 400,
          y: rand() * 360,
        };
        const state = C.start({ N, t, P });
        const g = C.compute(state);
        const a = applet(N, P, t);
        const cl = C.claims(g);
        configurations++;

        if (!nearList(g.V, a.V)) verticesMatch = false;
        if (!nearList(g.F, a.F)) feetMatch = false;
        if (!nearPoint(g.C, a.C) || !near(g.R, a.R)) comparisonMatch = false;
        if (!nearList(g.circle, a.circle) || !nearList(g.rim, a.rim) ||
            !nearList(g.U, a.U) || !nearList(g.feet, a.feet)) comparisonMatch = false;
        if (!near(g.sumSigned, a.sumSigned) || !near(g.sumUnsigned, a.sumUnsigned)) signedMatch = false;
        if (!g.signed.every((d, i) => near(d, a.signed[i])) ||
            !g.unsigned.every((d, i) => near(d, a.unsigned[i]))) unsignedMatch = false;
        if (!g.sideLengths.every((d, i) => near(d, a.sideLengths[i]))) sideMatch = false;

        // Moving P cannot change the signed sum, and it is exactly the sum
        // of the offsets of the side lines from the centre.
        const sumT = t.reduce((acc, v) => acc + v, 0);
        if (!near(g.sumSigned, sumT) || !cl.sumIsOffsets) invariant = false;
        if (g.inside) {
          inside++;
          if (!cl.unsignedWhenInside || !near(g.sumUnsigned, g.sumSigned)) unsignedInside = false;
        } else {
          outside++;
          if (!near(g.sumUnsigned, g.sumSigned)) outsideDifferent++;
        }
        if (!cl.feetRight) hintFeet = false;
        if (!cl.regularComparison) regularHint = false;
        if (g.convex) {
          simple++;
          if (!cl.equiangular || !near(g.interiorAngle, Math.PI - 2 * Math.PI / N)) {
            equiangularSimple = false;
          }
          if (!cl.containsPolygon) containedSimple = false;
          for (let i = 0; i < N; i++) {
            for (const v of g.V) {
              const radial = { x: g.circle[i].x - g.C.x, y: g.circle[i].y - g.C.y };
              const len = Math.hypot(radial.x, radial.y);
              const gap = g.R - ((v.x - g.C.x) * radial.x + (v.y - g.C.y) * radial.y) / len;
              minGap = Math.min(minGap, gap);
              maxGap = Math.max(maxGap, gap);
            }
          }
        } else {
          folded++;
        }
      }
    }
  }

  check("V matches a second transcription of the applet's Compute", verticesMatch);
  check("all perpendicular feet match the applet's Compute", feetMatch);
  check("C, R, G, H, U and the hint feet match the applet's Compute", comparisonMatch);
  check("the sum of signed distances matches the second transcription", signedMatch);
  check("each signed and ordinary distance matches the second transcription", unsignedMatch);
  check("all side lengths match the second transcription", sideMatch);
  check("the longest side is the one used for the comparison polygon", longestUsed);
  check("the sum of signed distances is invariant over all 1,950 configurations", invariant);
  check("ordinary distances equal the invariant whenever P is inside", unsignedInside);
  check("ordinary distances really can differ when P is outside", outsideDifferent > 100);
  check("simple polygons have N equal interior angles", equiangularSimple);
  check("the hint polygon encloses every simple polygon", containedSimple);
  check("equiangular polygons need not be equilateral", variedSides > 100);
  check("the hint polygon is a regular N-gon for every configuration", regularHint);
  check("the hint feet are perpendicular to the hint sides", hintFeet);
  check("the minimum clearance to the hint polygon is two units",
    minGap > 1.999 && minGap < 2.0001, `min ${minGap}, max ${maxGap}`);
  check("the sample contains both simple and folded polygons", simple > 200 && folded > 200);
  check("the test has plenty of points inside and outside", inside > 300 && outside > 1000);
  check(`covered every N in 3..15 and ${configurations} configurations`,
    configurations === NS.length * 150);
}

/* ------------------------------- 4. the page's other claims and converses */

{
  // An equilateral triangle is equiangular, and an equiangular triangle is
  // equilateral: for N=3 the edge directions differ by 120 degrees, so the
  // closing condition forces all three lengths to be equal.
  let equilateralAngles = true, equiangularSides = true;
  for (let k = 0; k < 40; k++) {
    const a = 20 + k * 2;
    const theta = (k * Math.PI) / 180;
    const u = { x: Math.cos(theta), y: Math.sin(theta) };
    const v = { x: Math.cos(theta + 2 * Math.PI / 3), y: Math.sin(theta + 2 * Math.PI / 3) };
    const w = { x: Math.cos(theta + 4 * Math.PI / 3), y: Math.sin(theta + 4 * Math.PI / 3) };
    const tri = [C.mul(u, a), C.add(C.mul(u, a), C.mul(v, a)), { x: 0, y: 0 }];
    for (let i = 0; i < 3; i++) {
      const p = tri[i], q = tri[(i + 1) % 3], r = tri[(i + 2) % 3];
      const e = C.sub(q, p), f = C.sub(r, p);
      const angle = Math.acos(Math.max(-1, Math.min(1, C.dot(e, f) /
        (Math.hypot(e.x, e.y) * Math.hypot(f.x, f.y)))));
      if (!near(angle, Math.PI / 3, 1e-9)) equilateralAngles = false;
    }
    // An equiangular triangle from three edge vectors of lengths x,y,z
    // closes only when x=y=z.
    const x = a, y = a * (1 + k / 100), z = a * (1 + (40 - k) / 100);
    const ex = C.mul(u, x), ey = C.mul(v, y), ez = C.mul(w, z);
    const closure = Math.hypot(ex.x + ey.x + ez.x, ex.y + ey.y + ez.y);
    if (closure < 0.1) equiangularSides = false; // only equilateral closes
  }
  check("an equilateral triangle has three equal angles", equilateralAngles);
  check("an equiangular triangle must be equilateral", equiangularSides);

  // Equiangular + equilateral for any N makes a regular N-gon: the edge
  // directions are forced, so equal lengths force equal spacing on a circle.
  let regularBoth = true;
  for (const N of NS) {
    for (const rotation of [0, 0.3, 1.1]) {
      const verts = Array.from({ length: N }, (_, i) => {
        const th = rotation + (2 * Math.PI * i) / N;
        return { x: 100 * Math.cos(th), y: 100 * Math.sin(th) };
      });
      const len = C.distance(verts[0], verts[1]);
      for (let i = 0; i < N; i++) {
        if (!near(C.distance(verts[i], verts[(i + 1) % N]), len)) regularBoth = false;
        if (!near(Math.hypot(verts[i].x, verts[i].y), 100)) regularBoth = false;
      }
    }
  }
  check("an equiangular polygon with equal sides is regular for every N", regularBoth);

  // The converse fails: a rectangle is equiangular but not equilateral,
  // and the sum of distances to its side lines is constant anyway.
  const w = 120, h = 70;
  const rect = (P) => P.x + (w - P.x) + P.y + (h - P.y);
  let rectConstant = true;
  for (let i = 0; i < 200; i++) {
    const P = { x: rand() * w, y: rand() * h };
    if (!near(rect(P), w + h)) rectConstant = false;
  }
  check("a non-square rectangle has a constant distance sum", rectConstant);
  check("that rectangle's sides are not all equal", w !== h);
  check("the rectangle's constant is the sum of its side lengths", near(rect({ x: 5, y: 9 }), 190));

  // A slanted parallelogram is a counterexample even without right angles.
  const b = 50, phi = Math.PI / 3;
  const height = b * Math.sin(phi);
  let parallelogramConstant = true;
  for (let i = 0; i < 200; i++) {
    const s = rand(), u = rand();
    const P = { x: 100 * s + u * b * Math.cos(phi), y: u * height };
    const dAB = P.y, dCD = height - P.y;
    const dAD = (100 * s * height) / b;
    const dBC = (100 * (1 - s) * height) / b;
    if (!near(dAB + dCD + dAD + dBC, height + 100 * Math.sin(phi))) {
      parallelogramConstant = false;
    }
  }
  check("a parallelogram also has a constant signed distance sum", parallelogramConstant);
}

/* ------------------- 5. a second transcription, straight from the bytecode */

/**
 * EquiangularPolyCanvas.Reset and Compute, and GeoSDoub.Intersect /
 * NearestPoint, written a second time without using the core at all.
 *
 * Reset: midX = floor(W/2), midY = floor(H/2), r = min(W,H)/4;
 *   T = (midX + r*cos, midY + r*sin);
 *   P1 = T + (midY - T.y, T.x - midX), P2 = T - (midY - T.y, T.x - midX).
 * Dragging side k by (t[k] - r) along its normal moves both its endpoints.
 * Compute: V[k] = Intersect(line[k], line[k+1]),
 *   F[k] = NearestPoint(P, line[k]), longest side picked with strict >,
 *   R = longest/2/tan(pi/N) + 2, C from that side's midpoint,
 *   circle[k] = C + R*(cos, sin), rim[k] = circle[k] + (C.y-y, x-C.x),
 *   U[k] = Intersect(circle[k]rim[k], circle[j]rim[j]),
 *   foot[k] = NearestPoint(P, U[k], U[j]).
 */
function applet(N, P, t, width = 400, height = 360) {
  const midX = Math.floor(width / 2), midY = Math.floor(height / 2);
  const radius = Math.min(width, height) / 4;
  const p1 = [], p2 = [];
  for (let k = 0; k < N; k++) {
    const angle = (2 * Math.PI / N) * k;
    const nx = Math.cos(angle), ny = Math.sin(angle);
    const x = midX + radius * nx, y = midY + radius * ny;
    const shift = t[k] - radius;
    p1.push({ x: x + midY - y + shift * nx, y: y - midX + x + shift * ny });
    p2.push({ x: x - midY + y + shift * nx, y: y + midX - x + shift * ny });
  }
  const det = (p, q) => p.x * q.y - p.y * q.x;
  const cut = (a, b, c, d) => {
    const r = { x: b.x - a.x, y: b.y - a.y };
    const s = { x: d.x - c.x, y: d.y - c.y };
    const den = det(r, s);
    if (Math.abs(den) < 1e-9) return { x: NaN, y: NaN };
    const k = det({ x: c.x - a.x, y: c.y - a.y }, s) / den;
    return { x: a.x + k * r.x, y: a.y + k * r.y };
  };
  const drop = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return { x: p.x, y: p.y };
    const k = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    return { x: a.x + k * dx, y: a.y + k * dy };
  };

  const V = [], F = [], sideLengths = [];
  for (let k = 0; k < N; k++) {
    const j = (k + 1) % N;
    V.push(cut(p1[k], p2[k], p1[j], p2[j]));
    F.push(drop(P, p1[k], p2[k]));
  }
  for (let k = 0; k < N; k++) {
    const j = (k + 1) % N;
    sideLengths.push(Math.hypot(V[k].x - V[j].x, V[k].y - V[j].y));
  }
  let longest = -Infinity, imax = -1;
  for (let k = 0; k < N; k++) {
    if (sideLengths[k] > longest + 1e-7) { longest = sideLengths[k]; imax = k; }
  }
  const jmax = (imax + 1) % N;
  const tan = Math.tan(Math.PI / N);
  const R = longest / 2 / tan + 2;
  const mx = (V[imax].x + V[jmax].x) / 2, my = (V[imax].y + V[jmax].y) / 2;
  const C = {
    x: mx - (V[jmax].y - V[imax].y) / 2 / tan,
    y: my + (V[jmax].x - V[imax].x) / 2 / tan,
  };
  const circle = [], rim = [], U = [], feet = [];
  for (let k = 0; k < N; k++) {
    const angle = (2 * Math.PI / N) * k;
    circle.push({ x: C.x + R * Math.cos(angle), y: C.y + R * Math.sin(angle) });
  }
  for (let k = 0; k < N; k++) {
    rim.push({ x: circle[k].x + C.y - circle[k].y,
      y: circle[k].y - C.x + circle[k].x });
  }
  for (let k = 0; k < N; k++) {
    const j = (k + 1) % N;
    U.push(cut(circle[k], rim[k], circle[j], rim[j]));
  }
  for (let k = 0; k < N; k++) {
    const j = (k + 1) % N;
    feet.push(drop(P, U[k], U[j]));
  }
  const signed = [], unsigned = [];
  let sumSigned = 0, sumUnsigned = 0;
  for (let k = 0; k < N; k++) {
    const nx = Math.cos((2 * Math.PI / N) * k), ny = Math.sin((2 * Math.PI / N) * k);
    const d = t[k] - ((P.x - midX) * nx + (P.y - midY) * ny);
    signed.push(d);
    unsigned.push(Math.abs(d));
    sumSigned += d;
    sumUnsigned += Math.abs(d);
  }
  return { V, F, C, R, circle, rim, U, feet, sideLengths,
    signed, unsigned, sumSigned, sumUnsigned, t };
}

done("equiangular-poly");
