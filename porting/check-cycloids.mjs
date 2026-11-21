#!/usr/bin/env node
"use strict";

/*
 * Logic test for cycloids/cycloids-core.js.
 *
 *   node porting/check-cycloids.mjs
 *
 * Both of the applet's methods (the closed form and the step-by-step rotation)
 * agree for every kind, every ratio the buttons allow and every speed, over
 * hundreds of steps and many marks; FindAngle equals atan2. The classical facts
 * that the curves must show, for a disc rolling without slipping (V = 1): a mark
 * on the rim of the rolling disc touches the line once every 2 pi r and the arch
 * is 8 r long and encloses 3 pi r^2; the hypocycloid with R/r = k has k cusps
 * (2: a straight line through the centre, 3: the deltoid, 4: the astroid
 * x^(2/3) + y^(2/3) = R^(2/3)), the epicycloid with R/r = k also k cusps (1: the
 * cardioid); a mark inside the disc makes a curtate curve without cusps and one
 * outside makes loops; V = 0 stops the spin (the marks run round a circle); the
 * ratio and speed buttons keep to the applet's limits.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("cycloids/cycloids-core.js", "CycloidsCore");
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));

/** A disc of the given kind with one mark on the rim (distance d about the disc's centre, at angle phi). */
function withMark(kind, ratio, speed, d, phi, extra) {
  const s = { ...C.start({ kind, ratio, speed, ...(extra || {}) }) };
  s.marks = [{ dist: d, angle: phi, t0: 0, id: 0 }];
  return s;
}

/* ------------------------------------------------------------ the rules */
{
  const s = C.start();
  check("a new game is not over", C.result(s) === null);
  equal("opens as a regular cycloid with V = 1, r = 30, no marks", [s.kind, s.speed, s.r, s.marks.length, s.time], ["regular", 1, 30, 0, 0]);
  const c0 = C.centreAt(s, 0), c1 = C.centreAt(s, 10);
  equal("the regular disc starts at the left margin on the ground and moves 2 pixels a step", [c0.x, c0.y, c1.x - c0.x], [40, 310, 20]);
  const st = C.move(s, { type: "step" });
  check("a step advances time and marks the demo explored", st.time === 1 && st.explored && st.moves === 1);
  check("the old position is untouched", s.time === 0 && !s.explored);
  const m = C.move(s, { type: "mark", x: 40, y: 280 });
  check("a click adds a mark at its distance and angle about the disc's centre", m && m.marks.length === 1 && near(m.marks[0].dist, 30) && near(m.marks[0].angle, -Math.PI / 2));
  check("a click on the disc's centre adds nothing", C.move(s, { type: "mark", x: 40, y: 310 }) === null);
  let full = s;
  for (let i = 0; i < C.MAX_POINTS; i++) full = C.move(full, { type: "mark", x: 70 + i, y: 250 });
  check(`at most ${C.MAX_POINTS} marks`, full.marks.length === 50 && C.move(full, { type: "mark", x: 100, y: 100 }) === null);
  check("bad moves are refused", C.move(s, null) === null && C.move(s, { type: "kind", value: "x" }) === null && C.move(s, { type: "mark", x: NaN, y: 1 }) === null && C.move(s, { type: "formula", value: 1 }) === null && C.move(s, { type: "nope" }) === null);
  // The kinds and the ratio buttons.
  check("the ratio buttons are for hypo and epi only", C.move(s, { type: "ratio", dir: 1 }) === null && C.move(C.move(s, { type: "kind", value: "epi" }), { type: "ratio", dir: 1 }).ratio === 3);
  const hypo = C.move(s, { type: "kind", value: "hypo" });
  equal("a hypocycloid starts at R/r = 2 and cannot go below it", [hypo.ratio, C.move(hypo, { type: "ratio", dir: -1 })], [2, null]);
  const epi = C.move(s, { type: "kind", value: "epi" });
  equal("an epicycloid starts at 2 and can go down to 1 but not 0", [C.move(epi, { type: "ratio", dir: -1 }).ratio, C.move(C.move(epi, { type: "ratio", dir: -1 }), { type: "ratio", dir: -1 })], [1, null]);
  equal("the ratio stops at 12", C.move(C.move(epi, { type: "ratio", value: 12 }), { type: "ratio", dir: 1 }), null);
  equal("the speed text is V or 1/|V|", [3, 2, 1, 0, -2, -3].map(C.speedText), ["3", "2", "1", "0", "1/2", "1/3"]);
  equal("the spin factor is V, 1/|V|, or none", [3, 1, 0, -2, -4].map(C.spinFactor), [3, 1, 0, 0.5, 0.25]);
  check("speed stays in range", C.move(s, { type: "speed", value: 10 }) === null && C.move(s, { type: "speed", value: -10 }) === null && C.move(s, { type: "speed", dir: -1 }).speed === 0);
  const r = C.move(C.move(m, { type: "step", count: 40 }), { type: "reset" });
  check("reset clears marks and time", r.marks.length === 0 && r.time === 0 && !r.explored);
  equal("a mark that has been drawing for 30 steps makes it done", C.result(C.move(m, { type: "step", count: 30 })), "done");
  equal("fewer steps do not", C.result(C.move(m, { type: "step", count: 29 })), null);
}

