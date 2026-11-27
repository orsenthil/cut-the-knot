"use strict";

/*
 * Four Turtles — the pursuit picture as plain data, from Alexander Bogomolny's
 * FourTurtles applet. No DOM, no window, no storage: one global, so a plain
 * <script> loads it in the page and porting/check-four-turtles.mjs loads it
 * in Node.
 *
 * The applet starts N turtles at the corners of a regular N-gon (N = 3..20,
 * default 4) and, every 50 ms, draws a smaller, turned copy of that polygon.
 * Reset() fixes the centre, circumradius R = trunc((min(w,h) - 40)/2) and
 * side S = 2R sin(pi/N). run() shrinks the side linearly by
 *   speed(N) * (1 - cos(gamma)) per frame, gamma = pi*(N-2)/N,
 * and turns each frame by
 *   angle = sin(gamma) * (1 - cos(gamma)) * log(current side / S).
 * In the rotating frame (MovingFrame) it also draws the original polygon
 * turned by -angle at full size: that is the "original appears to turn the
 * other way" the page mentions, while the shrinking polygon keeps its rays.
 *
 * Trace holds a clone of the shrinking polygon at each frame; the applet's
 * Spirals / Whirl / Both checkboxes join those clones into paths or draw the
 * whole stack ("whirl pattern"). This file exports those numbers; the page
 * only turns them into SVG.
 */

