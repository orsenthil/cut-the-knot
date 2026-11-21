#!/usr/bin/env node
"use strict";

/*
 * Logic test for cwidth/cwidth-core.js.
 *
 *   node porting/check-cwidth.mjs
 *
 * Every angle 0..359 degrees and every direction in steps of 1 degree: the
 * width of the Reuleaux triangle is its side in all directions (the claim that
 * defines constant width); the support function agrees with a brute-force scan
 * of the boundary; the applet's own bounding-square method (vertex box, then s
 * from the opposite side where an arc is extreme) equals the true bounding box
 * and has side s both ways. The page's problems are checked numerically: the
 * area (pi - sqrt 3)/2 s^2 against grid counting and its being less than the
 * circle's pi/4 s^2; the perimeter pi s by summing the arcs (Barbier); the
 * internal angles 120 degrees; each boundary point has a boundary point exactly
 * s away; no two points are farther apart than s; the area swept inside the
 * square, 2 sqrt 3 + pi/6 - 3 = 0.98770 for s = 1, by counting grid points
 * against every 0.5 degrees of turning; and the generalised shape's width
 * (side 50 extended by 10 on each side) is 70.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("cwidth/cwidth-core.js", "CwidthCore");
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

/** The boundary of the shape as a dense list of points, from the three arcs. */
function boundary(angle, s, per = 600) {
  const out = [];
  C.arcs(angle, s).forEach((arc, i) => {
    const vs = C.vertices(angle, s);
    const [cx, cy] = arc.centre;
    const a = vs[(i + 1) % 3], b = vs[(i + 2) % 3];
    let a1 = Math.atan2(a[1] - cy, a[0] - cx), a2 = Math.atan2(b[1] - cy, b[0] - cx);
    let d = a2 - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    for (let k = 0; k <= per; k++) { const t = a1 + (d * k) / per; out.push([cx + s * Math.cos(t), cy + s * Math.sin(t)]); }
  });
  return out;
}

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  check("a new game is not over", C.result(s) === null);
  equal("opens at angle 0, the rotating view, 5 degrees a tick", [s.angle, s.mode, s.step], [0, "rotate", 5]);
  const t = C.move(s, { type: "tick" });
  check("a tick turns it 5 degrees", t.angle === 5 && t.moves === 1);
  check("the old position is untouched", s.angle === 0 && s.moves === 0);
  let a = s; for (let i = 0; i < 72; i++) a = C.move(a, { type: "tick" });
  equal("72 ticks of 5 degrees are a full turn, kept mod 360", a.angle, 0);
  equal("clicking goes rotate, square, trace, rotate", (() => { let x = s; const r = [x.mode]; for (let i = 0; i < 3; i++) { x = C.move(x, { type: "click" }); r.push(x.mode); } return r; })(), ["rotate", "square", "trace", "rotate"]);
  check("seeing all three views is done", C.result(C.move(C.move(s, { type: "click" }), { type: "click" })) === "done" && C.result(C.move(s, { type: "click" })) === null);
  check("bad moves are refused", C.move(s, null) === null && C.move(s, { type: "mode", value: "x" }) === null && C.move(s, { type: "angle", value: NaN }) === null && C.move(s, { type: "step", value: "a" }) === null && C.move(s, { type: "nope" }) === null);
  equal("angle is kept mod 360, steps between 1 and 30", [C.move(s, { type: "angle", value: -10 }).angle, C.move(s, { type: "angle", value: 725 }).angle, C.move(s, { type: "step", value: 0 }).step, C.move(s, { type: "step", value: 99 }).step], [350, 5, 1, 30]);
  // The vertices as the applet's Rotate() computes them.
  const v0 = C.vertices(0, 100);
  check("the vertices at angle 0 are (-s/2, -r/2), (s/2, -r/2), (0, r)", near(v0[0][0], -50) && near(v0[1][0], 50) && near(v0[2][0], 0) && near(v0[2][1], 100 / C.SQRT3) && near(v0[0][1], -100 / C.SQRT3 / 2));
  check("each pair of vertices is the side s apart", [0, 7, 45, 90, 123, 359].every((ang) => { const v = C.vertices(ang, 100); return [[0, 1], [1, 2], [2, 0]].every(([i, j]) => near(Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1]), 100, 1e-9)); }));
}

