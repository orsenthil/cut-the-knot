#!/usr/bin/env node
"use strict";

/*
 * Logic test for areas-in-reg-poly/areas-in-reg-poly-core.js.
 *
 *   node porting/check-areas-in-reg-poly.mjs
 *
 * The applet's options are N (a spinner: 4 to 30 in steps of 2) and a
 * "Show hint" tick box, with one draggable point P. Every N in that range is
 * covered here, with the opening P and 400 deterministic random P per N
 * (5,614 configurations). The page's claim - equal sums of alternating
 * triangle areas for P inside the regular 2n-gon - is checked on every one.
 *
 * Section 3 is a second, independent transcription of the applet's own
 * Reset/Compute/Draw bytecode (V, U, W, H and the coloured triangle areas),
 * written straight from the constant pool rather than calling the core's
 * helpers, and compared with the core over the whole option range.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("areas-in-reg-poly/areas-in-reg-poly-core.js", "AreasInRegPolyCore");
const NS = Array.from({ length: 14 }, (_, k) => C.MIN_N + k * C.STEP_N);
const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nearPoint = (p, q, tol = 1e-7) =>
  p === q || (p && q && near(p.x, q.x, tol) && near(p.y, q.y, tol));
const nearList = (a, b, tol = 1e-7) =>
  a.length === b.length && a.every((p, i) =>
    (p === null && b[i] === null) || nearPoint(p, b[i], tol));

/* ------------------------------------------------ 1. the rules and options */

{
  const s = C.start({});
  equal("opening spinner is at N = 6", s.N, 6);
  nearPoint("opening P is the centre", s.P, { x: 200, y: 150 });
  check("the hint starts unticked", s.showHint === false);
  check("N range is exactly the applet's 4..30 by 2",
    C.MIN_N === 4 && C.MAX_N === 30 && C.STEP_N === 2);
  check("every spinner value is accepted unchanged", NS.every((n) => C.start({ N: n }).N === n));
  check("N below the minimum is clamped to 4", C.clampN(-20) === 4);
  check("N above the maximum is clamped to 30", C.clampN(500) === 30);
  check("N is snapped to the spinner's even lattice", C.clampN(13) === 14 && C.clampN(7) === 8);
  check("a non-numeric N falls back to 6", C.clampN("many") === 6);

  check("hint option is accepted", C.move(s, { type: "option", key: "showHint", value: true }).showHint === true);
  check("an unknown option is refused", C.move(s, { type: "option", key: "colour", value: true }) === null);
  check("a non-boolean option is refused", C.move(s, { type: "option", key: "showHint", value: 1 }) === null);
  check("N can be changed by a move", C.move(s, { type: "N", value: 12 }).N === 12);
  check("a non-finite N is refused", C.move(s, { type: "N", value: NaN }) === null);
  const moved = C.move(s, { type: "point", point: { x: -30, y: 9999 } });
  nearPoint("P is kept inside the board", moved.P, { x: 0, y: 300 });
  check("a non-finite P is refused", C.move(s, { type: "point", point: { x: Infinity, y: 5 } }) === null);
  check("an unknown move is refused", C.move(s, { type: "jump" }) === null);
  check("reset restores the opening picture",
    JSON.stringify(C.move(s, { type: "reset" })) === JSON.stringify(s));
}

/* ------------------------- 2. the page's claim over the whole option range */

