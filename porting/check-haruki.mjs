#!/usr/bin/env node
"use strict";

/*
 * Logic test for haruki/haruki-core.js.
 *
 *   node porting/check-haruki.mjs
 *
 * Two independent readings of the old bytecode are compared here: the core
 * and a literal second transcription of GeoSDoub.FindCircumcenter/Rotate/Intersect,
 * HarukiCanvas.GetCircle/Compute/Other and CTKMoveableDoub's circle glide, over
 * thousands of generated configurations (including near-horizontal chords,
 * where GeoSDoub switches from IntersectX to IntersectY).  The page's three
 * claims, BE = AF, AQ·RB/QR = BE, and "E and F do not move as P goes round",
 * are checked over the same configurations and over full sweeps of P.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("haruki/haruki-core.js", "HarukiCore");

/* ------------------------- a second transcription, straight from the class  */

const P = (x, y) => ({ x: x, y: y });
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const add = (a, b) => P(a.x + b.x, a.y + b.y);
const mul = (a, t) => P(a.x * t, a.y * t);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

// GeoSDoub.Rotate(DoubPoint,DoubPoint,double,int)
function rotate(center, p, t, sign) {
  const co = Math.cos(t), si = Math.sin(t);
  const dx = p.x - center.x, dy = p.y - center.y;
  return P(center.x + co * dx - sign * si * dy,
           center.y + sign * si * dx + co * dy);
}

// GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint)
function lineCross(a, b, c, e) {
  const l4 = a.y - b.y, l6 = b.x - a.x, l8 = a.x * b.y - a.y * b.x;
  const l10 = c.y - e.y, l12 = e.x - c.x, l14 = c.x * e.y - c.y * e.x;
  const den = l4 * l12 - l10 * l6;
  if (Math.abs(den) < 1) return null;
  return P((l6 * l14 - l12 * l8) / den, (l8 * l10 - l14 * l4) / den);
}

// GeoSDoub.FindCircumcenter: perpendicular bisectors of AB and BC.
function findCircumcenter(a, b, c) {
  const m1 = P((a.x + b.x) / 2, (a.y + b.y) / 2);
  const m2 = P((b.x + c.x) / 2, (b.y + c.y) / 2);
  return lineCross(m1, P(m1.x + (b.y - a.y), m1.y - (b.x - a.x)),
                   m2, P(m2.x + (c.y - b.y), m2.y - (c.x - b.x)));
}

// HarukiCanvas.GetCircle: the mean of the three radii, not the exact radius.
function getCircle(a, b, c) {
  const o = findCircumcenter(a, b, c);
  if (!finite(o)) return null;
  return { c: o, r: (d(o, a) + d(o, b) + d(o, c)) / 3 };
}

// GeoSDoub.IntersectX / IntersectY / Intersect(DoubLine,DoubCircle).
function intersectX(l1, l2, circle) {
  const m = (l1.x - l2.x) / (l1.y - l2.y);
  const b = l2.x - m * l2.y;
  const A = m * m + 1;
  const B = 2 * (m * (b - circle.c.x) - circle.c.y);
  const Cc = circle.c.y * circle.c.y + (b - circle.c.x) * (b - circle.c.x) - circle.r * circle.r;
  const disc = B * B - 4 * A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-B + s) / (2 * A), t2 = (-B - s) / (2 * A);
  return [P(m * t1 + b, t1), P(m * t2 + b, t2)];
}
function intersectY(l1, l2, circle) {
  const m = (l1.y - l2.y) / (l1.x - l2.x);
  const b = l2.y - m * l2.x;
  const A = m * m + 1;
  const B = 2 * (m * (b - circle.c.y) - circle.c.x);
  const Cc = circle.c.x * circle.c.x + (b - circle.c.y) * (b - circle.c.y) - circle.r * circle.r;
  const disc = B * B - 4 * A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-B + s) / (2 * A), t2 = (-B - s) / (2 * A);
  return [P(t1, m * t1 + b), P(t2, m * t2 + b)];
}
function lineCircle(l1, l2, circle) {
  if (Math.abs(l1.y - l2.y) > 1) return intersectX(l1, l2, circle);
  if (Math.abs(l1.x - l2.x) > 1) return intersectY(l1, l2, circle);
  return null;
}

// HarukiCanvas.Other(DoubPoint[],DoubPoint): first unless within one unit.
function other(points, vertex) {
  return d(points[0], vertex) < 1 ? points[1] : points[0];
}

