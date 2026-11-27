"use strict";

/*
 * The page for Dyno Ellipse: drawing and input only; the geometry is in
 * dyno-ellipse-core.js. The 400 by 300 SVG holds the two guide circles, the
 * traced curve, the two rotating arms, the grey lines that complete the sum,
 * and a focusable pen on the sum point. Go runs three steps a frame (the
 * applet's thread slept 5 ms); the four sliders keep the applet's ranges and
 * Reset restores its four starting numbers. The pen can be dragged along the
 * curve or moved through time with the arrow keys while keeping focus.
 */

(() => {
  const C = DynoEllipseCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const inputs = {
    rate1: document.getElementById("rate1"),
    rate2: document.getElementById("rate2"),
    r1: document.getElementById("r1"),
    r2: document.getElementById("r2"),
  };
  const outputs = {
    rate1: document.getElementById("rate1Out"),
    rate2: document.getElementById("rate2Out"),
    r1: document.getElementById("r1Out"),
    r2: document.getElementById("r2Out"),
  };
  const circlesBox = document.getElementById("circlesBox");
  const barsBox = document.getElementById("barsBox");
  const goBtn = document.getElementById("goBtn");
  const resetBtn = document.getElementById("resetBtn");

  const STEPS_PER_FRAME = 3;
  let state = C.start();
  let raf = null;
  let nearest = state.n;

  /** Write the line under the picture. "done" is the demo's only possible end. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers in paint order: guides, the trail, the arms, labels, the pen. */
  const guides = board.layer("guides");
  const trail = board.layer("trail");
  const arms = board.layer("arms");
  const labels = board.layer("labels");
  const tops = board.layer("handles");

  const circle1 = board.circle(C.CENTER, state.r1, "guide guide-1", guides);
  const circle2 = board.circle(C.CENTER, state.r2, "guide guide-2", guides);
  const curve = board.el("polyline", { points: "" }, "curve", trail);
  const bar1 = board.segment(C.CENTER, C.CENTER, "arm arm-1", arms);
  const bar2 = board.segment(C.CENTER, C.CENTER, "arm arm-2", arms);
  const join1 = board.segment(C.CENTER, C.CENTER, "join", arms);
  const join2 = board.segment(C.CENTER, C.CENTER, "join", arms);
  const tip1 = board.point(C.CENTER, "tip tip-1", 5, arms);
  const tip2 = board.point(C.CENTER, "tip tip-2", 5, arms);
  const centre = board.point(C.CENTER, "centre", 3, labels);
  const centreLabel = board.label(C.CENTER, "centre", "pt-label", 8, -8, labels);

  const pen = board.handle("pen", { x: C.CENTER.x + state.r1 + state.r2, y: C.CENTER.y }, {
    r: 8, layer: tops,
    label: "Tracing pen. Drag it along the curve, or focus it and press the arrow keys to move through time.",
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: (q) => {
      nearest = C.nearestStep(state, q, 0, state.n);
      return C.frame(state, nearest).sum;
    },
    onMove: () => {
      pause();
      state = C.setN(state, nearest);
      render();
    },
  });

  function render() {
    const f = C.frame(state);
    circle1.set(C.CENTER, state.r1).show(state.showCircles);
    circle2.set(C.CENTER, state.r2).show(state.showCircles);
    const points = C.trace(state, 0, state.n);
    curve.setAttribute("points", points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" "));
    bar1.set(C.CENTER, f.end1).show(state.showBars);
    bar2.set(C.CENTER, f.end2).show(state.showBars);
    join1.set(f.end1, f.sum).show(state.showBars);
    join2.set(f.end2, f.sum).show(state.showBars);
    tip1.set(f.end1).show(state.showBars);
    tip2.set(f.end2).show(state.showBars);
    centre.set(C.CENTER);
    centreLabel.set(C.CENTER, "centre");
    pen.set(f.sum);

    for (const name of Object.keys(inputs)) {
      inputs[name].value = String(state[name]);
      outputs[name].textContent = String(state[name]);
    }
    circlesBox.checked = state.showCircles;
    barsBox.checked = state.showBars;
    goBtn.textContent = state.running ? "Stop" : "Go";
    goBtn.setAttribute("aria-pressed", String(state.running));
    goBtn.setAttribute("aria-label", state.running ? "Stop the arms" : "Start the arms");
    resetBtn.disabled = state.n === 0 && !state.explored;

    say(C.status(state, f), C.result(state));
    // The position, for the player's record and the tutor (board units).
    if (window.Track) {
      window.Track.state({ ...state, pen: f.sum, end1: f.end1, end2: f.end2 });
    }
  }

  function pause() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    state = C.setRunning(state, false);
  }

  function tick() {
    if (!state.running) { raf = null; return; }
    state = C.step(state, STEPS_PER_FRAME);
    render();
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (state.running) return;
    state = C.setRunning(state, true);
    raf = requestAnimationFrame(tick);
    render();
    say("The arms are turning; the pen follows their sum.", C.result(state));
  }

  function stop() {
    if (!state.running) return;
    pause();
    render();
    say("Stopped. The pen stays where it was.", C.result(state));
  }

  for (const name of Object.keys(inputs)) {
    inputs[name].addEventListener("input", () => {
      // The applet's ProcessNumberChange calls Reset on all four number fields.
      state = C.setOption(state, name, inputs[name].value);
      nearest = state.n;
      render();
    });
  }
  circlesBox.addEventListener("change", () => {
    state = C.setShow(state, "showCircles", circlesBox.checked);
    render();
  });
  barsBox.addEventListener("change", () => {
    state = C.setShow(state, "showBars", barsBox.checked);
    render();
  });
  goBtn.addEventListener("click", () => (state.running ? stop() : start()));
  resetBtn.addEventListener("click", () => {
    pause();
    state = C.start();
    nearest = 0;
    render();
    say("Back to the applet's starting numbers. Press Go to watch the arms.", null);
  });

  /* Arrow keys move through time rather than nudging the pen off the curve.
     Capture keeps Geom's own arrow handler from running first; the handle's
     node is never replaced, so focus survives the computer's reply. */
  pen.node.addEventListener("keydown", (e) => {
    let n = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") n = state.n + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") n = Math.max(0, state.n - 1);
    else if (e.key === "PageUp") n = state.n + 25;
    else if (e.key === "PageDown") n = Math.max(0, state.n - 25);
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = state.n + C.PERIOD;
    if (n === null) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    pause();
    state = C.setN(state, n);
    nearest = state.n;
    render();
    pen.node.focus();
  }, true);

  document.addEventListener("visibilitychange", () => { if (document.hidden && state.running) stop(); });
  board.onTheme(render);
  render();
})();