const FourTurtlesCore = (() => {
  /* FourTurtles.init(): the APPLET on the page is WIDTH=600 HEIGHT=550. */
  const CANVAS = Object.freeze({ width: 600, height: 550 });
  const MARGIN = 20;                 // Reset()'s local d
  const PERIOD = 50;                 // run(): Thread.sleep(50L)
  /* Panel: PVNumeric.setMinValue(3), setMaxValue(20), setLong(4), delta 1. */
  const N_LIMIT = Object.freeze({ min: 3, max: 20, initial: 4 });

  const trunc = Math.trunc;          // Java integer division / int cast
  const round = (v) => Math.floor(v + 0.5); // Java Math.round(double)

  /** PVNumeric's integer editor: min/max, then a whole step; bad input -> 4. */
  function clampN(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return N_LIMIT.initial;
    return Math.max(N_LIMIT.min, Math.min(N_LIMIT.max, round(n)));
  }

  /** run()'s frame-count table, straight from its seven if_icmpge branches. */
  function speedForN(n) {
    if (n < 4) return 25;
    if (n < 5) return 12;
    if (n < 7) return 5;
    if (n < 10) return 3;
    if (n < 13) return 1;
    if (n < 15) return 0.75;
    return 0.5;
  }

  /** Reset(): centre, circumradius, side and the N starting corners. */
  function geometry(state) {
    const n = state.n;
    const width = state.width, height = state.height;
    const center = { x: trunc(width / 2), y: trunc(height / 2) };
    const radius = trunc((Math.min(width, height) - 2 * MARGIN) / 2);
    const side = 2 * radius * Math.sin(Math.PI / n);
    const corners = [];
    for (let k = 0; k < n; k++) {
      const phi = (2 * Math.PI / n) * k + Math.PI / n;
      corners.push({
        x: center.x + radius * Math.cos(phi),
        y: center.y - radius * Math.sin(phi),
      });
    }
    return { center, radius, side, corners };
  }

  /** The constants run() computes once before its loop. */
  function factors(n) {
    const gamma = Math.PI * (n - 2) / n;
    const factor = 1 - Math.cos(gamma);
    return {
      speed: speedForN(n),
      gamma,
      factor,
      sinGamma: Math.sin(gamma),
      turnPerLog: Math.sin(gamma) * factor,
      shrinkPerFrame: speedForN(n) * factor,
    };
  }

  /** Transform.Apply(): rotate by `angle` and scale by `scale` about `center`. */
  function transform(p, angle, scale, center) {
    const dx = p.x - center.x, dy = p.y - center.y;
    const cos = scale * Math.cos(angle), sin = scale * Math.sin(angle);
    return {
      x: cos * dx - sin * dy + center.x,
      y: sin * dx + cos * dy + center.y,
    };
  }

  const transformAll = (corners, angle, scale, center) =>
    corners.map((p) => transform(p, angle, scale, center));

  /** New applet: stationary frame, Trace off, Whirl selected, N = 4. */
  function start(options) {
    const s = {
      n: N_LIMIT.initial,
      movingFrame: false,    // Fixed ("stationary") checkbox starts selected
      traceIt: false,        // Trace checkbox
      curve: false,          // Spirals
      whirl: true,           // Whirl is the selected style in the group
      both: false,           // Both
      running: false,        // Animate button reads " Let them go"
      frame: 0,              // run()'s loop counter i
      trace: [],             // Vector<MovingSquare>
      width: CANVAS.width,
      height: CANVAS.height,
    };
    return setOptions(s, options);
  }

  /**
   * A new position with fields replaced. Changing N is actionPerformed()'s
   * NEdit branch: N = getLong(), then Reset() clears Trace and Moving and
   * rebuilds the polygon. The applet disables N and the checkboxes while it
   * is running, so the page does too.
   */
  function setOptions(state, options) {
    const s = Object.assign({}, state);
    if (!options) return s;
    if ("n" in options) {
      const n = clampN(options.n);
      if (n !== s.n) { s.n = n; s.frame = 0; s.trace = []; s.running = false; }
    }
    if ("width" in options) s.width = Number.isFinite(Number(options.width)) ? Math.max(1, trunc(Number(options.width))) : CANVAS.width;
    if ("height" in options) s.height = Number.isFinite(Number(options.height)) ? Math.max(1, trunc(Number(options.height))) : CANVAS.height;
    if ("movingFrame" in options) s.movingFrame = Boolean(options.movingFrame);
    if ("traceIt" in options) s.traceIt = Boolean(options.traceIt);
    if ("curve" in options) s.curve = Boolean(options.curve);
    if ("whirl" in options) s.whirl = Boolean(options.whirl);
    if ("both" in options) s.both = Boolean(options.both);
    if ("running" in options) s.running = Boolean(options.running);
    return s;
  }

  /** itemStateChanged(): Both turns on both Curve and Whirl at once. */
  function setStyle(state, style) {
    return setOptions(state, {
      curve: style === "spirals" || style === "both",
      whirl: style === "whirl" || style === "both",
      both: style === "both",
    });
  }

  /** Start(): Running = true, Trace.clear(), then the thread begins at i = 0. */
  function begin(state) {
    return Object.assign({}, state, { running: true, frame: 0, trace: [] });
  }

  /** Stop(): Running = false; the applet restores the button's label too. */
  function stop(state) {
    return Object.assign({}, state, { running: false });
  }

  /**
   * One frame of run(), as visible data. side <= 0 is the applet's Stop:
   * for side < 0 it stops before drawing; for side == 0 it draws and then
   * clears Moving, so nothing moving is visible either way.
   */
  function frameAt(state, index) {
    const i = index === undefined ? state.frame : index;
    const g = geometry(state);
    const f = factors(state.n);
    const side = g.side - f.shrinkPerFrame * i;
    const ratio = side / g.side;
    const over = side <= 0;
    // run() stores its turn in local A and negates it in the rotating frame.
    const sign = state.movingFrame ? -1 : 1;
    const angle = side > 0 ? sign * f.turnPerLog * Math.log(ratio) : (side === 0 ? -sign * Infinity : NaN);
    const squares = [];
    if (side > 0) {
      if (state.movingFrame) {
        squares.push({ points: transformAll(g.corners, angle, 1, g.center), dots: false });
        squares.push({ points: transformAll(g.corners, 0, ratio, g.center), dots: true });
      } else {
        squares.push({ points: transformAll(g.corners, angle, ratio, g.center), dots: true });
      }
    }
    return {
      index: i, side, ratio, angle, squares, over,
      center: g.center, corners: g.corners, radius: g.radius,
    };
  }

  /** The polygon run() adds to Trace at this frame (the shrinking one). */
  function tracedSquare(frame, movingFrame) {
    if (frame.over) return null;
    return movingFrame ? frame.squares[1] : frame.squares[0];
  }

  /**
   * Advance the animation by `frames` ticks. Each tick: compute side and
   * angle, add the clone to Trace, repaint, sleep 50 ms, i++, stop at side 0.
   */
  function advance(state, frames) {
    let s = state;
    const count = frames === undefined ? 1 : Math.max(0, trunc(frames));
    for (let t = 0; t < count && s.running; t++) {
      const frame = frameAt(s, s.frame);
      if (frame.side < 0) { s = stop(s); break; }
      const clone = tracedSquare(frame, s.movingFrame);
      const trace = clone ? s.trace.concat([clone.points.map((p) => ({ x: p.x, y: p.y }))]) : s.trace;
      s = Object.assign({}, s, { frame: s.frame + 1, trace });
      if (frame.side <= 0) s = stop(s);
    }
    return s;
  }

  /** End position: the last frame, whether or not a run has finished. */
  function finished(state) {
    // frame is the tick at which run() saw side <= 0; in the side < 0 case
    // that tick is never painted, but it is still where the applet stopped.
    return !state.running && state.frame > 0 && frameAt(state, state.frame).over;
  }

  /* --------------------------- the page's formulas, checked by the test ---- */

  /** D = VT = S/(1 - cos(2*pi/N)) with V = 1; T = D/V. */
  function pageDistance(side, n, speed) {
    const alpha = Math.PI / n;
    return side / (1 - Math.cos(2 * alpha));
  }
  function pageTime(side, n, speed) {
    const v = speed === undefined ? 1 : speed;
    return pageDistance(side, n) / v;
  }

  /** Physical pursuit: theta - theta0 = -cot(alpha) * log(r/r0). */
  function physicalTurnPerLog(n) {
    const alpha = Math.PI / n;
    return Math.cos(alpha) / Math.sin(alpha);
  }

  /** Plain data for the player's record and the tutor. */
  function position(state) {
    const g = geometry(state);
    const frame = frameAt(state);
    return {
      n: state.n,
      frame: state.frame,
      running: state.running,
      movingFrame: state.movingFrame,
      traceIt: state.traceIt,
      style: state.both ? "both" : state.curve ? "spirals" : state.whirl ? "whirl" : "none",
      side: frame.side,
      ratio: frame.ratio,
      angle: frame.angle,
      center: g.center,
      radius: g.radius,
      sideAtStart: g.side,
      traceLength: state.trace.length,
      done: finished(state),
    };
  }

  return {
    CANVAS, MARGIN, PERIOD, N_LIMIT,
    clampN, speedForN, geometry, factors, transform, transformAll,
    start, setOptions, setStyle, begin, stop, frameAt, tracedSquare, advance, finished,
    pageDistance, pageTime, physicalTurnPerLog, position,
  };
})();
