#!/usr/bin/env node
"use strict";

/*
 * Logic test for CubeIllusionCore.
 *
 *   node porting/check-cube-illusion.mjs
 *
 * The applet has no game to play: this is an illustration with three sliders
 * and two checkboxes. So the test checks the geometry instead: a second,
 * independent transcription of ComputePoints()/Draw() (closed-form instead of
 * the applet's incremental point objects) is compared over every reachable
 * combination of Angle (15..60 by 5), N (2..10), M (1..10, clamped by the
 * applet's adjustmentValueChanged rule) and both line toggles, on four canvas
 * sizes. It also checks the page's claims: the heavy strokes support both
 * readings, all strokes come from one projection angle, and switching the
 * tiling on or off never changes those strokes.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("cube-illusion/cube-illusion-core.js", "CubeIllusionCore");
const ROUND = Math.round;

/* Every position the applet's scrollbars and checkboxes can produce. */
function* configurations() {
  for (let angle = 15; angle <= 60; angle += 5) {
    for (let n = 2; n <= 10; n++) {
      for (let m = 1; m <= 10; m++) {
        for (const longLines of [true, false]) {
          for (const shortLines of [true, false]) {
            yield C.start({ angle, n, m, longLines, shortLines });
          }
        }
      }
    }
  }
}

/* -------------------------------------------- a second transcription, by hand */

/*
 * ComputePoints() in closed form. The applet builds B,D,C,E,F,G and then
 * Ap..Gp by differences; every one of those differences simplifies to these
 * affine formulas in the single slant step (uw, uh).
 */
function referencePoints(angle, n, m, w, h) {
  const ax = (w / 2) | 0; // Java's int division for w/2 and w/8
  const ay = (w / 8) | 0;
  const u = ROUND(h / 1.4 / 20);
  const t = (angle * Math.PI) / 180;
  const uw = u * 1.6 * Math.cos(t);
  const uh = u * Math.sin(t);
  const pt = (x, y) => ({ x, y });
  return {
    A: pt(ax, ay),
    B: pt(ax - n * uw, ay + n * uh),
    C: pt(ax, ay + 2 * n * uh),
    D: pt(ax + n * uw, ay + n * uh),
    E: pt(ax - n * uw, ay + 3 * n * uh),
    F: pt(ax, ay + 4 * n * uh),
    G: pt(ax + n * uw, ay + 3 * n * uh),
    Ap: pt(ax, ay + (2 * n - 2 * m) * uh),
    Bp: pt(ax - m * uw, ay + (2 * n - m) * uh),
    Cp: pt(ax, ay + 2 * n * uh),
    Dp: pt(ax + m * uw, ay + (2 * n - m) * uh),
    Ep: pt(ax - m * uw, ay + (2 * n + m) * uh),
    Fp: pt(ax, ay + (2 * n + 2 * m) * uh),
    Gp: pt(ax + m * uw, ay + (2 * n + m) * uh),
    unitLength: u, slantedUnitW: uw, slantedUnitH: uh,
  };
}

