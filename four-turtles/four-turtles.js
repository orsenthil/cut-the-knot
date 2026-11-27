"use strict";

/*
 * Four Turtles — the page: drawing and input only.
 *
 * All the numbers (the regular polygon, the shrinking/turning frames, the
 * trace and the page's formulas) come from four-turtles-core.js. This script
 * paints them with the shared Geom SVG helpers: the fixed square, the moving
 * turtle dots, the two trace styles, and a dial that sets the applet's N
 * option (3..20) by pointer or arrow keys. The applet had a number field for
 * N; the dial is another way to set that same option, not a new rule.
 */

(() => {
  const C = FourTurtlesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const runBtn = document.getElementById("runBtn");
  const fixedBtn = document.getElementById("fixedBtn");
  const rotatingBtn = document.getElementById("rotatingBtn");
  const traceBtn = document.getElementById("traceBtn");
  const styleBtns = {
    spirals: document.getElementById("spiralsBtn"),
    whirl: document.getElementById("whirlBtn"),
    both: document.getElementById("bothBtn"),
  };
  const nInput = document.getElementById("nInput");
  const nDown = document.getElementById("nDown");
  const nUp = document.getElementById("nUp");
  const resetBtn = document.getElementById("resetBtn");

  const baseLayer = board.layer("base");
  const traceLayer = board.layer("trace");
  const movingLayer = board.layer("moving");
  const dialLayer = board.layer("dial");
  const handleLayer = board.layer("handles");

  const startState = C.start();
  const origin = C.geometry(startState);
  const dialCenter = origin.center;
  const dialRadius = origin.radius + 17;
  const SLOTS = C.N_LIMIT.max - C.N_LIMIT.min + 1;
  const SLOT_ANGLE = 2 * Math.PI / SLOTS;

  const dialPoint = (n) => ({
    x: dialCenter.x + dialRadius * Math.cos(-Math.PI / 2 + (n - C.N_LIMIT.min) * SLOT_ANGLE),
    y: dialCenter.y + dialRadius * Math.sin(-Math.PI / 2 + (n - C.N_LIMIT.min) * SLOT_ANGLE),
  });
  const nFromPoint = (p) => {
    const a = Math.atan2(p.y - dialCenter.y, p.x - dialCenter.x);
    const slot = ((Math.round((a + Math.PI / 2) / SLOT_ANGLE) % SLOTS) + SLOTS) % SLOTS;
    return C.N_LIMIT.min + slot;
  };
  const snapDial = (p) => dialPoint(nFromPoint(p));

  // Small ticks for every N the applet's number field accepts.
  const ticks = [];
  for (let n = C.N_LIMIT.min; n <= C.N_LIMIT.max; n++) {
    ticks.push({ n, shape: board.point(dialPoint(n), "dial-tick", n % 5 === 0 ? 3.5 : 2.5, dialLayer) });
  }
  board.label({ x: dialCenter.x, y: 16 }, "3", "dial-label", 0, 0, dialLayer);
  board.label({ x: dialCenter.x, y: dialCenter.y + dialRadius + 15 }, "20", "dial-label", 0, 0, dialLayer);

  const baseSquare = board.polygon(origin.corners, "base-square", baseLayer);
  const whiskerPath = board.el("path", null, "trace-spiral", traceLayer);
  const whirlPath = board.el("path", null, "trace-whirl", traceLayer);

  const squares = [];
  const dots = [];
  const frameDots = (n) => {
    while (dots.length < n * 2) dots.push(board.point(dialCenter, "turtle-dot", 5, movingLayer));
    while (squares.length < 2) squares.push(board.polygon(origin.corners, "moving-square", movingLayer));
  };

  let state = startState;
  let seen = { stationary: false, rotating: false };
  let timer = 0;

  /** The status line. "done" tells the record that both frames were explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function styleName() {
    return state.both ? "both" : state.curve ? "spirals" : state.whirl ? "whirl" : "none";
  }

  function synchroniseControls() {
    runBtn.textContent = state.running ? "Stop" : "Let them go";
    runBtn.setAttribute("aria-label", state.running ? "Stop the turtles" : "Start the turtles moving");
    fixedBtn.setAttribute("aria-pressed", String(!state.movingFrame));
    rotatingBtn.setAttribute("aria-pressed", String(state.movingFrame));
    traceBtn.setAttribute("aria-pressed", String(state.traceIt));
    for (const [name, btn] of Object.entries(styleBtns)) {
      btn.setAttribute("aria-pressed", String(styleName() === name));
      btn.disabled = !state.traceIt || state.running;
    }
    for (const btn of [fixedBtn, rotatingBtn, traceBtn, nDown, nUp]) btn.disabled = state.running;
    nInput.disabled = state.running;
    nInput.value = String(state.n);
    nInput.setAttribute("aria-label", `Number of turtles, ${C.N_LIMIT.min} to ${C.N_LIMIT.max}. Currently ${state.n}.`);
  }

  function drawTrace() {
    const on = state.traceIt;
    whiskerPath.style.display = on && (state.curve || state.both) ? "" : "none";
    whirlPath.style.display = on && (state.whirl || state.both) ? "" : "none";
    if (!on) return;
    const n = state.n;
    let spiral = "";
    for (let i = 0; i + 1 < state.trace.length; i++) {
      const a = state.trace[i], b = state.trace[i + 1];
      for (let k = 0; k < n; k++) {
        spiral += `M ${a[k].x} ${a[k].y} L ${b[k].x} ${b[k].y} `;
      }
    }
    whiskerPath.setAttribute("d", spiral);
    whirlPath.setAttribute("d", state.trace
      .map((poly) => `M ${poly.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`).join(" "));
  }

  function drawMoving(frame) {
    frameDots(state.n);
    squares.forEach((sq, i) => sq.show(i < frame.squares.length));
    dots.forEach((dot, i) => dot.show(false));
    let dotIndex = 0;
    frame.squares.forEach((sq, i) => {
      squares[i].set(sq.points);
      squares[i].node.setAttribute("class", sq.dots ? "moving-square" : "reference-square");
      if (sq.dots) {
        for (const p of sq.points) dots[dotIndex++].set(p).show(true);
      }
    });
  }

  function render() {
    const g = C.geometry(state);
    const frame = C.frameAt(state);
    baseSquare.set(g.corners);
    drawTrace();
    drawMoving(frame);
    dial.set(dialPoint(state.n));
    for (const tick of ticks) {
      tick.shape.node.setAttribute("class", tick.n === state.n ? "dial-tick chosen" : "dial-tick");
    }

    const doneBoth = seen.stationary && seen.rotating;
    const ticksTaken = state.frame;
    if (doneBoth) {
      say("You have watched the turtles meet in both frames. The square shrinks and turns; from the centre they seem to come straight at you.", "done");
    } else if (state.running) {
      say(`${state.movingFrame ? "Rotating" : "Stationary"} frame, ${state.n} turtles, tick ${ticksTaken}: side ${frame.side.toFixed(1)}, turned ${(frame.angle * 180 / Math.PI).toFixed(1)}°.`);
    } else if (ticksTaken > 0 && frame.side <= 0) {
      say(`They met at the centre after ${ticksTaken} ticks. Try ${state.movingFrame ? "stationary" : "rotating"} to see the same chase from the other frame.`);
    } else {
      say(`Ready: ${state.n} turtles at the corners of a regular ${state.n}-gon. Press Let them go, then watch the side shrink.`);
    }
    if (window.Track) window.Track.state(C.position(state));
  }

  function tick() {
    if (!state.running) return;
    state = C.advance(state, 1);
    if (C.finished(state)) {
      seen[state.movingFrame ? "rotating" : "stationary"] = true;
      synchroniseControls(); // the applet's Stop re-enables every control
    }
    render();
    if (state.running) timer = setTimeout(tick, C.PERIOD);
  }

  function toggleRun() {
    clearTimeout(timer);
    state = C.setOptions(state, { running: !state.running });
    if (state.running) state = C.begin(state);
    synchroniseControls();
    if (state.running) tick(); else render();
  }

  function setN(n) {
    state = C.setOptions(state, { n });
    synchroniseControls();
    render();
  }

  function setFrame(movingFrame) {
    state = C.setOptions(state, { movingFrame });
    synchroniseControls();
    render();
  }

  function setTrace(traceIt) {
    state = C.setOptions(state, { traceIt });
    synchroniseControls();
    render();
  }

  function reset() {
    clearTimeout(timer);
    state = C.start();
    seen = { stationary: false, rotating: false };
    synchroniseControls();
    render();
  }

  const dial = board.handle("N", dialPoint(state.n), {
    r: 12, step: 100, shift: 300, layer: handleLayer,
    label: "Choose the number of turtles: drag this dial, or focus it and use the arrow keys.",
    describe: (p) => `N = ${nFromPoint(p)} turtles`,
    clamp: snapDial,
    onMove: (p) => setN(nFromPoint(p)),
  });

  runBtn.addEventListener("click", toggleRun);
  fixedBtn.addEventListener("click", () => setFrame(false));
  rotatingBtn.addEventListener("click", () => setFrame(true));
  traceBtn.addEventListener("click", () => setTrace(!state.traceIt));
  for (const [name, btn] of Object.entries(styleBtns)) {
    btn.addEventListener("click", () => { state = C.setStyle(state, name); synchroniseControls(); render(); });
  }
  nInput.addEventListener("change", () => setN(C.clampN(nInput.value)));
  nDown.addEventListener("click", () => setN(C.clampN(state.n - 1)));
  nUp.addEventListener("click", () => setN(C.clampN(state.n + 1)));
  resetBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement ||
        e.target === dial.node) return;
    if (e.key === "s" || e.key === "S") toggleRun();
    if (e.key === "r" || e.key === "R") reset();
  });

  board.onTheme(render);
  synchroniseControls();
  render();
})();