// CTKMoveableDoub.UpdateLocation's STAY_ON_CIRCLE branch.
function glide(p, circle) {
  const v = sub(p, circle.c);
  return add(circle.c, mul(v, circle.r / Math.hypot(v.x, v.y)));
}

// HarukiCanvas.Compute() method for method.
function appletCompute(A, B, Cc, D, Pp) {
  const Q = lineCross(A, B, Pp, Cc);
  const R = lineCross(A, B, Pp, D);
  if (!finite(Q) || !finite(R)) return null;
  const circleE = getCircle(Pp, Q, D);
  const circleF = getCircle(Pp, R, Cc);
  if (!circleE || !circleF) return null;
  const eHits = lineCircle(A, B, circleE), fHits = lineCircle(A, B, circleF);
  if (!eHits || !fHits) return null;
  const E = other(eHits, Q);
  const F = other(fHits, R);
  return { Q: Q, R: R, E: E, F: F, circleE: circleE, circleF: circleF };
}

/* ------------------------------------------------------------- test cases */

const rand = rng(20261127);
const onCircle = (o, r, t) => P(o.x + r * Math.cos(t), o.y + r * Math.sin(t));
const angularGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

const configs = [];
for (let i = 0; i < 2400; i++) {
  const o = P(60 + rand() * 360, 60 + rand() * 240);
  const r = 35 + rand() * 90;
  const t = [0, 1, 2, 3, 4].map(() => rand() * 2 * Math.PI);
  if (Math.min(
    angularGap(t[0], t[1]), angularGap(t[2], t[3]),
    angularGap(t[0], t[2]), angularGap(t[1], t[3]),
    angularGap(t[0], t[4]), angularGap(t[1], t[4]),
    angularGap(t[2], t[4]), angularGap(t[3], t[4]),
  ) < 0.08) continue;
  const pts = t.map((v) => onCircle(o, r, v));
  configs.push({ name: `circle-${i}`, o: o, r: r, t: t, pts: pts });
}
// Near-horizontal AB forces GeoSDoub.Intersect(DoubLine,DoubCircle) down its
// IntersectY branch; tilt them a little so they are not exactly parallel.
let horizontal = 0;
for (let i = 0; i < 120; i++) {
  const o = P(120 + rand() * 240, 100 + rand() * 160);
  const r = 55 + rand() * 45;
  const a = onCircle(o, r, 0.2 + rand() * 0.02);
  const b = onCircle(o, r, Math.PI - 0.2 - rand() * 0.02);
  if (Math.abs(a.y - b.y) > 1) continue;
  const t = [0.2, Math.PI - 0.2, 4.0, 5.2, 1.4];
  const pts = [a, b, ...t.slice(2).map((v) => onCircle(o, r, v))];
  configs.push({ name: `horizontal-${i}`, o: o, r: r, t: t, pts: pts });
  horizontal++;
}

/* --------------------------------------------------- 1. start, moves, flags */

{
  const s = C.start({});
  const base = getCircle(s.A, s.B, s.C);
  const D0 = rotate(base.c, s.C, -Math.PI / 4, -1);
  const P0 = rotate(base.c, s.A, 2 * Math.PI / 3, 1);
  check("the start copies the applet's A, B and C", d(s.A, P(180, 236)) < 1e-9 &&
    d(s.B, P(300, 236)) < 1e-9 && Math.abs(s.C.x - 210) < 1e-9);
  check("the start copies the applet's D and P rotations",
    d(s.D, D0) < 1e-9 && d(s.P, P0) < 1e-9);
  check("the start has the applet's checkbox defaults",
    s.options.names === true && s.options.statement === false && s.options.hint === false);
  check("a picture has no win or loss and starts unexplored",
    C.result(s) === null && s.explored === false);
  const g0 = C.geometry(s);
  check("the starting figure is well defined", !!g0 && finite(g0.E) && finite(g0.F));

  const moved = C.move(s, "A", { x: 9999, y: -9999 });
  check("a dragged A stays inside the board", moved.A.x <= C.VIEW.width - C.PAD && moved.A.y >= C.PAD);
  check("a drag marks the picture explored", moved.explored === true && s.explored === false);
  check("an unknown handle is refused", C.move(s, "Z", P(1, 1)) === s);
  check("a non-finite drag is refused", C.move(s, "D", P(NaN, 1)) === s);

  const circ = C.circle(s.A, s.B, s.C);
  const pulled = C.move(s, "P", P(9999, 9999));
  check("a dragged P glides onto the circle", d(pulled.P, circ.c) > 0 &&
    Math.abs(d(pulled.P, circ.c) - circ.r) < 1e-6 && d(pulled.P, glide(P(9999, 9999), circ)) < 1e-6);

  const changed = C.move(s, "B", P(330, 210));
  const newCirc = getCircle(changed.A, changed.B, changed.C);
  check("moving B re-anchors D and P on the new circle",
    Math.abs(d(newCirc.c, changed.D) - newCirc.r) < 1e-6 &&
    Math.abs(d(newCirc.c, changed.P) - newCirc.r) < 1e-6);
  const dOther = other(lineCircle(changed.C, s.D, newCirc), changed.C);
  const pOther = other(lineCircle(changed.C, s.P, newCirc), changed.C);
  check("CheckForABC keeps D and P on their old rays from C",
    d(changed.D, glide(dOther, newCirc)) < 1e-6 &&
    d(changed.P, glide(pOther, newCirc)) < 1e-6);

  const optioned = C.setOption(s, "hint", true);
  check("toggling an option keeps the previous state", optioned.options.hint && !s.options.hint);
  check("reset keeps options and marks exploration",
    C.reset(optioned).options.hint === true && d(C.reset(optioned).A, s.A) < 1e-12 && C.reset(optioned).explored);
}