/* Draw() written as raw coordinate arithmetic, without the core's point objects. */
function referenceSegments(s) {
  const { angle, n, m, width: w, height: h } = s;
  const p = referencePoints(angle, n, m, w, h);
  const ax = p.A.x, ay = p.A.y, uw = p.slantedUnitW, uh = p.slantedUnitH;
  const out = [];
  const line = (x1, y1, x2, y2, kind) =>
    out.push({ a: { x: ROUND(x1), y: ROUND(y1) }, b: { x: ROUND(x2), y: ROUND(y2) }, kind });
  const edge = (x1, y1, x2, y2) => line(x1, y1, x2, y2, "edge");

  // The 18 heavy strokes of Draw(), in the bytecode's order.
  edge(ax, ay, ax - n * uw, ay + n * uh);                                     // A-B
  edge(ax - n * uw, ay + n * uh, ax - n * uw, ay + 3 * n * uh);                 // B-E
  edge(ax - n * uw, ay + 3 * n * uh, ax, ay + 4 * n * uh);                      // E-F
  edge(ax, ay + 4 * n * uh, ax + n * uw, ay + 3 * n * uh);                      // F-G
  edge(ax + n * uw, ay + n * uh, ax + n * uw, ay + 3 * n * uh);                 // D-G
  edge(ax + n * uw, ay + n * uh, ax, ay);                                       // D-A
  edge(ax, ay + (2 * n - 2 * m) * uh, ax - m * uw, ay + (2 * n - m) * uh);       // Ap-Bp
  edge(ax - m * uw, ay + (2 * n - m) * uh, ax - m * uw, ay + (2 * n + m) * uh);  // Bp-Ep
  edge(ax - m * uw, ay + (2 * n + m) * uh, ax, ay + (2 * n + 2 * m) * uh);       // Ep-Fp
  edge(ax, ay + (2 * n + 2 * m) * uh, ax + m * uw, ay + (2 * n + m) * uh);       // Fp-Gp
  edge(ax + m * uw, ay + (2 * n - m) * uh, ax + m * uw, ay + (2 * n + m) * uh);  // Dp-Gp
  edge(ax + m * uw, ay + (2 * n - m) * uh, ax, ay + (2 * n - 2 * m) * uh);       // Dp-Ap
  edge(ax, ay, ax, ay + (2 * n - 2 * m) * uh);                                 // A-Ap
  edge(ax - n * uw, ay + 3 * n * uh, ax - m * uw, ay + (2 * n + m) * uh);       // E-Ep
  edge(ax + n * uw, ay + 3 * n * uh, ax + m * uw, ay + (2 * n + m) * uh);       // G-Gp
  edge(ax - m * uw, ay + (2 * n - m) * uh, ax, ay + 2 * n * uh);                // Bp-Cp
  edge(ax + m * uw, ay + (2 * n - m) * uh, ax, ay + 2 * n * uh);                // Dp-Cp
  edge(ax, ay + (2 * n + 2 * m) * uh, ax, ay + 2 * n * uh);                     // Fp-Cp

  if (s.longLines) {
    for (let i = 0; i < m; i++) {
      for (const side of [-1, 1]) {
        line(ax + side * (i + 1) * uw, ay + (i + 1) * uh,
             ax + side * (i + 1) * uw, ay + (2 * n - 2 * m + i + 1) * uh, "long");
      }
    }
    for (let i = 0; i < m; i++) {
      line(ax - m * uw, ay + (2 * n - m + 2 * i) * uh,
           ax - n * uw, ay + (3 * n - 2 * m + 2 * i) * uh, "long");
      line(ax + m * uw, ay + (2 * n - m + 2 * i) * uh,
           ax + n * uw, ay + (3 * n - 2 * m + 2 * i) * uh, "long");
      // The applet emits the Ep side first, then the Gp side.
      line(ax - m * uw + (i + 1) * uw, ay + (2 * n + m + i + 1) * uh,
           ax - n * uw + (i + 1) * uw, ay + (3 * n + i + 1) * uh, "long");
      line(ax + m * uw - (i + 1) * uw, ay + (2 * n + m + i + 1) * uh,
           ax + n * uw - (i + 1) * uw, ay + (3 * n + i + 1) * uh, "long");
    }
    for (let i = 1; i < n - m; i++) {
      for (const side of [-1, 1]) {
        line(ax + side * (m + i) * uw, ay + (m + i) * uh,
             ax + side * (m + i) * uw, ay + (2 * n + m + i) * uh, "long");
      }
    }
    for (let i = 1; i < n - m; i++) {
      for (const side of [-1, 1]) {
        line(ax, ay + 2 * i * uh, ax + side * n * uw, ay + (n + 2 * i) * uh, "long");
      }
    }
    for (let i = 1; i < n - m; i++) {
      line(ax - (m + i) * uw, ay + (2 * n + m + i) * uh,
           ax + (n - m - i) * uw, ay + (3 * n + m + i) * uh, "long");
      line(ax + (m + i) * uw, ay + (2 * n + m + i) * uh,
           ax + (m - n + i) * uw, ay + (3 * n + m + i) * uh, "long");
    }
  }
  if (s.shortLines) {
    for (let i = 1; i < m; i++) {
      line(ax - i * uw, ay + (2 * n - 2 * m + i) * uh,
           ax + m * uw - i * uw, ay + (2 * n - m + i) * uh, "short");
      line(ax + i * uw, ay + (2 * n - 2 * m + i) * uh,
           ax - m * uw + i * uw, ay + (2 * n - m + i) * uh, "short");
      line(ax - m * uw + i * uw, ay + (2 * n - m + i) * uh,
           ax - m * uw + i * uw, ay + (2 * n + m + i) * uh, "short");
      line(ax + m * uw - i * uw, ay + (2 * n - m + i) * uh,
           ax + m * uw - i * uw, ay + (2 * n + m + i) * uh, "short");
      for (const side of [-1, 1]) {
        line(ax + side * m * uw, ay + (2 * n - m + 2 * i) * uh,
             ax, ay + (2 * n + 2 * i) * uh, "short");
      }
    }
  }
  return out;
}

