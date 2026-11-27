#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-squares-from-temple/four-squares-from-temple-core.js.
 *
 *   node porting/check-four-squares-from-temple.mjs
 *
 * Two independent readings of the old applet are compared here:
 *
 * 1. A literal second transcription of FourSquaresFromTempleCanvas.Compute():
 *    AssignABC, UpperCenter, Midpoint, FormSquareOnDiagonal, FormSquare (with
 *    GeoSDoub.Rotate's sign), the N fix-up and the one-pixel IsOn test. It
 *    shares no helper with the core and mutates its own point objects in the
 *    bytecode's order. Compared on a structured grid, random positions,
 *    swapped outer points and after every kind of drag.
 * 2. The cut-the-knot page's claims: Bottema's four right-isosceles triangles,
 *    K as the midpoint of UV, UV = SI, both KINS and BEKH genuinely square,
 *    and -- when A, B, C are in a line -- the right angle UBV, the circle
 *    about K through U, V and B, and the exact doubling of the diagonals and
 *    the sides. The last claim is checked against the non-collinear cases as
 *    well, where the ratio is not 2.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-squares-from-temple/four-squares-from-temple-core.js", "FourSquaresFromTempleCore");

const pt = (x, y) => ({ x, y });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const dot = (a, b, c) => (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y);
const angleAt = (v, a, b) => {
  const d1 = dist(v, a), d2 = dist(v, b);
  if (!d1 || !d2) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, dot(a, v, b) / (d1 * d2))));
};

/* --------------------------- the applet's own methods, transcribed again 2 */

// GeoSDoub.Rotate written out field by field, as in the bytecode.
function appletRotate(p, q, a, dir) {
  const co = Math.cos(a), si = Math.sin(a);
  const dx = q.x - p.x, dy = q.y - p.y;
  const out = { x: 0, y: 0 };
  out.x = p.x + co * dx - dir * si * dy;
  out.y = p.y + dir * si * dx + co * dy;
  return out;
}
function appletMidpoint(p, q) {
  const out = { x: 0, y: 0 };
  out.x = (p.x + q.x) / 2;
  out.y = (p.y + q.y) / 2;
  return out;
}
function appletUpperCenter(p, q) {
  const m = appletMidpoint(p, q);
  const dy = q.y - m.y;
  const dx = -q.x + m.x;
  const out = { x: 0, y: 0 };
  if (dx < 0) { out.x = m.x + dy; out.y = m.y + dx; }
  else { out.x = m.x - dy; out.y = m.y - dx; }
  return out;
}
function appletFormSquareOnDiagonal(p, q, r, s) {
  const m = appletMidpoint(p, q);
  const dy = q.y - m.y;
  const dx = -q.x + m.x;
  if (dy < 0) {
    r.x = m.x + dy; r.y = m.y + dx;
    s.x = m.x - dy; s.y = m.y - dx;
  } else {
    s.x = m.x + dy; s.y = m.y + dx;
    r.x = m.x - dy; r.y = m.y - dx;
  }
}
function appletFormSquare(p, q, r, s) {
  const first = appletRotate(p, q, 1.5707963267948966, -1);
  const second = appletRotate(q, p, 1.5707963267948966, 1);
  r.x = first.x; r.y = first.y;
  s.x = second.x; s.y = second.y;
}
function appletCompute(state) {
  let A, C;
  if (state.A.x < state.C.x) { A = state.A; C = state.C; }
  else if (state.C.x < state.A.x) { A = state.C; C = state.A; }
  else { A = state.A; C = state.C; }
  const B = state.B;
  const U = appletUpperCenter(A, B);
  const V = appletUpperCenter(B, C);
  const K = appletMidpoint(U, V);
  const E = { x: 0, y: 0 }, H = { x: 0, y: 0 };
  appletFormSquareOnDiagonal(B, K, E, H);
  const X = { x: 0, y: 0 }, S = { x: 0, y: 0 };
  appletFormSquare(A, E, X, S);
  const I = { x: 0, y: 0 }, Y = { x: 0, y: 0 };
  appletFormSquare(H, C, I, Y);
  const N = { x: 0, y: 0 };
  N.x = I.x + S.x - K.x;
  N.y = I.y + S.y - K.y;
  const onLine = Math.abs(A.y - B.y) < 1;
  return { A, B, C, U, V, K, E, H, X, S, I, Y, N, onLine };
}

