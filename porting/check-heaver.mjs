#!/usr/bin/env node
"use strict";

/*
 * Logic test for heaver/heaver-core.js.
 *
 *   node porting/check-heaver.mjs
 *
 * 1. the applet's panel: the four occlusion choices, five turning shapes,
 *    three scrollbar ranges, defaults and Java's Math.round;
 * 2. a SECOND transcription of HeaverCanvas.reset, CreateFixSQ/TR/HEX/PENTA,
 *    CreateRotSQ/TR/HEX/PENTA/STAR, SetHole and DrawRotated, compared with the
 *    core on every one of the 4 x 5 x 81 configurations and six animation
 *    steps on two different canvas sizes;
 * 3. the page's claims: the turning shape never really grows (every vertex
 *    stays the same distance from the centre), yet the part visible through
 *    the four-square opening periodically swells and returns, and the six
 *    triangles really do form a hexagon;
 * 4. edge cases: slider clamping, the 200-step wrap, handle scrubbing and
 *    immutability of the position.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("heaver/heaver-core.js", "HeaverCore");
const TAU = 2 * Math.PI;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const P = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const samePoints = (a, b) => a.length === b.length &&
  a.every((p, i) => p.x === b[i].x && p.y === b[i].y);
const samePolys = (a, b) => a.length === b.length && a.every((p, i) => samePoints(p, b[i]));

/* ------------------------------------------------------------ 1. the panel */

{
  const s = C.start();
  equal("the opening panel is Squares / Square / 5 / 40 / 255 / step 0",
    [s.fix, s.rot, s.gap, s.speed, s.opacity, s.frame], [0, 0, 5, 40, 255, 0]);
  check("the page's 500 by 300 applet size and 200 animation steps are kept",
    C.WIDTH === 500 && C.HEIGHT === 300 && C.N === 200);
  check("the three AWT scrollbar ranges are 0..80, 0..200 and 0..255",
    C.GAP.MIN === 0 && C.GAP.MAX === 80 && C.SPEED.MAX === 200 &&
    C.OPACITY.MIN === 0 && C.OPACITY.MAX === 255);
  check("SetHole maps slider value 5 to an opening of 13, and 80 to 163",
    C.holeSize(s) === 13 && C.holeSize(C.option(s, "gap", 80)) === 163);
  check("Java Math.round rounds halves up, including negative halves",
    C.round(2.5) === 3 && C.round(-2.5) === -2 && C.round(-2.6) === -3);
  equal("the occlusion labels follow the applet's four checkboxes",
    C.FIX_NAMES, ["Squares", "4 triangles", "6 triangles", "5 triangles"]);
  equal("the turning-shape labels follow the applet's five checkboxes",
    C.ROT_NAMES, ["Square", "Triangle", "Hexagon", "Pentagon", "Star"]);
  check("every occlusion and shape number is in range",
    C.start({ fix: 99, rot: -4 }).fix === 3 && C.start({ fix: 99, rot: -4 }).rot === 0);
}

/* ---------------- 2. a second transcription, written straight from javap */

