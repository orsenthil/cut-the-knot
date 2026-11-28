#!/usr/bin/env node
"use strict";

/*
 * Logic test for hinged-dissection-of-vase/hinged-dissection-of-vase-core.js.
 *
 *   node porting/check-hinged-dissection-of-vase.mjs
 *
 * Two independent sources are compared here.
 *
 * 1. A second, literal transcription of HingedDissectionOfVaseCanvas.init(),
 *    Draw(), FillArc(), DrawArc() and DrawRadius(): Cx/Cy/R with Java integer
 *    division, the three sector centres (including the blue sector's odd
 *    half-pixel and (2*Angle+1)-degree corrections), the sector start angles,
 *    the neck arcs and the square's corners. Every one of 181 scroll-bar
 *    positions is checked on 20 board sizes, both against the core and for
 *    the arc endpoints that have to meet.
 *
 * 2. The cut-the-knot page's claim, verified analytically: the vase is a
 *    3/4 disk plus a neck whose three quarter-circle bulges each remove a
 *    circular segment, so its area is 4R^2, the area of the side-2R square
 *    drawn at Angle 180. The formula is also checked by rasterising the same
 *    vase boundary on a fine grid.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("hinged-dissection-of-vase/hinged-dissection-of-vase-core.js", "HingedDissectionOfVaseCore");
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const samePt = (a, b, tol = 1e-9) => near(a.x, b.x, tol) && near(a.y, b.y, tol);
const PI4 = 0.7853981633974483;
const PI34 = 2.356194490192345;
const RAD = Math.PI / 180;

/* ---- a second transcription, straight from the applet's bytecode -------- */

function bytesInit(w, h) {
  return {
    cx: Math.trunc((2 * w) / 5),
    cy: Math.trunc((2 * h) / 3),
    r: Math.trunc(Math.min(w, h) / 6),
  };
}

function bytesSectors(w, h, angle) {
  const { cx, cy, r } = bytesInit(w, h);
  const t = angle * RAD;
  const rnd = (n) => Math.round(n);

  // Draw()'s first FillArc: red.
  const y4 = cy + r * Math.sin(-PI4);
  const x6 = cx + r * Math.cos(-PI4);
  const y8 = y4 + r * Math.sin(PI34 - t);
  const x10 = x6 + r * Math.cos(PI34 - t);
  const red = { name: "red", c: { x: rnd(x10), y: rnd(y8) }, start: -45 + angle };

  // Draw()'s second FillArc: blue (the +0.5/-0.5 pixel correction included).
  const y12 = y8 + r * Math.sin(PI4 - t);
  const x14 = x10 + r * Math.cos(PI4 - t);
  const phi2 = -PI34 - (2 * angle + 1) * RAD;
  const y16 = y12 + r * Math.sin(phi2) - 0.5;
  const x18 = x14 + r * Math.cos(phi2) + 0.5;
  const blue = { name: "blue", c: { x: rnd(x18), y: rnd(y16) }, start: -135 + 2 * angle };

  // Draw()'s third FillArc: dark green (green.darker() in AWT).
  const y4b = cy + r * Math.sin(-PI34);
  const x6b = cx + r * Math.cos(-PI34);
  const y8b = y4b + r * Math.sin(PI4 + t);
  const x10b = x6b + r * Math.cos(PI4 + t);
  const green = { name: "green", c: { x: rnd(x10b), y: rnd(y8b) }, start: 135 - angle };

  return [red, blue, green];
}

function bytesOutline(w, h) {
  const { cx, cy, r } = bytesInit(w, h);
  const d = r * Math.SQRT2;
  return {
    bowl: { c: { x: cx, y: cy }, r, start: 135, extent: 270 },
    neck: [
      { name: "right", c: { x: Math.round(cx + d), y: Math.round(cy - d + 2) }, start: 135, extent: 90 },
      { name: "left", c: { x: Math.round(cx - d), y: Math.round(cy - d + 2) }, start: -45, extent: 90 },
      { name: "top", c: { x: cx, y: Math.round(cy - 2 * d + 2) }, start: -135, extent: 90 },
    ],
    diamond: [
      { x: cx, y: cy },
      { x: Math.round(cx + d), y: Math.round(cy - d) },
      { x: cx, y: Math.round(cy - 2 * d) },
      { x: Math.round(cx - d), y: Math.round(cy - d) },
    ],
  };
}

