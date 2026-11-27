#!/usr/bin/env node
"use strict";

/*
 * Logic test for deco-symmetry-2/deco-symmetry-2-core.js.
 *
 *   node porting/check-deco-symmetry-2.mjs
 *
 * The applet's page claims that any triangle can be cut into pieces that make
 * its mirror image by rotations and translations alone, "in just two cuts".
 * DecoSymmetry2Canvas.Compute() cuts from the foot D of the altitude from the
 * largest-angle vertex A to the midpoints E,F of the two sides through A.
 *
 * This test (a) re-derives every point from a second, literal transcription of
 * the applet's own bytecode and compares it with the core over a grid plus
 * seeded random triangles, (b) checks the page's claim on all of them: three
 * pieces, D on BC, right angle at D, an area partition of both triangles, and
 * a rotation (never a flip) taking each piece onto its mirror counterpart,
 * and (c) contrasts the construction with the sibling DecoSymmetry, which
 * needs four pieces in the general case and has a special acute switch.
 */

import { readFileSync } from "node:fs";
import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("deco-symmetry-2/deco-symmetry-2-core.js", "DecoSymmetry2Core");
const W = 500, H = 400;

/* ---------------------------------------------------------------- utilities */

const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const cross = (p, q) => p.x * q.y - p.y * q.x;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const dist2 = (p, q) => Math.pow(p.x - q.x, 2) + Math.pow(p.y - q.y, 2);
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const close = (p, q, tol = 1e-7) => dist(p, q) <= tol;
const round = (v) => Math.round(v * 1e8) / 1e8;

function rawAngle(p, q, r) {
  const num = dist2(p, q) + dist2(p, r) - dist2(q, r);
  return Math.acos(num / (2 * dist(p, q) * dist(p, r)));
}

