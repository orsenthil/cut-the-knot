#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-touching-circles/four-touching-circles-core.js.
 *
 *   node porting/check-four-touching-circles.mjs
 *
 * There are two distinct claims to check. The cut-the-knot page first says
 * the four contact points of a cyclic chain of tangent circles are concyclic;
 * its own Remark then corrects that to "iff an even number of the contacts is
 * external". The Java applet builds only the even family - two parallel lines
 * plus two circles touching at E - so its contact points A, E, B and infinity
 * always lie on AB, and the inverted contact points always lie with O on the
 * inverse of AB. The first half of this test checks those facts over thousands
 * of configurations, and checks the parity claim on general four-circle chains
 * built from prescribed tangency types.
 *
 * The second half is an independent, literal transcription of the applet's
 * DrawCircle, InvLine.InvertLinC, InvLine.InvertCinC and Inversion.Invert
 * bytecode, compared with the core over hundreds of random positions.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-touching-circles/four-touching-circles-core.js", "FourTouchingCirclesCore");
const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/* ----------------------------------------- a second, literal transcription */

/* GeoSDoub.Intersect, written from the four line coefficients. */
function bytecodeIntersect(a, b, c, d) {
  const u1 = a.y - b.y, v1 = b.x - a.x, w1 = a.x * b.y - a.y * b.x;
  const u2 = c.y - d.y, v2 = d.x - c.x, w2 = c.x * d.y - c.y * d.x;
  const det = u1 * v2 - u2 * v1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (v1 * w2 - v2 * w1) / det, y: (u2 * w1 - u1 * w2) / det };
}

/* FourTouchingCirclesCanvas.DrawCircle: midpoint, perpendicular and y = T.y. */
function bytecodeTangentCircle(T, E) {
  const mx = (E.x + T.x) / 2, my = (E.y + T.y) / 2;
  const px = mx + (E.y - T.y), py = my - (E.x - T.x);
  const centre = bytecodeIntersect({ x: mx, y: my }, { x: px, y: py },
    T, { x: T.x + 100, y: T.y });
  return { center: centre, radius: Math.abs(centre.x - T.x) };
}

/* GeoSDoub.NearestPoint(p,a,b) and Dist(p,line), as in the bytecode. */
function bytecodeFoot(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return { x: p.x, y: p.y };
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/* InvLine.InvertLinC, following the local variables of the disassembly. */
function bytecodeInvertLine(line, inv) {
  const d = dist(inv.center, bytecodeFoot(inv.center, line.p, line.q));
  if (d <= 0.1) return { kind: "line", p: line.p, q: line.q };
  const k = inv.radius * inv.radius / d / d;
  const n = bytecodeFoot(inv.center, line.p, line.q);
  const px = inv.center.x + k * (n.x - inv.center.x);
  const py = inv.center.y + k * (n.y - inv.center.y);
  return {
    kind: "circle",
    center: { x: (px + inv.center.x) / 2, y: (py + inv.center.y) / 2 },
    radius: Math.sqrt((px - inv.center.x) ** 2 + (py - inv.center.y) ** 2) / 2,
  };
}

/* Inversion.Invert(circle, point), with the local variable k. */
function bytecodeInvertPoint(circle, p) {
  const d = dist(circle.center, p);
  const k = circle.radius * circle.radius / d / d;
  return { x: circle.center.x + k * (p.x - circle.center.x),
    y: circle.center.y + k * (p.y - circle.center.y) };
}

/* InvLine.InvertCinC, main branch only (the near-degenerate branch is
 * exercised separately by putting O on one of the circles). */
function bytecodeInvertCircle(circle, inv) {
  const power = dist(inv.center, circle.center) ** 2 - circle.radius ** 2;
  if (Math.abs(power) <= 100) return null;
  const k = inv.radius * inv.radius / power;
  return {
    kind: "circle",
    center: { x: inv.center.x + k * (circle.center.x - inv.center.x),
      y: inv.center.y + k * (circle.center.y - inv.center.y) },
    radius: Math.abs(k) * circle.radius,
  };
}

/* Circumcircle through three points, found by solving three linear equations
 * (a different route from the core's explicit determinant formula). */
function circumcircle(a, b, c) {
  const D = a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y);
  if (Math.abs(D) < 1e-7) return null;
  const aa = a.x * a.x + a.y * a.y;
  const bb = b.x * b.x + b.y * b.y;
  const cc = c.x * c.x + c.y * c.y;
  const Dx = aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y);
  const Dy = aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x);
  const centre = { x: Dx / (2 * D), y: Dy / (2 * D) };
  return { center: centre, radius: dist(centre, a) };
}