const J = {
  /* GeoSDoub.Rotate: dir multiplies the sine term, as in the class bytecode. */
  rotate(c, p, a, dir) {
    const co = Math.cos(a), si = Math.sin(a);
    return {
      x: c.x + co * (p.x - c.x) - dir * si * (p.y - c.y),
      y: c.y + dir * si * (p.x - c.x) + co * (p.y - c.y),
    };
  },
  dist2(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2; },
  dist(a, b) { return Math.sqrt(this.dist2(a, b)); },
  P(x, y) { return { x: Math.round(x), y: Math.round(y) }; },

  /* CreateFixSQ(double side): a = round(side - hole/2), b = round(a + hole). */
  fixSQ(c, side, hole) {
    const a = Math.round(side - hole / 2);
    const b = Math.round(a + hole);
    const x = c.x - side, y = c.y - side;
    return [
      [this.P(x, y), this.P(x + a, y), this.P(x + a, y + a), this.P(x, y + a)],
      [this.P(x + b, y), this.P(x + b + a, y), this.P(x + b + a, y + a), this.P(x + b, y + a)],
      [this.P(x + b, y + b), this.P(x + b + a, y + b), this.P(x + b + a, y + b + a), this.P(x + b, y + b + a)],
      [this.P(x, y + b), this.P(x + a, y + b), this.P(x + a, y + b + a), this.P(x, y + b + a)],
    ];
  },

  /* CreateFixTR: four corner triangles and a smaller one below the centre. */
  fixTR(c, side, hole) {
    const d = 3 * side / 2;
    const p = { x: c.x, y: c.y - d };
    const q = this.rotate(c, p, 2.0943951023931953, 1);
    const r = this.rotate(c, p, 2.0943951023931953, -1);
    const D = this.dist(p, q);
    const t = (D - hole) / 2;
    const k = t / D;
    const tip = (v, u, w) => this.P(v.x, v.y);
    const shrink = (v, u) => this.P(v.x + (u.x - v.x) * k, v.y + (u.y - v.y) * k);
    const mid = { x: c.x, y: c.y + t / Math.sqrt(3) };
    return [
      [tip(p), shrink(p, q), shrink(p, r)],
      [tip(q), shrink(q, p), shrink(q, r)],
      /* the bytecode's first corner of Fixed[2] is (r.x, q.y) */
      [this.P(r.x, q.y), this.P(r.x + (p.x - r.x) * k, r.y + (p.y - r.y) * k),
        this.P(r.x + (q.x - r.x) * k, r.y + (q.y - r.y) * k)],
      [this.P(mid.x, mid.y), this.P(this.rotate(c, mid, 2.0943951023931953, 1).x,
        this.rotate(c, mid, 2.0943951023931953, 1).y),
        this.P(this.rotate(c, mid, 2.0943951023931953, -1).x,
          this.rotate(c, mid, 2.0943951023931953, -1).y)],
    ];
  },

  /* CreateFixHEX: six triangles rotated by one sixth of a turn. */
  fixHEX(c, side, hole) {
    const d = 4 * side / 3;
    const u = (2 * d / Math.sqrt(3) - hole) / 2;
    let p = { x: c.x - u, y: c.y - d };
    let q = { x: c.x + u, y: c.y - d };
    let r = this.rotate(c, q, 1.0471975511965976, -1);
    const out = [];
    for (let i = 0; i < 6; i++) {
      out.push([this.P(p.x, p.y), this.P(q.x, q.y), this.P(r.x, r.y)]);
      p = this.rotate(c, p, 1.0471975511965976, 1);
      q = this.rotate(c, q, 1.0471975511965976, 1);
      r = this.rotate(c, r, 1.0471975511965976, 1);
    }
    return out;
  },

  /* CreateFixPENTA: five triangles rotated by one fifth of a turn. */
  fixPENTA(c, side, hole) {
    const d = 3 * side / 2;
    const u = d * Math.sin(0.6283185307179586) - hole;
    const v = d * Math.cos(0.6283185307179586);
    let p = { x: c.x - u, y: c.y - v };
    let q = { x: c.x + u, y: c.y - v };
    let r = { x: c.x, y: c.y - hole };
    const out = [];
    for (let i = 0; i < 5; i++) {
      out.push([this.P(p.x, p.y), this.P(q.x, q.y), this.P(r.x, r.y)]);
      p = this.rotate(c, p, 1.2566370614359172, 1);
      q = this.rotate(c, q, 1.2566370614359172, 1);
      r = this.rotate(c, r, 1.2566370614359172, 1);
    }
    return out;
  },

  /* CreateRot*: SPoly before DrawRotated turns it. */
  rotBase(rot, c, side) {
    const d = 2 * side / 3;
    if (rot === 0) {
      const h = d / Math.sqrt(2);
      return [this.P(c.x + h, c.y - h), this.P(c.x + h, c.y + h),
        this.P(c.x - h, c.y + h), this.P(c.x - h, c.y - h)];
    }
    if (rot === 1) {
      const p = { x: c.x, y: c.y - d };
      return [p, this.rotate(c, p, 2.0943951023931953, 1),
        this.rotate(c, p, 2.0943951023931953, -1)];
    }
    if (rot === 2) {
      const inner = d / Math.sqrt(3);
      const out = [];
      for (let i = 0; i < 6; i++) {
        const a = 1.0471975511965976 * i;
        out.push({ x: c.x + d * Math.cos(a), y: c.y + d * Math.sin(a) });
        out.push({ x: c.x + inner * Math.cos(a + 0.5235987755982988),
          y: c.y + inner * Math.sin(a + 0.5235987755982988) });
      }
      return out;
    }
    const out = [];
    const step = rot === 3 ? 2 : 4;
    for (let i = 0; i < 5; i++) {
      const a = step * i * Math.PI / 5;
      out.push({ x: c.x + d * Math.cos(a), y: c.y + d * Math.sin(a) });
    }
    return out;
  },

  /* reset() + DrawRotated(): I * 2*pi/N clockwise, rounded once more. */
  draw(state, w, h) {
    const side = Math.min(w, h) / 3;
    const hole = 2 * state.gap + 3; // SetHole
    const c = state.fix === 1
      ? { x: w / 2, y: h / 2 + h / 10 }
      : { x: w / 2, y: h / 2 };
    let fixed;
    if (state.fix === 0) fixed = this.fixSQ(c, side, hole);
    else if (state.fix === 1) fixed = this.fixTR(c, side, hole);
    else if (state.fix === 2) fixed = this.fixHEX(c, side, hole);
    else fixed = this.fixPENTA(c, side, hole);
    const angle = state.frame * Math.PI * 2 / C.N;
    const spinning = this.rotBase(state.rot, c, side).map((p) => {
      const q = this.rotate(c, p, angle, 1);
      return this.P(q.x, q.y);
    });
    return { center: c, fixed: fixed, spinning: spinning };
  },
};