/* ------------------------------ 2. the core against the applet's bytecode */

{
  let circles = 0, geoms = 0, reanchors = 0, maxCircleErr = 0, maxGeomErr = 0;
  let sawLineCircleX = 0, sawLineCircleY = 0;
  for (const cfg of configs) {
    const [A, B, Cc, D, Pp] = cfg.pts;

    const mine = C.circle(A, B, Cc), theirs = getCircle(A, B, Cc);
    if (mine && theirs) {
      circles++;
      maxCircleErr = Math.max(maxCircleErr, d(mine.c, theirs.c), Math.abs(mine.r - theirs.r));
    }

    const g = C.compute(A, B, Cc, D, Pp);
    const x = appletCompute(A, B, Cc, D, Pp);
    if (g && x && [x.Q, x.R, x.E, x.F].every(finite)) {
      geoms++;
      for (const key of ["Q", "R", "E", "F"]) maxGeomErr = Math.max(maxGeomErr, d(g[key], x[key]));
      maxGeomErr = Math.max(maxGeomErr,
        Math.abs(g.circleE.c.x - x.circleE.c.x), Math.abs(g.circleF.r - x.circleF.r));
    }
    if (Math.abs(A.y - B.y) > 1) sawLineCircleX++; else sawLineCircleY++;

    // CheckForABC, transcribed above, after moving B to a nearby point.
    const B2 = P(B.x + 7, B.y - 11);
    const st = { A: A, B: B, C: Cc, D: D, P: Pp, explored: false };
    const after = C.move(st, "B", B2);
    const nc = getCircle(after.A, after.B, after.C);
    if (!nc) continue;
    const dPair = lineCircle(after.C, D, nc), pPair = lineCircle(after.C, Pp, nc);
    if (dPair && pPair) {
      reanchors++;
      maxGeomErr = Math.max(maxGeomErr,
        d(after.D, glide(other(dPair, after.C), nc)),
        d(after.P, glide(other(pPair, after.C), nc)));
    }
  }
  check("every generated circle agrees with FindCircumcenter/GetCircle",
    circles > 2000 && maxCircleErr < 1e-6, `${circles}/${configs.length}, err ${maxCircleErr}`);
  check("Compute agrees with the bytecode transcription on every configuration",
    geoms > 2000 && maxGeomErr < 1e-6, `${geoms} cases, err ${maxGeomErr}`);
  check("both IntersectX and IntersectY branches were exercised",
    sawLineCircleX > 1000 && sawLineCircleY > 30, `${sawLineCircleX} X, ${sawLineCircleY} Y`);
  check("CheckForABC's D/P re-anchoring agrees with the bytecode",
    reanchors > 2000 && maxGeomErr < 1e-6, `${reanchors} cases`);
}

/* --------------------------------------- 3. the page's claims, exhaustively */