const canon = (lines) => JSON.stringify(lines.map((v) => [
  v.a.x, v.a.y, v.b.x, v.b.y, v.kind,
]));

function nearly(a, b, tol) { return Math.abs(a - b) <= tol; }
function samePoint(p, q, tol = 1e-7) { return nearly(p.x, q.x, tol) && nearly(p.y, q.y, tol); }

/* ------------------------------------------------------------- 1. the rules */

equal("applet defaults", C.start({}), {
  angle: 45, n: 6, m: 3, longLines: true, shortLines: true, width: 400, height: 300,
});
equal("applet scrollbar ranges", C.RANGES, {
  angle: { min: 15, max: 60, step: 5 },
  n: { min: 2, max: 10, step: 1 },
  m: { min: 1, max: 10, step: 1 },
});
check("the illustration has no win or loss", C.result(C.start({})) === null);
check("the status describes the choices", /Tilt 45/.test(C.describe(C.start({}))));

{
  const base = C.start({});
  const next = C.adjust(base, { n: 4 });
  check("adjust does not change the position it is given", base.n === 6);
  check("adjust returns a new position", next !== base && next.n === 4);
  check("out-of-range sliders are clamped like a AWT Scrollbar",
    C.adjust(base, { angle: 3, n: 99, m: -7 }).angle === 15 &&
    C.adjust(base, { angle: 3, n: 99, m: -7 }).n === 10 &&
    C.adjust(base, { angle: 3, n: 99, m: -7 }).m === 1);
}

/* adjustmentValueChanged: M = N > M ? M : N, on every slider event. */
{
  let bad = 0;
  for (let n = 2; n <= 10; n++) {
    for (let m = 1; m <= 10; m++) {
      const s = C.start({ n, m });
      if (s.m !== Math.min(n, m)) bad++;
      // Raising M above N snaps back; raising N above M leaves M alone.
      if (C.adjust(s, { m: 10 }).m !== n) bad++;
      if (C.adjust(s, { n: 10 }).m !== s.m) bad++;
    }
  }
  check("M is clamped to N over all 9 x 10 slider pairs, in both directions", bad === 0, `${bad} bad`);
}

/* ------------------------------------- 2. second transcription, all the way */

