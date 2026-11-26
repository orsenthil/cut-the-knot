#!/usr/bin/env node
"use strict";

/*
 * Logic test for archimedes-lever/archimedes-lever-core.js.
 *
 *   node porting/check-archimedes-lever.mjs
 *
 * The page's claims are checked for every pair of weights 1..25 with both
 * settings of the GCD toggle (1,250 diagrams): the unit weights are evenly
 * spaced and centred on the original weights, the fulcrum is the midpoint of
 * the row, the two turning effects are equal there, the common unit makes no
 * difference to *where between the weights* the fulcrum lies, and moving the
 * fulcrum tips the heavier side down. Section 4 is a second, literal
 * transcription of ArchimedesLeverCanvas.Reset from the bytecode, compared
 * with the core field by field over the whole parameter space.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("archimedes-lever/archimedes-lever-core.js", "ArchimedesLeverCore");
const near = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  check("the applet starts with weights 3 and 4", s.NP === 3 && s.NQ === 4);
  check("the GCD toggle starts off", s.useGCD === false);
  const m = C.measure(s);
  equal("3 and 4 use seven unit weights", [m.unit, m.np, m.nq, m.total], [1, 3, 4, 7]);
  check("the row is spaced by (400 - 40) / 6 = 60", m.spacing === 60);
  check("the left weight is the centre of the first three units", near(m.xP, 80));
  check("the right weight is the centre of the last four units", near(m.xQ, 290));
  check("the fulcrum is the middle unit of the row", near(m.balance, 200) && near(m.xF, m.balance));
  check("the fulcrum cuts the gap in the ratio 4:3", near(m.leftDistance / m.rightDistance, 4 / 3));
  check("the two turning effects match at the fulcrum", near(m.leftTurn, m.rightTurn) && m.balanced);
  check("the original weights are circles of radius sqrt(w) * 10", near(m.rP, Math.sqrt(3) * 10) && near(m.rQ, 20));
  check("3 and 4 have no common factor to toggle", m.gcdAvailable === false);
  check("6 and 8 do", C.measure(C.start({ NP: 6, NQ: 8 })).gcdAvailable === true);
  check("weights are clamped to 1..25", C.start({ NP: 0, NQ: 99 }).NP === 1 &&
    C.start({ NP: 0, NQ: 99 }).NQ === 25);
  const moved = C.snapFulcrum(C.moveHandle(s, "F", { x: 240 }));
  check("dragging the fulcrum right tips the heavy left side down", C.measure(C.moveHandle(s, "F", { x: 240 })).tilt === -1);
  check("the snap button restores balance", C.measure(moved).balanced);
  check("toggling an unavailable GCD does nothing", C.toggleGCD(s) === s);
  const g = C.toggleGCD(C.start({ NP: 6, NQ: 8 }));
  equal("6 and 8 with GCD use three and four units of two",
    [C.measure(g).unit, C.measure(g).np, C.measure(g).nq], [2, 3, 4]);
  check("reset restores 3 and 4", C.reset(g).NP === 3 && C.reset(g).NQ === 4);
}

/* ------------------------------------------------ 2. the page's claims */