{
  let tested = 0, eq = 0, formula = 0, ambiguous = 0, horiz = 0;
  let maxEq = 0, maxFormula = 0, hintOk = 0, hintSeen = 0;
  for (const cfg of configs) {
    const [A, B, Cc, D, Pp] = cfg.pts;
    const g = C.compute(A, B, Cc, D, Pp);
    if (!g || !finite(g.E) || !finite(g.F) || !Number.isFinite(g.ratio)) continue;
    if (Math.abs(A.y - B.y) <= 1) horiz++;
    // The applet chooses the "other" intersection by a one-unit test. When
    // the two intersections are closer than two units, that test can select
    // Q or R itself, so the drawing (not the theorem) is degenerate.
    if (g.gapE < 2 || g.gapF < 2) { ambiguous++; continue; }
    tested++;
    maxEq = Math.max(maxEq, Math.abs(g.BE - g.AF));
    maxFormula = Math.max(maxFormula, Math.abs(g.BE - g.ratio));
    if (Math.abs(g.BE - g.AF) < 1e-6) eq++;
    if (Math.abs(g.BE - g.ratio) < 1e-6) formula++;

    // The hint marks the angles at F, P and E. The one at P is sometimes
    // supplementary, so compare cosines up to sign.
    const afc = C.angle(g.F, g.A, g.C);
    const cpd = C.angle(g.P, g.C, g.D);
    const deb = C.angle(g.E, g.D, g.B);
    if ([afc, cpd, deb].every(Number.isFinite)) {
      hintSeen++;
      if (Math.abs(Math.abs(Math.cos(afc)) - Math.abs(Math.cos(cpd))) < 1e-6 &&
          Math.abs(Math.abs(Math.cos(afc)) - Math.abs(Math.cos(deb))) < 1e-6) hintOk++;
    }
  }
  check("BE = AF on every non-degenerate generated figure",
    tested > 1900 && eq === tested && maxEq < 1e-6, `${eq}/${tested}, err ${maxEq}`);
  check("AQ·RB/QR equals BE on every such figure",
    formula === tested && maxFormula < 1e-6, `${formula}/${tested}, err ${maxFormula}`);
  check("near-horizontal chords were among the claims tested", horiz > 20, `${horiz}`);
  check("the near-tangent cases where the applet's one-unit test fails were counted",
    ambiguous > 0, `${ambiguous}`);
  check("the hint's marked angles at F, P and E agree up to supplement",
    hintSeen > 1900 && hintOk === hintSeen, `${hintOk}/${hintSeen}`);

  // E and F are independent of P: sweep P round the circle with A,B,C,D fixed.
  let sweeps = 0, positions = 0, maxDrift = 0;
  for (const cfg of configs.slice(0, 400)) {
    const o = cfg.o, r = cfg.r;
    const [A, B, Cc, D] = cfg.pts;
    const g0 = C.compute(A, B, Cc, D, cfg.pts[4]);
    if (!g0 || g0.gapE < 2 || g0.gapF < 2) continue;
    let moved = 0, ok = true;
    for (let j = 1; j <= 16; j++) {
      const Pp = onCircle(o, r, cfg.t[4] + j * 2 * Math.PI / 17);
      const g = C.compute(A, B, Cc, D, Pp);
      if (!g || g.gapE < 2 || g.gapF < 2) continue; // P at C/D or near tangency
      moved++;
      maxDrift = Math.max(maxDrift, d(g0.E, g.E), d(g0.F, g.F));
      if (d(g0.E, g.E) > 1e-5 || d(g0.F, g.F) > 1e-5) ok = false;
    }
    if (moved > 8 && ok) sweeps++;
    positions += moved;
  }
  check("E and F never move as P travels round the circle",
    sweeps > 300 && positions > 4000 && maxDrift < 1e-5,
    `${sweeps} sweeps, ${positions} positions, drift ${maxDrift}`);
}

/* --------------------------- 4. the applet's own one-unit selection quirk */

{
  const known = P(100, 100);
  const near = P(100.5, 100);
  const far = P(160, 100);
  check("Other() reproduces the applet's one-unit choice",
    C.other([known, far], known) === far && C.other([far, known], known) === far);
  check("intersections less than a unit apart can be mistaken for the original point",
    C.other([known, near], known) === near);
  const s = C.start({});
  const g = C.geometry(s);
  check("the starting lengths pin the page's constant on this board",
    Math.abs(g.BE - 136.132507) < 1e-4 && Math.abs(g.AF - g.BE) < 1e-9 &&
    Math.abs(g.ratio - g.BE) < 1e-9, `${g.BE}`);
}

done("haruki");