const SIZES = [[400, 300], [320, 240], [375, 500], [640, 480]];
{
  let bad = 0, count = 0;
  for (let angle = 15; angle <= 60; angle += 5) {
    for (let n = 2; n <= 10; n++) {
      for (let m = 1; m <= Math.min(n, 10); m++) {
        for (const [w, h] of SIZES) {
          const s = C.start({ angle, n, m, width: w, height: h });
          const got = C.computePoints(s);
          const want = referencePoints(angle, n, m, w, h);
          count++;
          for (const key of ["A", "B", "C", "D", "E", "F", "G",
                             "Ap", "Bp", "Cp", "Dp", "Ep", "Fp", "Gp"]) {
            if (!samePoint(got[key], want[key])) bad++;
          }
          if (!nearly(got.unitLength, want.unitLength, 1e-9) ||
              !nearly(got.slantedUnitW, want.slantedUnitW, 1e-9) ||
              !nearly(got.slantedUnitH, want.slantedUnitH, 1e-9)) bad++;
        }
      }
    }
  }
  check(`ComputePoints matches the independent closed form in ${count} configurations`, bad === 0, `${bad} bad`);
}

{
  // Closed-form and incremental arithmetic can land on opposite sides of a
  // rounding boundary (e.g. 121.49999999999999 vs 121.5), so allow one unit
  // on an endpoint; ordering and kind must agree exactly.
  let bad = 0, count = 0, maxDelta = 0;
  for (const s of configurations()) {
    const got = C.segments(s);
    const want = referenceSegments(s);
    count++;
    if (got.length !== want.length) { bad++; continue; }
    for (let i = 0; i < got.length; i++) {
      if (got[i].kind !== want[i].kind) { bad++; break; }
      let delta = 0;
      for (const key of ["a", "b"]) {
        for (const axis of ["x", "y"]) {
          delta = Math.max(delta, Math.abs(got[i][key][axis] - want[i][key][axis]));
        }
      }
      maxDelta = Math.max(maxDelta, delta);
      if (delta > 1) { bad++; break; }
    }
  }
  check(`Draw matches the independent transcription in ${count} configurations`,
    bad === 0, `${bad} bad, largest endpoint delta ${maxDelta}`);
}

/* ---------------------------------------------------- 3. the page's claims */

{
  let bad = 0, count = 0;
  for (const s of configurations()) {
    const lines = C.segments(s);
    const edges = lines.filter((v) => v.kind === "edge");
    count++;
    if (edges.length !== 18) bad++;
    const names = edges.map((v) => v.name).sort().join(",");
    const both = C.READINGS.small.concat(C.READINGS.cut).sort().join(",");
    if (names !== both) bad++;
  }
  check(`the 18 heavy strokes are the same in all ${count} configurations`, bad === 0, `${bad} bad`);
}

{
  // "There are two cubes ... or a small cube in a corner ... or a big cube
  // with a corner cut off": every named edge of both readings is on the page.
  let bad = 0;
  for (const s of configurations()) {
    const have = new Set(C.segments(s).filter((v) => v.kind === "edge").map((v) => v.name));
    for (const reading of [C.READINGS.small, C.READINGS.cut]) {
      for (const name of reading) if (!have.has(name)) bad++;
      if (reading.length !== 9) bad++;
    }
    // The two readings are genuinely different sets of strokes.
    for (const name of C.READINGS.small) if (C.READINGS.cut.includes(name)) bad++;
  }
  check("both readings can be traced on the very same heavy strokes", bad === 0, `${bad} bad`);
}

{
  // Each reading contains a closed hexagonal outline: follow it and come back.
  const hex = {
    small: [["Ap", "Bp"], ["Bp", "Ep"], ["Ep", "Fp"], ["Fp", "Gp"], ["Gp", "Dp"], ["Dp", "Ap"]],
    cut: [["A", "B"], ["B", "E"], ["E", "F"], ["F", "G"], ["G", "D"], ["D", "A"]],
  };
  let bad = 0;
  for (const s of configurations()) {
    const p = C.computePoints(s);
    for (const reading of ["small", "cut"]) {
      let cursor = null;
      for (const [from, to] of hex[reading]) {
        if (cursor !== null && !samePoint(cursor, p[from])) bad++;
        cursor = p[to];
      }
      if (!samePoint(cursor, p[hex[reading][0][0]])) bad++;
    }
  }
  check("both the small cube and the cut-corner cube close up as hexagons", bad === 0, `${bad} bad`);
}