const WIDTHS = [240, 300, 331, 400, 460, 501, 720];
const HEIGHTS = [200, 241, 300, 333, 460, 600];
let cases = 0;
for (const w of WIDTHS) for (const h of HEIGHTS) for (let a = 0; a <= 180; a++) cases++;

/* ------------------------------------------------ 1. the applet's constants */

{
  equal("the scroll bar is 0..180, step 1, starting at 0",
    [C.ANGLE_MIN, C.ANGLE_MAX, C.ANGLE_STEP, C.ANGLE_DEFAULT], [0, 180, 1, 0]);
  const s = C.start({});
  check("the applet opens on a 460x460 board at angle 0",
    s.width === 460 && s.height === 460 && s.angle === 0);
  check("NSectors defaults to 4 and does not change the drawing",
    s.nSectors === 4 && samePt(C.sectors(s)[0].c, C.sectors(C.start({ nSectors: 9 }))[0].c));
  check("an out-of-range scroll-bar value is clamped",
    C.start({ angle: -20 }).angle === 0 && C.start({ angle: 999 }).angle === 180);
  const moved = C.move(s, { type: "angle", value: 37.4 });
  check("moving the scroll bar keeps the other fields and records exploration",
    moved.angle === 37 && s.angle === 0 && moved.explored === true &&
    moved.cx === s.cx && moved.cy === s.cy && moved.R === s.R);
  check("reset returns to the opening picture",
    C.move(C.move(s, 90), { type: "reset" }).angle === 0);
  equal("result is null until the illustration has been explored, then done",
    [C.result(s), C.result(moved)], [null, "done"]);
}

/* ---------------------------- 2. init() on every board size in the grid --- */

{
  let ok = true;
  for (const w of WIDTHS) {
    for (const h of HEIGHTS) {
      const core = C.start({ width: w, height: h });
      const b = bytesInit(w, h);
      ok = ok && core.cx === b.cx && core.cy === b.cy && core.R === b.r;
    }
  }
  check(`Cx=2w/5, Cy=2h/3 and R=min(w,h)/6 with Java integer division in all ${WIDTHS.length * HEIGHTS.length} sizes`, ok);
  check("a 460x460 board really gives Cx=184, Cy=306, R=76",
    C.start({}).cx === 184 && C.start({}).cy === 306 && C.start({}).R === 76);
}

/* -------------- 3. sector centres and angles: whole scroll-bar range ------ */

{
  let centres = true, starts = true;
  for (const w of WIDTHS) {
    for (const h of HEIGHTS) {
      for (let a = C.ANGLE_MIN; a <= C.ANGLE_MAX; a++) {
        const core = C.sectors(C.start({ width: w, height: h, angle: a }));
        const bytes = bytesSectors(w, h, a);
        for (let i = 0; i < 3; i++) {
          centres = centres && samePt(core[i].c, bytes[i].c, 1e-12);
          starts = starts && core[i].start === bytes[i].start && core[i].extent === 90;
        }
      }
    }
  }
  check(`all three sector centres match the bytecode in all ${cases} configurations`, centres);
  check(`the three sector start angles match the bytecode in all ${cases} configurations`, starts);
}

/* -------------------- 4. the fixed outline, from the bytecode's DrawArc --- */

{
  let arcs = true, corners = true;
  for (const w of WIDTHS) {
    for (const h of HEIGHTS) {
      const g = C.outline(C.start({ width: w, height: h }));
      const b = bytesOutline(w, h);
      arcs = arcs && samePt(g.bowl.c, b.bowl.c) && g.bowl.r === b.bowl.r &&
        g.bowl.start === 135 && g.bowl.extent === 270;
      arcs = arcs && g.neck.every((arc, i) =>
        samePt(arc.c, b.neck[i].c) && arc.r === b.bowl.r &&
        arc.start === b.neck[i].start && arc.extent === 90);
      corners = corners && g.diamond.every((p, i) => samePt(p, b.diamond[i]));
    }
  }
  check("the bowl and all three neck arcs match DrawArc/DrawRadius on every size", arcs);
  check("the four square corners match DrawRadius(-PI/4) on every size", corners);
}

/* --------------------------- 5. the pieces hinge correctly ---------------- */

