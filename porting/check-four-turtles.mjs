#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-turtles/four-turtles-core.js.
 *
 * The applet is an illustration, so the check is a second, literal
 * transcription of its bytecode plus exhaustive checks of the page's claims:
 *
 *   1. Constructor / panel defaults, N spin range and run()'s speed table.
 *   2. Reset(), Transform.Apply() and run() translated instruction by
 *      instruction; compare every frame, in both frames of reference, for
 *      every N (3..20) on several canvas sizes.
 *   3. The page's formulas T = S/(V(1-cos 2a)), D = VT, D = S for N = 4,
 *      the regular-N-gon symmetry, the linear shrink and the log spiral,
 *      checked over the whole N and frame range.
 *   4. The rotating-observer claim, the trace/option edge cases and the
 *      position saved for the tutor.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("four-turtles/four-turtles-core.js", "FourTurtlesCore");

/* -------------------------------------------------------- 1. the defaults */

{
  // FourTurtlesCanvas.<init>: N=4, MovingFrame/TraceIt/Curve/Whirl/Running
  // all false; FourTurtlesPanel.<init>: Fixed selected, Trace off,
  // Whirl selected, Spirals/Both off, NEdit.setLong(4).
  const s = C.start();
  equal("canvas defaults N", s.n, 4);
  equal("canvas defaults MovingFrame", s.movingFrame, false);
  equal("canvas defaults TraceIt", s.traceIt, false);
  equal("canvas defaults Curve", s.curve, false);
  equal("canvas defaults Whirl", s.whirl, true);
  equal("canvas defaults Both", s.both, false);
  equal("canvas defaults Running", s.running, false);
  equal("canvas defaults frame", s.frame, 0);
  equal("panel NEdit lower bound", C.N_LIMIT.min, 3);
  equal("panel NEdit upper bound", C.N_LIMIT.max, 20);
  equal("panel NEdit initial value", C.N_LIMIT.initial, 4);
  equal("applet canvas WIDTH parameter", C.CANVAS, { width: 600, height: 550 });
  equal("run() sleeps 50 ms per frame", C.PERIOD, 50);

  // PVNumeric: setMinValue(3), setMaxValue(20), delta 1, integer only.
  for (const [input, want] of [[-100, 3], [0, 3], [2, 3], [3, 3], [3.4, 3], [3.6, 4],
                               [4, 4], [9, 9], [19.6, 20], [20, 20], [21, 20], [1000, 20],
                               [NaN, 4], [Infinity, 4], ["7", 7]]) {
    check(`N spin input ${String(input)} clamps to ${want}`, C.clampN(input) === want,
      `got ${C.clampN(input)}`);
  }
}

/* ------------------------------------ 2. the bytecode, transcribed again */

/** Reset(): int R = (min(width,height) - 2*20)/2; Side = 2R sin(pi/N). */
function bytecodeReset(n, width, height) {
  const d = 20;
  const R = Math.trunc((Math.min(width, height) - 2 * d) / 2); // Java int division
  const corners = [];
  for (let k = 0; k < n; k++) {
    const phi = (Math.PI / n) * 2 * k + Math.PI / n;
    corners.push({ x: Math.trunc(width / 2) + R * Math.cos(phi),
                   y: Math.trunc(height / 2) - R * Math.sin(phi) });
  }
  return { center: { x: Math.trunc(width / 2), y: Math.trunc(height / 2) },
           radius: R, side: 2 * R * Math.sin(Math.PI / n), corners };
}

/** run()'s seven-branch speed table, written out from the bytecode again. */
function bytecodeSpeed(n) {
  if (n < 4) return 25.0;
  else if (n < 5) return 12.0;
  else if (n < 7) return 5.0;
  else if (n < 10) return 3.0;
  else if (n < 13) return 1.0;
  else if (n < 15) return 0.75;
  return 0.5;
}

/** Transform(Apply): field Cos = R*cos(A), Sin = R*sin(A), then the rotation. */
function bytecodeTransform(p, angle, scale, center) {
  const cos = scale * Math.cos(angle), sin = scale * Math.sin(angle);
  const dx = p.x - center.x, dy = p.y - center.y;
  return { x: cos * dx - sin * dy + center.x, y: sin * dx + cos * dy + center.y };
}

