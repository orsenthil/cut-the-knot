#!/usr/bin/env node
"use strict";

/*
 * Logic test for brides-chair/brides-chair-core.js.
 *
 *   node porting/check-brides-chair.mjs
 *
 * The whole parameter space here is small: the triangle's three corners run
 * over a 9 x 9 grid of canvas positions, and the rotation slider has the
 * applet's 0..95 integer range. Every claim of the column and applet page is
 * checked over all non-degenerate grid triangles, not on a few examples:
 * equal flank areas, the 90-degree coincidence, the median/altitude of length
 * BC/2, the outer-side square identity, Pythagoras, the parallel/isosceles
 * olympiad claim, the symmetry of the flank relation and Vecten's concurrence.
 * A second, literal transcription of the applet's Rotate/FormSquare methods is
 * compared with the core over the same space.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("brides-chair/brides-chair-core.js", "BridesChairCore");
const { dist, dist2, sub, dot, cross, area, midpoint } = C;

const EPS = 1e-7;
const close = (a, b, tol = EPS) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const closeP = (a, b, tol = EPS) => close(a.x, b.x, tol) && close(a.y, b.y, tol);

/** Every non-degenerate triangle on a coarse grid covering the whole canvas. */
function* triangles() {
  for (let ax = 40; ax <= 360; ax += 40) for (let ay = 40; ay <= 260; ay += 40)
    for (let bx = 40; bx <= 360; bx += 40) for (let by = 40; by <= 260; by += 40)
      for (let cx = 40; cx <= 360; cx += 40) for (let cy = 40; cy <= 260; cy += 40) {
        const A = { x: ax, y: ay }, B = { x: bx, y: by }, Cc = { x: cx, y: cy };
        if (area(A, B, Cc) < 50) continue;
        const state = C.start({});
        state.A = A; state.B = B; state.C = Cc;
        yield state;
      }
}

function withCorners(A, B, Cc, extra) {
  const s = C.start(extra || {});
  s.A = A; s.B = B; s.C = Cc;
  return s;
}

/* --------------------------------------------------- 1. the rules and options */

{
  const s = C.start({});
  const d = C.WIDTH / 8;
  const cx = C.WIDTH / 2, cy = C.HEIGHT / 2;
  check("applet's initial A", closeP(s.A, { x: cx - d, y: cy + 2 }));
  check("applet's initial B", closeP(s.B, { x: cx + d, y: cy + 2 }));
  check("applet's initial C", closeP(s.C, {
    x: cx - d * Math.cos(Math.PI / 3),
    y: cy - d * Math.sin(Math.PI / 3) - 20,
  }));
  equal("all four checkboxes start off", [s.showNames, s.showLines, s.fillTriangles, s.medians], [false, false, false, false]);
  equal("slider starts at the applet's 0", s.rotation, 0);
  check("a fresh demo is not yet explored", C.result(s) === null);

  equal("slider range 0..95", [C.ROTATION_MIN, C.ROTATION_MAX, C.ROTATION_STEP], [0, 95, 1]);
  const slider = C.move(s, { type: "rotation", value: 95 });
  equal("slider at maximum", slider.rotation, 95);
  equal("slider clamps above maximum", C.move(s, { type: "rotation", value: 900 }).rotation, 95);
  equal("slider clamps below minimum", C.move(slider, { type: "rotation", value: -4 }).rotation, 0);
  equal("slider rounds to whole degrees", C.move(s, { type: "rotation", value: 42.6 }).rotation, 43);

  const dragged = C.move(slider, { type: "vertex", index: 2, x: 300, y: 90 });
  check("a drag moves point C", closeP(dragged.C, { x: 300, y: 90 }));
  equal("mousePressed resets the slider", dragged.rotation, 0);
  equal("drag keeps the record informed", C.result(dragged), "done");
  const clamped = C.move(s, { type: "vertex", index: 0, x: -500, y: 9999 });
  check("a dragged point stays on the canvas", closeP(clamped.A, { x: 8, y: C.HEIGHT - 8 }));
  equal("unknown moves are ignored", C.move(s, { type: "nonsense" }), s);

  const turned = C.move(s, { type: "option", key: "medians", value: true });
  equal("a checkbox turns on", turned.medians, true);
  equal("checkbox change resets rotation (itemStateChanged)", C.move(slider, { type: "option", key: "showNames", value: true }).rotation, 0);
  equal("the other option keys are unchanged", [turned.showNames, turned.showLines, turned.fillTriangles], [false, false, false]);
  equal("the right-angle preset sets a result", C.result(C.move(s, { type: "right" })), "done");
  const types = C.legalMoves(s).map((m) => m.type);
  check("selection, drag, slider, options, right angle and reset are all legal",
    ["select", "vertex", "rotation", "option", "right", "reset"].every((t) => types.includes(t)));
  equal("reset restores the first position", C.move(slider, { type: "reset" }), s);
  const roundTrip = JSON.parse(JSON.stringify(C.snapshot(slider)));
  equal("the position is plain JSON", C.snapshot(slider), roundTrip);
  equal("snapshot keeps the slider", roundTrip.rotation, 95);
}