{
  let total = 0;
  let badUnit = 0, badCount = 0, badCentre = 0, badSpacing = 0, badMidpoint = 0;
  let badWeighted = 0, badMoment = 0, badRatio = 0, badArea = 0, badUnitMoment = 0;
  let badGCD = 0, badTilt = 0, badSnap = 0, badDrag = 0;
  for (let NP = 1; NP <= 25; NP++) {
    for (let NQ = 1; NQ <= 25; NQ++) {
      for (const useGCD of [false, true]) {
        total++;
        const s = C.start({ NP: NP, NQ: NQ, useGCD: useGCD });
        const m = C.measure(s);
        const common = C.gcd(NP, NQ);
        const unit = useGCD && common > 1 ? common : 1;
        if (m.unit !== unit) badUnit++;
        if (m.np !== NP / unit || m.nq !== NQ / unit || m.units.length !== NP / unit + NQ / unit) badCount++;
        /* The replacement units keep the centre of gravity of each weight. */
        const first = m.units.slice(0, m.np), last = m.units.slice(m.np);
        const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        if (!near(mean(first), m.xP) || !near(mean(last), m.xQ)) badCentre++;
        for (let i = 1; i < m.units.length; i++) {
          if (!near(m.units[i] - m.units[i - 1], m.spacing)) badSpacing++;
        }
        /* The fulcrum is the midpoint of the two extreme unit weights. */
        const mid = (m.units[0] + m.units[m.units.length - 1]) / 2;
        if (!near(m.balance, mid) || !near(m.xF, mid)) badMidpoint++;
        /* ...and the weighted mean of the two original weights. */
        const weighted = (NP * m.xP + NQ * m.xQ) / (NP + NQ);
        if (!near(m.balance, weighted)) badWeighted++;
        /* Equilibrium: equal and opposite moments, equal turning "areas". */
        if (!near(m.moment, 0) || !m.balanced) badMoment++;
        if (!near(m.unitMoment, 0)) badUnitMoment++;
        if (!near(NP * m.leftDistance, NQ * m.rightDistance)) badRatio++;
        if (!near(m.leftArea, m.rightArea)) badArea++;
        /* The same common unit must not change the *relative* fulcrum. */
        const other = C.measure(C.start({ NP: NP, NQ: NQ, useGCD: !useGCD }));
        const fraction = (m.balance - m.xP) / (m.xQ - m.xP);
        const otherFraction = (other.balance - other.xP) / (other.xQ - other.xP);
        if (!near(fraction, NQ / (NP + NQ)) || !near(fraction, otherFraction)) badGCD++;
        /* Move the fulcrum either way: the side with the bigger turn goes down. */
        for (const d of [-m.spacing / 3, m.spacing / 3]) {
          const t = C.measure(C.moveHandle(s, "F", { x: m.xF + d }));
          if (t.tilt !== (d < 0 ? 1 : -1) || !near(C.measure(C.snapFulcrum(C.moveHandle(s, "F", { x: m.xF + d }))).moment, 0)) badTilt++;
        }
        /* Dragging a weight rebuilds the row around it, evenly, and still balances. */
        const dragged = C.moveHandle(s, NP <= NQ ? "P" : "Q", { x: m.margin + 10 });
        const dm = C.measure(dragged);
        const snapped = C.measure(C.snapFulcrum(dragged));
        if (dm.units.some((x) => !Number.isFinite(x)) || dm.units.length !== m.total) badDrag++;
        if (!near(snapped.moment, 0) || !near(snapped.balance, snapped.xF)) badSnap++;
      }
    }
  }
  check(`${total} diagrams have the applet's unit size`, badUnit === 0, `${badUnit} wrong`);
  check(`${total} diagrams have the right number of unit weights`, badCount === 0, `${badCount} wrong`);
  check("each block of units is centred on its original weight", badCentre === 0, `${badCentre} wrong`);
  check("the unit weights are evenly spaced", badSpacing === 0, `${badSpacing} wrong`);
  check("the fulcrum is halfway between the extreme units", badMidpoint === 0, `${badMidpoint} wrong`);
  check("the fulcrum is the weighted mean of the two weights", badWeighted === 0, `${badWeighted} wrong`);
  check("the two moments cancel at the fulcrum", badMoment === 0, `${badMoment} wrong`);
  check("the units and the originals have the same moment", badUnitMoment === 0, `${badUnitMoment} wrong`);
  check("distance is inversely proportional to weight: NP*dP = NQ*dQ", badRatio === 0, `${badRatio} wrong`);
  check("the left and right turning areas agree at balance", badArea === 0, `${badArea} wrong`);
  check("choosing the largest common unit keeps the same point between the weights", badGCD === 0, `${badGCD} wrong`);
  check("moving the fulcrum tips the side with the larger turn down", badTilt === 0, `${badTilt} wrong`);
  check("dragging a weight keeps the construction finite", badDrag === 0, `${badDrag} wrong`);
  check("snapping the fulcrum always restores equilibrium", badSnap === 0, `${badSnap} wrong`);

  const threeFour = C.measure(C.start({ NP: 3, NQ: 4 }));
  check("3:4 balances at 4:3, as the page says", near(threeFour.leftDistance / threeFour.rightDistance, 4 / 3));
  const sixEight = [1, 2].map((unit) => {
    const s = C.start({ NP: 6, NQ: 8, useGCD: unit === 2 });
    const m = C.measure(s);
    return (m.balance - m.xP) / (m.xQ - m.xP);
  });
  check("6 and 8 with unit 1 or 2 give the same 8:6 = 4:3 point", near(sixEight[0], sixEight[1]) && near(sixEight[0], 8 / 14));
}

