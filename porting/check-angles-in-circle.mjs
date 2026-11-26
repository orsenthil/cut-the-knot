#!/usr/bin/env node
"use strict";

/*
 * Logic test for angles-in-circle/angles-in-circle-core.js.
 *
 *   node porting/check-angles-in-circle.mjs
 *
 * The page claims that a secant angle is half the sum of the intercepted arcs
 * when A is inside the circle, half their difference when A is outside, and
 * still half the difference when one secant is a tangent. Those three claims
 * are checked on thousands of configurations, plus the inscribed-angle
 * special case with A on the circle. A second, literal transcription of the
 * applet's Compute()/Arc methods (ComputeSignedAngle, MoveToFirstCircle,
 * Contains, ToComplement, and the near/far choice) is compared with the core
 * over the whole position space. Sliding a chord parallel to itself is
 * checked to leave the angle and the theorem's value unchanged.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("angles-in-circle/angles-in-circle-core.js", "AnglesInCircleCore");
const rand = rng(20261126);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const TAU = C.TAU, O = C.CENTER, R = C.RADIUS;
const boardPoint = () => ({
  x: C.MIN_X + 8 + rand() * (C.MAX_X - C.MIN_X - 16),
  y: C.MIN_Y + 8 + rand() * (C.MAX_Y - C.MIN_Y - 16),
});
const onCircle = (p) => C.clampHandle(p, { x: -1000, y: -1000 });

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the circle is centred where the applet puts it", s.center, { x: 180, y: 120 });
  check("the radius matches the board", s.radius === 84);
  check("the new intersection is outside the circle", C.dist(s.A, O) > R);
  check("the first handle is on the board", s.B.x >= C.MIN_X && s.B.x <= C.MAX_X && s.B.y >= C.MIN_Y && s.B.y <= C.MAX_Y);
  check("the second handle is on the board", s.C.x >= C.MIN_X && s.C.x <= C.MAX_X && s.C.y >= C.MIN_Y && s.C.y <= C.MAX_Y);
  check("names are shown by default here", s.showNames === true);
  check("arcs are shown by default here", s.showArcs === true);
  check("angles are shown by default here", s.showAngles === true);
  check("an illustration has no result", C.result(s) === null);
  check("the status reads the difference case", C.describe(s).includes("half the difference"));
  const g = C.compute(s);
  check("the default picture has both arcs", g.available && g.arcBC > 0 && g.arcDE > 0);
  check("the default angle agrees with the formula", near(g.angle, g.formula));
}

/* ------------------------------------------------- 2. the handle operations */

{
  const s = C.start({});
  const before = C.compute(s);
  const moved = C.moveA(s, { x: 200, y: 100 });
  const after = C.compute(moved);
  check("dragging A keeps both secants crossing the circle", after.available);
  check("dragging A leaves the angle unchanged", near(after.angle, before.angle, 1e-6));
  check("dragging A leaves the theorem's value unchanged", near(after.formula, before.formula, 1e-6));
  check("B and C travel with A", near(C.dist(moved.B, moved.A), C.dist(s.B, s.A)) &&
                                 near(C.dist(moved.C, moved.A), C.dist(s.C, s.A)));
  check("moveA does not change the original position", s.A.x === 288 && s.A.y === 120);

  const rotated = C.moveHandle(s, "B", { x: 120, y: 120 });
  check("turning a secant keeps A fixed", rotated.A === s.A);
  check("turning a secant keeps the other handle fixed", rotated.C === s.C);
  check("turning a secant moves its own handle", rotated.B.x !== s.B.x || rotated.B.y !== s.B.y);
  check("a handle near A is pushed away", C.dist(C.moveHandle(s, "B", s.A).B, s.A) >= C.MIN_HANDLE - 1e-9);
  check("an unknown handle is ignored", C.moveHandle(s, "X", { x: 1, y: 1 }) === s);
  check("toggling arcs flips just that option", C.toggle(s, "showArcs").showArcs === false &&
                                                C.toggle(s, "showArcs").showNames === true);
  check("an unknown option is ignored", C.toggle(s, "nope") === s);
}

/* --------------------------------- 3. sliding a chord parallel to itself */

