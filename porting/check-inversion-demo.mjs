#!/usr/bin/env node
"use strict";

/*
 * Logic test for inversion-demo/inversion-demo-core.js.
 *
 *   node porting/check-inversion-demo.mjs
 *
 * Two kinds of checks. First, the core is compared with a second transcription
 * of the applet's own bytecode over hundreds of configurations: Add/Remove and
 * the starting layout from InversionDemoCanvas, InvLine.InvertCinC's circle and
 * line branches, InvLine.TangentAt and Inversion.Invert. Second, the claims on
 * the cut-the-knot page are checked: a circle inverts to a circle unless it
 * goes through O (then a line), a circle at right angles to the circle of
 * inversion is unchanged, points keep OX * OX' = R^2, distances follow
 * P'Q' = R^2 PQ / (OP OQ), and angles keep their measure. The applet's
 * |OP^2 - r^2| <= 100 drawing tolerance is tested as an applet quirk.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("inversion-demo/inversion-demo-core.js", "InversionDemoCore");
const near = (a, b, tol = 1e-7) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const pointNear = (a, b, tol = 1e-7) => !!a && !!b && near(a.x, b.x, tol) && near(a.y, b.y, tol);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a, b) => a.x * b.y - a.y * b.x;
const len = (v) => Math.hypot(v.x, v.y);
const polar = (c, r, a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
const angleAt = (p, q, r) => {
  const v = sub(q, p), w = sub(r, p);
  const c = (v.x * w.x + v.y * w.y) / (len(v) * len(w));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
};

/* ------------------------------------------------- the applet, from javap */

/* Inversion.Invert(DoubCircle, DoubPoint). */
function appletInvert(inv, p) {
  const d = C.dist(inv.center, p);
  const k = (inv.radius * inv.radius) / d / d;
  return { x: inv.center.x + k * (p.x - inv.center.x), y: inv.center.y + k * (p.y - inv.center.y) };
}

/* InvLine.TangentAt(DoubPoint): the second point 100 units along the tangent. */
function appletTangentAt(inv, q) {
  return { x: q.x + 100 * (q.y - inv.center.y), y: q.y - 100 * (q.x - inv.center.x) };
}

/* InvLine.InvertCinC(DoubCircle, false), with the boolean sign fixed at +1. */
function appletInvertCinC(inv, target) {
  const r = target.radius;                             // DoubCircle.GetRadius()
  const d = C.sqDist(inv.center, target.center) - r * r;
  if (Math.abs(d) > 100) {
    const k = (inv.radius * inv.radius) / d;
    return {
      kind: "circle",
      center: { x: inv.center.x + (target.center.x - inv.center.x) * k,
                y: inv.center.y + (target.center.y - inv.center.y) * k },
      radius: r * Math.abs(k),
    };
  }
  const far = { x: 2 * target.center.x - inv.center.x, y: 2 * target.center.y - inv.center.y };
  const q = appletInvert(inv, far);
  const t = appletTangentAt(inv, q);
  return { kind: "line", point: q, direction: sub(t, q) };
}

/* InversionDemoCanvas.Add() with the applet's random calls in bytecode order. */
function appletAdd(state, random) {
  const size = state.circles.length;
  const color = C.COLORS[size % C.COLORS.length];      // Colors[size % Colors.length]
  const s = Math.min(C.VIEW.width, C.VIEW.height) / 5; // min(w,h)/5
  const d = 2 * s;                                     // 2*s
  const radius = 50 + random() * (100 - 50);           // 50 + rand*(100-50)
  const angle = random() * Math.PI;                    // rand*PI
  const cx = s + random() * (C.VIEW.width - d);
  const cy = s + random() * (C.VIEW.height - d);
  return {
    C: { x: cx, y: cy },
    B: { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) },
    color,
  };
}

/* ------------------------------------------------- 1. the applet's own state */