{
  const rand = rng(20261126);
  let inside = 0, outside = 0, outsideDifferent = 0, configurations = 0;
  let verticesMatch = true, gonsMatch = true, feetMatch = true, areasMatch = true;
  let signedTranscription = true;
  let equalInside = true, halvesInside = true, signedAlways = true, signedNH = true;
  let feetPerpendicular = true, areaIsBaseTimesDistance = true, twoGonsTrue = true;
  let insideMatchesSign = true, fullSumsAddUp = true;

  for (const N of NS) {
    const opening = C.start({ N });
    const g0 = C.compute(opening);
    check(`N=${N}: the opening P is inside`, g0.inside);
    check(`N=${N}: the opening sums are equal`, C.claims(g0).equalSums);
    check(`N=${N}: V has N vertices, U and W have N/2, H has N`,
      g0.V.length === N && g0.U.length === N / 2 && g0.W.length === N / 2 && g0.H.length === N);

    const cx = g0.cx, cy = g0.cy, R = g0.R;
    for (const P of [opening.P, ...Array.from({ length: 400 }, () => ({
      x: cx + (rand() * 2 - 1) * R * 1.6,
      y: cy + (rand() * 2 - 1) * R * 1.6,
    }))]) {
      const g = C.compute(C.start({ N, P }));
      const a = applet(N, P); // independent transcription, section 3
      const cl = C.claims(g);
      configurations++;

      if (!nearList(g.V, a.V)) verticesMatch = false;
      if (!nearList(g.U, a.U) || !nearList(g.W, a.W)) gonsMatch = false;
      if (!nearList(g.H, a.H)) feetMatch = false;
      const evenSum = a.even.reduce((s, v) => s + v, 0);
      const oddSum = a.odd.reduce((s, v) => s + v, 0);
      if (!g.triangles.every((v, i) => near(v, i % 2 === 0 ? a.even[i / 2] : a.odd[(i - 1) / 2])) ||
          !near(g.evenArea, evenSum) || !near(g.oddArea, oddSum)) areasMatch = false;
      if (!cl.signedSumsEqual) signedAlways = false;
      if (!near(g.evenSigned, a.evenSigned) || !near(g.oddSigned, a.oddSigned)) {
        signedTranscription = false;
      }
      if (!cl.signedSumsAreNH) signedNH = false;
      if (g.inside !== g.allSameSide) insideMatchesSign = false;

      for (let i = 0; i < N; i++) {
        const v = g.V[i], w = g.V[(i + 1) % N], h = g.H[i];
        const e = C.sub(w, v), f = C.sub(h, v);
        // The foot lies on the side line and is perpendicular to the side.
        if (Math.abs(C.cross(e, f)) > 1e-6 || Math.abs(C.dot(C.sub(P, h), e)) > 1e-6) {
          feetPerpendicular = false;
        }
        // Triangle area = (side / 2) * distance from P to the side line.
        const area = Math.abs(C.cross(e, C.sub(P, v))) / 2;
        const distance = Math.abs(C.cross(e, C.sub(P, v))) / C.distance(v, w);
        if (!near(area, (g.side / 2) * distance)) areaIsBaseTimesDistance = false;
      }

      if (g.inside) {
        inside++;
        if (!cl.equalSums || !cl.sumsAreHalf || !cl.isHalfPolygon ||
            !near(g.evenArea, g.polygonArea / 2)) {
          equalInside = false;
          halvesInside = false;
        }
      } else {
        outside++;
        if (!near(g.evenArea, g.oddArea)) outsideDifferent++;
      }

      // The two extended n-gons are congruent regular n-gons of apothem h.
      if (N >= 6) {
        for (const arr of [g.U, g.W]) {
          const expectCircum = g.apothem / Math.cos(Math.PI / g.n);
          for (let i = 0; i < g.n; i++) {
            const j = (i + 1) % g.n;
            if (!near(C.distance(arr[i], { x: g.cx, y: g.cy }), expectCircum, 1e-6)) twoGonsTrue = false;
            const e = C.sub(arr[j], arr[i]);
            const ap = Math.abs(C.cross(e, { x: g.cx - arr[i].x, y: g.cy - arr[i].y })) / C.distance(arr[i], arr[j]);
            if (!near(ap, g.apothem, 1e-6)) twoGonsTrue = false;
          }
        }
      }
    }
  }

  check("all vertices match a second transcription of Reset", verticesMatch);
  check("both extended n-gons match the applet's U and W", gonsMatch);
  check("all perpendicular feet match the applet's Compute", feetMatch);
  check("alternating triangle areas match the applet's Draw", areasMatch);
  check("signed sums of a second transcription match the core", signedAlways);
  check("the page's equal sums hold for every inside configuration", equalInside);
  check("each inside sum is half the polygon's area", halvesInside);
  check("inside, even + odd areas add to the polygon's area", halvesInside);
  check("signed sums are equal for every P, inside or out", signedAlways);
  check("signed sums match the second transcription", signedTranscription);
  check("signed sums are n*s*h/2 for every P", signedNH);
  check("each altitude meets its side at right angles", feetPerpendicular);
  check("each triangle area is (side/2) times its altitude", areaIsBaseTimesDistance);
  check("U and W form two congruent regular n-gons of apothem h", twoGonsTrue);
  check("inside matches the all-one-side test", insideMatchesSign);
  check("random configurations include plenty inside and outside", inside > 400 && outside > 400);
  check("unsigned sums really can differ when P is outside", outsideDifferent > 50);
  check(`covered every N in 4..30 by 2 and ${configurations} configurations`,
    configurations === NS.length * 401);
}