/* ----------------------------------- configurations: grid, random, moves */

const rand = rng(5062);
const states = [];
for (const ry of [140, 250, 380]) {
  for (const ax of [40, 120, 200]) {
    for (const span of [100, 200, 280]) {
      for (const f of [0, 0.35, 0.65, 1]) {
        for (const dy of [-60, 0, 45]) {
          states.push({ A: pt(ax, ry), B: pt(ax + span * f, ry + dy),
            C: pt(ax + span, ry), options: {}, explored: false });
        }
      }
    }
  }
}
for (let i = 0; i < 500; i++) {
  const ax = 10 + rand() * 300, cx = ax + 40 + rand() * (480 - ax);
  const ry = 20 + rand() * 460;
  states.push({
    A: pt(ax, ry), C: pt(cx, ry),
    B: pt(ax + rand() * (cx - ax), Math.max(0, Math.min(500, ry + (rand() - 0.5) * 240))),
    options: {}, explored: false,
  });
}
// The exact line-up and the two outer handles deliberately in the wrong
// order (the applet's AssignABC must swap them).
for (let i = 0; i < 60; i++) {
  const y = 60 + rand() * 380, ax = 20 + rand() * 200, cx = ax + 80 + rand() * 200;
  states.push({ A: pt(ax, y), B: pt(ax + rand() * (cx - ax), y), C: pt(cx, y),
    options: {}, explored: false });
  states.push({ A: pt(cx, y), B: pt(ax + rand() * (cx - ax), y + 30), C: pt(ax, y),
    options: {}, explored: false });
}

/* ----------------------------------------------- 1. rules, options, status */

{
  const s = C.start({});
  check("the board is the applet's 500 by 500", C.VIEW.width === 500 && C.VIEW.height === 500);
  check("Ap is at (125, 416.67)", s.A.x === 125 && Math.abs(s.A.y - 1250 / 3) < 1e-9);
  check("B starts above the outer pair", s.B.x === 250 && Math.abs(s.B.y - 375) < 1e-9);
  check("Cp is at (400, 416.67)", s.C.x === 400 && Math.abs(s.C.y - s.A.y) < 1e-12);
  check("the applet's two Show boxes start off", !s.options.names && !s.options.hint);
  equal("the three draggable handles", C.legalMoves(s), ["A", "B", "C"]);
  check("a demo never wins or loses", C.result(s) === null && C.result(C.move(s, "B", s.B)) === "done");
  check("an unknown handle is refused", C.move(s, "Z", pt(1, 2)) === s);
  check("a drag is clamped to the board", C.move(s, "A", pt(9999, -9999)).A.x === 500 &&
    C.move(s, "C", pt(-5, 9999)).C.y === 500);
  const moved = C.move(s, "A", pt(140, 200));
  check("dragging A ties C's height to it", moved.C.y === 200 && moved.C.x === 400 &&
    moved.A.x === 140 && !s.explored && moved.explored);
  const movedC = C.move(s, "C", pt(430, 310));
  check("dragging C ties A's height to it", movedC.A.y === 310 && movedC.A.x === 125);
  const movedB = C.move(s, "B", pt(260, 410));
  check("dragging B leaves the outer pair alone", movedB.A.y === s.A.y && movedB.C.y === s.C.y);
  check("an option toggle is immutable and reset keeps it",
    C.setOption(s, "hint", true).options.hint && !s.options.hint &&
    C.setOption(s, "nonsense", true) === s &&
    C.reset(C.setOption(s, "names", true)).options.names === true &&
    C.reset(s).A.x === 125);
}

/* ------------------- 2. the core against the bytecode transcription, all in */