{
  const s = C.start();
  check("start puts O and A where InversionDemoCanvas.init() does",
    pointNear(s.O, { x: (C.VIEW.width / 2) * (4 / 7), y: C.VIEW.height / 2 }, 0) &&
    pointNear(s.A, { x: C.VIEW.width / 12, y: C.VIEW.height / 2 }, 0));
  check("the inversion circle is centred at O and passes through A",
    near(C.inversionCircle(s).radius, C.dist(s.O, s.A), 0) &&
    near(C.inversionCircle(s).radius, 850 / 7, 1e-9));
  check("the stack starts empty and an illustration has no end",
    s.circles.length === 0 && C.result(s) === null);
  check("Remove on an empty stack changes nothing", C.removeCircle(s) === s);

  const a = C.addCircle(s, rng(7));
  const b = C.addCircle(a, rng(7));
  check("Add pushes a circle and keeps the earlier one untouched",
    a.circles.length === 1 && b.circles.length === 2 &&
    pointNear(b.circles[0].C, a.circles[0].C, 0) &&
    pointNear(b.circles[0].B, a.circles[0].B, 0));
  check("the empty start state is not changed by Add", s.circles.length === 0);

  const removed = C.removeCircle(b);
  check("Remove pops the last circle only",
    removed.circles.length === 1 && pointNear(removed.circles[0].C, a.circles[0].C, 0) &&
    removed.circles[0].color === a.circles[0].color);

  const moved = C.moveVertex(b, "O", { x: 10, y: 20 });
  check("moving O leaves A and the circles where they were",
    pointNear(moved.O, { x: 10, y: 20 }, 0) && pointNear(moved.A, s.A, 0) &&
    pointNear(moved.circles[0].C, b.circles[0].C, 0) && b.touches === 0 && moved.touches === 1);
  const oldB = { ...b.circles[0].B };
  const oldRadius = C.targetCircle(b.circles[0]).radius;
  const movedB = C.moveVertex(b, "B0", { x: 400, y: 300 });
  check("moving a rim point changes that circle's radius",
    near(C.targetCircle(movedB.circles[0]).radius, C.dist({ x: 400, y: 300 }, movedB.circles[0].C)) &&
    !near(C.targetCircle(movedB.circles[0]).radius, oldRadius) &&
    pointNear(b.circles[0].B, oldB, 0));
  check("an unknown handle or a non-finite point is ignored",
    C.moveVertex(b, "C9", { x: 1, y: 1 }) === b &&
    C.moveVertex(b, "A", { x: NaN, y: 2 }) === b &&
    C.moveVertex(b, "B-1", { x: 1, y: 2 }) === b);

  const oldRadius1 = C.targetCircle(b.circles[1]).radius;
  const dragged = C.moveCircle(b, 1, { x: 400, y: 200 });
  check("dragging a whole circle translates centre and rim together",
    pointNear(dragged.circles[1].C, { x: 400, y: 200 }, 0) &&
    near(C.targetCircle(dragged.circles[1]).radius, oldRadius1) &&
    pointNear(dragged.circles[0].C, b.circles[0].C, 0) &&
    C.moveCircle(b, 5, { x: 1, y: 1 }) === b);
}

/* ---------------------------- 2. second transcription over the full ranges */

const rand = rng(20261127);