/* Independent concyclicity test, without using the core's geometry(). */
function fourConcyclic(a, b, c, d) {
  const circle = circumcircle(a, b, c);
  if (!circle) return Math.abs(cross(a, b, d)) <= 1e-6 * Math.max(1, dist(a, b));
  return Math.abs(dist(circle.center, d) - circle.radius) <= 1e-6 * Math.max(1, circle.radius);
}

/* --------------------------------------- 1. the applet's starting position */

{
  equal("the Java applet's canvas is 600 by 450", [C.WIDTH, C.HEIGHT], [600, 450]);
  const s = C.start({});
  equal("A = (2W/5, 9H/25)", s.A, { x: 240, y: 162 });
  equal("B = (4W/5, H/5)", s.B, { x: 480, y: 90 });
  equal("E = (4A + 3B)/7", s.E, { x: 2400 / 7, y: 918 / 7 });
  equal("O = (5W/8, 5H/8)", s.O, { x: 375, y: 281.25 });
  // R.x is 7*(width/2)/8, not 7*width/8: Canvas.init halves the width first.
  equal("R = (7(W/2)/8, 3H/4)", s.R, { x: 262.5, y: 337.5 });
  check("the starting inversion circle has radius 75*sqrt(5)/2",
    near(C.geometry(s).inversion.radius, Math.hypot(112.5, 56.25)));
  check("the starting E lies on AB", near(cross(s.A, s.B, s.E), 0));
  check("a new diagram has no win or loss", C.geometry(s).valid === true);
}

/* -------------------------- 2. E glides on AB; A and B call AdjustE exactly */

{
  const s = C.start({});
  const q = { x: 400, y: 300 };
  const moved = C.setPoint(s, "E", q);
  const f = bytecodeFoot(q, s.A, s.B);
  check("dragging E projects it onto AB", near(moved.E.x, f.x) && near(moved.E.y, f.y));
  check("setPoint does not change the given state", near(s.E.x, 2400 / 7));
  const movedA = C.setPoint(s, "A", { x: 210, y: 200 });
  const expectedY = movedA.B.y + (movedA.A.y - movedA.B.y) /
    (movedA.A.x - movedA.B.x) * (movedA.E.x - movedA.B.x);
  check("AdjustE re-solves E.y after A moves", near(movedA.E.y, expectedY));
  const vertical = C.setPoint(C.setPoint(s, "A", { x: 480, y: 150 }), "B", { x: 480, y: 250 });
  check("a nearly vertical AB makes AdjustE average the two y values",
    near(vertical.E.y, 200));
  check("setInverted only changes the flag", near(C.geometry(C.setInverted(s, true)).cA.radius,
    C.geometry(s).cA.radius));
  equal("position is plain data", Object.keys(C.position(s)).sort(),
    ["A", "B", "E", "O", "R", "inverted"]);
}

/* ------------------- 3. the figures are tangent, in hundreds of positions */

const random = rng(20261127);
function randomState() {
  const s = C.start({});
  const r = () => random();
  s.A = { x: 60 + r() * 180, y: 60 + r() * 330 };
  s.B = { x: 330 + r() * 200, y: 40 + r() * 370 };
  const t = 0.1 + r() * 0.8;
  s.E = { x: s.A.x + t * (s.B.x - s.A.x), y: s.A.y + t * (s.B.y - s.A.y) };
  s.O = { x: 100 + r() * 400, y: 80 + r() * 300 };
  s.R = { x: s.O.x + 30 + r() * 120, y: s.O.y + 20 + r() * 100 };
  return s;
}
const states = Array.from({ length: 400 }, randomState);