{
  let compared = 0, worstPoint = 0, onOk = 0, movedOk = 0, swapOk = 0;
  const names = ["A", "B", "C", "U", "V", "K", "E", "H", "X", "S", "I", "Y", "N"];
  for (const s of states) {
    const g = C.geometry(s), a = appletCompute(s);
    for (const n of names) worstPoint = Math.max(worstPoint, dist(g[n], a[n]));
    compared++;
    if (g.onLine === a.onLine) onOk++;
  }
  check(`every generated point matches the bytecode (${compared} cases, worst ${worstPoint.toExponential(1)})`,
    compared === states.length && worstPoint < 1e-8);

  check(`IsOn matches the applet's one-pixel test (${onOk}/${states.length})`, onOk === states.length);

  for (const s of [C.start({}), ...states.filter((_, i) => i % 97 === 0)]) {
    for (const n of C.NAMES) {
      const next = C.move(s, n, pt(20 + rand() * 460, 20 + rand() * 460));
      const g = C.geometry(next), a = appletCompute(next);
      const worst = Math.max(...names.map((k) => dist(g[k], a[k])));
      if (worst < 1e-8 && g.onLine === a.onLine) movedOk++;
    }
  }
  check(`drags reproduce the bytecode on every handle (${movedOk})`,
    movedOk === (1 + Math.ceil(states.filter((_, i) => i % 97 === 0).length)) * 3);

  const flipped = { A: pt(430, 200), B: pt(250, 260), C: pt(70, 200) };
  const gf = C.geometry(flipped), af = appletCompute(flipped);
  check("a swapped outer pair is assigned left to right, as in AssignABC",
    gf.A.x === 70 && gf.C.x === 430 && dist(gf.U, af.U) < 1e-9 && dist(gf.I, af.I) < 1e-9);
  check("the bytecode's circle radius is KU", Math.abs(C.geometry(flipped).circle.r -
    dist(appletCompute(flipped).K, appletCompute(flipped).U)) < 1e-9);
}

/* -------------------------- 3. the page's claims, over every configuration */