{
  let redGreen = true, blueQuirk = true, starts180 = true, rigid = true;
  for (const w of WIDTHS) {
    for (const h of HEIGHTS) {
      const zero = C.start({ width: w, height: h, angle: 0 });
      const [red, blue, green] = C.sectors(zero);
      const o = C.outline(zero);
      redGreen = redGreen && samePt(red.c, { x: zero.cx, y: zero.cy }) &&
        samePt(green.c, { x: zero.cx, y: zero.cy });
      // The blue sector carries the applet's (2*Angle+1) degree and half-pixel
      // corrections, so at angle 0 it is within a couple of pixels of O.
      blueQuirk = blueQuirk && Math.hypot(blue.c.x - zero.cx, blue.c.y - zero.cy) < 3;
      const end = C.start({ width: w, height: h, angle: 180 });
      const e = C.sectors(end), q = C.outline(end).diamond;
      starts180 = starts180 && e[0].start === 135 && e[1].start === 225 && e[2].start === -45 &&
        Math.hypot(e[0].c.x - q[1].x, e[0].c.y - q[1].y) < 3 &&
        Math.hypot(e[1].c.x - q[2].x, e[1].c.y - q[2].y) < 3 &&
        Math.hypot(e[2].c.x - q[3].x, e[2].c.y - q[3].y) < 3;
      for (let a = 0; a <= 180; a++) {
        const s = C.start({ width: w, height: h, angle: a });
        for (const sec of C.sectors(s)) {
          const p = C.arcPoint(sec.c, s.R, sec.start);
          const q2 = C.arcPoint(sec.c, s.R, sec.start + sec.extent);
          rigid = rigid && near(Math.hypot(p.x - sec.c.x, p.y - sec.c.y), s.R, 1e-9) &&
            near(Math.hypot(q2.x - sec.c.x, q2.y - sec.c.y), s.R, 1e-9) &&
            near((p.x - sec.c.x) * (q2.x - sec.c.x) + (p.y - sec.c.y) * (q2.y - sec.c.y), 0, 1e-6);
        }
      }
      // The outline itself never moves with the scroll bar.
      const a90 = C.outline(C.start({ width: w, height: h, angle: 90 }));
      if (!a90.neck.every((arc, i) => samePt(arc.c, o.neck[i].c))) redGreen = false;
    }
  }
  check("red and green quarter-disks start at the centre of the bowl", redGreen);
  check("blue keeps the applet's tiny half-pixel/one-degree offset at angle 0", blueQuirk);
  check("at 180 degrees the three pieces sit at the three upper square corners", starts180);
  check("every coloured piece is a 90-degree sector of radius R at every angle", rigid);
}

/* ----- 6. arc endpoints meet, and the outline is angle-independent ------- */

{
  let meet = true, bowl = true, visibility = true;
  for (const w of WIDTHS) {
    for (const h of HEIGHTS) {
      const g = C.geometry(C.start({ width: w, height: h }));
      const [right, left, top] = g.neck;
      const r0 = C.arcPoint(right.c, right.r, right.start);
      const r1 = C.arcPoint(right.c, right.r, right.start + 90);
      const l0 = C.arcPoint(left.c, left.r, left.start);
      const l1 = C.arcPoint(left.c, left.r, left.start + 90);
      const t0 = C.arcPoint(top.c, top.r, top.start);
      const t1 = C.arcPoint(top.c, top.r, top.start + 90);
      const b0 = C.arcPoint(g.bowl.c, g.bowl.r, 135);
      const b1 = C.arcPoint(g.bowl.c, g.bowl.r, 45);
      // The neck arcs carry the applet's +2 pixel shift and each centre is
      // rounded to a whole pixel by a(), so endpoints meet to within a pixel.
      meet = meet && samePt(t0, l1, 1.5) && samePt(t1, r0, 1.5) &&
        near(r1.y, b1.y + 2, 1.5) && near(r1.x, b1.x, 1.5) &&
        near(l0.y, b0.y + 2, 1.5) && near(l0.x, b0.x, 1.5);
      for (let k = 0; k < 3; k++) {
        const a = C.arcPoint(g.bowl.c, g.bowl.r, 135 + k * 90);
        const b = C.arcPoint(g.bowl.c, g.bowl.r, 225 + k * 90);
        bowl = bowl && near(Math.hypot(a.x - b.x, a.y - b.y), g.R * Math.SQRT2, 1e-8);
      }
      visibility = visibility && g.bowlVisible && g.neckVisible && !g.squareVisible && !g.guides;
      const mid = C.geometry(C.start({ width: w, height: h, angle: 90 }));
      const fin = C.geometry(C.start({ width: w, height: h, angle: 180 }));
      visibility = visibility && !mid.bowlVisible && mid.neckVisible && mid.guides &&
        !mid.squareVisible && !fin.neckVisible && fin.squareVisible;
    }
  }
  check("the three neck arcs join each other and the bowl across every size", meet);
  check("the 270-degree bowl splits into three equal quarter arcs", bowl);
  check("the applet hides/shows bowl, guides, neck and square at 0/90/180", visibility);
}

