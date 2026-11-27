#!/usr/bin/env node
"use strict";

/*
 * Logic test for eyeball/eyeball-core.js.
 *
 *   node porting/check-eyeball.mjs
 *
 * Checks the applet's opening arrangement, its two checkboxes and its dragging
 * rules, then the page's claim PQ = RS = 2*rA*rB/AB on 972 grid positions,
 * 1,200 seeded random positions and hand-picked near-degenerate ones. The
 * applet's own DrawTangents, ScaleToC, GeoSDoub.Intersect and GetCircle are
 * transcribed a second time, straight from javap -c of EyeballCanvas and
 * GeoSDoub, and every chord, touch point and extra circle is compared. Both
 * circle-intersection branches (x-separated and y-separated centres) are
 * exercised, as are the configurations where the tangents do not exist.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("eyeball/eyeball-core.js", "EyeballCore");

/* ------------------------------------------- a second transcription of the applet */

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/** GeoSDoub.IntersectCirclesX(DoubCircle,DoubCircle), from javap -c. */
function appletCirclesX(c1, r1, c2, r2) {
  const m = -(c1.y - c2.y) / (c1.x - c2.x);
  const b = (c1.x * c1.x - c2.x * c2.x + c1.y * c1.y - c2.y * c2.y - r1 * r1 + r2 * r2)
    / (2 * (c1.x - c2.x));
  const a = b - c1.x;
  const aa = m * m + 1;
  const bb = 2 * (m * a - c1.y);
  const cc = c1.y * c1.y + a * a - r1 * r1;
  const disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const y1 = (-bb + s) / (2 * aa), y2 = (-bb - s) / (2 * aa);
  return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
}

/** GeoSDoub.IntersectCirclesY(DoubCircle,DoubCircle), from javap -c. */
function appletCirclesY(c1, r1, c2, r2) {
  const m = -(c1.x - c2.x) / (c1.y - c2.y);
  const b = (c1.y * c1.y - c2.y * c2.y + c1.x * c1.x - c2.x * c2.x - r1 * r1 + r2 * r2)
    / (2 * (c1.y - c2.y));
  const a = b - c1.y;
  const aa = m * m + 1;
  const bb = 2 * (m * a - c1.x);
  const cc = c1.x * c1.x + a * a - r1 * r1;
  const disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const x1 = (-bb + s) / (2 * aa), x2 = (-bb - s) / (2 * aa);
  return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
}

/** GeoSDoub.Intersect(DoubCircle,DoubCircle): X if |dx|>1, else Y if |dy|>1. */
function appletCircleIntersection(c1, r1, c2, r2) {
  if (Math.abs(c1.x - c2.x) > 1) return appletCirclesX(c1, r1, c2, r2);
  if (Math.abs(c1.y - c2.y) > 1) return appletCirclesY(c1, r1, c2, r2);
  return [{ ...c1 }, { ...c1 }];
}

/** EyeballCanvas.ScaleToC(DoubCircle,DoubPoint), literally. */
function appletScaleToC(centre, radius, p) {
  // radius/dist, not dist/radius: the bytecode divides GetRadius() by Dist().
  const factor = radius / dist(centre, p);
  return {
    x: centre.x + factor * (p.x - centre.x),
    y: centre.y + factor * (p.y - centre.y),
  };
}

/**
 * EyeballCanvas.DrawTangents(g, touched, other, colour): disc = d² - r_touched²;
 * cross `touched` with the circle centred at `other` of radius sqrt(disc),
 * draw the rays from `other`, and return [scaled0, scaled1, cross0, cross1].
 */
function appletDrawTangents(touched, touchedR, other, otherR) {
  const d2 = (touched.x - other.x) ** 2 + (touched.y - other.y) ** 2;
  const disc = d2 - touchedR * touchedR;
  if (disc < 0) return null;
  const cross = appletCircleIntersection(touched, touchedR, other, Math.sqrt(disc));
  if (!cross) return null;
  return [
    appletScaleToC(other, otherR, cross[0]),
    appletScaleToC(other, otherR, cross[1]),
    cross[0], cross[1],
  ];
}

/** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), literally. */
function appletLineIntersection(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** GeoSDoub.FindCircumcenter(A,B,C), literally. */
function appletCircumcentre(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  // javap's aload_3 is local slot 3, the midpoint m1 - not parameter C (slot 2).
  return appletLineIntersection(m1, p, m2, q);
}

/** EyeballCanvas.GetCircle(P,Q,R,colour), literally (the radius is averaged). */
function appletGetCircle(a, b, c) {
  const centre = appletCircumcentre(a, b, c);
  const radius = (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3;
  return { centre, radius };
}

/* ------------------------------------------------------------- configurations */

const state = (A, rA, B, rB) => C.start({
  A, B,
  RA: { x: A.x, y: A.y - rA },
  RB: { x: B.x, y: B.y + rB },
});

const exact = [["opening", C.start()]];
// A 3x3x4x3x3x3 grid of whole positions that fit in the original canvas.
for (const ax of [90, 220, 350]) {
  for (const ay of [150, 200, 250]) {
    for (const bx of [430, 560, 690, 760]) {
      for (const by of [150, 200, 250]) {
        for (const ra of [30, 60, 90]) {
          for (const rb of [40, 80, 120]) {
            const A = { x: ax, y: ay }, B = { x: bx, y: by };
            if (dist(A, B) <= Math.max(ra, rb) + 10) continue;
            exact.push([`grid ${ax},${ay} / ${bx},${by} / ${ra},${rb}`, state(A, ra, B, rb)]);
          }
        }
      }
    }
  }
}
// Equal x centres force GeoSDoub.Intersect's Y branch; equal y forces X's
// degenerate |dy|<=1 path only when the two centres coincide (excluded).
for (let i = 0; i < 12; i++) {
  const A = { x: 180 + i * 36, y: 110 + (i % 3) * 20 };
  const B = { x: A.x + (i % 2), y: 330 - (i % 3) * 15 };
  const ra = 35 + (i % 4) * 12, rb = 45 + (i % 3) * 14;
  if (dist(A, B) <= Math.max(ra, rb) + 10) continue;
  exact.push([`same x ${i}`, state(A, ra, B, rb)]);
}
// A mirror image and a very close pair of tangent circles.
exact.push(["mirrored", state({ x: 620, y: 200 }, 80, { x: 150, y: 200 }, 60)]);
exact.push(["nearly touching", state({ x: 270, y: 200 }, 90, { x: 460, y: 200 }, 100)]);

const random = [];
const next = rng(20261127);
for (let i = 0; i < 9000 && random.length < 1200; i++) {
  const A = { x: 60 + next() * 400, y: 120 + next() * 160 };
  const B = { x: 80 + next() * 680, y: 120 + next() * 160 };
  const ra = 25 + next() * 85, rb = 30 + next() * 100;
  if (dist(A, B) <= Math.max(ra, rb) + 12) continue;
  random.push(state(A, ra, B, rb));
}
const sample = [...exact.map(([, s]) => s), ...random];
const yBranch = sample.filter((s) => Math.abs(s.A.x - s.B.x) <= 1).length;
const xBranch = sample.length - yBranch;

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  check("A starts at (w/4, h/2) of the applet's 600x400 canvas",
    C.dist(s.A, { x: 150, y: 200 }) < 1e-9);
  check("B starts at 12w/11 and the radii are min(w,h)/6 and min(w,h)/4",
    Math.abs(s.B.x - 12 * 600 / 11) < 1e-9 && s.B.y === 200
      && Math.abs(C.dist(s.A, s.RA) - 400 / 6) < 1e-9
      && Math.abs(C.dist(s.B, s.RB) - 400 / 4) < 1e-9);
  check("both applet checkboxes start unticked and a fresh picture is not over",
    !s.showExtra && !s.showRectangle && C.result(s) === null);
  equal("start counters", [s.moves, s.explored], [0, false]);
  check("legal moves are four points, two checkboxes and Reset", C.legalMoves(s).length === 7);
  const moved = C.move(s, { type: "point", name: "B", point: { x: 500, y: 180 } });
  check("dragging centre B leaves its radius point and the other circle alone",
    moved && moved.B.x === 500 && moved.B.y === 180
      && moved.RB.x === s.RB.x && moved.RB.y === s.RB.y
      && moved.A.x === s.A.x && C.result(moved) === "done");
  const resized = C.move(s, { type: "point", name: "RA", point: { x: 150, y: 155 } });
  check("dragging RA changes only the first radius", C.dist(resized.A, resized.RA) === 45
    && resized.RB.x === s.RB.x && resized.B.x === s.B.x);
  const tiny = C.move(s, { type: "point", name: "RB", point: { x: s.B.x, y: s.B.y + 1 } });
  check("a radius point cannot collapse its circle", C.dist(tiny.B, tiny.RB) >= C.MIN_RADIUS - 1e-9);
  check("bad point names, bad switches and unknown moves are refused",
    C.move(s, { type: "point", name: "X", point: s.A }) === null
      && C.move(s, { type: "option", key: "noSuchBox", value: true }) === null
      && C.move(s, { type: "jump" }) === null);
  let t = s;
  for (const key of C.OPTION_KEYS) t = C.move(t, { type: "option", key, value: true });
  check("both checkboxes can be ticked without moving any point",
    C.OPTION_KEYS.every((k) => t[k]) && C.HANDLES.every((n) => C.dist(t[n], s[n]) === 0));
  const reset = C.move(t, { type: "reset" });
  check("Reset restores the opening points but keeps the checkboxes",
    C.HANDLES.every((n) => C.dist(reset[n], s[n]) === 0)
      && C.OPTION_KEYS.every((k) => reset[k] === true));
  check("moves never change the position they were made from",
    s.moves === 0 && !s.explored && s.showExtra === false);
  const off = C.move(s, { type: "point", name: "A", point: { x: -999, y: 9999 } });
  check("a point dragged beyond the board is clamped inside it",
    off && off.A.x >= 8 && off.A.y <= C.HEIGHT - 8);
}

/* --------------------------------------- 2. the page's claims over every sample */

{
  let equalChords = 0, formula = 0, onA = 0, onB = 0, touchErr = 0, rightErr = 0;
  let chordRight = 0, midErr = 0, rectangle = 0, extras = 0;
  let smallest = Infinity, largest = 0, shortest = Infinity, longest = 0;
  let nan = 0;
  for (const s of sample) {
    const g = C.compute(s);
    if (!g.valid) throw new Error("a sample position has no tangents");
    const r = C.residuals(g);
    equalChords = Math.max(equalChords, r.equalChords);
    formula = Math.max(formula, r.chordFormula);
    onA = Math.max(onA, r.PQOnA);
    onB = Math.max(onB, r.RSOnB);
    touchErr = Math.max(touchErr, r.touchOnA, r.touchOnB);
    rightErr = Math.max(rightErr, r.tangentRight);
    chordRight = Math.max(chordRight, r.chordPerpendicular);
    midErr = Math.max(midErr, r.midOnAB);
    rectangle = Math.max(rectangle, r.rectangleSides);
    extras = Math.max(extras, r.extraThroughThird);
    smallest = Math.min(smallest, g.d / Math.max(g.rA, g.rB));
    largest = Math.max(largest, g.d / Math.min(g.rA, g.rB));
    shortest = Math.min(shortest, g.pq);
    longest = Math.max(longest, g.pq);
    const nums = [g.pq, g.rs, g.formula];
    if (g.extra[0]) nums.push(...Object.values(g.extra[0].centre));
    if (!nums.every(Number.isFinite)) nan++;
  }
  check(`PQ = RS on all ${sample.length} configurations`, equalChords < 1e-6, `max ${equalChords}`);
  check("both chords equal 2*rA*rB/AB, the page's sharper formula", formula < 1e-6, `max ${formula}`);
  check("P and Q lie on circle A, R and S on circle B", Math.max(onA, onB) < 1e-6);
  check("the tangent touch points lie on the circles they touch", touchErr < 1e-6);
  check("each radius is perpendicular to its tangent (right-triangle step)", rightErr < 1e-6);
  check("both chords are perpendicular to AB", chordRight < 1e-6);
  check("both chord midpoints lie on the line AB", midErr < 1e-6);
  check("the two sides PQSR are equal, as the rectangle claim needs", rectangle < 1e-6);
  check("each extra circle really passes through its third defining point", extras < 1e-9);
  check("the sample spans close and far circles", smallest < 1.15 && largest > 4,
    `d/max(r) down to ${smallest.toFixed(3)}, d/min(r) up to ${largest.toFixed(1)}`);
  check("the sample spans short and long chords", shortest < 10 && longest > 60,
    `${shortest.toFixed(2)}..${longest.toFixed(2)}`);
  check(`both circle-intersection branches are exercised (${xBranch} X, ${yBranch} Y)`,
    xBranch > 100 && yBranch >= 10);
  check("no configuration produced a NaN", nan === 0);

  // When the circles are too close, DrawTangents returns null, exactly as the
  // bytecode does for a negative discriminant.
  const tooClose = state({ x: 300, y: 200 }, 110, { x: 380, y: 200 }, 40);
  const g = C.compute(tooClose);
  const fromB = C.tangentPair(tooClose.B, 40, tooClose.A, 110);
  const fromA = C.tangentPair(tooClose.A, 110, tooClose.B, 40);
  check("no tangents exist when the circles overlap: the drawing is skipped",
    !g.valid && g.reason === "no tangents" && fromA === null && fromB !== null);
  const coincident = state({ x: 300, y: 200 }, 60, { x: 300, y: 200 }, 60);
  check("coincident centres give no tangents at all", !C.compute(coincident).valid);
  check("the second transcription agrees that overlapping circles have no tangents",
    appletDrawTangents(tooClose.A, 110, tooClose.B, 40) === null);
}

/* --------------------------- 3. the applet's own bytecode, transcribed twice */

{
  let chordErr = 0, touchErr = 0, extraCentre = 0, extraRadius = 0, pairs = 0;
  let scaleErr = 0, degenerate = 0, agreedDegenerate = 0;
  for (const s of sample) {
    const g = C.compute(s);
    // C1 is the first circle (A); C2 is the second (B), as in EyeballCanvas.Draw.
    const P = appletDrawTangents(g.A, g.rA, g.B, g.rB); // src A, to B: chord on B
    const Q = appletDrawTangents(g.B, g.rB, g.A, g.rA); // src B, to A: chord on A
    if (!P || !Q) throw new Error("the applet's DrawTangents found no pair");
    // GeoSDoub.Intersect's root order is kept by the core, so compare index
    // by index: chord[0] with arr[0], touch[0] with arr[2], and so on.
    const match = (pair, arr) => [
      Math.max(dist(arr[0], pair.chord[0]), dist(arr[1], pair.chord[1])),
      Math.max(dist(arr[2], pair.touch[0]), dist(arr[3], pair.touch[1])),
    ];
    for (const [pair, arr, target, targetR] of [
      [g.fromA, P, g.B, g.rB], [g.fromB, Q, g.A, g.rA],
    ]) {
      const [dc, dt] = match(pair, arr);
      chordErr = Math.max(chordErr, dc);
      touchErr = Math.max(touchErr, dt);
      for (let i = 0; i < 2; i++) {
        scaleErr = Math.max(scaleErr, Math.abs(dist(arr[i], target) - targetR));
      }
    }
    pairs++;
    // Draw() calls GetCircle(P[2], Q[2], P[0]) and GetCircle(P[3], Q[3], P[1]).
    const appletsExtra = [
      appletGetCircle(P[2], Q[2], P[0]),
      appletGetCircle(P[3], Q[3], P[1]),
    ];
    for (let i = 0; i < 2; i++) {
      const a = appletsExtra[i], c = g.extra[i];
      // GeoSDoub.Intersect returns (NaN,NaN) when its determinant is below 1;
      // the core reports that as no circle. Both behaviours are compared.
      if (!Number.isFinite(a.centre.x) || !Number.isFinite(a.centre.y)) {
        degenerate++;
        if (!c) agreedDegenerate++;
        continue;
      }
      if (!c) continue;
      extraCentre = Math.max(extraCentre, dist(a.centre, c.centre));
      extraRadius = Math.max(extraRadius, Math.abs(a.radius - c.radius));
    }
  }
  check(`DrawTangents' chords match the core on all ${pairs} configurations`,
    chordErr < 1e-6, `max ${chordErr}`);
  check("DrawTangents' touch points match the core on every configuration",
    touchErr < 1e-6, `max ${touchErr}`);
  check("ScaleToC puts every chord endpoint on the target circle", scaleErr < 1e-6, `max ${scaleErr}`);
  check("GetCircle's circumcentres match the core's extra circles", extraCentre < 1e-6, `max ${extraCentre}`);
  check("GetCircle's averaged radii match the core's extra circles", extraRadius < 1e-6, `max ${extraRadius}`);
  check("every degenerate GetCircle is reported as no circle by the core",
    degenerate === 0 || agreedDegenerate === degenerate, `${agreedDegenerate}/${degenerate}`);

  // The opening picture's numbers, independent of the core's own formula.
  const s = C.start();
  const P = appletDrawTangents({ x: 150, y: 200 }, 400 / 6,
    { x: 12 * 600 / 11, y: 200 }, 400 / 4);
  const Q = appletDrawTangents({ x: 12 * 600 / 11, y: 200 }, 400 / 4,
    { x: 150, y: 200 }, 400 / 6);
  const pq = dist(Q[0], Q[1]), rs = dist(P[0], P[1]);
  check("the transcribed opening chords are equal to each other", Math.abs(pq - rs) < 1e-9);
  check("the transcribed opening chords equal 2*rA*rB/AB",
    Math.abs(pq - 2 * (400 / 6) * (400 / 4) / (12 * 600 / 11 - 150)) < 1e-9);
  check("the transcribed opening picture agrees with the core's chord lengths",
    Math.abs(pq - C.compute(s).pq) < 1e-9 && Math.abs(rs - C.compute(s).rs) < 1e-9);
}

done("eyeball");