{
  let compared = 0;
  let worstCenter = 0;
  let worstRadius = 0;
  for (let i = 0; i < 900; i++) {
    const O = { x: 20 + rand() * 300, y: 20 + rand() * 200 };
    const A = polar(O, 20 + rand() * 100, rand() * Math.PI * 2);
    const inv = { center: O, radius: C.dist(O, A) };
    const target = { center: { x: 150 + rand() * 300, y: 30 + rand() * 280 },
                     radius: 8 + rand() * 60 };
    if (Math.abs(C.sqDist(O, target.center) - target.radius ** 2) <= 100) continue;
    const core = C.invertCircle(inv.center, inv.radius ** 2, target);
    const applet = appletInvertCinC(inv, target);
    if (core.kind !== "circle" || applet.kind !== "circle") break;
    compared++;
    worstCenter = Math.max(worstCenter, C.dist(core.center, applet.center));
    worstRadius = Math.max(worstRadius, Math.abs(core.radius - applet.radius));
  }
  check("circle branch matches InvLine.InvertCinC over hundreds of circles",
    compared >= 800 && worstCenter < 1e-8 && worstRadius < 1e-8,
    `${compared} circles, centre ${worstCenter}, radius ${worstRadius}`);

  let lines = 0;
  let worstPoint = 0;
  let worstDirection = 0;
  for (let i = 0; i < 140; i++) {
    const O = { x: 60 + rand() * 200, y: 60 + rand() * 160 };
    const R = 30 + rand() * 90;
    const a = rand() * Math.PI * 2;
    const r = 20 + rand() * 60;
    const target = { center: polar(O, r, a), radius: r }; // passes through O
    const inv = { center: O, radius: R };
    const core = C.invertCircle(inv.center, inv.radius ** 2, target);
    const applet = appletInvertCinC(inv, target);
    if (core.kind !== "line" || applet.kind !== "line") break;
    lines++;
    worstPoint = Math.max(worstPoint, C.dist(core.point, applet.point));
    const u = { x: core.direction.x / len(core.direction), y: core.direction.y / len(core.direction) };
    const v = { x: applet.direction.x / len(applet.direction), y: applet.direction.y / len(applet.direction) };
    worstDirection = Math.max(worstDirection, Math.abs(u.x - v.x), Math.abs(u.y - v.y));
  }
  check("line branch matches the applet's antipode and tangent construction",
    lines >= 130 && worstPoint < 1e-8 && worstDirection < 1e-12,
    `${lines} lines, point ${worstPoint}, direction ${worstDirection}`);

  let points = 0;
  let worstInverse = 0;
  for (let i = 0; i < 600; i++) {
    const O = { x: rand() * 400, y: rand() * 300 };
    const R = 20 + rand() * 100;
    const p = polar(O, 5 + rand() * 160, rand() * Math.PI * 2);
    const power = (i % 3 === 0 ? -1 : 1) * R * R;
    const core = C.invertPoint(O, power, p);
    const applet = appletInvert({ center: O, radius: Math.sqrt(Math.abs(power)) }, p);
    // The applet has no negative power: flip the image back across O to check it.
    const expected = power < 0
      ? { x: 2 * O.x - applet.x, y: 2 * O.y - applet.y }
      : applet;
    points++;
    worstInverse = Math.max(worstInverse, C.dist(core, expected));
  }
  check("point inversion matches Inversion.Invert (including a negative power)",
    points === 600 && worstInverse < 1e-8, `${points} points, worst ${worstInverse}`);

  let state = C.start();
  let addWorst = 0;
  let colorsOk = true;
  // Two identical streams: one for the transcription, one for the core.
  const appletRandom = rng(20261127);
  const coreRandom = rng(20261127);
  for (let i = 0; i < 24; i++) {
    const expected = appletAdd(state, appletRandom);
    state = C.addCircle(state, coreRandom);
    const got = state.circles[i];
    addWorst = Math.max(addWorst, C.dist(got.C, expected.C), C.dist(got.B, expected.B));
    if (got.color !== expected.color || got.color !== C.COLORS[i % 10]) colorsOk = false;
  }
  check("Add matches the applet's random circles exactly over 24 adds",
    addWorst < 1e-12 && colorsOk && state.circles.length === 24, `worst ${addWorst}`);
  check("the palette cycles modulo ten as in InversionDemoCanvas.Colors",
    state.circles[10].color === state.circles[0].color &&
    state.circles[13].color === state.circles[3].color);

  let popOk = true;
  for (let i = 23; i >= 0; i--) {
    popOk = popOk && state.circles.length === i + 1;
    state = C.removeCircle(state);
  }
  check("Remove unwinds the whole stack in LIFO order", popOk && state.circles.length === 0);
}

/* ------------------------------------------------------- 3. the page's claims */