{
  let bad = 0, movedArcs = 0, n = 0;
  for (let i = 0; i < 400; i++) {
    const s = C.start({ A: boardPoint(), B: boardPoint(), C: boardPoint() });
    const g = C.compute(s);
    if (!g.available || g.onCircle || g.tangent) continue;
    const amount = (rand() < 0.5 ? -1 : 1) * (2 + rand() * 12);
    for (const which of ["B", "C"]) {
      const t = C.slide(s, which, amount);
      const h = C.compute(t);
      if (!h.available) continue;
      // Only count slides that did not hit the board edge or push a handle
      // back out of the circle: those clamps are a UI constraint, not the theorem.
      const inside = (p) => p.x > C.MIN_X + 1 && p.x < C.MAX_X - 1 &&
                            p.y > C.MIN_Y + 1 && p.y < C.MAX_Y - 1;
      if (!inside(t.A) || !inside(t.B) || !inside(t.C) ||
          C.dist(t.B, t.A) < C.MIN_HANDLE + 1e-6 || C.dist(t.C, t.A) < C.MIN_HANDLE + 1e-6) continue;
      n++;
      // Compare the angle between the two line directions: which pair of
      // vertical angles gets labelled "near" can swap during a slide, but
      // the lines themselves have not turned.
      const dirs = (st) => {
        const u = C.unit(st.A, st.B), v = C.unit(st.A, st.C);
        // Lines, not rays: taking |dot| ignores A crossing one of the handles.
        return Math.acos(Math.min(1, Math.abs(u.x * v.x + u.y * v.y)));
      };
      if (!near(dirs(s), dirs(t), 1e-6) || !near(h.angle, h.formula, 1e-6)) bad++;
      if (Math.abs(h.arcBC - g.arcBC) > 1e-4 || Math.abs(h.arcDE - g.arcDE) > 1e-4) movedArcs++;
    }
  }
  check("parallel slides were exercised", n > 200, `${n} slides`);
  check("sliding a chord keeps the angle and the theorem's value", bad === 0, `${bad} of ${n} wrong`);
  check("sliding a chord changes the intercepted arcs", movedArcs > n / 2, `${movedArcs} of ${n} changed`);
  const s = C.start({});
  const parallel = C.start({ A: s.A, B: { x: 290, y: 120 }, C: { x: 300, y: 120 } });
  check("a degenerate parallel slide is refused", C.slide(parallel, "B", 10) === parallel);
}

/* -------------------------------------------- 4. the page's formulas */

{
  let inBad = 0, inN = 0, outBad = 0, outN = 0;
  for (let i = 0; i < 6000; i++) {
    const A = { x: C.MIN_X + rand() * (C.MAX_X - C.MIN_X), y: C.MIN_Y + rand() * (C.MAX_Y - C.MIN_Y) };
    const s = C.start({ A: A, B: onCircle(boardPoint()), C: onCircle(boardPoint()) });
    const g = C.compute(s);
    if (!g.available || g.tangent || g.onCircle) continue;
    if (g.inside) {
      inN++;
      if (!near(g.angle, (g.arcBC + g.arcDE) / 2, 1e-6)) inBad++;
    } else {
      outN++;
      if (!near(g.angle, Math.abs(g.arcBC - g.arcDE) / 2, 1e-6)) outBad++;
    }
  }
  check("inside cases were exercised", inN > 1000, `${inN}`);
  check("outside cases were exercised", outN > 1000, `${outN}`);
  check("inside: angle = half the SUM of the two arcs", inBad === 0, `${inBad} of ${inN} wrong`);
  check("outside: angle = half the DIFFERENCE of the two arcs", outBad === 0, `${outBad} of ${outN} wrong`);
}

/* --------------------------- 5. tangent and on-the-circle special cases */