{
  let okLineTouch = 0, okPairTouch = 0, okSecond = 0, okImages = 0;
  for (const s of states) {
    const g = C.geometry(s);
    // cA touches the vertical line through A at A: its centre is horizontal
    // from A and A is exactly one radius away.
    if (near(g.cA.center.y, s.A.y) && near(g.cA.radius, dist(g.cA.center, s.A))) okLineTouch++;
    // cA passes through E, and cB is tangent to cA at E (external when E is
    // between A and B, internal otherwise).
    if (near(dist(g.cA.center, s.E), g.cA.radius) &&
        near(dist(g.cB.center, s.E), g.cB.radius) &&
        (near(dist(g.cA.center, g.cB.center), g.cA.radius + g.cB.radius) ||
         near(dist(g.cA.center, g.cB.center), Math.abs(g.cA.radius - g.cB.radius)))) okPairTouch++;
    const tA = bytecodeTangentCircle(s.A, s.E);
    const tB = bytecodeTangentCircle(s.B, s.E);
    if (near(g.cA.center.x, tA.center.x) && near(g.cA.center.y, tA.center.y) &&
        near(g.cA.radius, tA.radius) && near(g.cB.center.x, tB.center.x) &&
        near(g.cB.center.y, tB.center.y) && near(g.cB.radius, tB.radius)) okSecond++;
    const p2 = bytecodeInvertPoint(g.inversion, s.E);
    if (near(p2.x, g.invertedPoints.E.x) && near(p2.y, g.invertedPoints.E.y)) okImages++;
  }
  check("circle A is tangent to its vertical line at A in all 400 figures", okLineTouch === 400);
  check("the two circles touch at E in all 400 figures", okPairTouch === 400);
  check("DrawCircle matches a literal second transcription in all 400 figures", okSecond === 400);
  check("Inversion.Invert matches the bytecode in all 400 figures", okImages === 400);
}

/* ---------------- 4. inversion of lines and circles, against the bytecode */

{
  let okLines = 0, okCircles = 0, okInvolutions = 0, okOnImages = 0;
  let expectedOnImages = 0, okLineBranch = 0, lineBranches = 0;
  for (const s of states) {
    const g = C.geometry(s);
    for (const [line, image] of [[g.lineA, g.imgLineA], [g.lineB, g.imgLineB],
      [g.lineAB, g.imgLineAB]]) {
      const second = bytecodeInvertLine(line, g.inversion);
      if (image.kind === second.kind &&
          near(image.center.x, second.center.x) && near(image.center.y, second.center.y) &&
          near(image.radius, second.radius)) okLines++;
    }
    for (const [circle, image] of [[g.cA, g.imgCA], [g.cB, g.imgCB]]) {
      const second = bytecodeInvertCircle(circle, g.inversion);
      if (!second) continue;
      if (image.kind === "circle" && near(image.center.x, second.center.x) &&
          near(image.center.y, second.center.y) && near(image.radius, second.radius)) okCircles++;
    }
    const back = C._internals.invertPoint(g.inversion, g.invertedPoints.E);
    if (near(back.x, s.E.x, 1e-6) && near(back.y, s.E.y, 1e-6)) okInvolutions++;
    // Inversion preserves tangency: A' lies on both the image of line A and
    // the image of circle A, E' lies on both circle images.
    const Ap = g.invertedPoints.A, E2 = g.invertedPoints.E;
    const on = (p, image) => image.kind === "circle" &&
      near(dist(p, image.center), image.radius, 1e-5 * Math.max(1, image.radius));
    if ([g.imgLineA, g.imgCA, g.imgCB].every((im) => im.kind === "circle")) {
      expectedOnImages++;
      if (on(Ap, g.imgLineA) && on(Ap, g.imgCA) &&
          on(E2, g.imgCA) && on(E2, g.imgCB)) okOnImages++;
    }
    // InvLine.InvertCinC's |power| <= 100 branch draws the tangent at the
    // inverted antipode: an approximation, not an exact image circle. Keep
    // the residual bounded in board units, as the applet does.
    if (g.imgCB.kind === "line" || g.imgCA.kind === "line") {
      lineBranches++;
      const im = g.imgCB.kind === "line" ? g.imgCB : g.imgCA;
      const residual = Math.abs(cross(im.p, im.q, E2)) / Math.max(1, dist(im.p, im.q));
      if (residual <= 2) okLineBranch++;
    }
  }
  check("InvLine.InvertLinC matches the bytecode for 1200 lines", okLines === 1200);
  const expectedCircles = states.reduce((n, s) => {
    const g = C.geometry(s);
    return n + (bytecodeInvertCircle(g.cA, g.inversion) ? 1 : 0) +
      (bytecodeInvertCircle(g.cB, g.inversion) ? 1 : 0);
  }, 0);
  check("InvLine.InvertCinC matches the bytecode for every non-degenerate circle",
    okCircles === expectedCircles);
  check("inversion is an involution on the contact point in all 400 figures", okInvolutions === 400);
  check("images keep the contacts tangent wherever the image is a circle",
    okOnImages === expectedOnImages && expectedOnImages > 390);
  check("the applet's near-degenerate tangent-line branch stays within 2px",
    okLineBranch === lineBranches && lineBranches > 0);
}