{
  let circles = 0;
  let worst = 0;
  for (let i = 0; i < 500; i++) {
    const O = { x: 30 + rand() * 320, y: 30 + rand() * 240 };
    const A = polar(O, 40 + rand() * 80, rand() * Math.PI * 2);
    const R2 = C.sqDist(O, A);
    const r = 10 + rand() * 55;
    const center = polar(O, r + 60 + rand() * 90, rand() * Math.PI * 2);
    const d = C.sqDist(O, center) - r * r;
    if (Math.abs(d) <= 100.5) continue;
    const image = C.invertCircle(O, R2, { center, radius: r });
    if (image.kind !== "circle") break;
    circles++;
    for (let k = 0; k < 16; k++) {
      const p = polar(center, r, (k * Math.PI) / 8);
      const q = C.invertPoint(O, R2, p);
      worst = Math.max(worst, Math.abs(C.dist(q, image.center) - image.radius) / image.radius);
    }
  }
  check("page: a circle away from O inverts into a circle through 16 sample points",
    circles >= 480 && worst < 1e-9, `${circles} circles, worst relative error ${worst}`);
}

{
  let lines = 0;
  let worstLine = 0;
  let worstDistance = 0;
  let worstPerp = 0;
  for (let i = 0; i < 160; i++) {
    const O = { x: 60 + rand() * 200, y: 60 + rand() * 160 };
    const R = 30 + rand() * 90;
    const a = rand() * Math.PI * 2;
    const r = 20 + rand() * 60;
    const center = polar(O, r, a);
    const image = C.invertCircle(O, R * R, { center, radius: r });
    if (image.kind !== "line" || !image.point) break;
    lines++;
    const u = image.direction;
    for (let k = 0; k < 12; k++) {
      const p = polar(center, r, (k * Math.PI) / 6);
      if (C.dist(p, O) < 1e-4) continue;
      const q = C.invertPoint(O, R * R, p);
      worstLine = Math.max(worstLine, Math.abs(cross(sub(q, image.point), u)) / len(u));
    }
    // For a circle through O the image line is R^2/(2r) from O.
    worstDistance = Math.max(worstDistance,
      Math.abs(Math.abs(cross(sub(O, image.point), u)) / len(u) - (R * R) / (2 * r)) / (R * R / (2 * r)));
    const radial = sub(center, O);
    worstPerp = Math.max(worstPerp, Math.abs((radial.x * u.x + radial.y * u.y) / (len(radial) * len(u))));
  }
  check("page: a circle through O inverts into a straight line",
    lines >= 150 && worstLine < 1e-8, `${lines} lines, worst offset ${worstLine}`);
  check("page: that line lies R^2/(2r) from O and is perpendicular to OC",
    worstDistance < 1e-8 && worstPerp < 1e-12,
    `distance ${worstDistance}, perpendicular ${worstPerp}`);
}

{
  let orthogonal = 0;
  let worst = 0;
  for (let i = 0; i < 400; i++) {
    const O = { x: 30 + rand() * 260, y: 30 + rand() * 200 };
    const R = 30 + rand() * 80;
    const r = 12 + rand() * 45;
    const d = Math.sqrt(R * R + r * r); // d^2 = R^2 + r^2, so power = R^2
    if (R * R <= 100.5) continue;
    const center = polar(O, d, rand() * Math.PI * 2);
    const source = { center, radius: r };
    const image = C.invertCircle(O, R * R, source);
    if (image.kind !== "circle") break;
    orthogonal++;
    worst = Math.max(worst, C.dist(image.center, center), Math.abs(image.radius - r));
  }
  check("page: circles perpendicular to the inversion circle are invariant",
    orthogonal >= 380 && worst < 1e-8, `${orthogonal} pairs, worst ${worst}`);
}