/* -------------------------------- 2. the constructions, over every triangle */

{
  let count = 0;
  for (const s of triangles()) {
    const { A, B, C: Cc } = s;
    const g = C.geometry(s);
    const ar = area(A, B, Cc);

    // FormSquare: the four corners of each erected square are a real square.
    for (const quad of [g.squares.AB, g.squares.BC, g.squares.CA]) {
      const sides = [dist(quad[0], quad[1]), dist(quad[1], quad[2]), dist(quad[2], quad[3]), dist(quad[3], quad[0])];
      for (const side of sides) check("square with four equal sides", close(side, sides[0]));
      check("square has a right corner", close(dot(sub(quad[1], quad[0]), sub(quad[3], quad[0])), 0));
    }

    // The column's first claim: the three flank triangles match ABC in area.
    for (const flank of [g.flanks.A, g.flanks.B, g.flanks.C]) {
      check("a flank has the same area as ABC", close(area(...flank), ar));
    }

    // The median of a flank is an altitude of ABC and half the opposite side.
    check("AM_a = BC/2", close(dist(A, g.medians.A), dist(B, Cc) / 2));
    check("BM_b = AC/2", close(dist(B, g.medians.B), dist(Cc, A) / 2));
    check("CM_c = AB/2", close(dist(Cc, g.medians.C), dist(A, B) / 2));
    check("AM_a is perpendicular to BC", close(dot(sub(g.medians.A, A), sub(Cc, B)), 0));
    check("BM_b is perpendicular to AC", close(dot(sub(g.medians.B, B), sub(A, Cc)), 0));
    check("CM_c is perpendicular to AB", close(dot(sub(g.medians.C, Cc), sub(B, A)), 0));

    // The column's outer-side identity: A_cB_c^2 + B_aC_a^2 + A_bC_b^2 = 3(AB^2+BC^2+AC^2).
    const outer = dist2(g.BA, g.CA) + dist2(g.AB, g.CB) + dist2(g.AC, g.BC);
    const sides = dist2(A, B) + dist2(B, Cc) + dist2(Cc, A);
    check("sum of the outer flank sides squared = 3 times sum of sides squared", close(outer, 3 * sides));

    // At slider 90 degrees the A-flank has turned until B_a lands on C.
    const turned = C.move(s, { type: "rotation", value: 90 });
    const r = C.geometry(turned);
    check("a quarter turn puts B' on C", closeP(r.movedBA, Cc));
    check("C-to-midpoint of B C' passes through A", closeP(midpoint(B, r.movedCA), A));
    check("the rotated median is parallel to BC", close(cross(sub(r.movedMid, A), sub(Cc, B)), 0));
    const medianNow = dist(A, r.movedMid);
    check("the rotated median still has half the length of BC", close(medianNow, dist(B, Cc) / 2));

    // The olympiad claim on the applet's page: if A_cB_c is parallel to AB,
    // then AC = BC.
    if (Math.abs(cross(sub(g.AB, g.BA), sub(B, A))) < 1e-8 * dist(g.AB, g.BA) * dist(A, B)) {
      check("A_cB_c parallel to AB makes AC = BC", close(dist(A, Cc), dist(B, Cc)));
    }

    // A flank's own flank at its first vertex is the original triangle again.
    const f = [A, g.BA, g.CA];
    const again = [f[0], C.rotate(f[0], f[2], -Math.PI / 2, 1), C.rotate(f[0], f[1], Math.PI / 2, 1)];
    check("a triangle is a flank of its own flank", closeP(again[0], A) && closeP(again[1], B) && closeP(again[2], Cc));

    // Vecten's concurrence: A->centre(BC), B->centre(CA), C->centre(AB).
    const cross2 = (p, q) => cross(p, q);
    const d1 = sub(g.centers.BC, A), d2 = sub(g.centers.CA, B), d3 = sub(g.centers.AB, Cc);
    const den = cross2(d1, d2);
    if (Math.abs(den) > 1e-9) {
      const t = cross(sub(B, A), d2) / den;
      const P = { x: A.x + t * d1.x, y: A.y + t * d1.y };
      check("the three lines to the square centres concur (Vecten)", close(cross(sub(P, Cc), d3), 0));
    }
    count++;
  }
  check("the grid really was exhaustive", count > 100000, `${count} triangles`);
}