{
  let bad = 0, n = 0;
  for (let i = 0; i < 2000; i++) {
    const len = R + 12 + rand() * 28;
    const aAngle = rand() * TAU;
    const A = { x: O.x + len * Math.cos(aAngle), y: O.y + len * Math.sin(aAngle) };
    const ux = Math.cos(aAngle), uy = Math.sin(aAngle), px = -uy, py = ux;
    const tLen = Math.sqrt(len * len - R * R);
    const sign = rand() < 0.5 ? 1 : -1;
    const T = {
      x: O.x + (R * R / len) * ux + sign * (R * tLen / len) * px,
      y: O.y + (R * R / len) * uy + sign * (R * tLen / len) * py,
    };
    const dB = { x: (T.x - A.x) / tLen, y: (T.y - A.y) / tLen };
    const spread = Math.asin(R / len) * (0.15 + 0.75 * rand());
    const cAngle = aAngle + Math.PI + (rand() < 0.5 ? -spread : spread);
    const dC = { x: Math.cos(cAngle), y: Math.sin(cAngle) };
    const s = C.start({ A: A, B: { x: A.x + 52 * dB.x, y: A.y + 52 * dB.y },
                            C: { x: A.x + 52 * dC.x, y: A.y + 52 * dC.y } });
    const g = C.compute(s);
    if (!g.available || !g.tangent) continue;
    n++;
    if (!near(g.angle, Math.abs(g.arcBC - g.arcDE) / 2, 1e-5)) bad++;
  }
  check("tangent cases were exercised", n > 400, `${n}`);
  check("a tangent still gives half the difference", bad === 0, `${bad} of ${n} wrong`);
}

{
  let bad = 0, zeroArc = 0, n = 0;
  for (let i = 0; i < 2000; i++) {
    const a = rand() * TAU;
    const A = { x: O.x + R * Math.cos(a), y: O.y + R * Math.sin(a) };
    const s = C.start({ A: A, B: onCircle(boardPoint()), C: onCircle(boardPoint()) });
    const g = C.compute(s);
    if (!g.available || !g.onCircle) continue;
    n++;
    if (g.arcBC < 1e-6) zeroArc++;
    if (!near(g.angle, g.arcDE / 2, 1e-5)) bad++;
  }
  check("on-the-circle cases were exercised", n > 1500, `${n}`);
  check("A on the circle makes one arc vanish", zeroArc === n, `${zeroArc} of ${n}`);
  check("inscribed angle = half the remaining arc", bad === 0, `${bad} of ${n} wrong`);
}

{
  // The page's central-angle starting point: two diameters give equal arcs.
  const s = C.start({ A: { x: O.x, y: O.y }, B: { x: O.x - 120, y: O.y - 40 },
                                            C: { x: O.x - 120, y: O.y + 40 } });
  const g = C.compute(s);
  check("A at the centre is the inside case", g.inside);
  check("the central angle equals its arc", near(C.deg(g.angle), C.deg(g.arcBC), 1e-6));
  check("the two arcs are equal at the centre", near(g.arcBC, g.arcDE, 1e-6));
}

/* ------------------- 6. a second transcription of the applet's own code */

/*
 * Written straight from the bytecode of AnglesInCircleCanvas.Compute(),
 * AnglesInCircleCanvas$Arc.SetAngle/MoveToFirstCircle/Contains/ToComplement
 * and GeoSDoub.ComputeSignedAngle, without calling the core's helpers.
 */