/** run(): every frame the thread actually paints, in its own order. */
function bytecodeFrames(n, width, height, movingFrame) {
  const g = bytecodeReset(n, width, height);
  const speed = bytecodeSpeed(n);       // local 4
  let side = g.side;                    // local 8 before the loop
  const beta = Math.PI / n;             // local 10
  const gamma = Math.PI * (n - 2) / n;  // local 12
  const s14 = Math.sin(beta);           // local 14
  const s16 = Math.sin(gamma);          // local 16
  const c18 = Math.cos(gamma);          // local 18
  const out = [];
  for (let i = 0; i < 1000; i++) {      // local 3
    side = g.side - ((speed * (1 - c18)) * i);
    if (side < 0) break;                // @190: Stop(), then @446
    let A = (s16 * (1 - c18)) * Math.log(side / g.side);  // local 1
    const r = side / g.side;            // local 6
    let squares;
    if (movingFrame) {
      A = -A;
      // The original polygon: no shrink, no turtle dots.
      squares = [{ points: g.corners.map((p) => bytecodeTransform(p, A, 1, g.center)), dots: false },
                 // The rotating observer's shrinking polygon: no rotation.
                 { points: g.corners.map((p) => bytecodeTransform(p, 0, r, g.center)), dots: true }];
    } else {
      squares = [{ points: g.corners.map((p) => bytecodeTransform(p, A, r, g.center)), dots: true }];
    }
    // At side == 0 the applet computes this frame, then clears Moving and
    // repaints, so nothing is visible. Model that last clear here.
    out.push({ side, ratio: r, angle: A,
               squares: side === 0 ? [] : squares,
               traced: squares[squares.length - 1].points });
    if (side <= 0) break;               // @432/@439: Stop()
  }
  return out;
}

const SIZES = [[600, 550], [600, 600], [400, 400], [320, 240], [800, 600], [1000, 300]];

{
  let configs = 0, frames = 0, points = 0, mismatches = 0, first = "";
  for (let n = C.N_LIMIT.min; n <= C.N_LIMIT.max; n++) {
    for (const movingFrame of [false, true]) {
      for (const [width, height] of SIZES) {
        configs++;
        const state = C.setOptions(C.start({ width, height }), { n, movingFrame });
        const mine = [];
        for (let i = 0; i < 1000; i++) {
          const f = C.frameAt(state, i);
          if (f.side < 0) break;
          mine.push(f);
          if (f.side <= 0) break;
        }
        const theirs = bytecodeFrames(n, width, height, movingFrame);
        if (mine.length !== theirs.length) {
          mismatches++;
          if (!first) first = `${n}/${movingFrame}/${width}x${height}: ${mine.length} vs ${theirs.length}`;
          continue;
        }
        for (let i = 0; i < mine.length; i++) {
          frames++;
          const a = mine[i], b = theirs[i];
          const ok = a.side === b.side && a.ratio === b.ratio && a.angle === b.angle &&
            a.squares.length === b.squares.length &&
            a.squares.every((sq, j) => sq.dots === b.squares[j].dots &&
              JSON.stringify(sq.points) === JSON.stringify(b.squares[j].points));
          points += a.squares.reduce((sum, sq) => sum + sq.points.length, 0);
          if (!ok) {
            mismatches++;
            if (!first) first = `${n}/${movingFrame}/${width}x${height} frame ${i}`;
          }
        }
      }
    }
  }
  check(`${configs} configurations match Reset(), Transform and run() exactly`, mismatches === 0, first);
  check(`${frames} animation frames were compared byte for byte`, frames > 1000, `only ${frames}`);
  check(`${points} transformed turtle positions were compared`, points > 10000, `only ${points}`);
}

{
  // The speed table, including its boundaries, independently transcribed.
  for (const [n, want] of [[3, 25], [4, 12], [5, 5], [6, 5], [7, 3], [8, 3], [9, 3],
                           [10, 1], [11, 1], [12, 1], [13, 0.75], [14, 0.75],
                           [15, 0.5], [20, 0.5]]) {
    check(`run() speed for N=${n}`, C.speedForN(n) === want && bytecodeSpeed(n) === want,
      `core ${C.speedForN(n)}, bytecode ${want}`);
  }
}