/* -------------------------------------------------- every case, where small */
{
  // The two methods agree, for every kind, ratio and speed.
  let worst = 0, n = 0;
  const marks = [[10, 0], [30, 1.2], [45, -2.4], [12.5, 3]];
  for (const kind of C.KINDS) {
    const ratios = kind === "regular" ? [2] : Array.from({ length: C.MAX_RATIO - C.minRatio(kind) + 1 }, (_, i) => C.minRatio(kind) + i);
    for (const ratio of ratios) for (let speed = C.MIN_SPEED; speed <= C.MAX_SPEED; speed += 1) for (const [d, phi] of marks) {
      const s = withMark(kind, ratio, speed, d, phi);
      for (const t of [1, 7, 90, 180, 360]) {
        n++;
        const a = C.markAt(s, s.marks[0], t), b = C.markIncremental(s, s.marks[0], t);
        worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
  }
  check(`the formula and step-by-step methods agree everywhere (${n} cases; worst gap ${worst.toExponential(1)} pixels)`, worst < 1e-6);

  // FindAngle equals atan2 over a ring of points.
  let bad = 0;
  for (let k = 0; k < 3600; k++) {
    const t = (k / 3600) * 2 * Math.PI - Math.PI + 1e-7;
    const a = C.findAngle(Math.cos(t) * 17, Math.sin(t) * 17, 17);
    if (Math.abs(a - Math.atan2(Math.sin(t), Math.cos(t))) > 1e-9 && Math.abs(Math.abs(a - Math.atan2(Math.sin(t), Math.cos(t))) - 2 * Math.PI) > 1e-9) bad++;
  }
  equal("FindAngle (asin/acos) equals atan2 at 3600 angles", bad, 0);

  // The regular cycloid: rim mark touches the ground every 2 pi r; arch length 8 r; area 3 pi r^2.
  const r = 30;
  const reg = withMark("regular", 2, 1, r, Math.PI / 2); // mark at the bottom of the disc, on the ground
  const ground = C.H - C.MARGIN;
  const first = C.markAt(reg, reg.marks[0], 0);
  check("the rim mark starts on the ground", near(first.y, ground, 1e-9));
  // The disc rolls Delta pixels a step and turns Delta / r radians: after 2 pi r / Delta steps it is back on the ground.
  const period = (2 * Math.PI * r) / C.DELTA;
  const back = C.markAt(reg, reg.marks[0], period);
  check("after the disc has rolled one circumference the mark is on the ground again, 2 pi r on", near(back.y, ground, 1e-6) && near(back.x - first.x, 2 * Math.PI * r, 1e-6));
  // Never below the ground; touches it only at the cusps.
  let low = 0;
  for (let k = 0; k <= 4 * period; k += 0.25) { const p = C.markAt(reg, reg.marks[0], k); low = Math.max(low, p.y - ground); }
  check("the mark never goes below the ground", low < 1e-9);
  // Arch length and area, by fine polygon approximation over one period.
  let len = 0, area = 0;
  const N = 20000;
  let prev = C.markAt(reg, reg.marks[0], 0);
  for (let k = 1; k <= N; k++) {
    const p = C.markAt(reg, reg.marks[0], (period * k) / N);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    area += (ground - (p.y + prev.y) / 2) * (p.x - prev.x); // between the arch and the ground
    prev = p;
  }
  check(`the arch is 8 r long (${len.toFixed(3)} vs ${8 * r}) and encloses 3 pi r^2 (${area.toFixed(1)} vs ${(3 * Math.PI * r * r).toFixed(1)})`, Math.abs(len - 8 * r) < 0.01 && Math.abs(area - 3 * Math.PI * r * r) < 1);
  // Inside and outside marks: curtate (no cusp, no loop) and prolate (loops).
  const loops = (d) => { const s = withMark("regular", 2, 1, d, Math.PI / 2); let back = 0; let px = null; for (let k = 0; k <= period * 2; k += 0.5) { const p = C.markAt(s, s.marks[0], k); if (px !== null && p.x < px - 1e-9) back++; px = p.x; } return back; };
  check("a mark inside the disc never goes backwards (curtate)", loops(15) === 0);
  check("a mark on the rim has cusps and does not go backwards", loops(30) === 0);
  check("a mark outside the disc goes backwards (loops)", loops(45) > 0);
}

{
  // Cusps of hypo and epi cycloids by counting stops of the rim mark (speed of the mark near zero).
  const cusps = (kind, k) => {
    const s = C.start({ kind, ratio: k });
    const r = C.discRadius(s);
    // a mark on the rim at the point where the disc touches the fixed circle at time 0 (the top: distance R from the centre O)
    const top = C.centreAt(s, 0);
    const toward = kind === "epi" ? { x: top.x, y: top.y + r } : { x: top.x, y: top.y - r }; // the touching point
    const phi = C.findAngle(toward.x - top.x, toward.y - top.y, r);
    const withM = { ...s, marks: [{ dist: r, angle: phi, t0: 0, id: 0 }] };
    // one full circuit of the disc's centre is 360 / Delta steps
    const steps = 360 / C.DELTA;
    const speeds = [];
    let prev = C.markAt(withM, withM.marks[0], 0);
    for (let t = 0.01; t <= steps + 1e-9; t += 0.01) { const p = C.markAt(withM, withM.marks[0], t); speeds.push([t, Math.hypot(p.x - prev.x, p.y - prev.y) / 0.01]); prev = p; }
    // cusps: runs of samples where the mark is almost still, counted round the whole circuit
    const typical = speeds.reduce((x, y) => x + y[1], 0) / speeds.length;
    const slow = speeds.map(([, v]) => v < 0.06 * typical);
    let count = 0;
    for (let i = 0; i < slow.length; i++) if (slow[i] && !(i > 0 && slow[i - 1])) count++;
    if (slow[0] && slow[slow.length - 1]) count--; // the cusp at the start is the same as the one at the end
    return count;
  };
  let bad = 0;
  for (const k of [3, 4, 5, 6, 7, 8]) if (cusps("hypo", k) !== k) bad++; // k = 2 is the straight line, checked below
  for (const k of [1, 2, 3, 4, 5, 6]) if (cusps("epi", k) !== k) bad++;
  equal("hypocycloids with R/r = 3..8 and epicycloids with R/r = 1..6 show that many cusps", bad, 0);

  // The astroid (R/r = 4): x^(2/3) + y^(2/3) = R^(2/3) about the fixed centre.
  const s = C.start({ kind: "hypo", ratio: 4 });
  const r = C.discRadius(s);
  const top = C.centreAt(s, 0);
  const phi = C.findAngle(0, -r, r);
  const ast = { ...s, marks: [{ dist: r, angle: phi, t0: 0, id: 0 }] };
  let worst = 0;
  for (let t = 0; t <= 180; t += 0.5) {
    const p = C.markAt(ast, ast.marks[0], t);
    const x = Math.abs(p.x - C.W / 2), y = Math.abs(p.y - C.H / 2);
    worst = Math.max(worst, Math.abs(Math.pow(x, 2 / 3) + Math.pow(y, 2 / 3) - Math.pow(C.FIXED_RADIUS, 2 / 3)));
  }
  check(`R/r = 4 gives the astroid x^(2/3) + y^(2/3) = R^(2/3) (worst error ${worst.toExponential(1)})`, worst < 1e-6);

  // The Tusi couple: R/r = 2 gives a straight line through the centre, traced back and forth.
  const t2 = C.start({ kind: "hypo", ratio: 2 });
  const r2 = C.discRadius(t2);
  const line = { ...t2, marks: [{ dist: r2, angle: C.findAngle(0, -r2, r2), t0: 0, id: 0 }] };
  let off = 0;
  for (let t = 0; t <= 180; t += 0.5) { const p = C.markAt(line, line.marks[0], t); off = Math.max(off, Math.abs(p.x - C.W / 2)); }
  check(`R/r = 2 gives a straight (vertical) line through the centre (worst offset ${off.toExponential(1)})`, off < 1e-6);

  // The cardioid (R/r = 1, epi): r = R and the mark traces a curve through the fixed circle with area 6 pi r^2.
  const card = C.start({ kind: "epi", ratio: 1 });
  const rc = C.discRadius(card);
  const cm = { ...card, marks: [{ dist: rc, angle: C.findAngle(0, rc, rc), t0: 0, id: 0 }] };
  let a2 = 0, prevP = C.markAt(cm, cm.marks[0], 0), len = 0;
  const steps = 360 / C.DELTA, M = 40000;
  for (let k = 1; k <= M; k++) {
    const p = C.markAt(cm, cm.marks[0], (steps * k) / M);
    a2 += (prevP.x * p.y - p.x * prevP.y) / 2; // shoelace about the origin
    len += Math.hypot(p.x - prevP.x, p.y - prevP.y);
    prevP = p;
  }
  check(`the cardioid has length 16 r (${len.toFixed(2)} vs ${16 * rc}) and area 6 pi r^2 (${Math.abs(a2).toFixed(0)} vs ${(6 * Math.PI * rc * rc).toFixed(0)})`, Math.abs(len - 16 * rc) < 0.1 && Math.abs(Math.abs(a2) - 6 * Math.PI * rc * rc) / (6 * Math.PI * rc * rc) < 1e-3);

  // V = 0: no spin of its own, so the mark is carried round with the disc's centre (its direction turns only with the orbit).
  const z = withMark("epi", 3, 0, 20, 0.7);
  let still = 0;
  for (let t = 0; t <= 180; t += 3) {
    const c = C.centreAt(z, t), p = C.markAt(z, z.marks[0], t);
    still = Math.max(still, Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - 20));
    const want = 0.7 + ((C.DELTA * t) * Math.PI) / 180; // the orbit carries it round
    still = Math.max(still, Math.abs(Math.cos(Math.atan2(p.y - c.y, p.x - c.x)) - Math.cos(want)));
  }
  check("with V = 0 the mark keeps its distance and turns only with the orbit", still < 1e-9);
}

/* ----------------------------- the same answers as the applet's own method */
{
  // The applet's numbers: Delta = 2, 50 marks, a tick every 50 ms, the disc 30 pixels, ground margin 10.
  equal("the applet's constants", [C.DELTA, C.MAX_POINTS, C.TICK_MS, C.START_RADIUS, C.MARGIN, C.START_RATIO], [2, 50, 50, 30, 10, 2]);
  // The rolling relation: the epicycloid's disc spins (R + r)/r times as fast as it orbits.
  const s = withMark("epi", 3, 1, 10, 0);
  const t = 90;
  const turn = ((C.DELTA * t) * Math.PI) / 180;
  const a = C.markAt(s, s.marks[0], t), c = C.centreAt(s, t);
  const ang = Math.atan2(a.y - c.y, a.x - c.x);
  const want = turn * (1 + 3); // (R + r)/r = 1 + ratio for V = 1
  check("an epicycloid disc spins (1 + R/r) times as fast as it orbits", near(Math.cos(ang), Math.cos(want), 1e-9) && near(Math.sin(ang), Math.sin(want), 1e-9));
  const h = withMark("hypo", 3, 1, 10, 0);
  const ah = C.markAt(h, h.marks[0], t), ch = C.centreAt(h, t);
  const angh = Math.atan2(ah.y - ch.y, ah.x - ch.x);
  const wanth = turn * (1 - 3);
  check("a hypocycloid disc spins (1 - R/r) times as fast: backwards", near(Math.cos(angh), Math.cos(wanth), 1e-9) && near(Math.sin(angh), Math.sin(wanth), 1e-9));
}

done("cycloids");