function appletCompute(state) {
  const O = state.center, R = state.radius, Ro = { x: O.x + R, y: O.y }, A = state.A;
  const d2 = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const length = (p, q) => Math.sqrt(d2(p, q));
  // GeoSDoub.Intersect(DoubCircle, DoubLine): two points on the line, in t order.
  function cut(h) {
    const l = length(A, h) || 1;
    const ux = (h.x - A.x) / l, uy = (h.y - A.y) / l;
    const b = (A.x - O.x) * ux + (A.y - O.y) * uy;
    const c = d2(A, O) - R * R;
    const disc = b * b - c;
    if (disc < -1e-8) return null;
    const s = Math.sqrt(Math.max(0, disc));
    return [{ x: A.x + (-b - s) * ux, y: A.y + (-b - s) * uy },
            { x: A.x + (-b + s) * ux, y: A.y + (-b + s) * uy }];
  }
  const I1 = cut(state.C), I2 = cut(state.B);
  if (!I1 || !I2) return { available: false };
  const inside = length(A, O) < R;
  const ref1 = inside ? state.C : A, ref2 = inside ? state.B : A;
  const nearFar = (I, ref) => length(ref, I[0]) <= length(ref, I[1])
    ? [I[0], I[1]] : [I[1], I[0]];
  const [n1, f1] = nearFar(I1, ref1), [n2, f2] = nearFar(I2, ref2);
  const B = n2, C = n1, D = f2, E = f1;

  // GeoSDoub.ComputeSignedAngle(o,p,q) = orientation * acos(cos), positive
  // when the screen cross product (p-o) x (q-o) is positive.
  function signed(p, q) {
    const cos = (d2(p, O) + d2(q, O) - d2(p, q)) / (2 * length(p, O) * length(q, O));
    const cross = (p.x - O.x) * (q.y - O.y) - (p.y - O.y) * (q.x - O.x);
    const v = Math.acos(Math.max(-1, Math.min(1, cos)));
    return cross > 0 ? v : -v;
  }
  const first = (v) => {
    while (v < 0) v += TAU;
    while (v >= TAU) v -= TAU;
    return v;
  };
  // AnglesInCircleCanvas$Arc.SetAngle(PointStart, PointEnd)
  function arc(start, end) {
    return { Start: first(signed(start, Ro)), Value: signed(end, start) };
  }
  function contains(a, x) {
    const t = first(x);
    if (a.Value > 0) return t >= a.Start && t <= a.Start + a.Value;
    if (a.Value < 0) return t <= a.Start + a.Value && t >= a.Start;
    return false;
  }
  function containsArc(a, b) { return contains(a, b.Start) || contains(a, b.Start + b.Value); }
  // AnglesInCircleCanvas$Arc.ToComplement()
  function complement(a) {
    a.Start += a.Value;
    a.Value = a.Value > 0 ? TAU - a.Value : -TAU - a.Value;
  }
  const arc1 = arc(B, C), arc2 = arc(D, E);
  // Draw(): if one arc contains the other, flip the containing arc.
  if (containsArc(arc1, arc2)) complement(arc1);
  else if (containsArc(arc2, arc1)) complement(arc2);
  return { available: true, B, C, D, E, arc1, arc2 };
}

{
  let bad = 0, n = 0;
  for (let i = 0; i < 4000; i++) {
    const s = C.start({ A: boardPoint(), B: onCircle(boardPoint()), C: onCircle(boardPoint()) });
    const mine = C.appletArcs(s.A, s.B, s.C);
    const their = appletCompute(s);
    if (!mine.available || !their.available) {
      if (mine.available !== their.available) bad++;
      continue;
    }
    n++;
    const samePoints = ["B", "C", "D", "E"].every((k) => near(mine[k].x, their[k].x) && near(mine[k].y, their[k].y));
    const sameArcs = ["Start", "Value"].every((k) =>
      near(mine.arc1[k === "Start" ? "start" : "value"], their.arc1[k], 1e-6) &&
      near(mine.arc2[k === "Start" ? "start" : "value"], their.arc2[k], 1e-6));
    if (!samePoints || !sameArcs) bad++;
  }
  check("the second transcription was compared", n > 1500, `${n} positions`);
  check("the core matches the applet's Compute() and Arc methods", bad === 0, `${bad} of ${n} wrong`);
}

/* ------------------------------------------------- 7. degenerate pictures */

{
  const s = C.start({ A: { x: 20, y: 20 }, B: { x: 300, y: 20 }, C: { x: 300, y: 60 } });
  const g = C.compute(s);
  check("a secant that misses the circle has no arcs", !g.available);
  check("the status asks for a new drag", C.describe(s).includes("Drag the points"));
  const inBoard = C.start({ A: { x: -500, y: 999 }, B: { x: -500, y: 999 }, C: { x: 999, y: 999 } });
  check("the start clamps into the board", inBoard.A.x >= C.MIN_X && inBoard.A.x <= C.MAX_X &&
                                            inBoard.A.y >= C.MIN_Y && inBoard.A.y <= C.MAX_Y);
  check("clamped handles stay on the board", inBoard.B.x <= C.MAX_X && inBoard.B.y <= C.MAX_Y &&
                                              inBoard.C.x >= C.MIN_X && inBoard.C.y >= C.MIN_Y);
}

done("angles-in-circle");