/* ------------------------ 5. the page's concyclicity claim, exhaustively */

{
  let collinear = 0, concyclic = 0, coreAgrees = 0;
  for (const s of states) {
    const g = C.geometry(s);
    if (g.onAB) collinear++;
    if (fourConcyclic(g.invertedPoints.A, g.invertedPoints.E,
      g.invertedPoints.B, g.invertedPoints.infinity)) concyclic++;
    if (g.concyclic) coreAgrees++;
  }
  check("A, E, B are collinear in all 400 positions", collinear === 400);
  check("the inverted contact points and O are concyclic in all 400 positions", concyclic === 400);
  check("the core's concyclicity test agrees with the independent one", coreAgrees === 400);
  // A finer sweep over E along one fixed AB, with a different O each time.
  const s = C.start({});
  let swept = 0;
  for (let i = 1; i < 999; i++) {
    const t = i / 1000;
    const q = { x: s.A.x + t * (s.B.x - s.A.x), y: s.A.y + t * (s.B.y - s.A.y) };
    const v = C.setPoint(s, "E", q);
    v.O = { x: 120 + (i % 251), y: 90 + (i % 173) };
    v.R = { x: v.O.x + 60, y: v.O.y + 45 };
    const g = C.geometry(v);
    if (g.concyclic && g.onAB &&
        fourConcyclic(g.invertedPoints.A, g.invertedPoints.E,
          g.invertedPoints.B, g.invertedPoints.infinity)) swept++;
  }
  check("998 positions of E on AB keep the claim true", swept === 998);
  // The line AB inverts to the circle through O, A', E', B'; compare the
  // circle's centre and radius with an independent circumcircle.
  let circles = 0;
  for (const s of states) {
    const g = C.geometry(s);
    const other = circumcircle(g.invertedPoints.infinity, g.invertedPoints.A, g.invertedPoints.E);
    if (other && near(other.center.x, g.through.center.x) &&
        near(other.center.y, g.through.center.y) &&
        near(other.radius, g.through.radius)) circles++;
  }
  check("the inverse of AB is the claimed circle through O in all 400 figures", circles === 400);
}

/* ------------------- 6. the Remark: parity for general finite-circle chains */

