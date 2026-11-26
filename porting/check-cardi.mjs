#!/usr/bin/env node
"use strict";

/*
 * Logic test for cardi/cardi-core.js.
 *
 *   node porting/check-cardi.mjs
 *
 * Checked: every claim on the applet's page (the mark stays on the rolling
 * circle, T is the contact point, the two chords TA and TM are equal, A is the
 * mirror of M in the common tangent, the pedal point is the midpoint of AM,
 * OPMQ is a parallelogram, every chord through the cusp is 4r, the chord
 * midpoints lie on a circle, and the mark is slowest at the cusp) at 600+
 * angles. Then two independent transcriptions of the applet's own computation,
 * written from the bytecode of cCTKCycloid2.updateCC / RotateInternal and
 * updateFormulaCC, are compared with the core across hundreds of radii,
 * centres, step sizes, speeds and step counts. The unused formula mode's
 * quarter-turn offset for the moving centre is measured and reported too.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cardi/cardi-core.js", "CardiCore");

const near = (a, b, tol = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const close = (p, q, tol = 1e-7) => p && q && Math.hypot(p.x - q.x, p.y - q.y) <= tol;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const P = (x, y) => ({ x, y });

/* ------------------------------------------------------------------------- *
 * The applet's computation, written a second time straight from the bytecode.
 * cCTKCycloid2.updateCC(int i):
 *   factor = V == 0 ? 0 : (V > 0 ? V : 1/abs(V));
 *   phi = (Delta * PI/180) * R/r * factor;
 *   cosPart = cos(phi); sinPart = sin(phi) * i;
 *   for each mark: PointsO -> PointsN, then RotateInternal(k, sinPart, cosPart)
 *     N.x = center.x + sx*cosPart - sy*sinPart
 *     N.y = center.y + sx*sinPart + sy*cosPart
 *   theta = Delta * PI/180; rotate the moving centre and each mark about
 *   the fixed centre by theta; m_Time++.
 * eCTKCycloid2.reset: center = (Cx + R + r, Cy), mark = (Cx + R, Cy).
 * ------------------------------------------------------------------------- */
function appletIncremental(o, R, r, steps, deltaDeg, v) {
  const factor = v === 0 ? 0 : v > 0 ? v : 1 / Math.abs(v);
  const phi = (deltaDeg * Math.PI / 180) * (R / r) * factor;
  const cosPart = Math.cos(phi), sinPart = Math.sin(phi); // i = 1 in eCTKCycloid2.update()
  const orbit = (deltaDeg * Math.PI / 180);
  const co = Math.cos(orbit), so = Math.sin(orbit);
  let centre = P(o.x + R + r, o.y);
  let mark = P(o.x + R, o.y);
  for (let k = 0; k < steps; k++) {
    const sx = mark.x - centre.x, sy = mark.y - centre.y;
    mark = P(centre.x + sx * cosPart - sy * sinPart, centre.y + sx * sinPart + sy * cosPart);
    const px = centre.x - o.x, py = centre.y - o.y;
    centre = P(o.x + px * co - py * so, o.y + px * so + py * co);
    const mx = mark.x - o.x, my = mark.y - o.y;
    mark = P(o.x + mx * co - my * so, o.y + mx * so + my * co);
  }
  return { P: centre, M: mark };
}

/* cCTKCycloid2.updateFormulaCC(int i), for the single mark CardiCanvas.reset
 * adds at time 0: InitAngle = PI (FindAngle(-r,0,r)), CentralAngle = 0
 * (FindAngle(R+r,0,R+r)), Dist = r, i = 1. */
function appletFormula(o, R, r, time, deltaDeg, v) {
  const factor = v > 0 ? v : 1 / Math.abs(v);
  const angle = ((deltaDeg * time) * Math.PI) / 180;
  const a = angle * (R / r + 1) * factor + Math.PI;
  const b = angle;
  const mark = P(
    o.x + (R + r) * Math.cos(b) + r * Math.cos(a),
    o.y + (R + r) * Math.sin(b) + r * Math.sin(a),
  );
  // The old formula method subtracts i*PI/2 for the moving centre. That is a
  // leftover from a sibling applet; Cardi never switches m_Formula on.
  const pAngle = angle - Math.PI / 2;
  const centre = P(o.x + (R + r) * Math.cos(pAngle), o.y + (R + r) * Math.sin(pAngle));
  return { P: centre, M: mark };
}

/* ------------------------------------------------------ 1. start and moves */