function rawNearestPoint(p, a, b) {
  if (dist2(a, p) < 0.1) return { x: p.x, y: p.y };
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** GeoSDoub.ComputeSignedAngle, transcribed directly from javap. */
function rawSignedAngle(p, q, r) {
  const c = (dist2(p, q) + dist2(p, r) - dist2(q, r)) / (2 * dist(p, q) * dist(p, r));
  const orient = cross(sub(q, p), sub(r, p)) > 0 ? 1 : -1;
  return orient * Math.acos(c);
}

function rawArea(points) {
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return twice / 2;
}

function insidePolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/* --------------------- a second transcription of Compute() from the bytecode */

function appletCompute(state) {
  const K = state.K, L = state.L, M = state.M;
  const a1 = rawAngle(K, L, M); // angle at K
  const a2 = rawAngle(L, M, K); // angle at L
  const a3 = rawAngle(M, L, K); // angle at M
  let A = K, B = L, C = M;
  if (a1 >= a2 && a1 >= a3) { A = K; B = L; C = M; }
  if (a2 >= a1 && a2 >= a3) { A = L; B = M; C = K; }
  if (a3 >= a1 && a3 >= a2) { A = M; B = K; C = L; }

  const avg = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
  const P = { x: state.width - avg.x, y: avg.y };
  const refl = (X) => ({ x: P.x - (X.x - avg.x), y: P.y + (X.y - avg.y) });
  const Ap = refl(A), Bp = refl(B), Cp = refl(C);

  const D = rawNearestPoint(A, B, C);
  const E = mid(A, B), F = mid(A, C);
  const Dp = rawNearestPoint(Ap, Bp, Cp);
  const Ep = mid(Ap, Bp), Fp = mid(Ap, Cp);
  const pieces = [[E, B, D], [F, A, E, D], [F, D, C]];
  const targets = [[Ep, Dp, Bp], [Fp, Dp, Ep, Ap], [Fp, Cp, Dp]];

  // SetRotatingPoly(): the rotation goal is the signed angle from source[0] ->
  // source[1] to a vector with the destination's first-edge displacement.
  const angles = pieces.map((piece, i) => {
    const target = targets[i];
    const shifted = {
      x: piece[0].x + target[1].x - target[0].x,
      y: piece[0].y + target[1].y - target[0].y,
    };
    return rawSignedAngle(piece[0], piece[1], shifted);
  });
  return { A, B, C, P, Ap, Bp, Cp, D, E, F, Dp, Ep, Fp, pieces, targets, angles };
}

/** GeoSDoub.FindCircumcenter: intersection of two perpendicular bisectors. */
function circumcenter(a, b, c) {
  const m1 = mid(a, b), m2 = mid(b, c);
  const p1 = { x: m1.x + b.y - a.y, y: m1.y - (b.x - a.x) };
  const p2 = { x: m2.x + c.y - b.y, y: m2.y - (c.x - b.x) };
  const r = sub(p1, m1), s = sub(p2, m2);
  const den = cross(r, s);
  const t = cross(sub(m2, m1), s) / den;
  return { x: m1.x + r.x * t, y: m1.y + r.y * t };
}

/** A literal transcription of the *sibling* DecoSymmetry's two branches. */
function siblingCompute(state) {
  const angle = appletCompute(state);
  const a = rawAngle(angle.A, angle.B, angle.C);
  const b = rawAngle(angle.B, angle.C, angle.A);
  const c = rawAngle(angle.C, angle.A, angle.B);
  const acute = a < Math.PI / 2 && b < Math.PI / 2 && c < Math.PI / 2;
  if (acute) {
    const O = circumcenter(angle.A, angle.B, angle.C);
    const Op = circumcenter(angle.Ap, angle.Bp, angle.Cp);
    return {
      acute: true,
      pieces: [[angle.A, O, angle.B], [angle.B, O, angle.C], [angle.C, O, angle.A]],
      targets: [[angle.Ap, Op, angle.Bp], [angle.Bp, Op, angle.Cp], [angle.Cp, Op, angle.Ap]],
      anchor: O,
    };
  }
  return {
    acute: false,
    pieces: [
      [angle.E, angle.B, angle.D], [angle.E, angle.D, angle.A],
      [angle.F, angle.A, angle.D], [angle.F, angle.D, angle.C],
    ],
    targets: [
      [angle.Ep, angle.Dp, angle.Bp], [angle.Ep, angle.Ap, angle.Dp],
      [angle.Fp, angle.Ap, angle.Dp], [angle.Fp, angle.Dp, angle.Cp],
    ],
    anchor: angle.D,
  };
}

/* ------------------------------------------------------------ configurations */

const configs = [];
const handPicked = [
  [{ x: 250, y: 60 }, { x: 80, y: 330 }, { x: 430, y: 330 }],   // acute
  [{ x: 100, y: 300 }, { x: 100, y: 80 }, { x: 400, y: 300 }],   // right
  [{ x: 60, y: 200 }, { x: 440, y: 200 }, { x: 250, y: 215 }],   // very obtuse
  [{ x: 250, y: 60 }, { x: 249, y: 340 }, { x: 251, y: 340 }],   // thin, almost collinear
  [{ x: 400, y: 120 }, { x: 120, y: 120 }, { x: 250, y: 360 }],  // reversed winding
];
function usable(k, l, m) {
  if ([k, l, m].some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false;
  if (dist(k, l) < 5 || dist(l, m) < 5 || dist(m, k) < 5) return false;
  if (Math.abs(rawArea([k, l, m])) <= 20) return false;
  // Math.acos of a value a hair outside [-1, 1] is NaN in Java too; those
  // nearly-collinear triangles are not useful test cases for rotation goals.
  return [rawAngle(k, l, m), rawAngle(l, m, k), rawAngle(m, l, k)].every(Number.isFinite);
}
for (const [k, l, m] of handPicked) if (usable(k, l, m)) configs.push({ K: k, L: l, M: m });

// A grid over the applet's board, with one corner fixed and the other two moved.
for (let lx = 20; lx <= 480; lx += 46) {
  for (let ly = 20; ly <= 380; ly += 45) {
    for (let mx = 20; mx <= 480; mx += 92) {
      for (let my = 20; my <= 380; my += 90) {
        const k = { x: 250, y: 60 };
        const l = { x: lx, y: ly }, m = { x: mx, y: my };
        if (usable(k, l, m)) configs.push({ K: k, L: l, M: m });
      }
    }
  }
}

const rand = rng(20261127);
for (let i = 0; i < 900; i++) {
  const k = { x: 15 + rand() * 470, y: 15 + rand() * 370 };
  const l = { x: 15 + rand() * 470, y: 15 + rand() * 370 };
  const m = { x: 15 + rand() * 470, y: 15 + rand() * 370 };
  if (usable(k, l, m)) configs.push({ K: k, L: l, M: m });
}
const withBoard = (cfg) => Object.assign({ width: W, height: H }, cfg);
// Keep only triangles for which even the applet's unclamped ComputeSignedAngle
// is finite: at a near-degenerate piece acos can step outside [-1, 1] in Java.
for (let i = configs.length - 1; i >= 0; i--) {
  if (!appletCompute(withBoard(configs[i])).angles.every(Number.isFinite)) configs.splice(i, 1);
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("the starting board is the applet's 500x400 canvas", [s.width, s.height], [W, H]);
  check("the starting K matches init()", close(s.K, { x: 216.66666666666666, y: 250 }), JSON.stringify(s.K));
  check("the starting L matches init()", close(s.L, { x: 100, y: 200 - (H / 3) * Math.sin(2 * Math.PI / 3) }));
  check("the starting M matches init()", close(s.M, { x: 100 - W / 12, y: 200 + (H / 3) * Math.sin(2 * Math.PI / 3) }));
  const moved = C.withPoint(s, "K", { x: 17, y: 23 });
  check("withPoint does not change the old position", s.K.x !== 17 && moved.K.x === 17);
  check("withPoint leaves the other corners alone", moved.L === s.L && moved.M === s.M);
  check("withPoint ignores an unknown point", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
}

/* --------------------------------- 2. every configuration against the bytecode */

{
  check("the configuration set is large", configs.length > 900, `${configs.length} triangles`);

  let sameA = true, sameP = true, sameFoot = true, sameMid = true;
  let sameMirror = true, samePieces = true, sameTargets = true, sameAngles = true;
  let detail = "", angleDetail = "";
  for (const cfg of configs) {
    const state = withBoard(cfg);
    const core = C.compute(state);
    const raw = appletCompute(state);
    for (const key of ["A", "B", "C", "D", "E", "F", "Dp", "Ep", "Fp", "P", "Ap", "Bp", "Cp"]) {
      if (!close(core[key], raw[key], 1e-5)) {
        detail = `${key}: ${JSON.stringify(core[key])} vs ${JSON.stringify(raw[key])}`;
        sameA = false;
      }
    }
    const rawAngles = [
      rawAngle(cfg.K, cfg.L, cfg.M), rawAngle(cfg.L, cfg.M, cfg.K), rawAngle(cfg.M, cfg.L, cfg.K),
    ];
    sameP = sameP && core.angles.every((a, i) => Math.abs(a - rawAngles[i]) < 1e-9);
    sameFoot = sameFoot && close(core.D, raw.D, 1e-5);
    sameMid = sameMid && close(core.E, raw.E, 1e-9) && close(core.F, raw.F, 1e-9);
    sameMirror = sameMirror && [core.Ap, core.Bp, core.Cp].every((p, i) =>
      close(p, { x: W - [core.A, core.B, core.C][i].x, y: [core.A, core.B, core.C][i].y }, 1e-5));
    samePieces = samePieces && core.pieces.every((piece, i) =>
      piece.length === raw.pieces[i].length && piece.every((p, j) => close(p, raw.pieces[i][j], 1e-5)));
    sameTargets = sameTargets && core.targets.every((piece, i) =>
      piece.length === raw.targets[i].length && piece.every((p, j) => close(p, raw.targets[i][j], 1e-5)));
    const ms = core.pieces.map((p, i) => C.motion(p, core.targets[i]).angle);
    sameAngles = sameAngles && ms.every((a, i) => {
      const d = Math.abs(Math.atan2(Math.sin(a - raw.angles[i]), Math.cos(a - raw.angles[i])));
      if (!(d < 1e-6 || Math.abs(d - 2 * Math.PI) < 1e-6) && !angleDetail) {
        angleDetail = `piece ${i}: core ${a.toFixed(9)} raw ${raw.angles[i].toFixed(9)} at ${JSON.stringify(cfg)}`;
      }
      return d < 1e-6 || Math.abs(d - 2 * Math.PI) < 1e-6;
    });
  }
  check("every derived point matches the second transcription", sameA, detail);
  check("the three angles match ComputeAngle", sameP);
  check("the altitude foot matches NearestPoint", sameFoot);
  check("E and F match Midpoint", sameMid);
  check("the mirror is the canvas's vertical reflection", sameMirror);
  check("the three source pieces match the bytecode", samePieces);
  check("the three target pieces match the bytecode", sameTargets);
  check("the rotation goals match ComputeSignedAngle", sameAngles, angleDetail);
}

/* ------------------------------------------- 3. the page's claim, everywhere */

{
  let largest = true, footInside = true, right = true, threePieces = true;
  let twoCuts = true, partitionSource = true, partitionMirror = true;
  let congruent = true, noFlip = true, disjoint = true, disjointMirror = true;
  let acuteOk = true, obtuseOk = true, rightOk = true, sampleDetail = "";
  for (const cfg of configs) {
    const state = withBoard(cfg);
    const m = C.measurements(state);
    const c = m.construction;
    const angles = [C.angleAt(c.A, c.B, c.C), C.angleAt(c.B, c.C, c.A), C.angleAt(c.C, c.A, c.B)];
    largest = largest && angles[0] >= angles[1] - 1e-9 && angles[0] >= angles[2] - 1e-9;
    footInside = footInside && m.footOnSide;
    right = right && m.rightAngle;
    threePieces = threePieces && c.pieces.length === 3 && c.pieces.every((p) => p.length >= 3);
    twoCuts = twoCuts && c.cuts.length === 2;
    partitionSource = partitionSource && m.partition;
    partitionMirror = partitionMirror && Math.abs(m.mirrorArea - m.triangleArea) < 1e-6 * m.triangleArea;
    congruent = congruent && m.rotations.every(Boolean);
    noFlip = noFlip && c.pieces.every((p, i) =>
      Math.sign(C.signedArea(p)) === Math.sign(C.signedArea(c.targets[i])));

    // Sample interior points: each must belong to exactly one piece.
    for (const [label, pieces] of [["source", c.pieces], ["target", c.targets]]) {
      for (const piece of pieces) {
        const g = C.barycenter(piece);
        for (const t of [0, 0.25, 0.5]) {
          const pt = {
            x: g.x * (1 - t) + piece[0].x * t,
            y: g.y * (1 - t) + piece[0].y * t,
          };
          const count = pieces.reduce((n, q) => n + (insidePolygon(pt, q) ? 1 : 0), 0);
          if (count !== 1 && !sampleDetail) sampleDetail = `${label} sample counted in ${count} pieces at ${JSON.stringify(cfg)}`;
          if (label === "source") disjoint = disjoint && count === 1;
          else disjointMirror = disjointMirror && count === 1;
        }
      }
    }

    const acute = angles.every((a) => a < Math.PI / 2);
    const obtuse = angles.some((a) => a > Math.PI / 2 + 1e-6);
    if (acute) acuteOk = acuteOk && m.rotations.every(Boolean) && m.footOnSide;
    if (obtuse) obtuseOk = obtuseOk && m.rotations.every(Boolean) && m.footOnSide;
    if (angles.some((a) => Math.abs(a - Math.PI / 2) < 1e-4)) {
      rightOk = rightOk && m.rotations.every(Boolean) && m.footOnSide;
    }
  }
  check("A is always a vertex at a largest angle", largest);
  check("D always lands on side BC", footInside);
  check("AD is always perpendicular to BC", right);
  check("there are always exactly three pieces", threePieces);
  check("there are always exactly two cuts", twoCuts);
  check("the source pieces partition the triangle", partitionSource);
  check("the mirror triangle has the same area", partitionMirror);
  check("each target is a rotation+translation of its source", congruent);
  check("no piece is flipped", noFlip);
  check("sampled points lie in exactly one source piece", disjoint, sampleDetail);
  check("sampled points lie in exactly one target piece", disjointMirror, sampleDetail);
  check("the claim holds for acute triangles", acuteOk);
  check("the claim holds for obtuse triangles", obtuseOk);
  check("the claim holds at right angles", rightOk);
}

/* -------------------------- 4. how this differs from the sibling DecoSymmetry */

{
  let generalFour = true, acuteThree = true, differentAnchor = true, siblingAcuteFound = false;
  let siblingObtuseFound = false, noAcuteSwitch = true;
  for (const cfg of configs) {
    const state = withBoard(cfg);
    const sibling = siblingCompute(state);
    const core = C.compute(state);
    if (sibling.acute) {
      siblingAcuteFound = true;
      acuteThree = acuteThree && sibling.pieces.length === 3;
      differentAnchor = differentAnchor && dist(sibling.anchor, core.D) > 1e-7;
    } else {
      siblingObtuseFound = true;
      generalFour = generalFour && sibling.pieces.length === 4;
    }
  }
  // DecoSymmetry2 has no "special acute" checkbox and never builds a circumcenter.
  const coreSource = readFileSync(new URL("../deco-symmetry-2/deco-symmetry-2-core.js", import.meta.url), "utf8");
  noAcuteSwitch = !/\bSpecialAcute\b|special-acute/.test(coreSource);
  check("the sibling needs four pieces in the general case", generalFour && siblingObtuseFound);
  check("the sibling's acute branch has three pieces via the circumcenter", acuteThree && siblingAcuteFound && differentAnchor);
  check("this applet always uses three pieces, with no acute switch", noAcuteSwitch && C.measurements(withBoard(configs[0])).pieces === 3);
}

/* -------------------------------------------------- 5. motion ends where it should */

{
  let exact = true, middle = true, constantSize = true;
  for (const cfg of configs.slice(0, 120)) {
    const c = C.compute(withBoard(cfg));
    for (let i = 0; i < c.pieces.length; i++) {
      const m = C.motion(c.pieces[i], c.targets[i]);
      const end = C.place(m, 1);
      exact = exact && end.every((p, j) => close(p, c.targets[i][j], 1e-7));
      middle = middle && C.place(m, 0).every((p, j) => close(p, c.pieces[i][j], 1e-9));
      const startEdge = dist(C.place(m, 0)[0], C.place(m, 0)[1]);
      const endEdge = dist(end[0], end[1]);
      constantSize = constantSize && Math.abs(startEdge - endEdge) < 1e-7 * Math.max(1, startEdge);
    }
  }
  check("an animation at t=0 is the original piece", middle);
  check("an animation at t=1 is the exact target piece", exact);
  check("the moving piece is never stretched", constantSize);
}

done("deco-symmetry-2");