/* ----------------------- 3. a second transcription from the applet bytecode */

/**
 * Written from AreasInRegPolyCanvas.Reset, Compute and Draw and the
 * GeoSDoub calls they make, without using anything from the core:
 *   R = min(W,H)/3.5, cx = W/2, cy = H/2 (Java integer division);
 *   V[k] = (cx + R*cos(2*pi*k/N), cy + R*sin(2*pi*k/N));
 *   U[k/2] = Intersect(V[k-1]V[k], V[k+1]V[k+2]) for k = 0,2,...;
 *   W[(k-1)/2] = Intersect(V[k-1]V[k], V[k+1]V[k+2]) for k = 1,3,...;
 *   H[k] = NearestPoint(P, V[k], V[(k+1)%N]);
 *   triangle k is (V[k], V[(k+1)%N], P) in Color1 if k%2==0 else Color2.
 */
function applet(N, P, width = 400, height = 300) {
  const det = (ax, ay, bx, by) => ax * by - ay * bx;
  const inter = (a, b, c, d) => {
    const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
    const den = det(rx, ry, sx, sy);
    if (Math.abs(den) < 1e-9) return null; // parallel sidelines have no meeting point
    const t = det(c.x - a.x, c.y - a.y, sx, sy) / den;
    return { x: a.x + rx * t, y: a.y + ry * t };
  };
  const foot = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  };

  const radius = Math.min(width, height) / 3.5;
  const midX = Math.floor(width / 2), midY = Math.floor(height / 2);
  const V = [], U = [], W = [], H = [];
  for (let k = 0; k < N; k++) {
    const theta = ((Math.PI * 2) / N) * k;
    V.push({ x: midX + radius * Math.cos(theta), y: midY + radius * Math.sin(theta) });
  }
  for (let k = 0; k < N; k += 2) {
    U.push(inter(V[(k - 1 + N) % N], V[k], V[(k + 1) % N], V[(k + 2) % N]));
  }
  for (let k = 1; k < N; k += 2) {
    W.push(inter(V[(k - 1 + N) % N], V[k], V[(k + 1) % N], V[(k + 2) % N]));
  }
  for (let k = 0; k < N; k++) H.push(foot(P, V[k], V[(k + 1) % N]));

  const even = [], odd = [];
  let evenSigned = 0, oddSigned = 0;
  for (let k = 0; k < N; k++) {
    const v = V[k], q = V[(k + 1) % N];
    const twice = det(q.x - v.x, q.y - v.y, P.x - v.x, P.y - v.y);
    if (k % 2 === 0) { even.push(Math.abs(twice) / 2); evenSigned += twice / 2; }
    else { odd.push(Math.abs(twice) / 2); oddSigned += twice / 2; }
  }
  return { V, U, W, H, even, odd, evenSigned, oddSigned };
}

done("areas-in-reg-poly");