{
  // "The brain tries to make up for the absence of perspective clues":
  // one angle gives all three families of strokes, with no foreshortening.
  let bad = 0, count = 0;
  for (let angle = 15; angle <= 60; angle += 5) {
    const s = C.start({ angle, n: 6, m: 3 });
    const p = C.computePoints(s);
    const ratio = p.slantedUnitH / p.slantedUnitW;
    const expected = Math.tan((angle * Math.PI) / 180) / 1.6;
    count++;
    if (!nearly(ratio, expected, 1e-9)) bad++;
  }
  check(`one tilt angle drives both slant directions in all ${count} angles`, bad === 0, `${bad} bad`);
}

{
  // Switching the grid never changes the two-cube skeleton.
  let bad = 0;
  for (let angle = 15; angle <= 60; angle += 5) {
    for (let n = 2; n <= 10; n++) {
      for (let m = 1; m <= n; m++) {
        for (const longLines of [true, false]) {
          for (const shortLines of [true, false]) {
            const heavy = (on, off) => canon(C.segments(C.start({
              angle, n, m, longLines: on, shortLines: off,
            })).filter((v) => v.kind === "edge"));
            if (heavy(longLines, shortLines) !== heavy(true, true)) bad++;
          }
        }
      }
    }
  }
  check("the two readings survive with the tiling on, off, or half off", bad === 0, `${bad} bad`);
}

{
  // Counts of the two optional families, worked out from the loops themselves.
  let bad = 0;
  for (const s of configurations()) {
    const lines = C.segments(s);
    const longs = lines.filter((v) => v.kind === "long").length;
    const shorts = lines.filter((v) => v.kind === "short").length;
    const wantLong = s.longLines ? 6 * (s.m + Math.max(0, s.n - s.m - 1)) : 0;
    const wantShort = s.shortLines ? 6 * (s.m - 1) : 0;
    if (longs !== wantLong || shorts !== wantShort) bad++;
  }
  check("long and short tiling line counts match the applet's five + one loops", bad === 0, `${bad} bad`);
}

{
  // A real quirk of the original: when M = N the three joining strokes
  // A-Ap, E-Ep, G-Gp collapse to points (and some grid strokes do too).
  // Away from that degenerate setting every stroke has length.
  let bad = 0, degenerate = 0;
  for (const s of configurations()) {
    for (const v of C.segments(s)) {
      if (![v.a.x, v.a.y, v.b.x, v.b.y].every(Number.isFinite)) bad++;
      const empty = v.a.x === v.b.x && v.a.y === v.b.y;
      if (empty && s.m < s.n) bad++;
      if (empty && v.name) degenerate++;
    }
  }
  check("every stroke is finite; only M = N collapses the three joining edges",
    bad === 0 && degenerate > 0, `${bad} bad, ${degenerate} collapsed edges`);
}

{
  // The UI fits the drawing into a fixed viewBox by an affine scale; that
  // transform preserves all incidences, so the bounds only need to exist.
  let bad = 0;
  for (const [w, h] of SIZES) {
    for (const angle of [15, 45, 60]) {
      for (const n of [2, 6, 10]) {
        const b = C.bounds(C.start({ angle, n, m: n, width: w, height: h }));
        if (![b.minX, b.minY, b.maxX, b.maxY, b.width, b.height].every(Number.isFinite)) bad++;
        if (b.width <= 0 || b.height <= 0) bad++;
      }
    }
  }
  check("the drawing always has a finite bounding box for the SVG fit", bad === 0, `${bad} bad`);
}

done("cube-illusion");