{
  let usable = 0, right = 0, midOk = 0, uvOk = 0, squaresOk = 0;
  let lineCases = 0, circleOk = 0, rightB = 0, doubleOk = 0, notLine = 0;
  let offLineCases = 0, notDouble = 0;
  let worstIso = 0, worstUv = 0, worstSquare = 0, worstCircle = 0, worstDouble = 0;

  const EPS = 1e-6;
  const iso = (vertex, leg1, leg2, hyp) => {
    const a = dist(vertex, leg1), b = dist(vertex, leg2), h = dist(leg1, leg2);
    // right angle at vertex, equal legs, hypotenuse sqrt(2) times a leg
    const s = Math.max(a, b, h, 1);
    const err = Math.max(Math.abs(a - b) / s,
      Math.abs(angleAt(vertex, leg1, leg2) - Math.PI / 2),
      Math.abs(h - Math.sqrt(2) * a) / s);
    worstIso = Math.max(worstIso, err);
    return hyp === undefined || Math.abs(h - hyp) < EPS * s ? err < 1e-5 : false;
  };

  let mirrored = 0, mirroredUvFail = 0;
  for (const s of states) {
    const g = C.geometry(s);
    // The page describes the drawn hinge: B between the outer handles and
    // the Bottema centre K above B. The applet's sign tests choose mirrored
    // squares outside that setup, where UV = SI need not hold; those cases
    // are counted below but are not claims of the page.
    if (!(g.A.x < g.B.x && g.B.x < g.C.x && g.K.y < g.B.y)) {
      mirrored++;
      if (Math.abs(dist(g.U, g.V) - dist(g.S, g.I)) > 1e-6) mirroredUvFail++;
      continue;
    }
    const len = [dist(g.A, g.E), dist(g.B, g.K), dist(g.H, g.C)].filter((v) => v > 1e-6);
    if (len.length < 3) continue; // degenerate hinge: no square to measure
    usable++;

    const checks = [
      iso(g.U, g.A, g.B), iso(g.V, g.B, g.C),
      iso(g.U, g.K, g.S), iso(g.V, g.K, g.I),
    ];
    if (checks.every(Boolean)) right++;

    const m = C.midpoint(g.U, g.V);
    const midErr = dist(m, g.K) / Math.max(1, dist(g.U, g.V));
    if (midErr < 1e-9) midOk++;
    const uvErr = Math.abs(dist(g.U, g.V) - dist(g.S, g.I)) / Math.max(1, dist(g.U, g.V));
    worstUv = Math.max(worstUv, uvErr);
    if (uvErr < 1e-9) uvOk++;

    // BEKH has diagonal BK; KINS has diagonal SI and N = I + (S - K).
    const sidesB = [dist(g.B, g.E), dist(g.E, g.K), dist(g.K, g.H), dist(g.H, g.B)];
    const sidesK = [dist(g.K, g.I), dist(g.I, g.N), dist(g.N, g.S), dist(g.S, g.K)];
    const spread = (xs) => (Math.max(...xs) - Math.min(...xs)) / Math.max(1, ...xs);
    const diagB = Math.abs(dist(g.B, g.K) - dist(g.E, g.H));
    const diagK = Math.abs(dist(g.S, g.I) - dist(g.K, g.N));
    const squareErr = Math.max(spread(sidesB), spread(sidesK), diagB, diagK) / Math.max(1, ...sidesB, ...sidesK);
    worstSquare = Math.max(worstSquare, squareErr);
    if (squareErr < 1e-9) squaresOk++;

    const ratio = dist(g.S, g.I) / dist(g.B, g.K);
    // The page assumes exact collinearity; the applet's IsOn allows a one
    // pixel wobble, so a near miss is not used for the exact-doubling claim.
    if (Math.abs(g.A.y - g.B.y) < 1e-9) {
      lineCases++;
      // B must lie on the circle about K with UV as diameter.
      const r = g.circle.r;
      const circErr = Math.max(Math.abs(dist(g.K, g.B) - r), Math.abs(dist(g.K, g.V) - r),
        Math.abs(dist(g.K, g.U) - r), Math.abs(2 * r - dist(g.U, g.V))) / Math.max(1, r);
      worstCircle = Math.max(worstCircle, circErr);
      if (circErr < 1e-9) circleOk++;
      if (Math.abs(angleAt(g.B, g.U, g.V) - Math.PI / 2) < 1e-6) rightB++;
      const dErr = Math.abs(ratio - 2);
      worstDouble = Math.max(worstDouble, dErr);
      if (dErr < 1e-8 &&
          Math.abs(dist(g.K, g.I) / dist(g.B, g.E) - 2) < 1e-8) doubleOk++;
    } else if (Math.abs(g.A.y - g.B.y) > 5) {
      offLineCases++;
      if (Math.abs(ratio - 2) > 1e-6) notDouble++;
    }
  }

  check(`every drawn-hinge configuration was used (${usable} of ${states.length}, ${mirrored} mirrored)`,
    usable + mirrored === states.length && usable > 400 && mirrored > 0);
  check(`the applet's mirrored centres can break UV = SI (${mirroredUvFail} cases)`,
    mirroredUvFail > 0);
  check(`Bottema's four triangles are right isosceles (worst ${worstIso.toExponential(1)})`,
    right === usable, `${right}/${usable}`);
  check(`K is the midpoint of UV (${midOk}/${usable})`, midOk === usable);
  check(`UV equals the diagonal SI (worst ${worstUv.toExponential(1)})`, uvOk === usable);
  check(`BEKH and KINS are genuine squares (worst ${worstSquare.toExponential(1)})`,
    squaresOk === usable);
  check(`when in line, B, U and V lie on the circle about K (worst ${worstCircle.toExponential(1)})`,
    circleOk === lineCases && lineCases > 100, `${circleOk}/${lineCases}`);
  check(`when in line, angle UBV is right (${rightB}/${lineCases})`, rightB === lineCases);
  check(`when in line, diagonals and sides double (worst ${worstDouble.toExponential(1)})`,
    doubleOk === lineCases, `${doubleOk}/${lineCases}`);
  check(`the doubling is specific to the line-up (${notDouble}/${offLineCases})`,
    notDouble === offLineCases && offLineCases > 100);
}

/* ------------------------------------- 4. messages and the edge of a drag */

{
  const s = C.start({});
  check("the opening status asks for the line-up", C.describe(s).includes("not in a line"));
  const aligned = C.move(s, "A", pt(s.A.x, s.B.y));
  check("moving A onto B's height lines all three up", C.geometry(aligned).onLine === true &&
    aligned.C.y === aligned.B.y);
  check("the status then states the double-side claim",
    C.describe(aligned).includes("2.00 times"));
  check("moving just off the line by one pixel keeps the applet's strict test",
    C.geometry(C.move(aligned, "B", pt(s.B.x, s.B.y + 0.999))).onLine === true &&
    C.geometry(C.move(aligned, "B", pt(s.B.x, s.B.y + 1))).onLine === false);
  check("reset returns to the raised-B start", C.geometry(C.reset(aligned)).onLine === false &&
    C.result(C.reset(aligned)) === null);
}

done("four-squares-from-temple");