{
  // Build a closed chain of four circles with prescribed external/internal
  // contacts, then test the four contact points. Side i has length ri+rj for
  // an external contact and |ri-rj| for an internal one; the contact point is
  // on the line of centres in the ratio ri : +/- rj.
  function circleIntersections(p, rp, q, rq) {
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
    if (!d || d > rp + rq || d < Math.abs(rp - rq)) return null;
    const a = (rp * rp - rq * rq + d * d) / (2 * d);
    const h2 = rp * rp - a * a;
    if (h2 < 0) return null;
    const h = Math.sqrt(h2);
    const bx = p.x + dx * a / d, by = p.y + dy * a / d;
    return [
      { x: bx - dy * h / d, y: by + dx * h / d },
      { x: bx + dy * h / d, y: by - dx * h / d },
    ];
  }

  const radii = [100, 64, 83, 72];
  let evenOK = 0, oddOK = 0, built = 0, builtEven = 0, builtOdd = 0;
  for (let mask = 0; mask < 16; mask++) {
    const ext = [0, 1, 2, 3].map((i) => (mask >> i) & 1);
    const sides = [0, 1, 2, 3].map((i) => {
      const j = (i + 1) % 4;
      return ext[i] ? radii[i] + radii[j] : Math.abs(radii[i] - radii[j]);
    });
    if (sides.some((d) => d < 1)) continue;
    for (let k = 0; k < 40; k++) {
      const angle = 0.25 + k * 0.13;
      const P = [{ x: 0, y: 0 }, { x: sides[0], y: 0 }];
      P[2] = { x: sides[0] + sides[1] * Math.cos(angle),
        y: sides[1] * Math.sin(angle) };
      const candidates = circleIntersections(P[0], sides[3], P[2], sides[2]);
      if (!candidates) continue;
      P[3] = candidates[k % 2];
      const T = [0, 1, 2, 3].map((i) => {
        const j = (i + 1) % 4;
        const denom = ext[i] ? radii[i] + radii[j] : radii[i] - radii[j];
        const t = radii[i] / denom;
        return { x: P[i].x + t * (P[j].x - P[i].x),
          y: P[i].y + t * (P[j].y - P[i].y) };
      });
      const count = ext.reduce((a, b) => a + b, 0);
      const holds = fourConcyclic(T[0], T[1], T[2], T[3]);
      built++;
      if (count % 2 === 0) { builtEven++; if (holds) evenOK++; }
      else { builtOdd++; if (!holds) oddOK++; }
    }
  }
  check("general chains were built in enough configurations", built > 250);
  check("both parities occur among the built chains", builtEven > 100 && builtOdd > 50);
  check("every chain with 0, 2 or 4 external contacts is concyclic", evenOK === builtEven);
  check("every chain with 1 or 3 external contacts is NOT concyclic", oddOK === builtOdd);
}

/* ---------------------- 7. degenerate positions the applet can reach */

{
  const s = C.start({});
  const base = C.geometry(s);
  const onInvCircle = C.setPoint(s, "O", {
    x: base.cA.center.x + base.cA.radius, y: base.cA.center.y,
  });
  const g1 = C.geometry(onInvCircle);
  check("O on circle A takes InvertCinC's tangent-line branch",
    g1.imgCA.kind === "line" && g1.imgCB.kind !== "line");
  const atE = C.setPoint(s, "O", s.E);
  const gE = C.geometry(atE);
  const dir = (im) => ({ x: im.q.x - im.p.x, y: im.q.y - im.p.y });
  const dA = dir(gE.imgCA), dB = dir(gE.imgCB);
  check("putting O on E makes the two image circles parallel lines",
    gE.imgCA.kind === "line" && gE.imgCB.kind === "line" &&
    Math.abs(dA.x * dB.y - dA.y * dB.x) <= 1e-6 * Math.max(1, dist(dA, { x: 0, y: 0 }) * dist(dB, { x: 0, y: 0 })));
  const tiny = C.setPoint(s, "O", { x: 300, y: 300 });
  tiny.R = { x: 300.00001, y: 300 };
  const g2 = C.geometry(tiny);
  check("a very small inversion circle still gives four contact points",
    Number.isFinite(g2.invertedPoints.A.x) && Number.isFinite(g2.invertedPoints.E.x));
  const onAB = C.setPoint(s, "O", { x: 300, y: s.A.y + (s.A.y - s.B.y) /
    (s.A.x - s.B.x) * (300 - s.A.x) });
  const g3 = C.geometry(onAB);
  check("O on AB makes the inverse of AB a line", g3.imgLineAB.kind === "line");
  check("the contact points are still concyclic (collinear here)", g3.concyclic === true);
}

done("four-touching-circles");