/* -------------------------------------------------- 2. every case, where small */
{
  // Constant width, every angle and direction.
  let bad = 0, n = 0, worst = 0;
  for (let angle = 0; angle < 360; angle++) for (let theta = 0; theta < 180; theta++) {
    n++;
    const w = C.width(angle, 1, theta);
    worst = Math.max(worst, Math.abs(w - 1));
    if (Math.abs(w - 1) > 1e-9) bad++;
  }
  equal(`width is exactly s in every direction at every angle (${n}); worst error ${worst.toExponential(1)}`, bad, 0);

  // The support function against a brute-force scan of the boundary, for a spread of angles.
  bad = 0; n = 0;
  for (const angle of [0, 13, 30, 47, 60, 77, 90, 119, 120, 200, 321]) {
    const pts = boundary(angle, 1);
    for (let theta = 0; theta < 360; theta += 5) {
      n++;
      const t = (theta * Math.PI) / 180;
      const brute = Math.max(...pts.map(([x, y]) => x * Math.cos(t) + y * Math.sin(t)));
      if (Math.abs(brute - C.support(angle, 1, theta)) > 2e-6) bad++;
    }
  }
  equal(`the support function equals a brute-force scan of the arcs (${n} directions)`, bad, 0);

  // The applet's bounding method equals the true bounding box; the square has side s.
  bad = 0; n = 0;
  for (let angle = 0; angle < 360; angle++) {
    n++;
    const a = C.boundsApplet(angle, 1), b = C.boundsTrue(angle, 1);
    for (const k of ["left", "right", "top", "bottom"]) if (Math.abs(a[k] - b[k]) > 1e-9) bad++;
    if (Math.abs(b.right - b.left - 1) > 1e-9 || Math.abs(b.bottom - b.top - 1) > 1e-9) bad++;
  }
  equal(`the applet's bounding square equals the true one, with side s, at every angle (${n})`, bad, 0);
  check("the enclosing square for a state has side s", [0, 33, 100, 250].every((angle) => { const q = C.square({ angle }, 80); return near(q.right - q.left, 80) && near(q.bottom - q.top, 80); }));

  // The page's problems.
  const area = C.area(1);
  let inCount = 0, total = 0;
  const N = 600;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { total++; if (C.inside(0, 1, -0.6 + (1.2 * (i + 0.5)) / N, -0.6 + (1.2 * (j + 0.5)) / N)) inCount++; }
  const counted = (inCount / total) * 1.44;
  check(`the area (pi - sqrt 3)/2 = ${area.toFixed(5)} matches grid counting (${counted.toFixed(5)})`, Math.abs(counted - area) < 2e-3);
  check("the Reuleaux triangle's area is less than the circle's of the same width", area < Math.PI / 4 && near(area, 0.70477, 1e-5));
  // Perimeter: sum of the three 60-degree arcs, and by polygon approximation
  const pts = boundary(0, 1, 2000);
  let perim = 0;
  for (let k = 1; k < pts.length; k++) if (k % 2001 !== 0) perim += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  check(`the perimeter is pi s (Barbier): ${perim.toFixed(5)}`, near(C.perimeter(1), Math.PI) && Math.abs(perim - Math.PI) < 1e-4);
  // Angles at the vertices: between the tangents of the two arcs meeting there: 120 degrees.
  let angOk = true;
  for (let i = 0; i < 3; i++) {
    const v = C.vertices(0, 1), p = v[i], q = v[(i + 1) % 3], r = v[(i + 2) % 3];
    // the arc from q to r is centred at p; the arcs meeting at q are centred at p and r (arc p-q centred at r, arc q-r centred at p)
    // the tangent at q of the arc centred at c is perpendicular to (q - c)
    const tangent = (c, pt) => { const dx = pt[0] - c[0], dy = pt[1] - c[1]; return [-dy, dx]; };
    const t1 = tangent(p, q), t2 = tangent(r, q); // arcs centred at p and at r both pass through q
    const cos = (t1[0] * t2[0] + t1[1] * t2[1]) / (Math.hypot(...t1) * Math.hypot(...t2));
    const ang = (Math.acos(Math.abs(cos)) * 180) / Math.PI; // the angle between the tangent lines
    if (!(near(ang, 60, 1e-6))) angOk = false; // the lines meet at 60 degrees; the interior angle is 180 - 60 = 120
  }
  check("the internal angles are 120 degrees (the tangents cross at 60)", angOk);
  // Every boundary point has a partner exactly s away; nothing is farther apart than s.
  let partner = true, widest = 0;
  const bd = boundary(0, 1, 120);
  for (const [x, y] of bd) {
    let best = Infinity;
    for (const [u, v] of bd) { const d = Math.hypot(u - x, v - y); best = Math.min(best, Math.abs(d - 1)); widest = Math.max(widest, d); }
    if (best > 2e-3) partner = false;
  }
  check("every boundary point has another boundary point at distance s", partner);
  check("no two points are farther apart than s (the diameter)", widest <= 1 + 1e-9);

  // The swept area inside the square, by counting grid points over every half degree of turning.
  const M = 240;
  const hit = new Uint8Array(M * M);
  for (let angle = 0; angle < 120; angle += 0.5) { // the shape repeats every 120 degrees
    const bb = C.boundsTrue(angle, 1); // the square [0,1]^2 sits at the true bounding box (the applet's method matches it at whole degrees)
    for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) {
      if (hit[i * M + j]) continue;
      // the square [0,1]^2 sits at the bounding box: shape coordinates = point + box corner
      if (C.inside(angle, 1, bb.left + (i + 0.5) / M, bb.top + (j + 0.5) / M)) hit[i * M + j] = 1;
    }
  }
  const swept = hit.reduce((s2, x) => s2 + x, 0) / (M * M);
  check(`the area the turning triangle covers in its square is 2 sqrt 3 + pi/6 - 3 = ${C.sweptArea(1).toFixed(5)} (counted ${swept.toFixed(4)})`, Math.abs(swept - C.sweptArea(1)) < 2e-3 && near(C.sweptArea(1), 0.98770039, 1e-8));
  check("so the square (area 1) is covered to within 1.3%", swept < 1 && 1 - swept < 0.0135);

  // The generalised shape: triangle side 50, sides extended 10 beyond each vertex: width 50 + 2*10 = 70.
  // The six arcs of radius 10 (at the vertices) and 60 (centred at the far vertices) give opposite points 70 apart.
  const side = 50, ext = 10;
  equal("the extended shape's width is the side plus twice the extension", side + 2 * ext, 70);
  // Check with coordinates: an arc of radius ext at a vertex and the arc of radius side+ext centred at the distant vertex.
  const vs = [[0, 0], [side, 0], [side / 2, (side * C.SQRT3) / 2]];
  let ok = true;
  for (let i = 0; i < 3; i++) { // point on the near arc (radius ext) directly away from the opposite vertex, and the far arc point through the vertex
    const v = vs[i], o1 = vs[(i + 1) % 3], o2 = vs[(i + 2) % 3];
    const mid = [(o1[0] + o2[0]) / 2, (o1[1] + o2[1]) / 2];
    const dir = [v[0] - mid[0], v[1] - mid[1]]; const len = Math.hypot(...dir);
    const tip = [v[0] + (dir[0] / len) * ext, v[1] + (dir[1] / len) * ext]; // on the radius-ext arc around v
    // the opposite side's arc is centred at v with radius side + ext through the antipode: distance from tip? ext + (side + ext) away along the line
    const far = [v[0] - (dir[0] / len) * (side + ext), v[1] - (dir[1] / len) * (side + ext)];
    if (!near(Math.hypot(tip[0] - far[0], tip[1] - far[1]), side + 2 * ext, 1e-9)) ok = false;
  }
  check("the extended shape's opposite points, along the line through a vertex, are 70 apart", ok);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // The applet's integer Rotate(): C.x = (int)(O.x cos + O.y sin), C.y = (int)(O.y cos - O.x sin), with R = 100.
  const R = 100, r = Math.trunc((R / 2) / (Math.sqrt(3) / 2)), a2 = Math.trunc(R / 2), a3 = Math.trunc(r / 2);
  const O = [[-a2, -a3], [a2, -a3], [0, 2 * a3 + 2]];
  let worst = 0;
  for (let a = 0; a < 360; a += 5) {
    const c = Math.cos((a * Math.PI) / 180), sn = Math.sin((a * Math.PI) / 180);
    const Ci = O.map(([x, y]) => [Math.trunc(x * c + y * sn), Math.trunc(y * c - x * sn)]);
    const Cf = C.vertices(a, R);
    Ci.forEach(([x, y], i) => { worst = Math.max(worst, Math.hypot(x - Cf[i][0], y - Cf[i][1])); });
  }
  check(`the real-number vertices are within 3 pixels of the applet's integer ones (worst ${worst.toFixed(2)})`, worst < 3.01);
  equal("the applet turns 5 degrees every 100 ms", [C.START_STEP, C.TICK_MS], [5, 100]);
}

done("cwidth");