/* --------------- 3. the same answers as the applet's own Reset() method */

/* Literal second transcription of ArchimedesLeverCanvas.Reset (bytecode). */
function appletReset(NP, NQ, useGCD, W, H) {
  function ownGcd(a, b) {
    while (b !== 0) { const t = a % b; a = b; b = t; }
    return a;
  }
  let g = ownGcd(NP, NQ);                       // local 2
  g = useGCD ? g : 1;                           // UseGCD ? gcd : 1
  const NPInUse = (NP / g) | 0;                 // local 3's two parts
  const NQInUse = (NQ / g) | 0;
  const L3 = NPInUse + NQInUse;
  const S4 = Math.sqrt(NP) * 10.0;              // radius of the P circle
  const S6 = Math.sqrt(NQ) * 10.0;              // radius of the Q circle
  const S8 = Math.sqrt(g) * 10.0;               // radius of a unit circle
  const Margin = Math.trunc(S8 > 20 ? S8 + 3.0 : 20);
  const S10 = W - 2 * Margin;
  const L11 = (S10 / (L3 - 1)) | 0;             // Java integer division, in dstore 11
  const DX = L11 / 2.0;
  const PW = { x: Margin + (L11 * (NPInUse - 1)) / 2.0, y: Math.trunc(H / 3) - S4, r: S4 };
  const QW = { x: Margin + L11 * (L3 - (NQInUse + 1) / 2.0), y: Math.trunc(H / 3) - S6, r: S6 };
  const PWLow = { x: PW.x, y: Math.trunc((4 * H) / 5) - S4, r: S4 };
  const QWLow = { x: QW.x, y: Math.trunc((4 * H) / 5) - S6, r: S6 };
  const Level2 = [];
  for (let i = 0; i < L3; i++) {
    Level2.push({ x: Margin + i * L11, y: Math.trunc(H / 2) - S8, r: S8 });
  }
  /* DrawFalcrum uses Margin + DX * (NPInUse + NQInUse - 1). */
  const fulcrumX = Margin + DX * (L3 - 1);
  return { g, NPInUse, NQInUse, L3, Margin, L11, DX, PW, QW, PWLow, QWLow, Level2, fulcrumX };
}

{
  let bad = 0, cases = 0;
  const badFields = { unit: 0, np: 0, nq: 0, spacing: 0, margin: 0, p: 0, q: 0, fulcrum: 0, units: 0, radii: 0 };
  for (let NP = 1; NP <= 25; NP++) {
    for (let NQ = 1; NQ <= 25; NQ++) {
      for (const useGCD of [false, true]) {
        cases++;
        const a = appletReset(NP, NQ, useGCD, C.WIDTH, C.HEIGHT);
        const m = C.measure(C.start({ NP: NP, NQ: NQ, useGCD: useGCD }));
        if (m.unit !== a.g) badFields.unit++;
        if (m.np !== a.NPInUse) badFields.np++;
        if (m.nq !== a.NQInUse) badFields.nq++;
        if (m.spacing !== a.L11) badFields.spacing++;
        if (!near(m.balance, a.fulcrumX)) badFields.fulcrum++;
        if (!near(m.xP, a.PW.x)) badFields.p++;
        if (!near(m.xQ, a.QW.x)) badFields.q++;
        if (!near(m.rP, a.PW.r) || !near(m.rQ, a.QW.r) || !near(m.rUnit, a.Level2[0].r)) badFields.radii++;
        for (let i = 0; i < a.L3; i++) {
          if (!near(m.units[i], a.Level2[i].x)) badFields.units++;
        }
      }
    }
  }
  bad = Object.values(badFields).reduce((x, y) => x + y, 0);
  for (const [field, count] of Object.entries(badFields)) {
    check(`${cases} bytecode layouts agree on ${field}`, count === 0, `${count} wrong`);
  }
  check("the whole transcription agrees with the core", bad === 0, `${bad} wrong`);
}

done("archimedes-lever");