{
  const frames = [0, 1, 17, 50, 137, 199];
  const sizes = [[500, 300], [437, 313]];
  let fixedBad = 0, spinBad = 0, centreBad = 0, checked = 0;
  for (let fix = 0; fix < 4; fix++) {
    for (let rot = 0; rot < 5; rot++) {
      for (let gap = 0; gap <= 80; gap++) {
        for (const [w, h] of sizes) {
          for (const frame of frames) {
            const state = C.start({ fix, rot, gap, frame });
            const mine = C.geometry(state, w, h);
            const theirs = J.draw(state, w, h);
            checked++;
            if (!samePolys(mine.fixed, theirs.fixed)) fixedBad++;
            if (!samePoints(mine.spinning, theirs.spinning)) spinBad++;
            if (mine.center.x !== theirs.center.x || mine.center.y !== theirs.center.y) centreBad++;
          }
        }
      }
    }
  }
  check(`the fixed occluders match a second bytecode transcription in all ${checked} configurations`,
    fixedBad === 0, `${fixedBad} mismatches`);
  check(`DrawRotated matches the second transcription in all ${checked} configurations`,
    spinBad === 0, `${spinBad} mismatches`);
  check("reset() puts the centre in the same place, including the h/10 shift",
    centreBad === 0, `${centreBad} mismatches`);
  check("the tall case really exercises the h/10 centre shift",
    J.draw(C.start({ fix: 1 }), 437, 313).center.y === 313 / 2 + 313 / 10);
}

/* ----------------------------------- 3. the page's claims, checked exhaustively */

/* Sutherland-Hodgman clipping of the turning polygon against x >= lo and
   x <= hi: the vertical opening left by the four fixed squares. */
function clipX(poly, bound, keepGreater) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = keepGreater ? a.x - bound : bound - a.x;
    const db = keepGreater ? b.x - bound : bound - b.x;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function visibleSpan(s, state, w, h, frame) {
  const g = C.geometry(C.option(state, "frame", frame), w, h);
  const angle = frame * TAU / C.N;
  const turned = g.base.map((p) => C.rotate(g.center, p, angle, 1));
  let clipped = clipX(turned, g.center.x - g.hole / 2, true);
  clipped = clipX(clipped, g.center.x + g.hole / 2, false);
  return Math.max(...clipped.map((p) => p.y)) - Math.min(...clipped.map((p) => p.y));
}