/* ------------------------- 7. the page's area claim ---------------------- */

{
  let square = true, identity = true, segments = true;
  for (const w of WIDTHS) {
    for (const h of HEIGHTS) {
      const s = C.start({ width: w, height: h });
      const q = C.outline(s).diamond;
      const sides = [0, 1, 2, 3].map((i) => {
        const a = q[i], b = q[(i + 1) % 4];
        return Math.hypot(b.x - a.x, b.y - a.y);
      });
      square = square && sides.every((d) => Math.abs(d - 2 * s.R) < 2);
      square = square && Math.abs(Math.hypot(q[0].x - q[2].x, q[0].y - q[2].y) - 2 * Math.SQRT2 * s.R) < 2 &&
        Math.abs(Math.hypot(q[1].x - q[3].x, q[1].y - q[3].y) - 2 * Math.SQRT2 * s.R) < 2;
      const a = C.areas(s.R);
      identity = identity && near(a.vase, 4 * s.R * s.R, 1e-9) &&
        near(a.square, a.vase, 1e-9) && near(a.bottom + a.top, a.vase, 1e-9) &&
        near(a.triangle + a.neck, a.top, 1e-9);
      segments = segments && near(a.segment, (Math.PI / 4 - 0.5) * s.R * s.R, 1e-9) &&
        near(a.neck, 2 * s.R * s.R - 3 * a.segment, 1e-9);
    }
  }
  check("the four sides of the finished diamond are 2R (to a pixel) and its diagonals 2*sqrt(2)R", square);
  check("the page's claim is exact: vase area = square area = 4R^2, for every size", identity);
  check("the neck is a 2R^2 rectangle minus three quarter-circle segments", segments);
}

/* ---- 8. independent raster check of the same vase boundary -------------- */

function insideVase(x, y, g) {
  // The applet nudges its neck arcs down two screen pixels to hide seams.
  // For the area claim use the ideal arcs: the shift is a drawing detail, not
  // part of the dissection, and is checked separately in section 6.
  const dx = x - g.cx, dy = y - g.cy, R = g.R, R2 = R * R;
  if (dx * dx + dy * dy <= R2 && dy >= -Math.abs(dx)) return true; // the 3/4 disk
  if (dy > -Math.abs(dx) || dy < (-3 * R) / Math.SQRT2) return false;
  const centres = [
    { x: g.cx - R * Math.SQRT2, y: g.cy - R * Math.SQRT2 },
    { x: g.cx + R * Math.SQRT2, y: g.cy - R * Math.SQRT2 },
    { x: g.cx, y: g.cy - 2 * R * Math.SQRT2 },
  ];
  return centres.every((c) => (x - c.x) ** 2 + (y - c.y) ** 2 >= R2);
}

{
  const raster = [];
  for (const R of [24, 60, 76, 90]) {
    const g = C.geometry(C.start({ width: 400, height: 400 }));
    g.R = R;
    g.cx = 0; g.cy = 0;
    const step = R / 260;
    let count = 0;
    for (let y = -3.1 * R; y <= 1.1 * R; y += step) {
      for (let x = -1.5 * R; x <= 1.5 * R; x += step) {
        if (insideVase(x, y, g)) count++;
      }
    }
    raster.push(Math.abs(count * step * step - 4 * R * R) / (4 * R * R));
  }
  check(`rasterising the vase boundary agrees with 4R^2 within 2% at R=24,60,76,90 (max error ${Math.max(...raster).toFixed(4)})`,
    raster.every((e) => e < 0.02));
}

/* ---------------------------- 9. saved position -------------------------- */

{
  const s = C.move(C.start({ width: 331, height: 241 }), { type: "angle", value: 93 });
  const p = C.snapshot(s);
  check("the saved position is plain data with the board units and angle",
    JSON.parse(JSON.stringify(p)).angle === 93 && p.cx === 132 && p.cy === 160 && p.R === 40 &&
    Object.keys(p).every((k) => !Array.isArray(p[k]) && typeof p[k] !== "function"));
}

done("hinged-dissection-of-vase");
