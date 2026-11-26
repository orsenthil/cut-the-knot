"use strict";

/*
 * Ratchet Effect, from Alexander Bogomolny's applet Ratchet.
 *
 * Two identical staircases slide down a steep slope. The plain one (T) moves
 * down at a steady pace. The flashing one (S) moves down at the same pace,
 * but on top of that it climbs one whole step while sliding half a tread
 * sideways, then drops back, every 12 frames. A ball rides on them: S carries
 * it while S climbs and hands it to T at the top of the climb; T carries it
 * while S drops back, and S takes it again. Each round the ball gains one
 * step on T, which only falls 0.8 of a step: two downward motions together
 * lift the ball. That is the ratchet behind Parrondo's paradox.
 *
 * Everything below is transcribed from the applet's classes Staircase and
 * MovingStaircase (coordinates in canvas pixels, y pointing down). The ball
 * is not a free body: it is drawn in the notch at a staircase's origin O, so
 * handing it over means moving the receiving staircase's origin by whole
 * steps to the step nearest the ball (AttachCircle).
 *
 * This file is the game's logic and nothing else. It defines one global,
 * RatchetCore. The position is plain data; tick() returns a new one.
 */
const RatchetCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 280;
  const SLOPE = { x: 10, y: 30 };   // Staircase(canvas, 10, 30, centre)
  const SLENGTH = 100;               // length of one step along the slope
  const SWIDTH = 40;                 // depth of a tread
  const BAND = 50;                   // horizontal width of the band behind the teeth
  const STEPS = 30;                  // SetStep(30): frames to slide one step
  const RATCHET_STEPS = 12;          // SetRatchetStep(12): frames per half cycle
  const MODES = ["regular", "flashing", "both"];
  const DELAY = { fast: 10, slow: 100 };

  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const mul = (k, a) => ({ x: k * a.x, y: k * a.y });

  /** Staircase: D, the vector of one step down the slope. */
  function stepVector() {
    const len = Math.sqrt(SLOPE.x * SLOPE.x + SLOPE.y * SLOPE.y);
    return { x: SLOPE.x * SLENGTH / len, y: SLOPE.y * SLENGTH / len };
  }

  /** The tread: perpendicular to D, SWIDTH long (the applet's (D.y, -D.x) scaled). */
  function tread(D) {
    const len = Math.sqrt(D.y * D.y + D.x * D.x);
    return { x: D.y * SWIDTH / len, y: -D.x * SWIDTH / len };
  }

  /** java.awt.Rectangle(0, 0, w, h).contains(round(x), round(y)). */
  function inside(p, w, h) {
    const x = Math.round(p.x), y = Math.round(p.y);
    return x >= 0 && y >= 0 && x < w && y < h;
  }

  function newStair(w, h) {
    const D = stepVector();
    return {
      O: { x: Math.trunc(w / 2), y: Math.trunc(h / 2) },
      D,
      step: { x: D.x / STEPS, y: D.y / STEPS },
      rstep: false,
      ratchet: { x: 0, y: 0 },
      numSteps: STEPS,
      stepNum: 0,
      drawBall: true,
      visible: true,
      C: null,
    };
  }

  /** MovingStaircase.SetRatchetStep(n). */
  function setRatchetStep(st, n) {
    const t = tread(st.D);
    st.numSteps = n;
    st.rstep = true;
    st.ratchet = { x: (-st.D.x + t.x / 2) / n, y: (-st.D.y + t.y / 2) / n };
  }

  /** Staircase.SetCircle: the ball in the notch at O, touching tread and riser. */
  function circleAt(st) {
    const t = tread(st.D);
    const p9 = add(st.O, mul(1.5, t));
    const p10 = add(st.O, mul(1.5, sub(t, st.D)));
    const a = Math.hypot(p9.x - p10.x, p9.y - p10.y);   // opposite O
    const b = Math.hypot(p10.x - st.O.x, p10.y - st.O.y); // opposite p9
    const c = Math.hypot(st.O.x - p9.x, st.O.y - p9.y);   // opposite p10
    const s = a + b + c;
    const I = {
      x: (a * st.O.x + b * p9.x + c * p10.x) / s,
      y: (a * st.O.y + b * p9.y + c * p10.y) / s,
    };
    const dist = (P, Q) => {
      const dx = Q.x - P.x, dy = Q.y - P.y;
      return Math.abs(dx * (P.y - I.y) - dy * (P.x - I.x)) / Math.hypot(dx, dy);
    };
    const r = (dist(p9, p10) + dist(p10, st.O) + dist(st.O, p9)) / 3;
    return { x: I.x, y: I.y, r };
  }

  /** MovingStaircase.NearestToCircle: O moved by whole steps to the ball. */
  function nearestToCircle(st) {
    const D = st.D;
    const k = Math.round((D.x * (st.O.x - st.C.x) + D.y * (st.O.y - st.C.y)) / (D.x * D.x + D.y * D.y));
    return { x: st.O.x - k * D.x, y: st.O.y - k * D.y };
  }

  /** RegularMove: slide down; past the edge, jump back to the top-most step. */
  function regularMove(st, w, h) {
    st.O = add(st.O, st.step);
    if (!inside(st.O, w, h)) {
      st.O = sub(st.O, st.D);
      while (inside(st.O, w, h)) st.O = sub(st.O, st.D);
      st.O = add(st.O, st.D);
    }
    return 2;
  }

  /** RatchetMove: slide plus the climb or the drop; returns 0 give, 1 take, 2 keep. */
  function ratchetMove(st, w, h) {
    st.O = add(st.O, add(st.step, st.ratchet));
    if (!inside(st.O, w, h)) {
      if (st.O.y > 0) {
        st.O = sub(st.O, st.D);
        while (inside(st.O, w, h)) st.O = sub(st.O, st.D);
        st.O = add(st.O, st.D);
      } else {
        st.O = add(st.O, st.D);
        while (inside(st.O, w, h)) st.O = add(st.O, st.D);
        st.O = sub(st.O, st.D);
      }
    }
    st.stepNum = (st.stepNum + 1) % st.numSteps;
    if (st.stepNum === 0) st.ratchet = { x: -st.ratchet.x, y: -st.ratchet.y };
    if (st.stepNum === 0 && st.drawBall) return 0;
    if (st.stepNum === 0 && !st.drawBall) return 1;
    return 2;
  }

  function move(st, w, h) {
    return st.rstep ? ratchetMove(st, w, h) : regularMove(st, w, h);
  }

  function detach(st) {
    st.drawBall = false;
    return st.C;
  }

  function attach(st, C) {
    st.C = C;
    st.drawBall = true;
    st.O = nearestToCircle(st);
  }

  /** RatchetCanvas.Show(mode). */
  function show(state, mode) {
    state.mode = mode;
    if (mode === "regular") {
      state.T.drawBall = true; state.T.visible = true; state.S.visible = false;
    } else if (mode === "flashing") {
      state.S.drawBall = true; state.S.visible = true; state.T.visible = false;
    } else {
      state.S.drawBall = true; state.S.visible = true; state.T.visible = true;
    }
  }

  /** RatchetCanvas.Reset, then Show(mode): both staircases back at the centre. */
  function start(options = {}) {
    const w = options.width || WIDTH;
    const h = options.height || HEIGHT;
    const mode = MODES.includes(options.mode) ? options.mode : "both";
    const S = newStair(w, h);
    const T = newStair(w, h);
    setRatchetStep(S, RATCHET_STEPS);
    T.drawBall = false;
    const state = { width: w, height: h, mode: "both", frame: 0, S, T };
    show(state, "both");
    show(state, mode);
    // Draw() computes each ball once before the first frame.
    S.C = circleAt(S);
    T.C = circleAt(T);
    return state;
  }

  const clone = (state) => JSON.parse(JSON.stringify(state));

  /**
   * One paint() of the running applet: the moves of that frame, in the
   * applet's order, with each staircase's ball recomputed when it is drawn.
   */
  function tick(prev) {
    const s = clone(prev);
    const { S, T, width: w, height: h } = s;
    if (s.mode === "both") {
      const r = move(S, w, h);
      if (r === 0) { attach(T, detach(S)); S.O = nearestToCircle(S); }
      else if (r === 1) attach(S, detach(T));
      S.C = circleAt(S);
      T.C = circleAt(T);
      move(T, w, h);
    } else if (s.mode === "regular") {
      T.C = circleAt(T);
      move(T, w, h);
    } else {
      S.C = circleAt(S);
      move(S, w, h);
    }
    s.frame += 1;
    return s;
  }

  /** Who holds the ball that is drawn: "S", "T" or null. */
  function holder(state) {
    if (state.mode === "regular") return "T";
    if (state.mode === "flashing") return "S";
    return state.S.drawBall ? "S" : "T";
  }

  /** The ball as drawn now: centre and radius, from the holder's origin. */
  function ball(state) {
    const who = holder(state);
    return circleAt(state[who]);
  }

  /** Staircase.Draw: the outline of a staircase, clipped to the canvas as the applet does. */
  function polygon(st, w, h) {
    const t = tread(st.D);
    let top = { ...st.O };
    while (inside(top, w, h)) top = sub(top, st.D);
    let bottom = { ...st.O };
    while (inside(bottom, w, h)) bottom = add(bottom, st.D);
    const pts = [{ x: top.x - BAND, y: top.y }, { ...top }, add(top, t)];
    let p = add(top, st.D);
    while (inside(p, w, h)) {
      pts.push({ ...p }, add(p, t));
      p = add(p, st.D);
    }
    pts.push({ ...bottom }, { x: bottom.x - BAND, y: bottom.y });
    return pts;
  }

  return {
    WIDTH, HEIGHT, MODES, DELAY, STEPS, RATCHET_STEPS,
    stepVector, tread, start, tick, holder, ball, polygon, circleAt,
  };
})();