{
  const s = C.start({});
  equal("the board is the applet's suggested size", C.VIEW, { x: 0, y: 0, width: 390, height: 350 });
  equal("the fixed centre is the middle of the canvas", C.O, { x: 195, y: 175 });
  check("the two radii are equal, as the applet sets m_R = m_r = 30",
    C.R === 30 && C.R_MOVING === 30 && C.R === C.R_MOVING);
  check("the applet rolls two degrees a tick and waits 100 ms", C.DELTA === 2 && C.TICK_MS === 100);
  equal("the three overlays match which = 0, 1, 2", C.MODES, ["cross", "parallelogram", "double"]);
  check("the opening picture is 60 degrees into the roll",
    near(s.theta, Math.PI / 3, 1e-12) && s.mode === "cross" && s.construction === false);
  check("the opening mark is exactly the applet's mark after 30 ticks",
    close(C.geometry(s).M, appletIncremental(C.O, C.R, C.R_MOVING, 30, 2, 1).M, 1e-9));
  check("the opening mark is the cusp's neighbour on the cardioid",
    near(dist(C.geometry(s).M, C.O), Math.sqrt(3) * C.R, 1e-9));
  check("a fresh illustration is not finished", C.result(s) === null && s.explored === false);
}

{
  const s = C.start({});
  const dragged = C.move(s, { type: "theta", value: Math.PI });
  check("dragging sets the angle and marks the picture explored",
    near(dragged.theta, Math.PI, 1e-12) && dragged.explored && !s.explored);
  check("a finished illustration has no win or loss", C.result(dragged) === "done");
  check("dragging leaves the old position alone", s.theta !== dragged.theta);
  check("angles wrap around one turn", near(C.move(s, { type: "theta", value: 3 * Math.PI }).theta, Math.PI, 1e-12));
  check("one step of the app is two degrees", near(C.move(s, { type: "step" }).theta - s.theta, 2 * Math.PI / 180, 1e-12));
  check("steps can be counted out", near(C.move(s, { type: "step", count: 90 }).theta, s.theta + Math.PI, 1e-12));
  check("the three overlays can all be chosen", C.MODES.every((mode) => C.move(s, { type: "mode", value: mode }).mode === mode));
  check("the construction overlay toggles", C.move(s, { type: "construction", value: true }).construction === true);
  const reset = C.move(C.move(s, { type: "mode", value: "double" }), { type: "reset" });
  check("reset restores the opening angle but keeps the mode", near(reset.theta, s.theta, 1e-12) && reset.mode === "double");
  check("bad moves are refused", C.move(s, { type: "mode", value: "nope" }) === null
    && C.move(s, { type: "construction", value: 3 }) === null
    && C.move(s, { type: "theta", value: "x" }) === null
    && C.move(s, { type: "unknown" }) === null);
  check("legalMoves lists one of each", C.legalMoves().length === 5);
}

/* ------------------------------------------ 2. the page's claims, all round */

const angles = [];
for (let i = 0; i < 360; i++) angles.push((2 * Math.PI * i) / 360 + 0.003);
for (const t of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 2 * Math.PI - 0.001]) angles.push(t);
const rand = rng(20261126);
for (let i = 0; i < 240; i++) angles.push(rand() * 2 * Math.PI);

const names = Object.keys(C.claims(C.start({})));
for (const name of names) {
  let passed = 0;
  for (const theta of angles) if (C.claims({ theta, mode: "cross", construction: true, explored: true })[name]) passed++;
  check(`"${name}" holds at all ${angles.length} angles`, passed === angles.length, `${passed}/${angles.length}`);
}

{
  let worst = 0;
  let velocityOk = true;
  for (const theta of angles) {
    const g = C.geometry({ theta });
    const pAngle = Math.atan2(g.P.y - g.O.y, g.P.x - g.O.x);
    const mAngle = Math.atan2(g.M.y - g.P.y, g.M.x - g.P.x) - Math.PI;
    const turned = Math.atan2(Math.sin(mAngle - pAngle), Math.cos(mAngle - pAngle));
    const wrap = Math.atan2(Math.sin(turned - theta), Math.cos(turned - theta));
    worst = Math.max(worst, Math.abs(wrap));
    if (!near(g.R, g.r) || !near(dist(g.Q, g.O), g.r, 1e-9)) velocityOk = false;
  }
  check("the mark turns twice as fast as the rolling centre", worst < 1e-9, `worst ${worst}`);
  check("the hinged Q stays on a circle of radius r about O", velocityOk);
}

/* ---------------- 3. the applet's own computation, over many configurations */