{
  const state = C.start(); // four squares over a turning square, hole 13
  const w = C.WIDTH, h = C.HEIGHT;
  const spans = Array.from({ length: C.N }, (_, f) => visibleSpan(C, state, w, h, f));
  check("the visible square really swells: an eighth turn is over 30% taller",
    spans[25] > spans[0] * 1.3 && spans[75] > spans[50] * 1.3,
    `${spans[0].toFixed(2)} -> ${spans[25].toFixed(2)}`);
  check("the visible square shrinks back: steps 0, 50 and 100 agree",
    near(spans[0], spans[50], 1e-7) && near(spans[0], spans[100], 1e-7));
  check("the swell repeats every 50 of the applet's 200 steps",
    spans.every((v, f) => near(v, spans[(f + 50) % C.N], 1e-7)));
  check("the smallest visible size is at the whole quarter turns, the largest at the eighth turns",
    spans.indexOf(Math.min(...spans)) === 0 &&
    Math.max(...spans) - Math.min(spans[25], spans[75]) < 1e-6);

  /* The real polygon has a fixed size in every configuration. */
  let radiusBad = 0;
  for (let rot = 0; rot < 5; rot++) {
    for (let frame = 0; frame < C.N; frame++) {
      const st = C.start({ rot, frame });
      const g = C.geometry(st, w, h);
      const original = g.base.map((p) => P(g.center, p));
      const now = g.base.map((p) => P(g.center, C.rotate(g.center, p, frame * TAU / C.N, 1)));
      if (!original.every((r, i) => near(r, now[i], 1e-8))) radiusBad++;
    }
  }
  check("no turning shape ever really expands: all 1000 steps keep every radius",
    radiusBad === 0, `${radiusBad} changes`);

  /* The six occluding triangles form a regular hexagon when unrounded. */
  const hex = J.fixHEX({ x: 250, y: 150 }, 100, 13);
  const outer = [];
  for (const tri of hex) outer.push({ x: tri[1].x, y: tri[1].y });
  const radii = outer.map((p) => P({ x: 250, y: 150 }, p));
  const angles = outer.map((p) => Math.atan2(p.y - 150, p.x - 250))
    .map((a) => (a + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b);
  check("six occluders give six equally distant outside corners",
    radii.every((r) => Math.abs(r - radii[0]) < 1.5),
    radii.map((r) => r.toFixed(2)).join(","));
  check("those six corners are spaced a sixth of a turn apart",
    angles.every((a, i) => Math.abs(a - angles[0] - i * Math.PI / 3) < 0.02));

  equal("each occlusion choice keeps the applet's number of covering pieces",
    [0, 1, 2, 3].map((fix) => C.geometry(C.start({ fix })).fixed.length), [4, 4, 6, 5]);
  equal("the five turning shapes have 4, 3, 12, 5 and 5 vertices",
    [0, 1, 2, 3, 4].map((rot) => C.geometry(C.start({ rot })).spinning.length), [4, 3, 12, 5, 5]);
  check("mismatched shapes really do draw a different aperture",
    !samePolys(C.geometry(C.start({ fix: 0 })).fixed, C.geometry(C.start({ fix: 2 })).fixed) &&
    !samePolys(C.geometry(C.start({ rot: 0 })).spinning, C.geometry(C.start({ rot: 1 })).spinning));
  check("the status line names the shapes, hole and step",
    /Squares cover a turning square · opening 13 px · step 0 of 200/.test(C.describe(C.start())));
}

/* --------------------------------------------------- 4. edges and input */

{
  const s = C.start();
  for (const [key, bounds] of [["gap", C.GAP], ["speed", C.SPEED], ["opacity", C.OPACITY]]) {
    check(`${key} clamps below its minimum`, C.option(s, key, bounds.MIN - 30)[key] === bounds.MIN);
    check(`${key} clamps above its maximum`, C.option(s, key, bounds.MAX + 30)[key] === bounds.MAX);
  }
  check("a bad slider value keeps the old one instead of writing NaN",
    C.option(s, "gap", "not a number").gap === 5);
  let at = s;
  for (let i = 0; i < C.N; i++) at = C.advance(at);
  check("the animation wraps from step 199 back to 0", at.frame === 0 && s.frame === 0);
  check("a panel change does not restart the animation",
    C.option(C.start({ frame: 137 }), "fix", 2).frame === 137);
  const c = C.geometry(s).center;
  check("the scrub handle reads step 0 to the right and step 50 below the centre",
    C.frameFromPoint({ x: c.x + 100, y: c.y }, c) === 0 &&
    C.frameFromPoint({ x: c.x, y: c.y + 100 }, c) === 50);
  check("the scrub handle wraps a point above the centre to the last steps",
    C.frameFromPoint({ x: c.x, y: c.y - 100 }, c) === 150);
  const before = JSON.stringify(s);
  C.geometry(s, 500, 300);
  C.advance(s);
  C.option(s, "rot", 4);
  check("no core function mutates the position it is given", JSON.stringify(s) === before);
}

done("heaver");