/* ---------------------- 3. Pythagoras and the applet's own Rotate/FormSquare */

{
  // Literal transcription of GeoSDoub.Rotate from its bytecode.
  const geoRotate = (c, p, angle, dir) => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return {
      x: c.x + cos * (p.x - c.x) - dir * sin * (p.y - c.y),
      y: c.y + dir * sin * (p.x - c.x) + cos * (p.y - c.y),
    };
  };
  // Literal transcription of BridesChairCanvas.Rotate and FormSquare.
  const appletFormSquare = (p, q) => [
    geoRotate(p, q, Math.PI / 2, 1),
    geoRotate(q, p, Math.PI / 2, -1),
  ];
  const appletRotate = (A, BA, CA, degrees) => [
    geoRotate(A, BA, degrees * Math.PI / 180, 1),
    geoRotate(A, CA, degrees * Math.PI / 180, 1),
  ];

  let count = 0;
  for (const s of triangles()) {
    const g = C.geometry(s);
    const squares = [appletFormSquare(s.A, s.B), appletFormSquare(s.B, s.C), appletFormSquare(s.C, s.A)];
    check("core square on AB matches FormSquare", closeP(g.CA, squares[0][0]) && closeP(g.CB, squares[0][1]));
    check("core square on BC matches FormSquare", closeP(g.AB, squares[1][0]) && closeP(g.AC, squares[1][1]));
    check("core square on CA matches FormSquare", closeP(g.BC, squares[2][0]) && closeP(g.BA, squares[2][1]));

    // Each whole degree of the slider, 0 through 95.
    for (let v = C.ROTATION_MIN; v <= C.ROTATION_MAX; v += C.ROTATION_STEP) {
      const r = C.geometry(C.move(s, { type: "rotation", value: v }));
      const expected = appletRotate(s.A, g.BA, g.CA, v);
      check("core rotation matches Rotate(int) for every slider value",
        closeP(r.movedBA, expected[0]) && closeP(r.movedCA, expected[1]));
      check("rotation keeps the turning point at the same distance from A",
        close(dist(s.A, r.movedBA), dist(s.A, g.BA)));
    }

    // Pythagoras: put C on the circle with AB as diameter.
    const A = s.A, B = s.B;
    const ab = sub(B, A), len = dist(A, B);
    const perp = { x: -ab.y / len, y: ab.x / len };
    const Cc = { x: (A.x + B.x) / 2 + perp.x * len / 2, y: (A.y + B.y) / 2 + perp.y * len / 2 };
    if (Cc.x > 8 && Cc.x < C.WIDTH - 8 && Cc.y > 8 && Cc.y < C.HEIGHT - 8) {
      check("square on hypotenuse = sum of squares on the legs",
        close(dist2(A, B), dist2(A, Cc) + dist2(B, Cc)));
      const right = C.move(s, { type: "right" });
      check("the right-angle preset really gives a right angle",
        Math.abs(dot(sub(right.B, right.C), sub(right.A, right.C))) < EPS);
    }
    count++;
  }
  check("the applet comparison covered the whole grid and slider", count > 100000, `${count} triangles`);
}

done("brides-chair");
