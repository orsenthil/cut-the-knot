#!/usr/bin/env node
"use strict";

/*
 * Logic test for angle-on-diameter/angle-on-diameter-core.js.
 *
 *   node porting/check-angle-on-diameter.mjs
 *
 * Checks the article's claims (∠APB is right; an inscribed angle is half the
 * central angle; the isosceles-triangle angle chase; and the converse from the
 * linked Thales' Theorem page) at hundreds of positions of P.  Then it compares
 * the core with a second, literal transcription of the applet's own setup,
 * written straight from AngleOnDiameterCanvas.init()/CreatePoint() in the
 * bytecode: the radius min(W/2,H/2)*2/3, A at PI, B at 0, and P at
 * pi/2 + pi/4*random - pi/8 with CreatePoint(cx,cy,-t,r).  The angle check uses
 * a separate law-of-cosines transcription of GeoSDoub.ComputeAngle, shared by
 * the applet's ShowAngle calls, so the two implementations share no code.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("angle-on-diameter/angle-on-diameter-core.js", "AngleOnDiameterCore");

/* ------------------------------ the applet's own computation, transcribed */

const P = (x, y) => ({ x, y });
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// AngleOnDiameterCanvas.CreatePoint(cx, cy, angle, r): DoubPoint(cx+r*cos, cy+r*sin).
function appletCreatePoint(cx, cy, angle, r) {
  return P(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
}

// AngleOnDiameterCanvas.init(), for the suggested 400x300 canvas.
function appletInit(width, height, randomValue) {
  const cx = width / 2, cy = height / 2;
  const r = Math.min(width / 2, height / 2) * 2 / 3;
  const circle = { c: P(cx, cy), r: r };
  const A = appletCreatePoint(cx, cy, Math.PI, r);
  const B = appletCreatePoint(cx, cy, 0, r);
  const theta = Math.PI / 2 + Math.PI / 4 * randomValue - Math.PI / 8;
  const Pp = appletCreatePoint(cx, cy, -theta, r);
  return { circle, A, B, P: Pp, theta };
}

// GeoSDoub.ComputeAngle(p, q, r): the law-of-cosines angle at the first point,
// used by ShowAngle for every coloured arc the hint draws.
function computeAngle(p, q, r) {
  const pq = dist(p, q), pr = dist(p, r), qr = dist(q, r);
  const num = pq * pq + pr * pr - qr * qr;
  const den = 2 * pq * pr;
  return Math.acos(Math.max(-1, Math.min(1, num / den)));
}

const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const A = C.point(C.CENTER.x - C.RADIUS, C.CENTER.y);
const B = C.point(C.CENTER.x + C.RADIUS, C.CENTER.y);

/* ------------------------------------------------------ 1. the start picture */

{
  const s = C.start({});
  const applet = appletInit(C.VIEW.width, C.VIEW.height,
    (C.START_ANGLE - Math.PI / 2 + Math.PI / 8) / (Math.PI / 4));
  check("the radius is the applet's min(W/2,H/2)*2/3", C.RADIUS === 100 && applet.circle.r === 100);
  check("the centre is the middle of the canvas", C.CENTER.x === 200 && C.CENTER.y === 150);
  check("A and B are the ends of the horizontal diameter",
    dist(s.P, A) > 0 && Math.abs(A.x - applet.A.x) < 1e-12 && Math.abs(B.x - applet.B.x) < 1e-12);
  check("the opening P matches the applet's CreatePoint(cx,cy,-t,r)",
    dist(s.P, applet.P) < 1e-9, `${JSON.stringify(s.P)} vs ${JSON.stringify(applet.P)}`);
  check("the opening angle lies in the applet's [3pi/8,5pi/8] range",
    C.START_ANGLE >= 3 * Math.PI / 8 - 1e-12 && C.START_ANGLE <= 5 * Math.PI / 8 + 1e-12);
  check("names start on and the other overlays off",
    s.options.names === true && s.options.mode === "plain");
  check("a drawing is not a game: no result", C.result(s) === null);
  check("a fresh drawing is not yet explored", s.explored === false);
}

/* ----------------------------------------- 2. moves, options and the record */

{
  const s = C.start({});
  const dragged = C.move(s, P(205, 44));
  check("dragging marks the picture explored", dragged.explored === true && s.explored === false);
  check("dragging leaves the old position alone", s.P.x !== dragged.P.x);
  check("dragging keeps P on the circle", near(dist(dragged.P, C.CENTER), C.RADIUS, 1e-9));
  check("a point at the centre is sent back to the start circle",
    near(dist(C.move(s, P(200, 150)).P, C.CENTER), C.RADIUS, 1e-9));
  const optioned = C.setOption(s, "mode", "hint");
  check("choosing the hint keeps the old state", optioned.options.mode === "hint" && s.options.mode === "plain");
  check("an unknown option is refused", C.setOption(s, "mode", "nonsense") === s);
  check("reset restores P but keeps the options",
    dist(C.reset(optioned).P, s.P) < 1e-12 && C.reset(optioned).options.mode === "hint");
  check("reset keeps the picture explored", C.reset(dragged).explored === true);
}

/* ------------------------------- 3. the claims, at hundreds of positions of P */

let onCircle = 0, right = 0, corner = 0, central = 0, halves = 0, base = 0;
let chase = 0, split = 0, matchesApplet = 0, used = 0;
let maxClaimErr = 0, maxAppletErr = 0;
const rand = rng(20261126);
const angles = [];
for (let i = 0; i < 360; i++) angles.push(2 * Math.PI * i / 360 + 0.003);
for (let i = 0; i < 240; i++) angles.push(rand() * 2 * Math.PI);

for (const t of angles) {
  const s = { P: C.pointOnCircle(C.CIRCLE, t), options: { names: true, mode: "plain" }, explored: true };
  const g = C.geometry(s);
  // The right-angle mark degenerates when P lands on A or B; skip those.
  if (dist(g.P, A) < 0.5 || dist(g.P, B) < 0.5) continue;
  used++;

  const ap = appletInit(C.VIEW.width, C.VIEW.height, 0.5);
  // Compare the same angle, not the random start: rebuild both points from t.
  const appletP = appletCreatePoint(ap.circle.c.x, ap.circle.c.y, -t, ap.circle.r);
  const a = g.angles;
  const errs = [
    dist(g.P, appletP),
    Math.abs(a.APB - computeAngle(g.P, A, B)),
    Math.abs(a.AOP - computeAngle(C.CENTER, A, g.P)),
    Math.abs(a.BOP - computeAngle(C.CENTER, B, g.P)),
    Math.abs(a.APO - computeAngle(g.P, A, C.CENTER)),
    Math.abs(a.BPO - computeAngle(g.P, B, C.CENTER)),
  ];
  const worst = Math.max(...errs);
  maxAppletErr = Math.max(maxAppletErr, worst);
  if (worst < 1e-8) matchesApplet++;

  // Three radii of the same circle.
  const radii = [dist(C.CENTER, A), dist(C.CENTER, B), dist(C.CENTER, g.P)];
  maxClaimErr = Math.max(maxClaimErr, Math.max(...radii) - Math.min(...radii));
  if (Math.max(...radii) - Math.min(...radii) < 1e-9) onCircle++;

  // The page's headline claim, checked two ways.
  maxClaimErr = Math.max(maxClaimErr, Math.abs(a.APB - Math.PI / 2), Math.abs(g.corner));
  if (Math.abs(a.APB - Math.PI / 2) < 1e-8) right++;
  if (Math.abs(g.corner) < 1e-8) corner++;

  // An inscribed angle measures half the central angle; the two central
  // angles of a diameter add to two right angles (180°).
  maxClaimErr = Math.max(maxClaimErr, Math.abs(g.centralSum - Math.PI),
    Math.abs(a.APB - g.centralSum / 2));
  if (Math.abs(g.centralSum - Math.PI) < 1e-8 && Math.abs(a.APB - g.centralSum / 2) < 1e-8) central++;
  if (near(a.APB, (a.AOP + a.BOP) / 2, 1e-8)) halves++;

  // The article's isosceles-triangle chase: equal base angles, each doubled
  // by the opposite exterior angle, then halved back to a right angle.
  const chaseErrs = [
    Math.abs(a.OAP - a.APO), Math.abs(a.OBP - a.BPO),
    Math.abs(a.OAP + a.APO - a.BOP), Math.abs(a.OBP + a.BPO - a.AOP),
    Math.abs(2 * a.APO - a.BOP), Math.abs(2 * a.BPO - a.AOP),
  ];
  maxClaimErr = Math.max(maxClaimErr, ...chaseErrs);
  if (chaseErrs.every((e) => e < 1e-8)) base++;
  if (Math.abs(a.APO + a.BPO - Math.PI / 2) < 1e-8) chase++;
  // The radius OP splits ∠APB into exactly those two base angles.
  maxClaimErr = Math.max(maxClaimErr, Math.abs(a.APB - (a.APO + a.BPO)));
  if (Math.abs(a.APB - (a.APO + a.BPO)) < 1e-8) split++;
}

{
  check(`all sampled positions were usable (${used})`, used > 550, `${used}`);
  check("OA = OB = OP at every position", onCircle === used, `${onCircle}/${used}`);
  check("∠APB is a right angle at every position", right === used, `${right}/${used}`);
  check("PA and PB are perpendicular (dot product zero)", corner === used, `${corner}/${used}`);
  check("the two central angles add to 180° and APB is half", central === used, `${central}/${used}`);
  check("the inscribed angle is half the central angle", halves === used, `${halves}/${used}`);
  check("both triangles are isosceles and the exterior-angle chase holds", base === used, `${base}/${used}`);
  check("∠APO + ∠BPO = 90°", chase === used, `${chase}/${used}`);
  check("OP splits ∠APB into the two base angles", split === used, `${split}/${used}`);
  check(`the core matches the applet's points and angles to ${maxAppletErr.toExponential(1)}`,
    matchesApplet === used, `${matchesApplet}/${used}`);
  check(`every claim holds to ${maxClaimErr.toExponential(1)}`, maxClaimErr < 1e-8);
}

/* ------------------------------------- 4. the converse, and the status lines */

{
  // The linked Thales' Theorem page says "an angle inscribed in a semicircle
  // is right, and vice versa": any P with a right angle lies on the circle.
  const rand2 = rng(7);
  let converse = 0, tested = 0;
  for (let i = 0; i < 500; i++) {
    const q = P(60 + rand2() * 280, 20 + rand2() * 260);
    if (dist(q, A) < 1 || dist(q, B) < 1) continue;
    tested++;
    const apb = computeAngle(q, A, B);
    const circleErr = Math.abs(dist(q, C.CENTER) - C.RADIUS);
    if (Math.abs(apb - Math.PI / 2) < 1e-7) {
      if (circleErr < 1e-6) converse++;
    } else if (circleErr > 1e-6) {
      converse++;
    }
  }
  check(`the converse holds at ${tested} off/on-circle points`, converse === tested, `${converse}/${tested}`);

  const s = C.start({});
  check("the plain status quotes the right angle", /∠APB = 90\.0°/.test(C.describe(s)));
  check("statement mode reports the marked corner", /square at P/.test(C.describe(C.setOption(s, "mode", "statement"))));
  const hint = C.describe(C.setOption(s, "mode", "hint"));
  check("hint mode reports the equal base angles", /∠APO = ∠OAP/.test(hint) && /∠BPO = ∠OBP/.test(hint));
  const moved = C.move(s, P(270, 96));
  check("the angle stays right after a drag",
    Math.abs(C.geometry(moved).angles.APB - Math.PI / 2) < 1e-8);
}

done("angle-on-diameter");