/* -------------------------------- 3. the page's claims, exhaustively */

{
  // The page: S = 2R sin(a), R/(V sin a) = S/(2V sin^2 a) = S/(V(1-cos 2a)),
  // D = VT = S/(1-cos 2a). Try the whole N range and many side/speed values.
  let failures = 0, n4 = 0;
  for (let n = 3; n <= 20; n++) {
    const alpha = Math.PI / n;
    for (const side of [0.1, 1, 3, 7.5, 79.82, 360.62, 1000]) {
      for (const v of [0.25, 1, 2, 7]) {
        const R = side / (2 * Math.sin(alpha));
        const t1 = R / (v * Math.sin(alpha));
        const t2 = side / (2 * v * Math.sin(alpha) ** 2);
        const t3 = C.pageTime(side, n, v);
        const d = C.pageDistance(side, n);
        const close = (a, b) => Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(a), Math.abs(b));
        if (!close(t1, t2) || !close(t2, t3) || !close(v * t3, d)) failures++;
        if (n === 4 && close(d, side)) n4++;
      }
    }
  }
  check("all 504 T and D values satisfy the page's three formulas", failures === 0, `${failures} failures`);
  check("the page's N=4 claim D=S holds for every side and speed", n4 === 28, `only ${n4}/28`);
  check("the page's D at N=4 equals S", Math.abs(C.pageDistance(360.62, 4) - 360.62) < 1e-12);
  // D/S is 1/(1-cos(2pi/N)): below 1 for N=3, exactly 1 at N=4, then above
  // 1 and growing for N>=5. The square is where the chase is exactly one side.
  check("a triangle travels less than its side, a square exactly its side",
    C.pageDistance(10, 3) < 10 && Math.abs(C.pageDistance(10, 4) - 10) < 1e-12,
    `${C.pageDistance(10, 3)}, ${C.pageDistance(10, 4)}`);
  check("the page's distance exceeds a side and grows for N>=5",
    C.pageDistance(10, 20) > C.pageDistance(10, 6) && C.pageDistance(10, 6) > 10 &&
    C.pageDistance(10, 5) > 10);
}