{
  let worstProduct = 0;
  let worstInvolution = 0;
  let worstDistance = 0;
  for (let i = 0; i < 500; i++) {
    const O = { x: rand() * 600, y: rand() * 450 };
    const R = 20 + rand() * 100;
    const p = polar(O, 5 + rand() * 140, rand() * Math.PI * 2);
    const q = polar(O, 5 + rand() * 140, rand() * Math.PI * 2);
    const pp = C.invertPoint(O, R * R, p);
    const qq = C.invertPoint(O, R * R, q);
    worstProduct = Math.max(worstProduct,
      Math.abs(C.dist(O, p) * C.dist(O, pp) - R * R) / (R * R));
    worstInvolution = Math.max(worstInvolution, C.dist(C.invertPoint(O, R * R, pp), p));
    const expected = (R * R * C.dist(p, q)) / (C.dist(O, p) * C.dist(O, q));
    worstDistance = Math.max(worstDistance, Math.abs(C.dist(pp, qq) - expected) / expected);
  }
  check("page: OX times OX' equals R^2", worstProduct < 1e-12, `worst ${worstProduct}`);
  check("inversion undoes itself", worstInvolution < 1e-7, `worst ${worstInvolution}`);
  check("page formula: P'Q' = R^2 PQ / (OP OQ)", worstDistance < 1e-12, `worst ${worstDistance}`);
}

{
  let worstAngle = 0;
  for (let i = 0; i < 400; i++) {
    const O = { x: rand() * 600, y: rand() * 450 };
    const P = polar(O, 10 + rand() * 120, rand() * Math.PI * 2);
    const a = rand() * Math.PI * 2;
    const b = a + rand() * Math.PI;
    const h = C.dist(O, P) * 1e-5;
    const Q = { x: P.x + h * Math.cos(a), y: P.y + h * Math.sin(a) };
    const R = { x: P.x + h * Math.cos(b), y: P.y + h * Math.sin(b) };
    const r2 = (30 + rand() * 90) ** 2;
    worstAngle = Math.max(worstAngle, Math.abs(
      angleAt(P, Q, R) - angleAt(C.invertPoint(O, r2, P), C.invertPoint(O, r2, Q), C.invertPoint(O, r2, R))));
  }
  check("page: inversion preserves the measure of an angle", worstAngle < 0.01,
    `worst change ${worstAngle} degrees`);
}

{
  // The applet's own tolerance: a circle that misses O by a hair is drawn as
  // a line. The page's exact claim still holds; this is a drawing quirk.
  const O = { x: 200, y: 200 };
  const R = 80;
  const r = 40;
  const center = { x: O.x + 120, y: O.y }; // d^2 = 14400, power = 12800 <= 100 away
  const source = { center, radius: r };
  const nearO = { center: { x: O.x + Math.sqrt(r * r + 50), y: O.y }, radius: r };
  check("applet quirk: the line branch also fires near O, not only through it",
    C.invertCircle(O, R * R, source).kind === "circle" &&
    C.invertCircle(O, R * R, nearO).kind === "line" &&
    appletInvertCinC({ center: O, radius: R }, nearO).kind === "line");
}

{
  let state = C.start();
  const random = rng(99);
  for (let i = 0; i < 8; i++) state = C.addCircle(state, random);
  const g = C.geometry(state);
  const finite = g.items.every((item) =>
    Number.isFinite(item.source.radius) && Number.isFinite(item.d) &&
    (item.image.kind !== "circle" ||
      (Number.isFinite(item.image.radius) && Number.isFinite(item.image.center.x))) &&
    (item.image.kind !== "line" ||
      (Number.isFinite(item.image.point.x) && Number.isFinite(item.image.direction.x))));
  check("geometry stays finite with a full stack of eight circles", finite && g.items.length === 8);
  const text = C.status(state, g);
  check("the status describes the picture without NaN or undefined",
    /8 coloured circles/.test(text) && !/NaN|undefined/.test(text), text);
  const empty = C.status(C.start());
  check("the empty picture asks for a circle", /Add circle/.test(empty), empty);
  const O = state.O;
  const first = state.circles[0];
  const onO = { x: O.x + (first.B.x - first.C.x), y: O.y + (first.B.y - first.C.y) };
  const through = C.geometry(C.moveCircle(state, 0, onO));
  check("the status reports a straight-line image when a circle meets O",
    through.items[0].image.kind === "line" && /straight line/.test(C.status(state, through)),
    C.status(state, through));
}

done("inversion-demo");