let maxFormula = 0, maxIncremental = 0, maxCore = 0, maxCentre = 0, maxQuarterTurn = 0, maxCorrected = 0;
let compared = 0, rollingCompared = 0;
const rngCfg = rng(90210);
const centres = [P(195, 175), P(200, 150), P(137, 89), P(260, 120)];
for (let k = 0; k < 420; k++) {
  const o = centres[k % centres.length];
  const R = [10, 20, 30, 45][rngCfg() * 4 | 0];
  const r = [7, 15, 30, 45][rngCfg() * 4 | 0];
  const deltaDeg = [1, 2, 3, 5][rngCfg() * 4 | 0];
  const v = [1, 2, 3, -1, -2][rngCfg() * 5 | 0];
  const steps = [1, 5, 17, 60, 90, 180, 360][rngCfg() * 7 | 0];
  const theta = (steps * deltaDeg * Math.PI) / 180;

  const fromCore = C.formulaPoint(theta, o, R, r, v > 0 ? v : 1 / Math.abs(v));
  const fromFormula = appletFormula(o, R, r, steps, deltaDeg, v).M;
  const fromLoop = appletIncremental(o, R, r, steps, deltaDeg, v).M;
  const coreLoop = C.incremental(o, R, r, steps, deltaDeg, v).M; // core's own transcription

  maxFormula = Math.max(maxFormula, dist(fromCore, fromFormula));
  if (v === 1) { // the two methods in the applet only agree at true rolling speed
    maxIncremental = Math.max(maxIncremental, dist(fromFormula, fromLoop));
    rollingCompared++;
  }
  // The real, step-by-step mode scales the mark's own spin by V but not the
  // orbit; that is the closed form it actually follows for every speed.
  const factor = v > 0 ? v : 1 / Math.abs(v);
  const spin = theta * (R / r * factor + 1) + Math.PI;
  const corrected = P(
    o.x + (R + r) * Math.cos(theta) + r * Math.cos(spin),
    o.y + (R + r) * Math.sin(theta) + r * Math.sin(spin),
  );
  maxCorrected = Math.max(maxCorrected, dist(corrected, fromLoop));
  maxCore = Math.max(maxCore, dist(coreLoop, fromLoop));
  const centre = appletIncremental(o, R, r, steps, deltaDeg, v).P;
  maxCentre = Math.max(maxCentre, dist(centre, C.onCircle(o, R + r, theta)));
  maxQuarterTurn = Math.max(maxQuarterTurn, dist(appletFormula(o, R, r, steps, deltaDeg, v).P, C.onCircle(o, R + r, theta - Math.PI / 2)));
  compared++;
}

check(`the core's closed form matches updateFormulaCC in ${compared} configurations`, maxFormula < 1e-7, `worst ${maxFormula}`);
check(`at true rolling speed updateFormulaCC agrees with updateCC (${rollingCompared} configurations)`, rollingCompared > 0 && maxIncremental < 1e-7, `worst ${maxIncremental}`);
check(`the step-by-step mark matches its own closed form in all ${compared} configurations`, maxCorrected < 1e-7, `worst ${maxCorrected}`);
check(`the core's own transcription of updateCC agrees with the check's`, maxCore < 1e-9, `worst ${maxCore}`);
check("the moving centre circles O at radius R+r in the applet's real mode", maxCentre < 1e-7, `worst ${maxCentre}`);
check("the unused formula mode puts the moving centre a quarter turn behind", maxQuarterTurn < 1e-7, `worst ${maxQuarterTurn}`);

{
  const cusp = C.cusp(C.O, C.R);
  const cuspFromApplet = appletIncremental(C.O, C.R, C.R_MOVING, 0, 2, 1).M;
  check("the cusp A is the applet's mark at time zero", close(cusp, cuspFromApplet));
  let worstM = 0, worstT = 0;
  for (const theta of angles) {
    const g = C.geometry({ theta });
    const fromM = C.thetaFrom(g.M, "M"), fromT = C.thetaFrom(g.T, "T");
    const wrapped = C.norm(theta);
    const diff = Math.atan2(Math.sin(fromM - wrapped), Math.cos(fromM - wrapped));
    worstM = Math.max(worstM, Math.abs(diff));
    const diffT = Math.atan2(Math.sin(fromT - wrapped), Math.cos(fromT - wrapped));
    worstT = Math.max(worstT, Math.abs(diffT));
    if (!close(C.clamp(g.M, "M"), g.M, 1e-9) || !close(C.clamp(g.T, "T"), g.T, 1e-9)) {
      worstM = Infinity;
    }
  }
  check("dragging M reads back its angle and stays on the cardioid", worstM < 1e-8, `worst ${worstM}`);
  check("dragging T reads back its angle and stays on the fixed circle", worstT < 1e-8, `worst ${worstT}`);
}

done("cardi");