{
  // Symmetry: every painted polygon is a regular N-gon about the same centre,
  // however small and turned it is. Check every vertex of every frame.
  let bad = 0, sides = 0, frames = 0;
  for (let n = 3; n <= 20; n++) {
    for (const movingFrame of [false, true]) {
      const state = C.start({ n, movingFrame });
      for (let i = 0; i < 1000; i++) {
        const f = C.frameAt(state, i);
        if (f.side < 0) break;
        if (f.over) break;
        frames++;
        for (const sq of f.squares) {
          const radii = sq.points.map((p) => Math.hypot(p.x - f.center.x, p.y - f.center.y));
          if (Math.max(...radii) - Math.min(...radii) > 1e-9) bad++;
          for (let k = 0; k < n; k++) {
            const p = sq.points[k], q = sq.points[(k + 1) % n];
            sides++;
            if (Math.abs(Math.hypot(p.x - q.x, p.y - q.y) - radii[k] * 2 * Math.sin(Math.PI / n)) > 1e-9) bad++;
            const a0 = Math.atan2(p.y - f.center.y, p.x - f.center.x);
            const a1 = Math.atan2(q.y - f.center.y, q.x - f.center.x);
            const step = ((a1 - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            // Screen y points down, so the corners are ordered clockwise:
            // the step may appear as 2pi/N or as its complement.
            if (Math.abs(step - 2 * Math.PI / n) > 1e-9 &&
                Math.abs(step - (2 * Math.PI - 2 * Math.PI / n)) > 1e-9) bad++;
          }
        }
      }
    }
  }
  check(`the regular N-gon invariant holds at all ${sides} sides of ${frames} frames`, bad === 0, `${bad} failures`);
}

{
  // The applet's shrink is exactly linear in the frame number. For N=4 its
  // step equals speed=12, which is the page's S = S0 - Vt with V=12.
  let bad = 0, n4exact = 0, frames = 0;
  for (let n = 3; n <= 20; n++) {
    const state = C.start({ n });
    const f = C.factors(n);
    for (let i = 0; i < 100; i++) {
      const a = C.frameAt(state, i), b = C.frameAt(state, i + 1);
      if (a.side < 0 || b.side < 0) break;
      frames++;
      if (Math.abs(a.side - b.side - f.shrinkPerFrame) > 1e-9) bad++;
      if (n === 4 && Math.abs(f.shrinkPerFrame - C.speedForN(4)) < 1e-12) n4exact++;
    }
  }
  check(`side shrinks by the same fixed amount in all ${frames} frame pairs`, bad === 0, `${bad} failures`);
  check("for N=4 the shrink per frame is the applet's speed 12", n4exact > 0);
  check("the page's linear side claim is S0 minus V times t",
    Math.abs((C.geometry(C.start()).side - C.frameAt(C.start(), 2).side) - 2 * C.speedForN(4)) < 1e-9);
  check("for other N the animation step uses 1+cos(2pi/N), a display speed, not the page's V",
    Math.abs(C.factors(3).shrinkPerFrame - 25 * (1 + Math.cos(2 * Math.PI / 3))) < 1e-12 &&
    Math.abs(C.factors(3).shrinkPerFrame - 25 * (1 - Math.cos(2 * Math.PI / 3))) > 1);
}

{
  // The traced path of each turtle is a logarithmic spiral: r = exp(A/k),
  // where A is the applet's turn and k its fixed log coefficient. The page
  // says the real pursuit spiral also satisfies r = c*e^(k*theta) and that
  // the turn speeds up near the centre; both are checked here.
  let spiralBad = 0, paceBad = 0, physicalOnlyAt4 = 0, faster = 0, turns = 0;
  for (let n = 3; n <= 20; n++) {
    const state = C.start({ n });
    const k = C.factors(n).turnPerLog;
    const physical = C.physicalTurnPerLog(n);
    // sin(gamma)*(1-cos(gamma)) = cot(alpha) * sin^2(2*pi/N).
    const expectedRatio = Math.sin(2 * Math.PI / n) ** 2;
    if (Math.abs(k / physical - expectedRatio) < 1e-12) physicalOnlyAt4++;
    if (n === 4) check("at N=4 the applet's spiral has the physical pitch cot(pi/4)=1", Math.abs(k - physical) < 1e-12);
    let prevChange = 0, first = true;
    for (let i = 0; i < 1000; i++) {
      const f = C.frameAt(state, i);
      if (f.side < 0 || f.over) break;
      if (Math.abs(f.ratio - Math.exp(f.angle / k)) > 1e-10) spiralBad++;
      if (i > 0) {
        const prev = C.frameAt(state, i - 1);
        const change = Math.abs(f.angle - prev.angle);
        if (!first) {
          if (change > prevChange) faster++; else paceBad++;
          turns++;
        }
        prevChange = change;
        first = false;
      }
    }
  }
  check("every traced point lies on a logarithmic spiral r = exp(A/k)", spiralBad === 0,
    `${spiralBad} failures`);
  check("the angular change grows on every later frame (the turn speeds up)", paceBad === 0 && faster === turns,
    `${faster}/${turns}, ${paceBad} failures`);
  check("the applet's pitch equals the physical cot(alpha) times sin^2(2*pi/N) for every N",
    physicalOnlyAt4 === 18, `${physicalOnlyAt4}/18`);
}

{
  // The page: to the rotating observer the original polygon turns the other
  // way, while the shrinking polygon keeps its rays fixed. run() negates A
  // for the reference square and uses angle 0 for the shrinking one.
  let opposite = 0, radial = 0, expectedRays = 0, checked = 0;
  for (let n = 3; n <= 20; n++) {
    const s = C.setOptions(C.start(), { n, movingFrame: true });
    for (let i = 1; i < 10; i++) {
      const f = C.frameAt(s, i);
      if (f.over) break;
      checked++;
      expectedRays += n;
      if (f.angle > 0 && C.frameAt(C.start({ n }), i).angle === -f.angle) opposite++;
      for (let k = 0; k < n; k++) {
        const p = f.squares[1].points[k];
        const corner = f.corners[k];
        const cross = (corner.x - f.center.x) * (p.y - f.center.y) -
                      (corner.y - f.center.y) * (p.x - f.center.x);
        if (Math.abs(cross) < 1e-8) radial++;
      }
    }
  }
  check("the rotating frame reverses the sign of every turn", opposite === checked,
    `${opposite}/${checked}`);
  check("every rotating-frame turtle stays on its original radial line", radial === expectedRays && radial > 0,
    `${radial}/${expectedRays} rays`);
  equal("stationary and rotating frames use opposite angles",
    [C.frameAt(C.start({ n: 5 }), 3).angle < 0, C.frameAt(C.start({ n: 5, movingFrame: true }), 3).angle > 0],
    [true, true]);
}

/* -------------------------------- 4. options, trace and saved position */

{
  // Start() clears Trace; each painted frame adds one clone; Stop() keeps it;
  // a new N calls Reset() and clears it again.
  let s = C.start({ n: 4 });
  check("a fresh applet has an empty trace", s.trace.length === 0);
  s = C.begin(s);
  check("Start sets Running and leaves Trace empty", s.running && s.trace.length === 0);
  s = C.advance(s, 5);
  equal("five frames leave five trace polygons", s.trace.length, 5);
  equal("each trace polygon has N vertices", s.trace[4].length, 4);
  check("the trace records the same side as frame 4",
    Math.abs(Math.hypot(s.trace[4][0].x - s.trace[4][1].x,
      s.trace[4][0].y - s.trace[4][1].y) - C.geometry(s).side * C.frameAt(s, 4).ratio) < 1e-9);
  s = C.stop(s);
  check("Stop clears Running but keeps the drawing", !s.running && s.frame === 5 && s.trace.length === 5);
  const stopped = C.advance(s, 5);
  equal("a stopped applet does not advance", stopped.frame, 5);
  s = C.setOptions(s, { n: 7 });
  check("changing N resets the frame, trace and running flag",
    s.n === 7 && s.frame === 0 && s.trace.length === 0 && !s.running);

  // Run to the end for every N: the last frame is at side <= 0 and Running
  // is false; the animation never paints a negative side.
  for (let n = 3; n <= 20; n++) {
    let t = C.begin(C.start({ n }));
    for (let i = 0; i < 500 && t.running; i++) t = C.advance(t);
    const last = C.frameAt(t, t.frame);
    check(`N=${n} finishes with side <= 0 and Running false`,
      !t.running && last.side <= 0 && C.finished(t), `side ${last.side}, frame ${t.frame}`);
    check(`N=${n} painted no frame with a negative side`,
      t.trace.every((_, i) => C.frameAt(t, i).side > 0));
  }
}

{
  // itemStateChanged(): the style radio group gives Curve/Whirl/Both, and
  // the three style checkboxes only matter when TraceIt is on.
  const s = C.start();
  equal("default style", [s.curve, s.whirl, s.both], [false, true, false]);
  equal("spirals sets only Curve", [C.setStyle(s, "spirals").curve, C.setStyle(s, "spirals").whirl,
    C.setStyle(s, "spirals").both], [true, false, false]);
  equal("both sets Curve and Whirl", [C.setStyle(s, "both").curve, C.setStyle(s, "both").whirl,
    C.setStyle(s, "both").both], [true, true, true]);
  equal("whirl sets only Whirl", [C.setStyle(s, "whirl").curve, C.setStyle(s, "whirl").whirl,
    C.setStyle(s, "whirl").both], [false, true, false]);

  // Track.state(): plain data, in board units, with the answer too.
  const p = C.position(C.advance(C.begin(C.start({ n: 6 })), 3));
  equal("the saved position is plain data", JSON.parse(JSON.stringify(p)), p);
  equal("the saved centre is the applet's centre", p.center, { x: 300, y: 275 });
  equal("the saved radius follows Reset()", p.radius, bytecodeReset(6, 600, 550).radius);
  equal("the saved initial side follows Reset()", p.sideAtStart, bytecodeReset(6, 600, 550).side);
  equal("the saved style is the selected Whirl", p.style, "whirl");
  equal("the saved trace length", p.traceLength, 3);
  check("the saved side matches the current frame", Math.abs(p.side - C.frameAt(C.start({ n: 6 }), 3).side) < 1e-12);
}

done("four-turtles");
